# Matrix Input Switch Runbook

**Purpose:** Switch any TV between cable, DirecTV, Fire TV inputs reliably — covering Wolf Pack `outputOffset`, Crestron slot offsets, per-location quirks, and UI vs CLI paths.
**Audience:** operators, admins, Claude Code agents.
**Read time:** ~10 minutes.

## When to use this runbook

- A bartender asks "how do I put TV 7 on DirecTV box 3?"
- You're scripting routing changes (scheduler, DJ mode, auto-allocator) and the wrong TV is changing.
- A new card was added to a multi-card Wolf Pack chassis and routing now lands on wrong outputs.
- Crestron DM matrix is in play and outputs 1-8 mysteriously aren't working.
- An auto-update at a new location is failing `verify-install.sh` with an `outputOffset` error.

## Pre-flight checks

- [ ] You know the location and which matrix model it has (per `.claude/locations/<branch>.md`):
  - Holmgren Way → Wolf Pack 48-port, multi-card.
  - Graystone → Wolf Pack WP-36X36, multi-card (audio card at +32).
  - Stoneyard Greenville / Appleton → Wolf Pack, multi-card.
  - Lucky's 1313 → Wolf Pack WP-36X36, **single-card** (`outputOffset=0`).
  - Leg Lamp → Wolf Pack, **single-card** (`outputOffset=0`).
- [ ] You can reach the matrix on the LAN: `ping -c 2 <matrix_ip>`.
- [ ] You know the TV's output number (NOT the physical TV ID — the matrix output number it's wired to). Lookup:
  ```bash
  sqlite3 /home/ubuntu/sports-bar-data/production.db \
    "SELECT id, name, outputNumber FROM MatrixOutput ORDER BY outputNumber;"
  ```
- [ ] You know the source input number. Lookup:
  ```bash
  sqlite3 /home/ubuntu/sports-bar-data/production.db \
    "SELECT id, name, inputNumber, sourceType FROM MatrixInput ORDER BY inputNumber;"
  ```

## Architecture context

Two matrix vendors in the fleet:

**Wolf Pack** (HDTVSupply 4K60 series): RS-232 over IP, HTTP API, simple `SET OUT[n] IN[m]` command set. The CRITICAL gotcha: `MatrixConfiguration.outputOffset` is added to every output number before commands go to the chassis. Wrong offset = silent misrouting; the matrix returns success but lights up the wrong physical TV. Lucky's 1313 shipped with `outputOffset=26` for weeks in 2026 before being caught.

**Crestron** (DM/HD-MD/DMPS/NVX): Telnet (port 23 standard, 41795 CTP, 41794 CIP). Has a DIFFERENT offset gotcha: output slot numbers START at a chassis-dependent value, not at 1. Always add the slot offset before routing.

| Crestron chassis | Output slot starts at |
|---|---|
| DM 8x8 / 16x16 | 17 |
| DM 32x32 | 33 |
| DM 64x64 | 65 |

So "output 1" on a DM 16x16 is slot **17** on the wire. The `packages/crestron` client adds this offset automatically — but only if `chassisModel` is set correctly in the DB row.

## Step 1 — Verify the routing config is sane

For Wolf Pack:

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT id, name, model, ipAddress, outputOffset, audioOutputCount FROM MatrixConfiguration;"
```

**Expected per location:**

| Location | Layout | `outputOffset` | Note |
|---|---|---|---|
| Stoneyard Greenville (WP-36X36) | Multi-card | per card | check per-card mapping |
| Stoneyard Appleton (WP) | Multi-card | per card | check per-card mapping |
| Holmgren Way (WP 48-port) | Multi-card | per card | outputs 37-40 are audio-only |
| Graystone (WP-36X36) | Multi-card | `+32` for audio card | comment in `wolfpack-matrix-service.ts:275` |
| Lucky's 1313 (WP-36X36) | **Single-card** | **MUST be 0** | audio via dbx ZonePRO 1260m @ 192.168.10.50 |
| Leg Lamp (WP) | **Single-card** | **MUST be 0** | |

**Confirm a single-card location is correctly enforced:**
```bash
grep MATRIX_SINGLE_CARD /home/ubuntu/Sports-Bar-TV-Controller/.env
# Expected at Lucky's / Leg Lamp:
# MATRIX_SINGLE_CARD=true
```

If you're at a single-card location, MATRIX_SINGLE_CARD=true AND outputOffset MUST equal 0. The verify-install.sh script will fail and rollback if not.

For Crestron:

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT id, name, model, ipAddress, port, status FROM CrestronMatrix;"
```

Confirm the `model` field matches the actual chassis (so slot offset is correctly derived).

## Step 2 — UI path (preferred for one-off switches)

**Bartender remote** (port 3002) — for bar staff:
1. Open `http://<host>:3002/remote`.
2. Click **Video** tab.
3. Tap the TV (output) — the source picker opens.
4. Tap the desired source (Cable Box 1, DirecTV 3, Fire TV 2, etc.).
5. The change happens within ~500ms; the picker closes.

**Admin matrix UI** (port 3001) — for admins debugging or doing bulk changes:
1. Open `http://<host>:3001/matrix-control`.
2. The matrix grid shows current routes as a heatmap (input on rows, output on columns, lit cells = active route).
3. Click a cell to switch that output to that input.
4. Successful command flashes green; error flashes red with a toast.

## Step 3 — CLI path (preferred for scripts / debugging)

**Switch a Wolf Pack route:**
```bash
curl -X POST http://localhost:3001/api/matrix/route \
  -H 'Content-Type: application/json' \
  -d '{
    "outputNumber": 7,
    "inputNumber": 3,
    "source": "manual"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "outputNumber": 7,
    "appliedOutputNumber": 7,
    "inputNumber": 3,
    "matrixResponse": "OK"
  }
}
```

The `appliedOutputNumber` is `outputNumber + outputOffset`. On a single-card location it should equal `outputNumber`. On Graystone's audio card it will be `outputNumber + 32`.

**Confirm via current-channels endpoint:**
```bash
curl -s http://localhost:3001/api/matrix/current-channels | jq '.[] | select(.outputNumber==7)'
```

**Expected:**
```json
{
  "outputNumber": 7,
  "outputName": "TV 7",
  "inputNumber": 3,
  "inputName": "DirecTV 3",
  "sourceType": "directv",
  "currentChannel": "212",
  "currentProgram": "ESPN: Lakers @ Celtics"
}
```

## Step 4 — Source-type specific notes

### Cable Box (IR only)

Switching the input ROUTES the cable box's HDMI to the TV; it doesn't change the channel. To change the channel, after routing send IR commands via `/api/ir-devices/send-command` — see CLAUDE.md §5 (CEC dead, IR only).

### DirecTV (IP control)

Switching the input routes the DirecTV box's HDMI. Channel changes go via DirecTV HTTP API on port 8080:
```bash
curl -X POST http://localhost:3001/api/directv/tune \
  -H 'Content-Type: application/json' \
  -d '{"deviceId": "directv-3", "channel": "212"}'
```

The bartender remote's Guide tab combines routing + tuning in one click — that flow lives in `apps/web/src/app/api/schedules/bartender-schedule/route.ts`.

### Fire TV (ADB)

Switching the input routes the Fire TV's HDMI. To then launch a streaming app:
```bash
curl -X POST http://localhost:3001/api/streaming/launch \
  -H 'Content-Type: application/json' \
  -d '{"deviceId": "firetv-2", "appId": "espn"}'
```

If the launch fails for Prime Video specifically, see `FIRETV_OFFLINE_RECOVERY.md` Step 7 (launcher-hosted Prime Video gotcha).

## Step 5 — Wolf Pack `outputOffset` deep dive

**Why the offset exists:** the Wolf Pack chassis is internally addressed by SLOT, not by face-panel output number. Multi-card chassis have multiple HDMI output cards, each card occupying a contiguous slot range. The first card is slot 1-8, second card 9-16, etc. — but the LABELS on the front panel may show "Output 1" for each card. So a "card 2 output 1" labeled on the panel is actually slot 9 on the wire.

The `outputOffset` field captures "how many slots into the chassis is THIS card's output 1?" The runtime adds it to every output number before sending.

**Single-card chassis** = one card filling all outputs = offset MUST be 0. The output labeled "1" IS slot 1.

**Symptom of wrong offset:** routing API returns success, matrix accepts command, wrong physical TV changes (or NO TV changes if the offset points past the populated slots). Operators see "nothing happens when I switch."

**Diagnose a suspected misroute:**

```bash
# What's the configured offset?
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT name, model, outputOffset FROM MatrixConfiguration;"

# What did the matrix actually do?
pm2 logs sports-bar-tv-controller --lines 50 | grep -E 'MATRIX|wolfpack' | tail -20
```

Look for the `appliedOutputNumber` in the route log. If it's different from `outputNumber`, that's the offset being added. Cross-reference with the physical wiring to confirm correctness.

**Fix wrong offset:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE MatrixConfiguration SET outputOffset=0 WHERE id='matrix-1';"
pm2 restart sports-bar-tv-controller
```

Then test a known-safe route (e.g. output 1 → input 1) and walk the bar to verify the correct physical TV changed.

## Step 6 — Crestron slot offset deep dive

Unlike Wolf Pack, Crestron's offset is BAKED INTO THE PROTOCOL, not a per-location config. The chassis model determines the offset. Output slot numbers START at:

| Chassis | Output slot start |
|---|---|
| 8x8 / 16x16 | 17 |
| 32x32 | 33 |
| 64x64 | 65 |

So a routing command for "DM 16x16 output 1" must send slot `17` on the wire. The `@sports-bar/crestron` package handles this automatically based on the `model` field of the `CrestronMatrix` row.

**Symptom of wrong model in DB:** sending routes to a Crestron returns success but does nothing. Or, more confusingly, lights up an output offset by exactly the difference between configured-model and actual-model slot starts.

**Confirm model field:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT id, name, model FROM CrestronMatrix;"
```

If `model` is wrong, update it, restart PM2, and the routing will apply the correct slot offset on the next command.

Inputs do NOT have an offset — input 1 is wire slot 1.

## Per-location quirks (READ BEFORE FIRST SWITCH AT A LOCATION)

- **Holmgren Way:** Wolf Pack 48-port multi-card. Outputs **37-40 are audio-only** (no video display attached). Routing video to those outputs is harmless but pointless. The Atlas zones consume the audio.
- **Graystone:** Wolf Pack WP-36X36 multi-card. Audio output card needs `+32` offset (see `wolfpack-matrix-service.ts:275`).
- **Lucky's 1313:** Wolf Pack WP-36X36 single-card, **`outputOffset=0` enforced**. `audioOutputCount=0` because audio goes through dbx ZonePRO 1260m at `192.168.10.50`, NOT through the matrix audio outputs.
- **Leg Lamp:** Wolf Pack single-card, **`outputOffset=0` enforced**.
- **Stoneyard Greenville / Appleton:** Wolf Pack multi-card; per-location reference doc has the per-card offset table.

## Verification

After any routing change:

1. **Check the API confirms applied output:**
   ```bash
   curl -X POST http://localhost:3001/api/matrix/route \
     -H 'Content-Type: application/json' \
     -d '{"outputNumber":7,"inputNumber":3,"source":"manual"}' | jq .
   ```
   Expected: `data.appliedOutputNumber` equals `outputNumber + outputOffset`.

2. **Check current-channels reflects the change:**
   ```bash
   curl -s 'http://localhost:3001/api/matrix/current-channels' | jq '.[] | select(.outputNumber==7)'
   ```

3. **Walk the bar.** Confirm the physical TV labeled 7 changed to the correct source. This is the ONLY definitive verification for `outputOffset` correctness — the matrix will report success on wrong offsets.

4. **Check the route log:**
   ```bash
   sqlite3 /home/ubuntu/sports-bar-data/production.db \
     "SELECT ts, source, outputNumber, inputNumber FROM MatrixRouteLog ORDER BY ts DESC LIMIT 5;"
   ```

## If still broken

- **Route API says success but no physical change happens:** offset is almost certainly wrong. Compare configured `outputOffset` against the per-location quirks table above. Walk the bar with a single test route to confirm.
- **Route API says success but the WRONG physical TV changes:** offset is wrong AND points to a populated slot. Same fix.
- **Route API returns 502 / connection refused:** matrix is unreachable. `nc -zv <matrix_ip> 4999` (Wolf Pack TCP) or `nc -zv <matrix_ip> 23` (Crestron Telnet).
- **Route succeeds in admin UI but bartender remote shows no change:** the bartender UI reads from a cached store. Force refresh the page; check `/api/matrix/current-channels` directly.
- **Verify-install.sh fails at single-card location:** `MATRIX_SINGLE_CARD=true` is in `.env` but `outputOffset != 0`. Fix the offset in the DB OR remove the env flag if the location is actually multi-card.

## Escalation path

1. Capture matrix config: `sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT * FROM MatrixConfiguration;" > /tmp/matrix-config.txt`.
2. Capture recent route attempts: `pm2 logs sports-bar-tv-controller --lines 200 | grep -iE 'matrix|route|wolfpack|crestron' > /tmp/matrix-routes.txt`.
3. Capture the per-location reference: `cp .claude/locations/<branch>.md /tmp/`.
4. If physical wiring changed (a card was added/swapped/moved), update BOTH the DB AND the per-location table in CLAUDE.md Gotcha #4 — multi-card offsets are wiring-specific and won't auto-verify.

## Cross-references

- **CLAUDE.md Gotcha #4** — Matrix Config Per-Location Values (the canonical `outputOffset` table + single-card enforcement detail).
- **CLAUDE.md §6** — Crestron Matrix Switcher Control.
- **CLAUDE.md §8** — Wolf Pack Multi-View Card Control (sibling concern: multi-view modes vs basic routing).
- **`packages/wolfpack/README.md`** — full Wolf Pack protocol reference, HTTP API endpoints.
- **`packages/crestron/README.md`** — chassis slot offset table, Telnet/CTP/CIP command list.
- **`packages/multiview/README.md`** — multi-view hex frames if the target output is a quad-view card.
- **Memory file:** `feedback_matrix_offset.md` — original `outputOffset` discovery and per-location enforcement design.
- **Related runbook:** `CURRENT_CHANNEL_LOOKUP.md` to verify a routed TV ended up on the expected channel.
- **Related runbook:** `FIRETV_OFFLINE_RECOVERY.md` if you routed to a Fire TV input and the launch fails.
- **Related runbook:** `PM2_RESTART_RUNBOOK.md` after editing matrix config in the DB.
- **Source:** `apps/web/src/app/api/matrix/route/route.ts` — the route endpoint that applies offset.
- **Source:** `apps/web/src/lib/wolfpack-matrix-service.ts` — runtime that adds offset and talks to the matrix.
- **Source:** `apps/web/src/instrumentation.ts` — startup `[MATRIX-CONFIG] ⚠` log if a single-card model has non-zero offset.
- **Source:** `scripts/verify-install.sh` — `MATRIX_SINGLE_CARD` enforcement layer.
