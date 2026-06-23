# Hardware Driver Separation Plan — Per-Device-Family Decomposition

> **STATUS: DRAFT v2 — AI-generated (code-grounded), pending human review. Implementation NOT started.**
> v2 drafted 2026-06-21 by Claude via Hermes `ask_claude_code` on CT 212 (plan mode, reading the actual
> repo — citations are real `file:line`). Supersedes the local-`qwen2.5:14b` v1 (which produced the
> concise grounded skeleton). Covers device **FAMILY + MODEL/FIRMWARE** separation.
> **Tracking todo:** c81fc929-9abe-473b-88e1-fbc9f8f8d2af.

## Summary

The hardware **control packages** in this monorepo are already cleanly separated by device family (`packages/atlas`, `packages/firecube`, `packages/directv`, `packages/wolfpack`, `packages/crestron`, `packages/bss-blu`, `packages/dbx-zonepro`, `packages/ir-control`, `packages/multiview`, `packages/shure-slxd`, `packages/dmx`, `packages/htd`). The real obstacle to debugging one device type in isolation is the **cross-cutting layers** that are still family-blind: a single mixed `input_sources` table, a single `[COMPONENT]`-tagged log stream, an ad-hoc health monitor that only covers Fire TV and hard-codes a `/atmosphere|epson|projector/i` exclusion regex, and no per-family diagnostic surface. A second, harder dimension runs underneath all of this: nearly every real bug in this codebase is **model/firmware-specific** (Fire TV Cube `AFTR`/PVFTV hosting Prime Video in `com.amazon.firebat`; Atlas firmware 4.5 "Custom Priority Volume"; Shure SLX-D 1.4.7.0 `TX_MODEL`/`GROUP_CHANNEL` wire-names; Wolf Pack single-card vs multi-card `outputOffset`), yet the data model captures model/firmware inconsistently and the drivers branch on these quirks with scattered hardcoded `if`s. This plan adds a thin, uniform per-family **driver + health + quirk** contract over the existing packages (no rewrites), captures **model + firmware per device** in the data model, gives the projector a real home, and adds per-family scoped logging and diagnostics — while keeping the `distribution-engine` `matrix_input_id → channelNumber` resolution working byte-for-byte.

## Current Problems

- **`input_sources` is a mixed bag.** `packages/database/src/schema.ts:1500` defines one table holding cable / directv / firetv / stream rows discriminated only by a `type` string column, with `device_id` pointing into whichever of `CableBox` / `DirecTVDevice` / `FireTVDevice` happens to match. There is no family-scoped way to read "just the Fire TV inputs and their device rows."
- **Dual `matrix_input_id` lineage.** `input_sources.matrix_input_id` (`schema.ts:1510`, declared `text`) means two different things at different sites: a **UUID FK to `MatrixInput.id`** at some locations and the **`channelNumber` string** ("1".."10") at others (`distribution-engine.ts:81-119` documents and works around exactly this). A naive join "silently resolves NOTHING" at channel-number sites, no-oping the learned-preference bias.
- **Model/firmware capture is inconsistent.** `FireTVDevice` has `deviceModel`, `model`, `softwareVersion`, `serialNumber` (`schema.ts:30-33`) — but `DirecTVDevice` has only `receiverType` (no firmware), `CableBox` has `provider`+`model` (no firmware, `schema.ts:670-671`), `AudioProcessor` has `model`+`processorType` but **no firmware column** (`schema.ts:332-334`) even though Atlas firmware 4.5 and Shure SLX-D firmware 1.4.7.0 are the exact axes the quirks turn on. `MatrixConfiguration` carries `model` + `outputOffset` but the single-card/multi-card distinction is an operator-maintained CLAUDE.md table, not data.
- **Quirks are hardcoded family-wide, not keyed by model/firmware.** Prime-Video-on-`firebat`, `TX_MODEL` vs `TX_TYPE`, `outputOffset`, and Atlas custom-priority-volume are all branch logic buried in package code, not a queryable per-model registry.
- **The projector has no device table.** It exists only as a `FireTVDevice` row with `deviceType='Epson Projector'` / `model='HA90'` (`schema.ts:24,33`) and surfaces only in health monitoring. `packages/scheduler/src/device-health.ts:9` carries the hack `const EXPECTED_POWERED_DOWN = /atmosphere|epson|projector/i` to stop the health monitor from excluding it — a string-regex stand-in for a missing data model.
- **Logging is one undifferentiated stream.** `packages/logger/src/index.ts` provides `[COMPONENT]` tags (`[CEC]`, `[IR]`, `[MATRIX]`, `[WOLFPACK]`) by convention only; there is no per-family channel or file, so you cannot `tail` one device family in isolation. `enhanced-logger.ts` has a richer `DeviceType` union (`'wolf_pack' | 'directv' | 'ir_device' | 'tv' | 'audio_system' | 'network'`) and `logHardwareOperation()` that persist to the DB — but it is underused and the two loggers are not bridged.
- **Health/diagnostics are Fire-TV-only and ad hoc.** `device-health.ts` explicitly scopes itself "v1 scope is **Fire TV only**" (line 23) and fails open. There is no uniform health contract the other families implement, and no per-family diagnostics view.

---

## 1. DATA MODEL (deep)

### 1.1 Decomposing `input_sources`: per-family TABLES vs per-family VIEWS

`input_sources` has exactly one hot, correctness-critical consumer that must not regress: the distribution engine's preference resolver (`distribution-engine.ts:88-119`) and, downstream of it, the `AvailableInput.inputNumber` tie-breaker. Any decomposition is judged by whether that path survives unchanged.

#### Option A — Per-family physical tables (replace `input_sources`)

Split into `cable_input_sources`, `directv_input_sources`, `firetv_input_sources`, `stream_input_sources`, each holding only the columns that family needs (drop `current_app` from cable, drop `current_channel` from streaming, etc.), and expose a backward-compat `input_sources` **UNION ALL view** so existing readers keep working.

- **Resolution impact:** the engine query `SELECT id, matrix_input_id FROM input_sources WHERE matrix_input_id IS NOT NULL` (`distribution-engine.ts:89-92`) now hits the compat view. The view must surface `id`, `type`, `device_id`, `matrix_input_id` identically. The `MatrixInput` join (`miRows`, `channelById`, `validChannels` at lines 93-105) and the dual-lineage branch (lines 108-118) are **unchanged** because they operate on the engine's in-memory maps, not on physical storage. The `AvailableInput.inputNumber` tie-breaker (lines 130-134, 484-485, 692-693) consumes `inputSourceIdToChannel`, which is built the same way.
- **Cost:** every writer (`/api/input-sources/*`, seeders) must be rewritten to target the right physical table, and the UNION view is read-only — writes through it are not portable across SQLite. High blast radius for a "debug-isolation" goal.

#### Option B — Keep `input_sources`, add per-family VIEWS (RECOMMENDED)

Keep `input_sources` as the single canonical **write** table (zero writer changes, FK integrity intact) and add thin per-family **read** views that filter by `type` and join the family device table, e.g.:

```sql
CREATE VIEW v_firetv_input_sources AS
SELECT i.*,                          -- everything the engine sees, unchanged
       f.deviceModel, f.model AS hw_model, f.softwareVersion, f.serialNumber,
       f.isOnline AS device_online, f.deviceType
FROM input_sources i
JOIN FireTVDevice f ON i.device_id = f.id
WHERE i.type = 'firetv';

CREATE VIEW v_cable_input_sources AS
SELECT i.*, c.provider, c.model AS hw_model, c.lastChannel
FROM input_sources i JOIN CableBox c ON i.device_id = c.id
WHERE i.type = 'cable';
-- v_directv_input_sources, v_stream_input_sources analogous
```

- **Resolution impact: none.** The engine continues to `SELECT ... FROM input_sources` (`distribution-engine.ts:89`). The views are additive and consumed only by the new diagnostic surface (§4) and the family drivers (§2). The `matrix_input_id → channelNumber` map and the `inputNumber` tie-breaker are physically untouched.
- **Benefit for the stated goal:** a developer debugging Fire TV reads exactly one view that already joins device model/firmware, without filtering a 4-type table by hand.

**Recommendation: Option B.** It delivers the isolation benefit at near-zero risk to the resolution path, and is reversible (drop the views). Option A is reserved for a much later, separately-justified normalization pass if `input_sources` column sprawl becomes painful.

### 1.2 Collapsing the dual `matrix_input_id` lineage to ONE

Pick **UUID FK to `MatrixInput.id`** as the single canonical form. Rationale:

1. **Disambiguation.** A bare `channelNumber` string ("1") is only unique *within* a `MatrixConfiguration` — `MatrixInput` enforces uniqueness on `(configId, channelNumber)` (`schema.ts:286`), not on `channelNumber` alone. A site with more than one config (or a future multi-chassis site) makes the string ambiguous; the UUID never is.
2. **Referential integrity + cascade.** A real FK to `MatrixInput.id` lets the input row participate in `onDelete` semantics; the string lineage silently dangles when an input is renumbered or recreated.
3. **The engine already does the join.** The `channelById` path (`distribution-engine.ts:103,112-113`) is the FK lineage and is the one that *works*. Standardizing on it lets us **delete** the fragile direct-number branch (lines 114-116) after backfill, simplifying the hottest correctness path rather than adding to it.

**Why not the channelNumber string** (the seductive alternative): it needs no join and matches `AvailableInput.inputNumber` directly — but it sacrifices uniqueness and integrity, and it is the lineage the code calls "UNRELIABLE." We keep the *resolution target* as `channelNumber` (what `AvailableInput` carries), but the *stored key* becomes the FK.

**Backfill shape** (run once, idempotent, per location):

```sql
-- For rows currently holding a channelNumber string, replace with the FK UUID.
UPDATE input_sources
SET matrix_input_id = (
  SELECT mi.id FROM MatrixInput mi
  JOIN MatrixConfiguration mc ON mi.configId = mc.id AND mc.isActive = 1
  WHERE CAST(mi.channelNumber AS TEXT) = input_sources.matrix_input_id
)
WHERE matrix_input_id IS NOT NULL AND matrix_input_id != ''
  AND matrix_input_id NOT IN (SELECT id FROM MatrixInput)        -- only the string lineage
  AND EXISTS (SELECT 1 FROM MatrixInput mi2
              WHERE CAST(mi2.channelNumber AS TEXT) = input_sources.matrix_input_id);
```

After backfill is verified across the fleet, the engine's dual branch collapses to the single FK join. **Until then**, the existing dual-tolerant resolver in `distribution-engine.ts:108-118` stays exactly as-is (it already handles both), so the compat window is free.

### 1.3 The model/firmware dimension in the data model

Make **model + firmware first-class on every family device table**, because the hardest bugs key off them:

| Table | Has model? | Add for firmware/quirk keying |
|---|---|---|
| `FireTVDevice` | `deviceModel`, `model`, `softwareVersion` ✓ | already sufficient (`AFTR` + `PVFTV-215.5200` live here) |
| `DirecTVDevice` | `receiverType` only | add `firmwareVersion`, `firmwareObservedAt` |
| `CableBox` | `model`, `provider` | add `firmwareVersion` (nullable; IR-blind boxes may stay null) |
| `IRDevice` | `brand`, `model` | none (IR is open-loop/blind; model is enough for code-set selection) |
| `AudioProcessor` | `model`, `processorType` | **add `firmwareVersion`, `firmwareObservedAt`** — Atlas 4.5 + Shure 1.4.7.0 quirks live here |
| `MatrixConfiguration` | `model`, `outputOffset` | add `cardLayout` enum `'single' \| 'multi'` to replace the CLAUDE.md/`MATRIX_SINGLE_CARD` env convention with data |

`firmwareObservedAt` records when the driver last read firmware off the wire, so diagnostics can flag "config says 4.5, device now reports 4.6." This is the column the quirk registry (§2.3) queries to choose a handler. New columns are nullable + additive (one Drizzle migration via `npx drizzle-kit generate`, per Gotcha #6 — never `db:push`).

### 1.4 Giving the projector a home

Create a dedicated **`projectors`** table and stop overloading `FireTVDevice`:

```ts
export const projectors = sqliteTable('Projector', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  brand: text('brand').notNull().default('Epson'),
  model: text('model'),                       // e.g. 'HA90' (today's FireTVDevice.model)
  firmwareVersion: text('firmwareVersion'),
  ipAddress: text('ipAddress'),
  protocol: text('protocol').notNull().default('pjlink'),  // pjlink | esc-vp21
  matrixOutputId: text('matrixOutputId'),     // a projector is a DISPLAY (output), not an input
  powerState: text('powerState').notNull().default('unknown'),
  lampHours: integer('lampHours'),
  offlineWhenPoweredDown: integer('offlineWhenPoweredDown', { mode: 'boolean' })
    .notNull().default(true),                  // replaces the regex hack as DATA
  isOnline: integer('isOnline', { mode: 'boolean' }).notNull().default(false),
  lastSeen: timestamp('lastSeen'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})
```

Key correction the table encodes: **a projector is a display fed by a matrix output, not an `input_sources` row.** It links to `MatrixOutput`, not `MatrixInput`. Once projectors live here with `offlineWhenPoweredDown=true` as a column, the `EXPECTED_POWERED_DOWN = /atmosphere|epson|projector/i` regex in `device-health.ts:9` is deleted; the health contract (§2) reads the boolean. (The Atmosphere TV at `.48`, also caught by that regex, is genuinely a `FireTVDevice`-class display — it gets the same `offlineWhenPoweredDown` flag on its row rather than a name match.)

---

## 2. DRIVER / SERVICE INTERFACE (deep)

### 2.1 The uniform contract

Define one small interface in a new cross-cutting package `@sports-bar/device-registry` (no hardware code; just types + the registry):

```ts
export interface DeviceDescriptor {
  family: string                 // 'firetv' | 'directv' | 'cable' | 'wolfpack' | 'atlas' | 'shure' | 'projector' | 'ir' | 'dmx' | 'htd' | ...
  deviceId: string
  model: string | null           // 'AFTR', 'AZMP8', 'SLXD4D', 'WP-36X36', 'HA90'
  firmwareVersion: string | null // 'PVFTV-215.5200', '4.5', '1.4.7.0'
}

export interface HealthStatus {
  reachable: boolean
  lastSeen: number | null
  descriptor: DeviceDescriptor
  expectedOfflineWhenPoweredDown: boolean   // projector/Atmosphere semantics, as data
  quirksApplied: string[]                   // ids of quirk handlers that fired (see §2.3)
  raw?: unknown                             // family-specific payload for the diagnostics drawer
}

export interface DeviceFamilyDriver {
  readonly family: string
  list(): Promise<DeviceDescriptor[]>
  describe(deviceId: string): Promise<DeviceDescriptor>
  health(deviceId: string): Promise<HealthStatus>
}
```

`describe()` is the single chokepoint that surfaces model+firmware to *everything else* — diagnostics, quirk lookup, scoped logging tags.

### 2.2 Adoption WITHOUT rewriting the packages — thin adapters

The control packages stay exactly as they are. Each family ships a **thin adapter** that implements `DeviceFamilyDriver` by delegating to what already exists:

- **Fire TV:** adapter wraps `apps/web/src/lib/device-db.ts` loaders (`loadFireTVDevices`, `getFireTVDeviceById`) for `list`/`describe` (model/firmware come straight from `deviceModel`/`softwareVersion`), and the existing `firetv-connection-manager` / `adb-client` for `health`. No package rewrite.
- **Atlas:** adapter delegates `health()` to the existing `atlasClientManager.getAtlasClient(...)` singleton; `describe()` reads `AudioProcessor.model` + the new `firmwareVersion`.
- **Shure:** adapter delegates to `shureSlxdClientManager.getSnapshots()`.
- **Wolf Pack / DirecTV / Cable / IR / DMX / HTD:** adapters wrap their existing managers/loaders; families with no live reachability probe (cable, IR) report `reachable` from their operator-set `isOnline` column and flag it `raw.monitored=false`, mirroring the honest caveat already written in `device-health.ts:23-25`.

Adapters are ~40 lines each and additive. Nothing in `packages/atlas`, `packages/firecube`, etc. changes signature.

### 2.3 Per-model / per-firmware quirk handlers (the second dimension)

Replace scattered hardcoded family-wide branches with a **quirk registry** keyed by `(family, modelMatcher, firmwareMatcher)`:

```ts
interface Quirk {
  id: string                                   // 'firetv.prime-on-firebat'
  family: string
  matches(d: DeviceDescriptor): boolean        // model/firmware predicate
  // family-specific payload the driver applies
}
```

The driver's `describe()` result is run through `quirkRegistry.resolve(descriptor)` to get the active quirk set; `health().quirksApplied` records which fired. Concrete migrations of quirks that exist today:

| Existing hardcoded behavior | Becomes quirk keyed on |
|---|---|
| Prime Video hosted in `com.amazon.firebat` (not `com.amazon.avod`) on AFTR/PVFTV builds | `family=firetv`, `model=~/AFTR/` **or** `firmware=~/PVFTV/` → use `firebat` packageAlias |
| Atlas firmware 4.5 "Custom Priority Volume" looking like a drop | `family=atlas`, `firmware>=4.5` → drop-watcher checks priority-volume before flagging |
| Shure SLX-D wire-names `TX_MODEL`/`GROUP_CHANNEL` vs legacy `TX_TYPE`/`GROUP_CHAN` | `family=shure`, `firmware>=1.4.7.0` → parser case-statement variant |
| Wolf Pack single-card `outputOffset` must be 0 | `family=wolfpack`, `cardLayout=single` (now a column) → enforce offset 0 |

This turns "which firmware am I on and what changes because of it?" from tribal knowledge in CLAUDE.md gotchas into a queryable, testable registry — and the diagnostics view (§4) can render `quirksApplied` per device.

### 2.4 Respecting the Next.js per-bundle-singleton gotcha

The `deviceDriverRegistry` and `quirkRegistry` are cross-route managers, so they hit Gotcha #10: a `private static` in an App Router route bundle is per-bundle, not per-process. Hoist both to `globalThis` via the process-wide symbol registry, exactly like `atlasClientManager`/`shureSlxdClientManager`:

```ts
export function getDeviceDriverRegistry(): DeviceDriverRegistry {
  const KEY = Symbol.for('@sports-bar/device-registry.drivers')
  const g = globalThis as any
  if (!g[KEY]) g[KEY] = new DeviceDriverRegistry()
  return g[KEY]
}
```

The registries hold no sockets themselves (the family managers do), so there is no `SO_REUSEPORT`-style duplication risk — but the singleton must still be process-wide so every route sees the same registered adapter set and the same in-flight-promise locks the adapters already rely on.

---

## 3. SCOPED LOGGING

Build **on top of** the existing `[COMPONENT]` tag mechanism (`packages/logger/src/index.ts`) rather than replacing it.

Add a `logger.forFamily(family, descriptor?)` factory that returns a child logger which:

1. **Prefixes a family tag and a model tag.** A Fire TV line becomes `[FIRETV][AFTR/PVFTV-215.5200] ...` (the model tag is taken from `DeviceDescriptor`). This preserves every existing `[COMPONENT]` grep while adding model-grain filtering: `grep '\[FIRETV\]\[AFTR'`.
2. **Mirrors to a per-family file**, reusing the daily-rotation pattern already proven by the Shure RF log (`/home/ubuntu/sports-bar-data/logs/shure-rf-YYYY-MM-DD.log`): write to `/home/ubuntu/sports-bar-data/logs/family-<family>-YYYY-MM-DD.log` (30-day retention). Now one family is tailable in isolation:
   ```bash
   tail -f /home/ubuntu/sports-bar-data/logs/family-firetv-*.log
   # or, in the unified PM2 stream:
   pm2 logs sports-bar-tv-controller | grep '\[FIRETV\]'
   ```
3. **Bridges to `enhanced-logger`.** The child logger also calls `enhancedLogger.logHardwareOperation(deviceType, deviceId, ...)` (`enhanced-logger.ts:209`), populating the DB-backed `deviceType` / `deviceId` / `component` / `tags` fields so System Admin analytics can slice by family without parsing text. The `DeviceType` union there is widened to match the family set (`firetv`, `cable`, `projector`, `shure`, `atlas`, `dmx`, `htd`, …).

No call site is forced to migrate: `logger.info('[CEC] ...')` keeps working; families opt in by switching to `const log = logger.forFamily('firetv', descriptor)`. The file sink is gated by an env (`FAMILY_LOG_FILES=1`) so low-RAM boxes (e.g. Graystone) can leave it off.

---

## 4. DIAGNOSTIC SURFACE

One **per-family diagnostics view**, parameterized by family, built from the pieces above:

- **Route:** `GET /api/diagnostics/[family]` (rate-limited, validated). For the family it returns, per device: the `DeviceDescriptor` (model + firmware), the latest `HealthStatus` (`reachable`, `lastSeen`, `quirksApplied`, `expectedOfflineWhenPoweredDown`), the family's `input_sources`/output mapping via the §1.1 view (including the **resolved `channelNumber`** so an engineer can confirm the `matrix_input_id → channelNumber` resolution for that device), and the last N lines of the per-family log file (§3).
- **Page:** `/diagnostics/[family]` (e.g. `/diagnostics/firetv`), wrapped in `<SafeBoundary label="diagnostics-firetv">` so a render crash in one family's panel doesn't escalate to the global error page.
- **Model/firmware filtering (the second dimension):** query params `?model=AFTR&firmware=PVFTV-215*` filter the device list, so you can inspect "only the AFTR cubes on the PVFTV build" — the exact slice where the `firebat` quirk applies. The view renders `quirksApplied` as chips per device, so firmware-specific behavior is visible at a glance instead of inferred from CLAUDE.md.
- **Reuse:** the route calls `getDeviceDriverRegistry().get(family)` for descriptors/health, `enhancedLogger` analytics for error rates per device, and the per-family SQL view for the input/channel mapping. No new data path; it's a read-only aggregation of §1–§3.

The projector gets `/diagnostics/projector` for free once it has a table and an adapter — the first time the projector is debuggable in isolation instead of hiding inside the Fire TV health monitor.

---

## 5. STAGED MIGRATION

Do **one family at a time**, with `npm run build` + PM2 restart + a live Playwright check between stages, software-to-`main`-first then merge to location branches.

### First family: **Fire TV** (reasoning grounded in the code)

1. **Lowest data-model lift:** `FireTVDevice` already has `deviceModel`, `model`, `softwareVersion`, `serialNumber` (`schema.ts:30-33`) — the model/firmware dimension needs *zero* new columns to prove the pattern.
2. **Richest quirk surface:** the AFTR/PVFTV `firebat` quirk is the canonical model+firmware case; it exercises the quirk registry end-to-end.
3. **Pays down the projector hack in the same pass:** the projector currently *is* a `FireTVDevice` row, and the `EXPECTED_POWERED_DOWN` regex lives in `device-health.ts` (the Fire TV health monitor). Extracting `projectors` (§1.4) and replacing the regex with the `offlineWhenPoweredDown` column is naturally part of cleaning the Fire TV family.
4. **Clean wrap points already exist:** `device-db.ts` loaders and `firetv-connection-manager` give the adapter (§2.2) something to delegate to without touching `packages/firecube`.

**Per-stage checklist (applies to every family after Fire TV — DirecTV, Cable, Wolf Pack, Atlas, Shure, IR, DMX, HTD):**

1. **Schema (additive only):** add the family's missing `firmwareVersion`/`model`/projector columns via `drizzle-kit generate` (review SQL, strip any proposed `DROP`s per Gotcha #6); never `db:push`.
2. **Backfill SQL shape** (idempotent; e.g. projector extraction):
   ```sql
   INSERT INTO Projector (id, name, brand, model, ipAddress, offlineWhenPoweredDown, isOnline, lastSeen, createdAt, updatedAt)
   SELECT id, name, 'Epson', model, ipAddress, 1, isOnline, lastSeen, createdAt, updatedAt
   FROM FireTVDevice
   WHERE deviceType IN ('Epson Projector') AND id NOT IN (SELECT id FROM Projector);
   ```
   (Atmosphere TV stays a `FireTVDevice` but gets `offlineWhenPoweredDown=1` set in the same migration so the `.48` device is excluded by data, not by name.)
3. **Add the per-family VIEW** (§1.1) + the **adapter** (§2.2) + register it in the `globalThis` registry.
4. **Dual-write / compat window:** for the projector move, **do not delete** the `FireTVDevice` projector rows yet — keep `device-health.ts` reading both the regex *and* the new `offlineWhenPoweredDown` column for one release, so a stale build that hasn't migrated still excludes correctly. The `input_sources` resolver keeps its dual-lineage branch (`distribution-engine.ts:108-118`) until §1.2 backfill is fleet-confirmed.
5. **Cut over:** point the new `/diagnostics/firetv` + family logger at the adapter; once verified live, remove the regex/dead lineage in a *separate* commit (Standing Rule 3 — never delete in the same pass as the move).
6. **Rollback:** every stage is one additive migration + one rollback tag (`rollback-YYYY-MM-DD-HH-MM`, per the auto-update mechanism). Reverting is: drop the new view, unregister the adapter, restore the regex read (still present during the compat window). Because writers never moved off `input_sources` and columns are additive-nullable, no data is lost on rollback.

After Fire TV proves the pattern, sequence the rest by quirk-pain: **Atlas/Shure next** (firmware-4.5 and 1.4.7.0 quirks are the highest-value registry entries and force the `AudioProcessor.firmwareVersion` column), then **Wolf Pack** (folds the `cardLayout`/`outputOffset` gotcha into data + a verify quirk), then the open-loop families (DirecTV, Cable, IR, DMX, HTD).

---

## Risks & Open Questions

- **`matrix_input_id` backfill at channel-number sites.** The §1.2 `UPDATE` assumes exactly one `isActive` `MatrixConfiguration`; a multi-config site would need `configId` disambiguation. Audit `SELECT COUNT(*) FROM MatrixConfiguration WHERE isActive=1` per location before running, and keep the dual-tolerant resolver until every box reports the FK form.
- **Read-vs-write asymmetry of views (Option B).** The per-family views are read-only; any future "write through the family view" expectation must be redirected to `input_sources`. Document this on each view.
- **Firmware capture cadence.** `firmwareVersion`/`firmwareObservedAt` are only as good as the last `describe()` probe. Open question: do we read firmware on every health tick (cost) or on a slower cadence? Proposal: refresh on connect + once/24h, mirroring the Shure/Atlas connect-time reads.
- **`enhanced-logger` `DeviceType` union widening.** Adding `projector`/`shure`/`atlas`/`dmx`/`htd` changes a persisted enum; confirm no analytics query hard-codes the old six values before widening.
- **Per-family log files on RAM-tight boxes.** Graystone (15 GB) may not want N daily log files plus the existing Shure/SDR logs; the `FAMILY_LOG_FILES` env gate covers this, but retention/rotation totals across all families should be budgeted (the Shure log is 30-day already).
- **Quirk registry authority.** Quirks must be unit-tested against real frame/version fixtures (the Shure mock-receiver pattern in `scripts/mock-shure-receiver.ts` is the model). Open question: where do quirk definitions live — in each control package (co-located with the protocol) or centrally in `device-registry`? Leaning co-located, registered at import, to keep protocol knowledge next to the wire code.
- **Atmosphere TV classification.** Confirm with the operator that `.48` should stay a `FireTVDevice` with `offlineWhenPoweredDown=1` rather than moving to a `displays` table alongside projectors; the memory notes it is Atmosphere TV (not a Fire Cube), so its long-term home may be the same as the projector's.
