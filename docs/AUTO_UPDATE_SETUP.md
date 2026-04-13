# Auto-Update Setup & State-Location Decision Record

## 1. Purpose

This document is two things in one: (a) the operator-facing setup guide for
the auto-update feature that lands in Phase 1 of the `AUTO_UPDATE_SYSTEM_PLAN`,
and (b) the design decision record for where auto-update state lives and why.
It exists so that any future operator or contributor can answer "where is the
last-run timestamp stored?" and "how do I disable auto-update?" without having
to read source code. The actual `auto-update.sh` script and the cron unit
that calls it are NOT in scope here — they ship in Phase 1 and Phase 2 of the
plan respectively. This doc covers only the infrastructure pieces that those
phases will depend on.

---

## 2. State location decision

The auto-updater needs to persist a small amount of state across runs:

- `enabled` (boolean) — operator kill switch
- `lastRunAt` (ISO timestamp) — when the last run started
- `lastResult` (`pass` | `fail` | `rolled_back`) — outcome of last run
- `lastCommitSha` (string) — the commit we updated to (or attempted to)
- `lastError` (string, nullable) — failure detail if applicable
- A small append-only history of every run (for the Sync tab UI)

Three options were considered.

### Option A — SQLite tables in `production.db`

Add two new tables: `auto_update_state` (single-row config) and
`auto_update_history` (append-only log).

**Pros:**
- The Sync tab UI is a Next.js page; it already has Drizzle ORM connected to
  `production.db`. Reading and writing state is a one-line query.
- The history table is naturally append-only and benefits from SQL (filtering,
  ordering, pagination for the UI).
- `production.db` is already backed up before every run by the auto-updater
  itself (Phase 2 of the plan). State is implicitly snapshotted.
- A single source of truth — no risk of DB-vs-file drift.
- Atomic writes via SQLite transactions — no half-written JSON file if the
  process is killed mid-write.

**Cons:**
- The auto-updater is a bash script run from cron. Writing to SQLite from
  bash means shelling out to `sqlite3 production.db "INSERT ..."`. That is
  fine but adds a hard dependency on `sqlite3` being installed (already true
  on every location ISO, so not a real concern).
- "What if auto-update corrupts the DB?" — this is the strongest objection.
  The mitigations: (1) we back up the DB *before* running, so a corruption
  is recoverable; (2) the writes are tiny INSERTs that almost never coincide
  with schema migrations; (3) if `production.db` is gone or unwritable, the
  app is already broken and auto-update is the least of our worries; (4) we
  can read state through Drizzle from the running app even while the cron
  script is running, because SQLite WAL mode handles concurrent readers.
- Can't read state when the app is fully down (e.g. mid-build) — but the
  cron script reads its own state directly via `sqlite3` CLI, and the UI
  reads via Drizzle when the app is up. The two access paths never need
  the other side to be alive.

### Option B — JSON file at `/home/ubuntu/sports-bar-data/auto-update-state.json`

A standalone JSON file outside the repo, alongside `production.db`.

**Pros:**
- No DB dependency. Bash can `jq` it directly (well, except we don't have
  `jq` installed on production — see verify-install.sh which had to use
  `node` instead).
- Persists across `git reset` operations.
- Trivially readable by both bash and the Next.js app.

**Cons:**
- The Sync tab UI would need a new API route that reads the JSON file from
  disk. Not hard, but it's a new file-IO code path that doesn't compose with
  the existing Drizzle patterns.
- No atomicity guarantee unless we write to a `.tmp` file and rename. Easy
  to get wrong.
- Append-only history would be a separate file or a growing array inside
  the JSON — both awkward.
- Not visible in DB backups. Operators backing up `production.db` would
  silently lose the state file.
- Two sources of truth (this file + production.db) is exactly the kind of
  drift we want to avoid.

### Option C — systemd environment file or `/etc/environment`

Store state as env vars exported to the auto-update unit.

**Pros:**
- Visible to systemd. `systemctl show` reveals state.
- Survives DB and repo wipes.

**Cons:**
- Env files are not designed for mutation. Updating means rewriting the file
  and reloading systemd. Race conditions galore.
- The Next.js app cannot read systemd state without shelling out — terrible
  UX in the Sync tab.
- No history support at all.
- Requires root to write `/etc/environment`. The auto-updater runs as
  `ubuntu`, not root. Hard pass.

### Decision: **Option A — SQLite tables in `production.db`**

Reason: the Sync tab UI is the primary consumer of this state, and the UI is
a Next.js page with Drizzle already wired up. Putting state anywhere else
means inventing a second access path for no benefit. The DB-corruption fear
is mitigated by the pre-update backup that the auto-updater already takes,
and the writes themselves are tiny single-row operations that do not coincide
with schema migrations.

### Proposed schema sketch

These tables will land in Phase 1 alongside `auto-update.sh`. They are
**not added in pre-work** — schema changes come with the consumer code.

```typescript
// apps/web/src/db/schema.ts (sketch — not yet implemented)

export const autoUpdateState = sqliteTable('auto_update_state', {
  id: integer('id').primaryKey().default(1),  // singleton row, always id=1
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  scheduleCron: text('schedule_cron').notNull().default('30 2 * * *'),
  lastRunAt: text('last_run_at'),              // ISO 8601
  lastResult: text('last_result'),             // 'pass' | 'fail' | 'rolled_back' | 'in_progress'
  lastCommitShaBefore: text('last_commit_sha_before'),
  lastCommitShaAfter: text('last_commit_sha_after'),
  lastError: text('last_error'),
  lastDurationSecs: integer('last_duration_secs'),
  updatedAt: text('updated_at').notNull(),     // ISO 8601, set on every write
})

export const autoUpdateHistory = sqliteTable('auto_update_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startedAt: text('started_at').notNull(),     // ISO 8601
  finishedAt: text('finished_at'),             // null while running
  result: text('result').notNull(),            // 'pass' | 'fail' | 'rolled_back' | 'in_progress'
  commitShaBefore: text('commit_sha_before').notNull(),
  commitShaAfter: text('commit_sha_after'),
  branch: text('branch').notNull(),
  durationSecs: integer('duration_secs'),
  verifyResultJson: text('verify_result_json'),  // JSON dump of verify-install.sh --json
  errorMessage: text('error_message'),
  triggeredBy: text('triggered_by').notNull(),   // 'cron' | 'manual_api' | 'manual_cli'
})
```

Both tables are created via `npm run db:push` at install time. The Sync tab
UI reads `auto_update_state` for the live status banner and joins with the
last 30 rows of `auto_update_history` for the history table.

The bash auto-updater will write to these tables via `sqlite3 production.db
"INSERT INTO auto_update_history ..."`. Writes happen at three checkpoints:
on start (insert `in_progress` row), on each phase boundary (update the row),
and on finish (update result + finishedAt + duration).

---

## 3. Configuration

These pieces must be in place before auto-update can run. As of this commit,
only the first two exist.

| Piece | Path | Status | Owned by |
|-------|------|--------|----------|
| Branch-aware update script | `update_from_github.sh` | DONE (Pre-work 1) | already shipped |
| Post-update verifier | `scripts/verify-install.sh` | DONE (Pre-work 2) | this commit |
| Auto-update orchestrator | `scripts/auto-update.sh` | TODO (Phase 1) | not started |
| State tables in DB | `auto_update_state`, `auto_update_history` | TODO (Phase 1) | not started |
| Cron unit | `/etc/cron.d/sports-bar-autoupdate` | TODO (Phase 2) | not started |
| API key in cron environment | `/etc/environment` ANTHROPIC_API_KEY | TODO (Pre-work 3) | manual ops |
| Sync tab UI | `apps/web/src/app/system-admin/...` | TODO (Phase 3a) | not started |

---

## 4. Claude Code CLI dependency

Auto-update requires the `claude` CLI to be installed, authenticated, and
reachable from the cron environment. Pre-work 3 of `AUTO_UPDATE_SYSTEM_PLAN`
covers the headless verification of this. Cron does NOT source `~/.bashrc`
or `~/.profile`, so an `ANTHROPIC_API_KEY` set in those files is invisible
to cron. The key MUST live in `/etc/environment` (system-wide, sourced by
PAM and inherited by cron) or in a systemd `EnvironmentFile=` directive if
the cron unit is replaced by a systemd timer. **If Pre-work 3 fails to
confirm Claude Code works from a minimal cron-like environment, the
auto-update feature cannot ship** — Claude Code is a required active monitor
per user direction, not a post-hoc bonus check. See §5 of
`AUTO_UPDATE_SYSTEM_PLAN.md` for the three checkpoints where Claude Code is
invoked during a run.

---

## 5. Operator runbook (skeleton)

Concrete commands land with Phase 2 (cron) and Phase 3a (UI). Skeleton only:

### Enable auto-update
- (Future) Sync tab → "Auto Update" panel → toggle "Enabled" → set time → Save.
- (Future) Cron entry is written to `/etc/cron.d/sports-bar-autoupdate` by
  the API route. Operator does NOT hand-edit cron.

### Disable auto-update
- (Future) Sync tab → toggle "Enabled" off. The cron entry stays in place
  but the script reads `auto_update_state.enabled` and exits early when
  disabled. This is intentional: it avoids needing root to remove cron lines.

### Force-run now
- (Future) Sync tab → "Run Update Now" button. POSTs to an API route which
  spawns `auto-update.sh` with `--triggered-by=manual_api`.
- Manual CLI: `bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/auto-update.sh --triggered-by=manual_cli`

### Check history
- (Future) Sync tab → "Update History" table, last 30 runs.
- SQL: `sqlite3 ~/sports-bar-data/production.db "SELECT * FROM auto_update_history ORDER BY started_at DESC LIMIT 10;"`

### Manual rollback
- The auto-updater rolls back automatically on verify failure. Manual
  rollback is only needed if the operator decides post-hoc that a passing
  update was actually bad. Use the rollback git tag the auto-updater creates
  before each run: `git checkout rollback-YYYY-MM-DD-HHMMSS && rm -rf
  apps/web/.next && npm run build && pm2 restart sports-bar-tv-controller`.

---

## 6. Testing the setup

Right now, with only Pre-work 1 and Pre-work 2 shipped, you can verify:

1. **Branch-aware update script syntax:** `bash -n update_from_github.sh`
2. **Verify script syntax:** `bash -n scripts/verify-install.sh`
3. **Verify script run against the live install:** `bash scripts/verify-install.sh`
   - Expect exit 0 and `[VERIFY] PASS (6/6 checks, Ns)`
4. **Verify script quiet mode:** `bash scripts/verify-install.sh --quiet`
   - Expect a single summary line on success, full failure detail on failure
5. **Verify script JSON mode:** `bash scripts/verify-install.sh --json`
   - Expect a single JSON object on stdout, parseable by `node -e
     'console.log(JSON.parse(require("fs").readFileSync(0,"utf8")))'`

Once Phase 1 lands you'll additionally test the orchestrator, the state
tables, and the cron entry. Until then, this doc is the design contract for
those phases to consume.
