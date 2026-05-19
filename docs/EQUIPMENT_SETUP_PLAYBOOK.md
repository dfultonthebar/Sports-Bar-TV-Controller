# Equipment Setup Playbook

## Purpose + AI Hub usage

This playbook is the single canonical runbook for bringing new equipment online at a Sports Bar TV Controller location. It is consumed in two ways: (1) directly by an installer or operator who needs a step-by-step "I just got X — how do I install it?" guide, and (2) by the **AI Hub** (Ollama-driven chat at `/ai-hub`) which indexes this document into its RAG vector store and answers operator questions like "I just got an Atlas AZM8 — walk me through setup" by retrieving the relevant section. Every section is written for both audiences: explicit numbered steps with exact commands and expected outputs, plus liberal use of section headings ("Setup: X", "First step:", "Verification:") so semantic search can pull the right snippet.

For per-version manual steps tied to a specific release (e.g. "after upgrading to v2.34.0, do this"), see `docs/VERSION_SETUP_GUIDE.md`. For the canonical fresh-install runbook (the "whole new bar" end-to-end), the source-of-truth is `docs/NEW_LOCATION_SETUP.md`; this document expands on it with per-equipment detail for the pieces operators add over time.

---

## Quick Reference Table — "I just got…"

| New equipment | Top section | Time estimate |
|---|---|---|
| Atlas AZM8 / AZMP4 audio processor | §3 | 30 min |
| Shure SLX-D wireless mic receiver (SLXD4 / SLXD4D / SLXD24D) | §7.3 | 20 min |
| NESDR Smart (RTL-SDR) spectrum dongle | §8 | 10 min + 30 min RAG indexing |
| Wolf Pack HDMI matrix (any size) | §2.1 | 45 min |
| Wolf Pack Multi-View Quad-View card | §2.2 | 30 min |
| Crestron DM matrix (8x8 / 16x16 / 32x32 / 64x64) | §2.3 | 60 min (output offsets!) |
| Amazon Fire TV Cube / Stick | §4 | 15 min |
| DirecTV Genie or client receiver | §5 | 20 min |
| Global Cache iTach IP2IR (IR blaster) | §6 | 30 min hardware + IR learning per cable box |
| Spectrum / Charter cable box (any model) | §6.5 | 15 min IR learning per box |
| dbx ZonePRO 1260m / 1261m audio processor | §7.1 | 25 min |
| BSS Soundweb London BLU-N | §7.2 | 25 min |
| Pulse-Eight USB CEC adapter (TV power only) | §6.6 | 15 min |
| HDTVSupply 4K60 Quad-View card | §2.2 | 30 min |
| DMX lighting (Enttec, PKnight CR011R, Art-Net) | §9.1 | 30 min |
| Lutron Caséta / RA3 system | §9.2 | 45 min |
| Philips Hue Bridge + bulbs | §9.3 | 20 min |
| New Intel iGPU box (AI Hub host) | §10 | 60 min + RAG re-index |
| Pulling a new model into Ollama | §10.3 | 10 min + RAG re-embed |
| Whole new bar location from scratch | §1 | 4-8 hours |

---

## §1. New location bootstrap (full first-time install)

**What you have:** an empty Intel NUC or equivalent x86 box with Ubuntu installed, network cable plugged in, no Sports Bar TV Controller code yet. This section is the most-cited cross-reference in this whole playbook because every later section assumes the host is already set up.

**Pre-flight checks (before you start):**
- LAN access from this box to every piece of venue hardware (matrix, TVs, Fire TVs, audio processor, IR blaster). If the venue uses VLANs, this box needs to be on the management VLAN OR on a router that can route to all device VLANs.
- Internet access for `git clone`, `npm ci`, Ollama model downloads, Tailscale auth.
- ~20 GB free disk for logs, builds, AI models.
- 8 GB RAM minimum, 16 GB recommended (Ollama models + Next.js).
- LAN inbound TCP 3001 (admin UI) and 3002 (bartender UI) reachable from iPads.

### 1.1 OS prerequisites (Ubuntu 24.04 LTS, node 22+, PM2, sqlite3)

**Setup: install base packages on a fresh Ubuntu 24.04 box.**

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nodejs npm sqlite3 build-essential curl wget
node --version    # MUST be ≥ 18.17 ; v22.x preferred
```

If `node --version` is older than 18.17, install Node 22 from NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Install PM2 globally (process manager — keeps the app running across reboots):

```bash
sudo npm install -g pm2
```

**Verification:**

```bash
node --version    # v22.x.x
npm --version     # 10.x.x or later
pm2 --version     # 5.x.x or later
sqlite3 --version # 3.37 or later
```

**Common pitfalls:**
- Ubuntu 22.04 boxes will work but the fleet standard at v2.46.3+ is 24.04 (noble). Plan to upgrade — see `docs/OS_UPGRADE_RUNBOOK.md`.
- Some apt-installed `nodejs` packages on older Ubuntu come bundled with very old npm. Reinstall npm globally: `sudo npm install -g npm@latest`.

### 1.2 Clone the repo + npm install

```bash
cd /home/ubuntu
git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
cd Sports-Bar-TV-Controller
git checkout main
npm ci
```

**`npm ci` takes ~3-5 minutes the first time.** It installs the full monorepo (37 workspace packages + Next.js + Drizzle ORM + everything else) from the lockfile.

**Verification:** `ls node_modules/@sports-bar/ | wc -l` should show 30+ entries.

### 1.3 Create the location branch

Every location runs on its own git branch (`location/<slug>`) that holds location-specific data files. `main` has empty template files; the location branch holds real device IPs, layouts, channel presets, etc.

```bash
# Step 1: confirm main is checked out
git branch --show-current      # → main

# Step 2: create the location branch (replace <slug> — e.g. "graystone", "holmgren-way")
git checkout -b location/<slug>
```

You will push this branch to GitHub later (Step 1.13) once the location is actually configured.

**Critical rule (per CLAUDE.md "Commit Strategy"):** Never merge a location branch back into main. Software changes go to main first then merge INTO location branches. Location data NEVER goes to main. See `docs/CLAUDE_VERSIONING_GUIDE.md`.

### 1.4 Initial database setup (drizzle-kit push)

```bash
mkdir -p /home/ubuntu/sports-bar-data/{backups,update-logs,logs}
cd /home/ubuntu/Sports-Bar-TV-Controller
npx drizzle-kit push --config apps/web/drizzle.config.ts
```

This creates `/home/ubuntu/sports-bar-data/production.db` with all ~85 tables. First push takes ~30 seconds.

**Verification:**

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db ".tables" | wc -w
# Expect: 80-90 tables
```

**Common pitfall — silent index conflict abort (CLAUDE.md Gotcha #6):** `drizzle-kit push` aborts entirely when it hits a pre-existing index (e.g. `ApiKey_provider_keyName_key already exists`). Tables scheduled AFTER the failing index in push order are silently skipped. After every push, verify the most-recently-added table actually exists:

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA table_info(sdr_carriers);"
# Expect: a list of columns, not blank
```

If blank, add manually with `CREATE TABLE` or `ALTER TABLE`.

### 1.5 Run bootstrap-new-location.sh (auth PINs, Location row, .env)

This is the step that was missing before late 2025 and bit every location. It creates the `Location` DB row, seeds `AuthPin` rows with bcrypt-hashed PINs, writes `LOCATION_ID` / `LOCATION_NAME` / `AUTH_COOKIE_SECURE=false` into `.env`, and optionally creates the location git branch.

```bash
bash scripts/bootstrap-new-location.sh \
  --name "Your Bar Name" \
  --slug your-bar-slug \
  --timezone America/Chicago \
  --admin-pin 7819 \
  --staff-pin 1234 \
  --anthropic-api-key sk-ant-... \
  --non-interactive \
  --create-branch
```

Without `--non-interactive` it prompts for every field. The script is **idempotent** — safe to re-run. Existing Location rows and active PINs are not overwritten (you will see "not overwriting" lines).

**Required flags explained:**
- `--name` — human display name (shown in the UI)
- `--slug` — short kebab-case identifier (used in the git branch name and DB row); auto-derived from name if omitted
- `--admin-pin` / `--staff-pin` — 4-digit PINs, range 1000-9999, used to log in to the web UI
- `--anthropic-api-key` — shared key for auto-update Checkpoints A/B/C (talk to fleet admin for current key); without it auto-update falls back to the CLI subscription path with a monthly cap
- `--create-branch` — creates the local `location/<slug>` branch off `origin/main`

**Verification:**

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT id, name FROM Location;"
# Expect: one row matching the name you passed

sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT role, isActive FROM AuthPin;"
# Expect: 2 rows — STAFF + ADMIN, both isActive=1
```

### 1.6 Wire LOCATION_ID + LOCATION_NAME in .env

The bootstrap script does this for you. Confirm:

```bash
grep -E '^(LOCATION_ID|LOCATION_NAME|AUTH_COOKIE_SECURE)' /home/ubuntu/Sports-Bar-TV-Controller/.env
# Expect 3 lines.
# LOCATION_ID=<uuid>
# LOCATION_NAME='Your Bar Name'         (single-quoted if it contains spaces)
# AUTH_COOKIE_SECURE=false
```

**Critical:** `AUTH_COOKIE_SECURE=false` is REQUIRED on HTTP-only LAN deployments. Browsers silently drop `Secure` cookies on `http://` origins, so login appears to succeed but every subsequent request looks unauthenticated. Only set this to `true` if you put a real HTTPS reverse proxy in front of the app.

### 1.7 Build + PM2 start (port 3001)

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
npm run build      # ~3-5 min the first time; Turborepo caches subsequent builds
pm2 start ecosystem.config.js
sleep 8
pm2 status         # Expect: sports-bar-tv-controller as 'online'
```

**Verification — the app is responding:**

```bash
curl -sS http://localhost:3001/api/system/health | head -c 200
# Expect: JSON with "status":"healthy"
```

**Setup PM2 to auto-start on boot:**

```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
pm2 save
```

Without this, the app does NOT restart after a system reboot.

### 1.8 Set up bartender proxy via setup-bartender-nginx.sh (port 3002)

```bash
bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/setup-bartender-nginx.sh
```

This installs nginx, writes `/etc/nginx/sites-available/bartender-remote` with a strict allow-list (only the bartender remote + the API routes the bartender UI calls), and replaces the legacy Node `apps/web/bartender-proxy.js` PM2 app. Idempotent — safe to re-run.

**Verification:**

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3002/
# Expect: 302 (redirect to /remote)

curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3002/system-admin
# Expect: 403 (admin routes blocked on bartender port)
```

**Critical pitfall — new API routes are 403 by default on port 3002:** the Nginx allow-list is whitelist-only. When you add a new `/api/foo/` route that the bartender UI needs to hit, you MUST add a `location /api/foo/` block to `scripts/setup-bartender-nginx.sh` AND re-run the script. Otherwise the route works on 3001 but returns 403 on 3002. This bit Holmgren during the v2.34.0 Shure rollout — `/api/shure-rf` was missing from the allow-list.

### 1.9 Set up Ollama IPEX-LLM via setup-iris-ollama.sh

**Setup: install Intel iGPU-accelerated Ollama (only if the box has an Intel Iris Xe / Arc iGPU).**

```bash
bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/setup-iris-ollama.sh
```

This script (~140 MB download for the IPEX portable build):
1. Adds the `ubuntu` user to the `render` + `video` groups (required for `/dev/dri/renderD128` access).
2. Installs `clinfo`, `intel-gpu-tools`, Intel level-zero userspace stack (`intel-level-zero-gpu`, `intel-opencl-icd`, `intel-igc-cm`, `libze1`, `libigc1`, `libigdfcl1`, `libigdgmm12`, `libdrm-intel1`).
3. Downloads the IPEX-LLM Ollama portable build to `/home/ubuntu/ipex-llm-ollama/`.
4. Writes `/etc/systemd/system/ollama-ipex.service` with the correct env vars (`OLLAMA_HOST=0.0.0.0:11434`, `OLLAMA_NUM_GPU=999`, `SYCL_*` flags, etc.).
5. Disables the upstream CPU-only `ollama` systemd unit and starts `ollama-ipex` instead — same port 11434.

**Expected performance gain:** llama3.1:8b Q4 goes from ~3 tok/s (CPU) to ~14 tok/s (Iris Xe). AI Suggest endpoint goes from 3+ min (and frequent timeouts) to ~100s.

**Verification:**

```bash
systemctl is-active ollama-ipex
# Expect: active

sudo journalctl -u ollama-ipex --since=5m | grep "using Intel GPU"
# Expect: one or more lines
```

**Common pitfall — "No Intel iGPU detected":** if this box has AMD or Nvidia hardware (not Intel), `setup-iris-ollama.sh` will refuse to run and exit. The fleet-standard path does not apply — the location stays on upstream CPU-only Ollama. Document the hardware in `.claude/locations/<branch>.md`.

**Common pitfall — `/dev/dri/` empty:** the script tries `modprobe i915` and `modprobe xe` automatically. If both fail, the BIOS may have integrated graphics disabled — re-enable in BIOS, reboot, re-run the script.

### 1.10 Pull AI models (llama3.1:8b, nomic-embed-text, qwen2.5:14b)

**Why `sg ollama -c`:** the model directory `/usr/share/ollama/.ollama/models` is group-owned by `ollama`. Running `ollama pull` as `ubuntu` without the supplementary group will fail with permission errors mid-download. `sg ollama -c 'command'` runs the command under the `ollama` group temporarily.

```bash
# Chat model (default for AI Suggest, /api/chat)
sg ollama -c 'ollama pull llama3.1:8b'      # ~4.7 GB download

# Embedding model (RAG vector store)
sg ollama -c 'ollama pull nomic-embed-text'  # ~274 MB download

# Larger chat model (slower, for hard questions — optional)
sg ollama -c 'ollama pull qwen2.5:14b'      # ~9 GB download
```

**Verification:**

```bash
ollama list
# Expect: 3 rows showing the pulled models with their sizes

curl -s http://localhost:11434/api/tags | python3 -m json.tool
# Expect: same 3 models in JSON form
```

### 1.11 Run scan-system-docs.ts + scan-code-docs.ts (RAG indexing)

The AI Hub's RAG store needs to be built before chat will have any context.

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
npm run rag:scan
```

This scans `/docs/`, `/packages/*/README.md`, and `CLAUDE.md` into the vector store. Takes ~10-30 min depending on document volume and Ollama embedding speed (faster on iGPU). Each document is chunked (750 tokens, 100 overlap) and embedded via `nomic-embed-text`.

**Verification:**

```bash
curl -s http://localhost:3001/api/rag/stats | python3 -m json.tool
# Expect: { "totalChunks": 1000-5000, "totalDocs": 50-150, ... }

# Smoke-test the query path
curl -s -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query":"how do I configure CEC cable box control?"}' | python3 -m json.tool
# Expect: "answer" with a real response, "sources" with relevant doc filenames
```

### 1.12 Verify install via verify-install.sh

```bash
bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/verify-install.sh
```

Should report **PASS (7/7 checks)**. The 7 layers are: `pm2_online`, `health_http`, `metrics_http`, `bartender_proxy`, `critical_tables`, `matrix_config`, `crash_logs`. Same script runs as Checkpoint C at the end of every `auto-update.sh` run — green here means auto-update will also be happy.

**Common failures:**
- `bartender_proxy` FAIL → §1.8 didn't run or nginx didn't reload
- `critical_tables` FAIL → §1.4 silently aborted; redo `drizzle-kit push`
- `matrix_config` FAIL → `MATRIX_SINGLE_CARD=true` is set in `.env` but `outputOffset != 0` in the DB. Either fix the DB value or unset the flag (multi-card location). See §2.1.

### 1.13 Final commit + push location branch

```bash
git add apps/web/data/
git commit -m "feat(<slug>): initial location bootstrap"
git push -u origin location/<slug>
```

**Never push to main from a location branch.** Software-only changes (code, packages, docs) go to main first; data files (`apps/web/data/*.json`, `.env`, layout images) live only on the location branch.

---

## §2. HDMI matrix switchers

### 2.1 Wolf Pack (single-card vs multi-card — outputOffset CRITICAL)

**What you have:** a Wolf Pack 4K HDMI matrix (8x8, 16x16, 36x36, 48-port, or other). The chassis has either a single card filling all outputs, or multiple daughter cards each driving a subset of outputs. Card layout determines `outputOffset` and is set by the installer.

**Pre-flight checks:**
- Matrix powered on, network cable connected, IP visible on front-panel display
- Web UI reachable: `curl -s -o /dev/null -w "%{http_code}" http://<ip>/login.php` returns 200
- Default web UI credentials: `admin / admin`
- **Card layout known** — count physical daughter cards installed in the chassis. Ask the original installer if not sure.

**Setup: first step — verify connectivity.**

```bash
ping <ip>                                                   # responds
curl -s -o /dev/null -w "%{http_code}" http://<ip>/login.php  # 200
```

**Setup: seed the matrix config in the database.**

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
npx tsx scripts/seed-wolfpack-config.ts \
  --name "Main Bar Matrix" \
  --ip 192.168.1.100 \
  --model WP-36X36
```

This creates the `MatrixConfiguration` row. Then verify in SQL:

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT name, ipAddress, model, outputOffset, audioOutputCount FROM MatrixConfiguration;"
```

**Setup: set outputOffset correctly (CRITICAL per CLAUDE.md Gotcha #4).**

| Card layout | outputOffset | audioOutputCount notes |
|---|---|---|
| **Single-card** (one card fills all outputs) | **MUST be 0** | 0 if audio routes via Atlas/dbx/BSS DSP; non-zero only if Wolf Pack outputs are wired to speakers |
| **Multi-card** (chassis populated with multiple daughter cards) | Per-card, depends on physical wiring | Per-location |

**Per-location reference (live values, do not generalize across locations):**

| Location | Model | Layout | outputOffset | audioOutputCount |
|---|---|---|---|---|
| Stoneyard Greenville | WP-36X36 | Multi-card | per card | 4 |
| Stoneyard Appleton | Wolf Pack | Multi-card | per card | 4 |
| Holmgren Way | WP 48-port | Multi-card | per card layout | 4 (outputs 37-40 audio-only) |
| Graystone | WP-36X36 | Multi-card | +32 for audio card | 4 |
| Lucky's 1313 | WP-36X36 | Single-card | **0 (enforced)** | **0** (audio via dbx ZonePRO) |
| Leg Lamp | Wolf Pack | Single-card | **0 (enforced)** | 0 |

**Setup: opt-in to single-card enforcement (if applicable).** If this location IS single-card, add `MATRIX_SINGLE_CARD=true` to `.env` so `scripts/verify-install.sh` fails the install if `outputOffset != 0`. Multi-card locations leave the flag unset.

```bash
echo 'MATRIX_SINGLE_CARD=true' >> /home/ubuntu/Sports-Bar-TV-Controller/.env
pm2 restart sports-bar-tv-controller --update-env
```

**Setup: add inputs and outputs via the UI.** Matrix Control page → label each input (Fire TV Cube 1, Cable Box, etc.) and each output (TV 1 Main Bar, TV 2 Patio, etc.). These labels are stored in `MatrixInput` and `MatrixOutput` tables.

**Verification — route a test input to a test output, confirm video on TV:**

```bash
curl -s -X POST http://localhost:3001/api/matrix/route \
  -H "Content-Type: application/json" \
  -d '{"inputNumber":1,"outputNumber":1}'
# Expect: { "success": true, ... }
```

Watch TV 1 — should display Input 1's source within 1 second.

**Common pitfalls:**
- **Wolf Pack TCP port 5000 is non-functional** on all units tested — it responds "OK" to any garbage command but never actually switches. Always use HTTP. The UI defaults to HTTP; do not change `protocol` to `TCP`.
- **Wolf Pack does NOT pass CEC** through to TVs (CLAUDE.md §5). Combined with Spectrum cable box firmware disabling CEC, cable box control is IR-only. Don't try to wire CEC for cable boxes.
- **Output slot 65535** in the cache means "settling window" — the matrix returns 0xFFFF for ~500ms after a route. Server normalizes to -1 and filters out. The client MERGES route state into the existing map (does not replace) so missing outputs preserve their last-known value. Bug fixed in v2.5.x.

### 2.2 Wolf Pack Multi-View Quad-View cards (RS-232 USB 115200 8N1)

**What you have:** an HDTVSupply 4K60 Quad-View output card installed in one or more Wolf Pack output slots. Each card displays up to 4 inputs simultaneously on one TV, in 8 selectable layouts (single, 2-window split, PIP, quad, etc.).

**Pre-flight checks:**
- Card physically installed in Wolf Pack chassis output slots (note start/end slot numbers, e.g. slots 21-24)
- USB-to-RS-232 cable connected from the control NUC to the card's serial port
- `ls /dev/ttyUSB*` shows the adapter (e.g. `/dev/ttyUSB0`)
- 115200 baud, 8N1, no parity (default for this card)

**Setup: identify which `/dev/ttyUSB*` belongs to this card.**

```bash
ls -la /dev/ttyUSB*
# Note the device path (e.g. /dev/ttyUSB0)

# Test serial — send a single mode-set frame
echo -ne '\xEB\x90\x00\x11\x00\xff\x32\x07\x00\x01\x02\x03\x00\x00\x00\x00\x00\x00' \
  > /dev/ttyUSB0
# Expect: card switches to quad-view mode (mode byte 0x07)
```

**Setup: add the card via the Matrix Control UI.**

Navigate to Matrix Control → "Multi-View Cards" tab → "Add Card":
- Name: e.g. "Big Wall Quad-View"
- Start slot: 21 (the lowest output slot the card occupies)
- End slot: 24 (the highest output slot)
- Serial port: `/dev/ttyUSB0`
- Initial mode: 0 (single window)

**Display modes (mode byte → layout):**

| Mode | Layout |
|---|---|
| 0 | Single window (input 1 fills screen) |
| 1 | 2-window split |
| 2 | PIP, big window on top-left |
| 3 | PIP, big window on bottom-right |
| 4 | 3-window (1 top, 2 bottom) |
| 5 | 3-window alt layout |
| 6 | 3-window with 2 PIP overlays |
| 7 | 4-window quad |

**Hex frame format (always 18 bytes):**

```
EB 90 00 11 00 ff 32 [mode] 00 01 02 03 00 00 00 00 00 00
```

Bytes `01 02 03` at offsets 10-12 are the Wolf Pack input numbers for windows 2, 3, and 4 (window 1 is implicit from the matrix routing on the card's first slot).

**Verification:** route 4 different inputs to slots 21, 22, 23, 24, set mode to 7 (quad). All 4 sources should appear simultaneously on the TV connected to that Wolf Pack card's output.

**Common pitfalls:**
- USB-to-RS-232 adapters can be renamed on reboot (`/dev/ttyUSB0` becomes `/dev/ttyUSB1`). Use udev rules with the adapter's serial number to pin the device name.
- Commands terminate with `.` (period) — response is `OK` or `ERR`.

### 2.3 Crestron DM (output slot offsets: DM 8x8/16x16 +17, 32x32 +33, 64x64 +65)

**What you have:** a Crestron DigitalMedia matrix — DM-MD series (8x8/16x16/32x32/64x64/128x128), HD-MD series, DMPS3-4K series, or DM-NVX (network video) series. 18 supported models total.

**Pre-flight checks:**
- Matrix on the network with a static IP assigned
- Telnet (TCP 23) open (default protocol — simplest text commands)
- For DMPS / NVX, optionally CTP (TCP 41795) or CIP (TCP 41794) for richer control
- Telnet password / admin credentials known (Crestron Studio default is usually empty or `admin`)

**Setup: verify Telnet reachability.**

```bash
telnet <ip> 23
# At the prompt, type:
DUMPDMROUTEI
# Expect: routing table printed back. Press Ctrl+] then 'quit' to exit.
```

**Setup: add the matrix via the Crestron tab in the UI.**

Navigate to Matrix Control → "Crestron DM" tab → "Add Matrix":
- Name: e.g. "Main Bar Crestron"
- Model: select from dropdown (e.g. `DM-MD16X16`)
- IP: e.g. `192.168.1.110`
- Port: 23 (Telnet default)
- Username / password if your config requires them

**CRITICAL — output slot offset by chassis (CLAUDE.md §6 / packages/crestron/README.md):**

DM matrices number outputs starting AFTER the input block. The application adds the offset BEFORE issuing routing commands.

| Chassis | Output slot start | Offset to add |
|---|---|---|
| 8x8, 16x16 | 17 | +17 |
| 32x32 | 33 | +33 |
| 64x64 | 65 | +65 |
| 128x128 | 129 | +129 |
| HD-MD any | 1 (HD-MD outputs start at 1) | 0 |
| DMPS series | (per model) | (per model) |
| NVX | N/A (network video) | N/A |

The model-profile catalog (`packages/crestron/src/index.ts`) holds these offsets — confirm via `GET /api/crestron/matrices/[id]` that the application loaded the right profile.

**Key Telnet commands the app issues:**

```
SETAVROUTE   <input> <output>    # Route input → output (video + audio)
SETVIDEOROUTE <input> <output>   # Video only
SETAUDIOROUTE <input> <output>   # Audio only (audio breakaway)
DUMPDMROUTEI                     # Get current routing state
```

**Verification — test connection:**

```bash
curl -s -X POST http://localhost:3001/api/crestron/matrices/<matrix-id>/test \
  -H "Content-Type: application/json"
# Expect: { "success": true, "connected": true, ... }
```

Then route input 1 to output 1 in the UI; watch the destination TV.

**Common pitfalls:**
- **Output offsets silently corrupt routing** the same way as Wolf Pack outputOffset. Pick the wrong chassis model in the UI → every "output 1" command routes to physical output 17 (or 33, 65) → operators see "the wrong TV plays the wrong source" with no error.
- HD-MD outputs start at 1, NOT 17. Don't apply the DM-MD offset to HD-MD chassis.
- NVX (network video) is a different protocol family — encoders/decoders pair via stream IDs, not slot numbers. Out of scope for this matrix-routing page; needs the NVX-specific UI flow.

---

## §3. Atlas audio processors (AZMP4 / AZM8)

**What you have:** an AtlasIED Atmosphere AZM4, AZM8, AZMP4 (powered version), or AZMP8. 4 or 8 input channels; multiple zone outputs. Network-controllable via TCP JSON-RPC (port 5321) + subscribed UDP meters (port 3131).

**Pre-flight checks:**
- Processor powered on, network cable connected
- Static IP assigned via DHCP reservation or via processor's web UI
- Firmware version known (visible on processor front panel or web UI). Firmware 4.5+ has a "Custom Priority Volume" feature that creates a drop-watcher false-positive trap — see §3.4.
- Atmosphere Design software (Atlas's PC config tool) has been used to define zones, sources, scenes, and priority routing — this is the venue's audio design, set once and stored on the processor.

### 3.1 First-time IP config (front-panel network menu)

On the processor's front panel:
1. **Menu** button → navigate to **Network**
2. Set **DHCP** to `Off` (we want a static IP)
3. Enter **IP Address**, **Subnet Mask**, **Gateway**
4. Confirm — processor reboots (~30 sec)

Or use DHCP and reserve the lease on your router by MAC address.

**Verification:** `ping <ip>` responds.

### 3.2 TCP port 5321 + UDP 3131 (JSON-RPC + meters)

The Atlas exposes two control surfaces simultaneously:

| Port | Direction | Protocol | Purpose |
|---|---|---|---|
| 5321 (TCP) | bidirectional | JSON-RPC | Commands: `get`, `set`, `sub` (subscribe), `unsub` |
| 3131 (UDP) | inbound (we receive) | JSON | Subscribed meter pushes — `SourceMeter_N`, `ZoneMeter_N`, `GroupMeter_N` in dB |

**Verification — TCP reachable:**

```bash
nc -zv <ip> 5321
# Expect: succeeded
```

**Verification — UDP 3131 reachable (passive — packets only flow after we subscribe):**

```bash
# Will print incoming UDP packets after the app subscribes
sudo tcpdump -i any -nn 'udp port 3131' &
# Add the processor in the UI, watch tcpdump for SourceMeter / ZoneMeter packets.
```

### 3.3 Scene 1 — initial state

**Setup: use Atmosphere Design to define Scene 1.**

Scene 1 should hold the venue's "normal operating state":
- Source routing for each zone
- Default volume levels
- Mute state (typically unmuted)
- Priority configuration

The application does NOT auto-recall Scene 1 on connect (that's a dbx ZonePRO thing — see §7.1). But the operator should manually recall Scene 1 after any priority event or unexpected state so the system returns to known good.

### 3.4 IMPORTANT: firmware 4.5 Custom Priority Volume gotcha (CLAUDE.md §7)

Atlas firmware 4.5+ adds a per-priority "Custom Volume" field that pins zone gain to a fixed low level during priority events. **This looks IDENTICAL to a real drop signature** to the `atlas-drop-watcher.ts` and will generate false-positive drop events.

**Before debugging any "false drop event" alerts, always check:**

Atlas GUI → **Sources** → **Priority** → look for any priority with a **Custom Volume** value set. If non-zero, that priority is INTENTIONALLY lowering zone gain during page/mic activation — the drop watcher is correctly observing the gain change but it's not a bug, it's by design.

If you want the drop watcher to ignore Custom-Priority-Volume drops, add a per-zone exclusion to the watcher's cooldown logic (see `apps/web/src/lib/atlas-drop-watcher.ts`).

### 3.5 Adding to AudioProcessorManager UI

Navigate to Device Config → Audio Processors → "Add Processor":
- Type: **AtlasIED Atmosphere**
- Model: **AZM4 / AZM8 / AZMP4 / AZMP8**
- Name: e.g. "Main Bar Atlas"
- IP: e.g. `192.168.1.50`
- Port: 5321 (default)
- Test connection → should succeed

After save, the app's `atlasClientManager` (a globalThis-hoisted singleton — CLAUDE.md Gotcha #10) creates one persistent `ExtendedAtlasClient` for this processor. ALL paths (meter manager, drop watcher, priority watcher, UI commands) share that one client. Do NOT instantiate `new AtlasTCPClient(...)` anywhere else.

### 3.6 Atlas drop watcher + priority watcher self-registration

On first boot after adding the processor, two watchers self-register:

**Atlas drop watcher** (`apps/web/src/lib/atlas-drop-watcher.ts`):
- Polls zone gain every 30s
- Fires `atlas_drop_events` row when a zone gain crashes ≥15 points landing ≤10
- Writes `event_type='startup'` row on boot to prove it's alive
- Heartbeat every 30s while a drop is active

**Atlas priority watcher** (`apps/web/src/lib/atlas-priority-watcher.ts`):
- Polls input meters every 5s
- Fires `atlas_priority_events` row when any input matching `/\b(mic|juke|page|intercom|priority)\b/i` crosses −45 dB
- Also fires on unexpected `ZoneSource_X` changes
- Writes `event_type='startup'` row on boot
- Banner appears at top of bartender remote audio tab while a priority event is active

**Verification — startup events exist:**

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT event_type, created_at FROM atlas_drop_events ORDER BY created_at DESC LIMIT 5;"
# Expect: at least one event_type='startup' row from the most recent boot

sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT event_type, created_at FROM atlas_priority_events ORDER BY created_at DESC LIMIT 5;"
# Same — startup row from most recent boot
```

**Common pitfall — Atlas firmware exposes NO queryable "priority active" parameter** (per CLAUDE.md §7). 60+ candidate param names probed, all returned `-32604`. Priority is INFERRED from input meter levels + unexpected zone-source changes. Don't waste time probing the param namespace; the inference is the only viable path.

---

## §4. Amazon Fire TV (Cube + Stick)

**What you have:** Amazon Fire TV Cube (3rd gen / AFTR), Fire TV Stick 4K Max, or Fire TV-branded smart TV (Toshiba C350 / Insignia F50). Controlled over ADB (Android Debug Bridge) on TCP 5555.

**Pre-flight checks:**
- Fire TV plugged in, paired with the venue's WiFi or wired to Ethernet
- Static IP via DHCP reservation (DHCP reservations are MANDATORY; ADB authorization is keyed to host+IP and lease changes will require re-auth)
- ADB binary installed on the control box: `which adb` returns path; if not, `sudo apt install -y android-tools-adb`
- Host's `~/.android/adbkey` and `adbkey.pub` exist (auto-generated by first `adb start-server`)

### 4.1 Initial pairing + WiFi

Plug Fire TV into HDMI + power. On first boot:
1. Pair the included Alexa Voice Remote (hold home button until pairing prompt clears)
2. Sign in to Amazon account
3. Connect to venue WiFi OR plug in Ethernet (Cubes have Ethernet ports; Sticks need a USB OTG adapter)
4. Skip parental controls, skip ads-on-lockscreen, skip channel surveys

### 4.2 Enable ADB + Developer Options (Settings → My Fire TV → Developer Options)

On modern Fire TV builds (Fire OS 7+), Developer Options are hidden by default:

1. **Settings** → **My Fire TV** → **About**
2. Click on the device name (e.g. "Fire TV Cube") **7 times** rapidly. After 4-5 clicks a counter appears: "You are 3 steps away from being a developer." After 7, Developer Options menu unlocks.
3. Back out to **Settings** → **My Fire TV** → **Developer Options** (now visible)
4. **ADB Debugging** → ON
5. **Apps from Unknown Sources** → ON (only needed if you plan to sideload Scout APK or similar)

### 4.3 ADB allow-list (host computer fingerprint)

Per CLAUDE.md / `docs/NEW_LOCATION_SETUP.md` §8a — this is the most-forgotten step on first install. Each Fire TV must individually authorize the host's RSA public key.

**Setup: first step — make sure the ADB server is running:**

```bash
adb start-server
# First run generates ~/.android/adbkey + adbkey.pub (2048-bit RSA)
```

**Setup: attempt to connect to each Fire TV — expect `unauthorized` the first time:**

```bash
adb connect <fire-tv-ip>:5555
# Expect on first try: "connected to <ip>:5555 (status: unauthorized)"
```

**Setup: walk to each Fire TV with the physical remote.** The TV displays a popup: "Allow USB debugging from this computer?" with the host's RSA key fingerprint.

1. **CHECK the "Always allow from this computer" checkbox.** If you skip this, the popup reappears every reboot.
2. Click **OK** / **Allow**.

**Setup: re-run `adb connect` from the host:**

```bash
adb connect <fire-tv-ip>:5555
# Expect: "connected to <ip>:5555" with no unauthorized note

adb devices
# Expect: <ip>:5555    device   (not "unauthorized" or "offline")
```

**CRITICAL — back up `~/.android/`:**

The host's `~/.android/adbkey` + `adbkey.pub` ARE the host's identity. Lose them and every Fire TV at the location must be re-authorized manually. Back up after first-time setup:

```bash
tar czf ~/android-keys-backup-$(date +%Y%m%d).tar.gz \
  ~/.android/adbkey ~/.android/adbkey.pub
# Store somewhere durable: off-host, S3, USB, location password manager.
```

To restore on a fresh host (BEFORE `adb start-server` — otherwise a fresh key gets generated that you don't want):

```bash
mkdir -p ~/.android
tar xzf ~/android-keys-backup-YYYYMMDD.tar.gz -C /
chmod 600 ~/.android/adbkey
adb start-server
adb devices    # all previously-authorized TVs should appear as 'device'
```

### 4.4 Static IP recommended

Use DHCP reservation on the venue's router. ADB key authorization is keyed to (host RSA key, Fire TV serial) — IP changes shouldn't break auth, but DHCP-lease churn complicates inventory tracking. Always reserve.

### 4.5 Add to FireTVDevice DB table OR data/firetv-devices.json

**Preferred:** add via UI — Device Config → Fire TV → "Add Device":
- Name: e.g. "Big Wall Fire Cube"
- IP: e.g. `192.168.5.131`
- Port: 5555 (default)
- Matrix input: e.g. 3 (which Wolf Pack input this Cube is wired to)
- Test connection → should succeed

This writes to `FireTVDevice` table.

**Alternative (seed-only on first boot):** add to `apps/web/data/firetv-devices.json`. Auto-seeder reads this on first startup when `FireTVDevice` table is empty. After that, the DB is the source of truth.

### 4.6 Cube AFTR Prime Video note (com.amazon.firebat) per CLAUDE.md §9

**Critical gotcha:** On Fire TV Cube **2nd gen (model AFTR, Fire OS 7.7)** and other PVFTV-build Cubes, `com.amazon.avod` is **NOT installed as a standalone app**. `pm list packages` does not show it. Prime Video is hosted entirely inside the Fire TV launcher (`com.amazon.firebat`).

**Don't waste time hunting for the AVOD package.** v2.28.8 added `com.amazon.firebat` as a `packageAlias` for the `amazon-prime` catalog entry. `streamingManager.launchApp('amazon-prime')` falls through to firebat, which routes to `livingroom.landing.LandingActivity` (same activity the home-screen tile invokes).

**Diagnostic flow for any Fire TV where Prime Video can't be found:**

1. Confirm device lacks `com.amazon.avod`: `adb -s <ip>:5555 shell pm path com.amazon.avod` returns failure
2. Have an operator open Prime Video manually, then `adb -s <ip>:5555 shell dumpsys window windows | grep mCurrentFocus` shows the actual foreground activity
3. Confirm package launchable: `adb -s <ip>:5555 shell cmd package resolve-activity --brief -c android.intent.category.LEANBACK_LAUNCHER <package>` returns a real activity
4. Add the package to `packageAliases` for `amazon-prime` in `packages/streaming/src/streaming-apps-database.ts`

**Same reasoning applies to:** Amazon Music, Amazon Photos, other Amazon-branded apps that may be launcher-hosted on some Fire OS builds. Never trust the catalog package name as authoritative — trust `pm path` on the actual device.

**ESPN Watch CTA gotcha (CLAUDE.md memory):** ESPN GTV's "Watch" detail-page button is **DPAD-only**. Synthetic touch (`input tap` / `dispatchGesture`) is rejected. Only `KEYCODE_DPAD_CENTER` (key 23) advances to PlayerActivity. v2.32.99 added host-side `sendKey(23)` + 5s wait + 2x DPAD safety advance.

**Verification — send a test command:**

```bash
curl -s -X POST http://localhost:3001/api/firetv-devices/send-command \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"<id>","command":"HOME","ipAddress":"<ip>","port":5555}'
# Expect: { "success": true, ... }
# Fire TV should jump to home screen
```

---

## §5. DirecTV receivers (Genie + clients)

**What you have:** DirecTV HR54/HR44 (Genie main receiver), C61/C71/C41 (Genie client), HR24 (HD DVR), or H25 (HD receiver). Controlled via DirecTV's SHEF (Set-top HTTP Export Functions) HTTP API on TCP 8080.

**Pre-flight checks:**
- Receiver powered on, network cable connected (or via DECA coax-Ethernet bridge)
- IP visible in receiver's network menu (Settings → Network Setup → Connect Now → IP info)
- Static IP via DHCP reservation strongly recommended

### 5.1 Enable SHEF on receiver (Settings → Whole-Home → External Device)

On the receiver's UI:
1. **Menu** → **Settings & Help** → **Settings** → **Whole-Home** → **External Device**
2. Set **External Device** → **Allow**
3. Set **Current Program** → **Allow**

Without these, SHEF API on port 8080 returns 403 / "not allowed" for every command.

### 5.2 Identify Genie vs client (genie has port 8080)

| Receiver type | SHEF port | Notes |
|---|---|---|
| **Genie main** (HR54, HR44, HR34) | 8080 | Full SHEF API; tunes for itself AND for connected clients |
| **Genie client** (C61, C71, C41, C61K) | 8080 | Limited SHEF; primarily for tuning. Genie main handles guide |
| **HR24, H25 (standalone)** | 8080 | Full SHEF API on each receiver |

**Setup: verify SHEF reachability:**

```bash
curl -s "http://<receiver-ip>:8080/info/getVersion" | python3 -m json.tool
# Expect: JSON with "version", "stbSoftwareVersion", "systemTime", etc.
```

If you get a 403 or timeout, SHEF is not enabled — go back to §5.1.

### 5.3 Static IP recommended

Same as Fire TV — use DHCP reservation. DirecTV receivers will get a new IP after lease expiry and tuning commands will silently fail.

### 5.4 Add to DirecTVDevice DB table OR data/directv-devices.json

**Preferred:** add via UI — Device Config → DirecTV → "Add Receiver":
- Name: e.g. "Bar Genie Main"
- IP: e.g. `192.168.1.50`
- Port: 8080 (default)
- Model: e.g. `HR54-200`
- Receiver type: Genie / Client / Standalone
- Matrix input: e.g. 5 (which Wolf Pack input this receiver is wired to)
- Test connection → should return the SHEF version info

This writes to `DirecTVDevice` table.

**Alternative (seed-only):** `apps/web/data/directv-devices.json`. Auto-seeder reads on first boot when the table is empty.

**Note (CLAUDE.md Gotcha #5 — known tech debt):** the `@sports-bar/directv` package still reads `data/directv-devices.json` for guide fetching, even though all other code paths use the DB. When you change a receiver IP, edit BOTH the DB (via UI) AND `data/directv-devices.json` until this is fixed.

**Verification — tune to a channel:**

```bash
curl -s -X POST http://localhost:3001/api/directv/tune \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"<id>","channel":206}'
# Expect: { "success": true, ... }
# Receiver should tune to ESPN (channel 206)
```

---

## §6. Global Cache iTach IP2IR (IR blasters)

**What you have:** Global Cache iTach IP2IR — a 3-port IR blaster controlled over TCP 4998. Each port can drive an IR emitter taped to a cable box / DVD player / audio receiver's IR sensor window.

**Pre-flight checks:**
- iTach powered on (PoE or 5V wall wart)
- Network cable connected
- Default IP via DHCP — use Global Cache's free iLearn app on Windows/Mac to discover it, OR check the venue router's DHCP leases for a `GlobalCache_*` hostname
- IR emitters connected to ports 1, 2, 3 as needed

### 6.1 First-time IP config (DHCP discovery via iLearn app)

Easiest: download Global Cache's free [iLearn app](https://www.globalcache.com/downloads/) on a Windows or Mac laptop on the same LAN. Open it → "Discover" → shows every iTach on the network with its IP and MAC. Set a static IP via the iTach web UI at `http://<discovered-ip>/`.

**Or via the venue router:** look at the DHCP lease table for a device named `GlobalCache_XXXXXX`. That's the iTach.

**Or via Linux nmap from the control NUC:**

```bash
sudo nmap -sn 192.168.1.0/24 | grep -i "global"
```

**Setup: pin to static IP via iTach web UI:**

1. Browse to `http://<iTach-ip>/`
2. Navigate to "Network" tab
3. Change DHCP → Static, enter IP/mask/gateway
4. Save & Reboot

### 6.2 Mount + IR emitter placement (per IR_EMITTER_PLACEMENT_GUIDE.md)

For each IR emitter wire:

1. **Locate the target device's IR sensor window.** Spectrum cable boxes (most common): top-left front panel, behind a dark/tinted plastic window. Other devices vary — check manufacturer docs.
2. **Clean the area** around the IR sensor with a lint-free cloth.
3. **Position emitter 2-6 inches from sensor**, dual-eye emitter preferred. Aim directly at the window. Direct (0°) placement is most reliable; slight angles (15-30°) work but reduce range.
4. **Stick with adhesive backing** — peel, press firmly, hold 10-15 sec. Allow 1 hour to set before stressing.
5. **Cable management** — secure cable so the emitter cannot shift. Keep IR cable away from power cables (interference).
6. **Test with phone camera** — point camera at the emitter, trigger a command. IR is invisible to eyes but shows as bright purple/white pulses through a camera's CMOS sensor. Bright steady pulses = good signal.

Full placement guide with diagrams + multi-device rack layouts: `docs/IR_EMITTER_PLACEMENT_GUIDE.md`.

### 6.3 IR Learning workflow (Device Config → IR → Learn IR)

**What this does:** captures a complete IR code from a physical remote so the app can replay it.

**Setup: first step — add the device + the iTach.**

1. Device Config → IR → "Add IR Device":
   - Name: e.g. "Cable Box Main Bar"
   - Type: select cable box / DVD / audio receiver
   - Global Cache device: select your iTach
   - Port number: 1 / 2 / 3 (which iTach port the emitter is wired to)
2. Click into the new device → "IR Commands" tab → see grid of buttons (Power, CH+, CH-, 0-9, Guide, etc.)

**Setup: learn one button.**

1. Click **Learn** on, say, "Power"
2. Status changes to "Learning..." — iTach LED starts flashing (learning mode active)
3. Pick up the physical cable box remote
4. Point at the iTach's front IR sensor, 6-12 inches away, direct angle
5. Press and **hold** the Power button on the remote for 1-2 seconds
6. Release
7. App shows: "Successfully learned Power" — status changes to "Learned" (green), Test button appears

**Setup: test the learned code.**

1. Make sure the IR emitter is positioned per §6.2
2. Click the **Test** button on the just-learned Power command
3. Cable box should toggle power
4. If no response: re-check emitter placement, re-learn the code

**Repeat for every button you need:** typically Power, CH+, CH-, Guide, 0-9, Last, OK, Up/Down/Left/Right, Exit. ~60-75 min total for a 27-button Spectrum remote, ~2 min per button.

Full demo with screenshots and expected outputs: `docs/IR_LEARNING_DEMO_SCRIPT.md`.

### 6.4 Per-device port assignment (multi-port iTach gotcha — port adjustment per CLAUDE.md §10)

The iTach IP2IR has **3 IR ports** (1, 2, 3). Learned IR codes have `sendir,1:1,...` hardcoded — the "1:1" means module 1, port 1. The runtime substitutes the device's configured `globalCachePortNumber` before transmission.

**Critical:** if you tape Cable Box A's emitter to port 1, and Cable Box B's emitter to port 2, both devices in the DB MUST have the correct `globalCachePortNumber` set — otherwise the wrong emitter fires and the wrong cable box responds. Symptom: clicking "channel up" on Cable Box A's remote tile changes Cable Box B's channel.

**Verification:**

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT name, globalCachePortNumber FROM IRDevice ORDER BY name;"
# Expect: each device has the port matching where you wired the emitter
```

### 6.5 Spectrum cable box IR-only (CEC blocked per CLAUDE.md §5)

Spectrum (Charter) cable boxes disable CEC in firmware. Combined with Wolf Pack matrix not passing CEC through, the **only** way to control a Spectrum cable box is IR.

The `@sports-bar/ir-control` package ships a catalog of common Spectrum box models in `SPECTRUM_CABLE_BOX_MODELS` (Cisco, Motorola, Pace, Arris, Samsung, Humax, Technicolor + Digital Adapter variants). The model dropdown in the UI is populated from this list.

**Do not write new CEC code paths for cable boxes.** Even if a future firmware re-enables CEC, the matrix still strips it.

### 6.6 Pulse-Eight USB CEC adapter (TV power only, not cable boxes)

**What you have:** Pulse-Eight USB-CEC Adapter — USB to the control NUC, HDMI to a Wolf Pack output port. Used ONLY for TV power on/off and active-source signaling, NOT for cable box control.

**Setup:**

```bash
sudo apt install -y libcec-dev cec-utils
# Plug in the adapter, then test:
echo 'scan' | cec-client -s -d 1
# Expect: scan output listing CEC devices on the HDMI bus
```

Then in the app: CEC Discovery page → "Scan for Devices" → map discovered TVs to outputs.

**Limitations:**
- One adapter controls one HDMI bus (one TV / chain) at a time. For a 25-TV install you'd need 25 adapters — operators almost never bother.
- Samsung TVs need **Anynet+** enabled in TV settings for CEC to work (Settings → General → External Device Manager → Anynet+ → On).
- Anynet+ CAUSES PROBLEMS too — some Wolf Pack firmwares emit CEC standby when routing changes, which power-cycles every TV with Anynet+ on. Most venues leave Anynet+ OFF and use Samsung's REST API for power control instead.

---

## §7. Audio DSPs

### 7.1 dbx ZonePRO (TCP 3804, scene 1 auto-recall on connect per CLAUDE.md §7)

**What you have:** dbx ZonePRO 640m / 641m / 1260m / 1261m. The "m" variants support 3rd-party TCP control on port 3804 (non-m models do not — they're config-only via the front USB port). The 1260/1260m have 6 output zones; 1261/1261m have 12.

**Pre-flight checks:**
- M-series confirmed (check model label on rear panel)
- Network cable connected to the rear Ethernet port
- Static IP assigned via ZonePRO Designer (the manufacturer's Windows config app)
- ZonePRO Designer has been used to: define zones, define source mappings, save Scene 1 with the venue's normal routing state
- Router object IDs noted from ZonePRO Designer (they vary per install — e.g. zone 1 might be `0x0105001F`)

**Setup: verify TCP 3804 reachability:**

```bash
nc -zv <ip> 3804
# Expect: succeeded
```

**Setup: add via Audio Processor UI.**

Device Config → Audio Processors → "Add Processor":
- Type: **dbx ZonePRO**
- Model: 1260m / 1261m / etc.
- Name: e.g. "Lucky's Main Audio"
- IP: e.g. `192.168.10.50`
- TCP Port: 3804 (default)
- Node Address: 30 (configurable in ZonePRO Designer; 30 = `0x001E`)
- **sceneOnConnect**: Scene 1 (CRITICAL — see below)
- Test connection → should succeed (no response from device, just TCP handshake)

**CRITICAL — failsafe mode + sceneOnConnect (CLAUDE.md §7):**

Opening a new TCP connection to the dbx ZonePRO triggers its built-in failsafe mode. Failsafe SHIFTS source indices — e.g. Spotify (index 10) may become S/PDIF input 2 (index 8). Audio routes incorrectly with no warning.

**Fix:** the `DbxTcpClient` auto-recalls Scene 1 on every new TCP connection. Scene recall restores normal routing after failsafe activation. The UI exposes `sceneOnConnect` as a setting — leave it set to 1 for Scene 1. Scene 1 in ZonePRO Designer MUST hold the correct routing.

**CRITICAL — TCP vs RS-232 framing (CLAUDE.md §7 / packages/dbx-zonepro/README.md):**

| | RS-232 (Serial) | TCP (Port 3804) |
|---|---|---|
| Prefix | F0/64/00 | None |
| Checksum | Required | None |
| Frame | Wrapped HiQnet | Raw HiQnet only |

**Do NOT use RS-232 framing over TCP.** Commands will be silently ignored — the device gives no error, just nothing happens. If you find yourself debugging "commands sent but no audio change", first verify the frame format. The protocol is fire-and-forget over TCP (no response from device).

**Source index mapping (per-install, defined in ZonePRO Designer):**

| Index | Source (Lucky's example) |
|---|---|
| 0 | None |
| 1 | ML1 (mic/line input 1) |
| 2 | ML2 |
| 3 | DJ (ML3/ML4 stereo pair) |
| 7 | S1 — Jukebox (S/PDIF 1) |
| 8 | S2 — TV1 (S/PDIF 2) |
| 9 | S3 — TV2 (S/PDIF 3) |
| 10 | S4 — Spotify (S/PDIF 4) |

**Volume safety:** SV `0x0001` is the fader, UWORD 0-415. Normal listening level is ~95. Never test above 125. Maximum value 415 is approximately +12 dB above unity — will blow speakers / ears.

**Verification:** mute/unmute a zone, set volume to 50, route a source. Audio in that zone should reflect changes within ~1 second.

### 7.2 BSS Soundweb London (HiQnet TCP 1023)

**What you have:** BSS Soundweb London BLU-50 / 100 / 120 / 160 / 320 / 800 / 806 / 806DA. Controlled via HiQnet over TCP port 1023. Some models add Dante or CobraNet for digital audio networking; control protocol is the same regardless.

**Pre-flight checks:**
- BSS unit powered on, network cable to rear Ethernet
- Static IP assigned via BSS Audio Architect (the manufacturer's Windows config app)
- Audio Architect has been used to load a design that exposes the control objects (zone volume, mute, source selection)
- Object IDs noted — they're per-design and you MUST match what's deployed

**Setup: verify TCP 1023 reachability:**

```bash
nc -zv <ip> 1023
# Expect: succeeded
```

**Setup: add via Audio Processor UI.**

Device Config → Audio Processors → "Add Processor":
- Type: **BSS Soundweb London**
- Model: BLU-160 / BLU-806 / etc.
- Name: e.g. "Patio Audio"
- IP: e.g. `192.168.1.51`
- TCP Port: 1023 (default)
- Object IDs: enter per-zone object IDs from your Audio Architect design

**Verification:** test mute on zone 1 — audio should stop in that zone.

### 7.3 Shure SLX-D wireless mic receiver (TCP 2202, front-panel "Allow Third-Party Controls" → Enable per CLAUDE.md §7a)

**What you have:** Shure SLX-D digital wireless receiver — SLXD4, SLXD4D, SLXD14, SLXD14D, SLXD24, **SLXD24D** (most common dual-mic build). G58 (470-514 MHz) is the most common US frequency band SKU.

**This is for monitoring only.** The receiver's analog outputs feed into the Atlas / dbx / BSS audio processor as a normal input — this package does NOT replace any DSP function. It reads battery, RSSI, frequency, and TX type from the receiver over TCP and uses that telemetry to:
1. Show live mic status on the bartender Audio tab
2. Detect RF interference (game-day stadium-adjacent ENG truck bleed) and label corresponding Atlas priority events as `rf_induced_mic_active` so operators stop chasing ghost overrides

**Pre-flight checks — RUN THE PREFLIGHT API:**

```bash
curl -s -X POST http://localhost:3001/api/shure-rf/preflight \
  -H "Content-Type: application/json" \
  -d '{"ip":"<receiver-ip>","port":2202}' | python3 -m json.tool
```

This returns a checklist:
- TCP reachable on 2202
- Third-Party Controls enabled (NOT blocked)
- Firmware version ≥ 1.1.0
- Model recognized

If ANY check fails, fix it before adding the receiver — the preflight gate catches the BLOCKED-third-party-controls failure mode that otherwise looks like a network problem.

**CRITICAL — front-panel gate:**

`Menu → Advanced → Network → Allow Third-Party Controls → Enable`

Defaults to **BLOCKED** on new units and can reset to BLOCKED after firmware updates. Without this enabled, port 2202 accepts the TCP connection but **silently drops every command**. Symptom: "connected, no state cache populating" after the seed GET. This is the #1 first-install failure.

**Setup: add via Audio Processor UI (or Wireless Mics tab at v2.34.2+).**

Device Config → Audio Processors → "Add Processor" → Type: **Shure SLX-D**:
- Model: SLXD4 / SLXD4D / SLXD24D / etc.
- Name: e.g. "Bar Wireless Mics"
- IP: e.g. `192.168.1.55`
- TCP Port: 2202 (default)
- Receiver name: visible label
- Auto-reconnect: ON

Canonical operator home at v2.34.2+: **Device Config → Audio → Wireless Mics** tab. One place for setup, pre-flight test, live battery + RSSI + frequency tile per channel, event history, dedicated-log-file path, mock-receiver developer command.

**Protocol gotchas (full list in `packages/shure-slxd/README.md`):**
- Wire-protocol property names per Shure's "SLX-D Command Strings v2 (2020-G)" spec: **`TX_MODEL`** (not `TX_TYPE`), **`GROUP_CHANNEL`** (not `GROUP_CHAN`). Confirmed live on Holmgren SLXD4D firmware 1.4.7.0.
- Network-side **frequency scan does NOT exist** in SLX-D firmware 1.4.7.0. Only front-panel Group Scan / Channel Scan, or WWB6 (different protocol), or our software-side per-frequency hop (`POST /api/shure-rf/find-clean-freq` — causes an audible click on every hop).
- FREQUENCY is 6-digit kHz (e.g. `537125` = 537.125 MHz), not 7-digit kHz×100.
- RSSI on SLX-D is COMBINED (no per-antenna A/B split) and SAMPLE-only — no REP push for RSSI changes.
- METER_RATE range 50-60000 ms. We use 1000 ms for game-day RF detection (Bitfocus recommends 5000 ms baseline; faster locks the receiver's web UI).
- **Receiver SILENTLY DROPS malformed/out-of-range commands** — no ERR/NAK frame exists in the protocol. Validate via REP echo if certainty needed.

**Verification — battery + RSSI tile visible:**

Navigate to `/remote` → Audio tab → bottom of page should show `ShureMicStatusPanel` with per-channel battery bars and signal quality. Polls every 3s via `GET /api/shure-rf/status`.

**Verification — dedicated log file rotating daily:**

```bash
ls -la /home/ubuntu/sports-bar-data/logs/shure-rf-*.log
# Expect: today's file present, format shure-rf-YYYY-MM-DD.log
tail -5 /home/ubuntu/sports-bar-data/logs/shure-rf-$(date +%Y-%m-%d).log
# Format: ISO_TS | LEVEL | receiverId | ch | event | rssi_dbm | freq_mhz | tx_type | note
```

30-day retention. Mirrored through `@sports-bar/logger` for PM2 visibility but the dedicated file is the audit source of truth.

---

## §8. SDR spectrum monitor (NESDR Smart / RTL-SDR)

**What you have:** an RTL-SDR-compatible USB dongle — NooElec NESDR Smart (~$35, recommended) or any RTL-SDR v3 derivative. Coverage 25 MHz – 1.7 GHz, more than enough for G58 wireless mics (470-514 MHz) plus the surrounding TV broadcast spectrum.

**Purpose:** complement the Shure receiver's narrow per-channel view with a wide-band sweep so the system sees ALL RF activity in the band, not just on the tuned mic freqs. Provides cross-confirmation for Shure interference events + early warning when a new carrier appears in the band before it hits the mic channel.

### 8.1 USB plug + DVB-USB blacklist (per setup-sdr.sh)

**The #1 first-install failure:** the kernel's `dvb_usb_rtl28xxu` driver grabs the dongle before user-space `rtl_power` / `rtl_test` can claim it. Symptom: `rtl_test` fails with `usb_claim_interface error -6`. The setup script blacklists the DVB modules; without that, nothing works.

**Don't plug in the dongle yet** — run the setup script first.

### 8.2 Run sudo bash scripts/setup-sdr.sh

```bash
sudo bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/setup-sdr.sh
```

The script (idempotent — safe to re-run):
1. `apt install -y rtl-sdr` if missing
2. Writes `/etc/modprobe.d/blacklist-rtl.conf` with `dvb_usb_rtl28xxu`, `rtl2832`, `rtl2830`, `e4000`, `rtl2838` blacklisted
3. Live-unloads any currently-loaded DVB modules via `rmmod` (no reboot needed)
4. Appends `SDR_ENABLED=auto` to `.env` if not already set
5. Runs `rtl_test -t` to confirm dongle visibility (if plugged in)

**Now plug in the dongle.**

```bash
rtl_test -t 2>&1 | head -10
# Expect: "Found 1 device(s):" followed by device info, no usb_claim_interface error
```

If you see the error, reboot the box once — that guarantees the DVB blacklist takes effect.

### 8.3 Set SDR_ENABLED=auto in .env

The setup script does this. Confirm:

```bash
grep SDR_ENABLED /home/ubuntu/Sports-Bar-TV-Controller/.env
# Expect: SDR_ENABLED=auto
```

**Modes:**
- `auto` (recommended) — start watcher only when dongle detected, probe every 5 min
- `true` — force-start, error if no dongle
- `false` / unset — off, no probes

Restart PM2 to pick up the env change:

```bash
pm2 restart sports-bar-tv-controller --update-env
```

### 8.4 Auto band-tracking from Shure receivers

`SDR_BAND_PRESET=auto` (default) reads `shureSlxdClientManager.getSnapshots()` every 5 min, sweeps `MIN-5 MHz` to `MAX+5 MHz` across the actual Shure receiver freqs. When you add an H55-band receiver later, the SDR sweep automatically follows.

**Other presets** (set via `SDR_BAND_PRESET` in `.env`):
- `uhf-wireless` — 470-700 MHz fixed (covers G58 + H55 + J50A + J52A)
- `full-uhf` — 470-960 MHz
- `custom` — use `SDR_BAND_START_MHZ` / `SDR_BAND_END_MHZ`

The watcher spawns `rtl_power -f <start>M:<end>M:25k -i 1 -e 0 -g 25` as a long-lived child process. Parses CSV output line-by-line:
- **Aggregator:** max/avg/count per (minute, freq) bucket → flushed to `sdr_spectrum` at minute rollover. Storage budget ~290 MB/year.
- **Carrier detection:** per-freq bin, count consecutive samples ≥ `-85 dBm` threshold → rising-edge `carrier_active` row. CARRIER_CLEAR_SAMPLES=5 → falling-edge `carrier_cleared` row. Heartbeat every 30s while active.

### 8.5 Verify via /device-config → Audio → Wireless Mics → RF Spectrum Monitor

Navigate to that page. Three possible render states:
- **Disabled** — SDR not configured, setup instructions shown
- **Waiting for sweep** — dongle detected, first sweep cycle not yet complete (yellow warn box)
- **Live** — waterfall canvas + active-carriers list

Waterfall is annotated with our Shure freqs (cyan vertical lines) + Green Bay TV station edges WCWF/WLUK (dashed white lines). Click any column to inspect 7-day peak-stats for that frequency.

The whole panel is wrapped in `SafeBoundary` — a render crash shows a tiny red inline card, doesn't escalate to the global "Something went wrong" page boundary.

**API endpoints:**

```bash
# Liveness + active-carriers
curl -s http://localhost:3001/api/sdr/status | python3 -m json.tool

# Historical waterfall data
curl -s "http://localhost:3001/api/sdr/history?minutesAgo=60" | python3 -m json.tool | head -100

# Per-freq peak stats (foundation for the recurring-pattern detector + frequency-suggestion engine)
curl -s "http://localhost:3001/api/sdr/peak-stats?daysAgo=7&topN=20" | python3 -m json.tool
```

**Cross-confirmation with Shure:** when `shure-rf-watcher` fires `rf_interference`, it queries `sdr_carriers` within ±60s at the same freq (±50 kHz tolerance). If matched, the event's `note` gets `(SDR-confirmed, SDR peak X dBm)`. UI shows a purple "SDR-confirmed" badge on event-history rows. The Ollama pattern digest weights these higher when recommending mitigation.

**Common pitfalls:**
- Reboot recommended if the blacklist was just newly created — guarantees DVB modules don't reload on USB plug.
- `rtl_test` showing "PLL not locked" warnings is normal on the first few seconds — ignore unless persistent.
- USB hubs sometimes don't deliver enough power for an RTL-SDR. Plug directly into the NUC's USB port.

---

## §9. Lighting / commercial controls

### 9.1 DMX (ArtNet, Enttec, PKnight CR011R)

**What you have:** a DMX512 lighting universe controlling fixtures (par cans, moving heads, color-changing strips). Two transport options:
- **USB DMX adapter** — Enttec Pro / Open DMX USB, PKnight CR011R. Plug into NUC USB port.
- **Network Art-Net node** — Enttec ODE, DMXking, generic. UDP 6454.

**Pre-flight checks:**
- Fixtures patched (each fixture's DMX start address set on the fixture itself)
- USB adapter shows in `lsusb` OR Art-Net node has IP on the network
- DMX cable run from adapter/node to first fixture, daisy-chained to subsequent fixtures, terminated at the end

**Setup: install DMX dependencies (already in package.json; pulled by npm ci).**

```bash
# No separate install needed — packages/dmx ships the serial driver as a Node.js dep.
# Confirm USB adapter is visible:
ls -la /dev/ttyUSB*
# Or, for Art-Net node:
ping <node-ip>
```

**Setup: add via DMX admin page (if your build has the UI).**

DMX Admin → "Add Adapter":
- Type: USB DMX / Art-Net / Maestro
- Adapter: select from dropdown (USB devices auto-detected)
- Or Art-Net IP if network node
- Universe: 1 (default — most installs only use one universe)

**Setup: define scenes.**

DMX Admin → "Scenes" → "New Scene":
- Name: e.g. "Pregame Bright"
- Channels: set each fixture's intensity / color values
- Save

**Setup: game-event reactor (optional).**

`packages/dmx/src/game-event-reactor.ts` drives lights from sports game events (touchdown → strobe + color burst). Enable in DMX Admin → "Game Events" → toggle ON.

**Verification:** trigger a scene from the UI. Lights respond within ~50ms (Art-Net) or ~100ms (USB).

### 9.2 Lutron Caséta / RA3

**What you have:** Lutron Caséta Smart Bridge Pro 2 OR Lutron RA3 processor. Caséta uses LEAP (TLS) protocol; older Homeworks/RadioRA2 uses LIP (Telnet).

**Pre-flight checks:**
- Lutron processor on the network with static IP
- For LEAP: paired CA-signed certs (generated via the official Lutron pairing flow — `pyenv install python3.x; pip install pylutron-caseta; lap-pair <bridge-ip>`)
- For LIP: Telnet port 23 enabled, integration password set

**Setup: add via lighting admin.**

Lighting Admin → "Add System":
- Type: Lutron LEAP / Lutron LIP
- IP: bridge IP
- Cert files (LEAP only): paste contents OR upload PEM files
- Integration password (LIP only)
- Test connection

**Setup: discover devices.**

After test passes, click "Discover" → polls processor for all paired switches, dimmers, scenes. Adds rows to the lighting DB tables.

**Common pitfalls:**
- LEAP needs paired CA-signed certs. Use the official `lap-pair` Python tool to generate. Without certs, every connection attempt returns "Hello" then closes.
- Hue v2 endpoints require an `application-key` header — provisioned via Hue Bridge button-press flow (see §9.3).

### 9.3 Philips Hue (Hue Bridge discovery)

**What you have:** Philips Hue Bridge (square white box, Ethernet to router) + Hue bulbs paired via the Hue app.

**Pre-flight checks:**
- Hue Bridge on the network (LED lights up after ~30 sec)
- Hue mobile app installed, used to add bulbs to the bridge
- Bridge IP known (Hue app → Settings → Hue Bridges → tap the bridge → IP visible)

**Setup: discover the bridge.**

Two options:
1. **mDNS discovery** — `curl https://discovery.meethue.com/` returns JSON with all Hue bridges on your subnet
2. **Manual IP** — enter directly in the Lighting Admin UI

**Setup: pair (button-press flow).**

This is a one-time pairing handshake:

1. Lighting Admin → "Add Hue Bridge" → enter IP → "Pair"
2. **Walk to the Hue Bridge** and press the round button on top
3. Within 30 seconds, click "Confirm" in the UI
4. Bridge generates an `application-key` and sends it back. App stores in the DB.

After this, all subsequent requests use the application-key header — no re-pairing needed unless the bridge factory-resets.

**Setup: discover bulbs + groups.**

Lighting Admin → click into the Hue Bridge → "Discover Devices" → polls bridge for all paired bulbs / groups / scenes.

**Verification:** toggle a bulb on/off from the UI. Bulb responds within ~200ms.

---

## §10. AI Hub (per-location)

**What you have:** the host NUC with an Intel iGPU. Goal is to run Ollama locally (no cloud calls) so AI Suggest, AI Hub chat, and pattern digests work without external API costs.

### 10.1 Hardware prerequisites (Intel Iris Xe iGPU — see FLEET_STATUS.md)

**Required:** Intel Iris Xe or Intel Arc iGPU with level-zero driver support. Verify:

```bash
lspci | grep -iE 'vga|3d|display' | grep -i intel
# Expect: at least one Intel VGA/3D/Display controller line
# Examples: "Intel Corporation Iris Xe Graphics"
#           "Intel Corporation Device a7a0" (newer Raptor Lake-P)
```

If the line is AMD or Nvidia: the IPEX-LLM Ollama setup will NOT work. The location stays on upstream CPU-only Ollama at ~3 tok/s and `setup-iris-ollama.sh` refuses to run. Document the hardware in `.claude/locations/<branch>.md`.

Current fleet status per location: see `docs/FLEET_STATUS.md`.

### 10.2 Run setup-iris-ollama.sh

See §1.9 for the full description. Repeating the critical steps:

```bash
bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/setup-iris-ollama.sh
```

**Verify after running:**

```bash
systemctl is-active ollama-ipex
# Expect: active

sudo journalctl -u ollama-ipex --since=5m | grep "using Intel GPU"
# Expect: one or more matches

# Confirm the API responds
curl -s http://localhost:11434/api/tags | python3 -m json.tool
# Expect: { "models": [...] }
```

### 10.3 Pull AI models with `sg ollama -c 'ollama pull ...'`

**Standing rule (CLAUDE.md Rule #10):** all locations stay on the LATEST model versions. Weekly check `ollama list` vs ollama.ai.

```bash
# Chat model (default for AI Suggest, /api/chat — line ~52 OLLAMA_MODEL)
sg ollama -c 'ollama pull llama3.1:8b'

# Embedding model (RAG vector store)
sg ollama -c 'ollama pull nomic-embed-text'

# Larger chat model (slower, better quality for hard questions — optional)
sg ollama -c 'ollama pull qwen2.5:14b'
```

**When a model major version releases** (e.g. `llama3.2:8b`):
1. Pull the new model: `sg ollama -c 'ollama pull llama3.2:8b'`
2. Verify on the RAG grill suite: `npm run rag:test`
3. Switch default in `apps/web/src/app/api/chat/route.ts` (~line 52, `OLLAMA_MODEL` constant)
4. **Re-embed the RAG store after embedding-model majors** (because chunk vectors are incompatible across embedding model major versions)

### 10.4 Re-index RAG store

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
npm run rag:scan          # Incremental — adds new docs only
npm run rag:scan:clear    # Full re-index — clears vector store first (after embedding-model changes)
```

Re-index after embedding model changes, or weekly via cron for fresh content.

**Setup: optional weekly cron.**

```bash
crontab -e
# Add line:
0 3 * * 0 cd /home/ubuntu/Sports-Bar-TV-Controller && npm run rag:scan >> /home/ubuntu/sports-bar-data/logs/rag-scan.log 2>&1
# Sundays at 3 AM
```

### 10.5 Verify chat works

Open `http://<host-ip>:3001/ai-hub` in a browser, log in, ask a question. Should get a coherent answer within 10-30s.

Or test via API:

```bash
curl -s -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"How do I configure CEC cable box control?"}]}' \
  --max-time 120 | python3 -m json.tool
# Expect: response with "answer" field, takes ~10-30s on iGPU, 60-120s on CPU
```

### 10.6 Optional: cron weekly RAG refresh

Already covered in §10.4. Plus:

```bash
# Weekly Ollama model freshness check (Standing Rule #10)
0 4 * * 1 ollama list > /tmp/ollama-versions.txt
# Then have a human / Claude review the file weekly
```

---

## Appendix: Common gotchas across all equipment

**This is a consolidated quick-reference for the most-common cross-cutting issues operators hit. Each item has a full treatment in CLAUDE.md.**

### A1. Body stream already consumed (API routes)

`validateRequestBody()` reads the request body. NEVER call `request.json()` after — use `validation.data`. Affects POST/PUT/PATCH; GET has no body, use `validateQueryParams()` instead. (CLAUDE.md Gotcha #1)

### A2. PM2 restart vs delete+start

`pm2 restart` does NOT re-read `.env` via `ecosystem.config.js` — only `pm2 delete` + `pm2 start` does. Use restart for code-only changes; delete+start when env vars or ecosystem config changed. Force-rebuild before restarting if package source changed:

```bash
rm -rf apps/web/.next .turbo node_modules/.cache
npx turbo run build --force
pm2 restart sports-bar-tv-controller --update-env
```

### A3. Production DB path

ALWAYS `/home/ubuntu/sports-bar-data/production.db`. Set in `apps/web/drizzle.config.ts` + env. Dev environments may differ.

### A4. Matrix Config per-location values (CRITICAL — outputOffset)

See §2.1 in this playbook. Wrong `outputOffset` silently misroutes to wrong physical TVs with no error. (CLAUDE.md Gotcha #4)

### A5. Device data: DB is source of truth

Devices are stored in `DirecTVDevice`, `FireTVDevice` tables — NOT JSON files. JSON files (`apps/web/data/*.json`) are seed-only on first boot. After that, the DB is the source of truth. To re-seed, delete DB rows and restart the app. (CLAUDE.md Gotcha #5)

### A6. drizzle-kit push fails silently on pre-existing indexes

See §1.4 in this playbook. Always verify newly-added tables/columns exist after push. (CLAUDE.md Gotcha #6)

### A7. Location data files get blanked on merge from main

Main has empty template JSON files (`tv-layout.json` = 61 bytes, etc.). When merging main → location branch, git can silently overwrite real data with templates if there's no conflict.

**After every merge from main, verify:**

```bash
wc -c apps/web/data/tv-layout.json
# Must be >500 bytes at a configured location
```

If blanked, restore: `git show HEAD~1:apps/web/data/tv-layout.json > apps/web/data/tv-layout.json`

### A8. BartenderLayout must include rooms

The bartender Video tab reads both `zones` AND `rooms` from `BartenderLayout` DB table. If `rooms` is empty, room filter tabs won't appear. Auto-seeder handles fresh installs; existing locations need the `rooms` column populated.

### A9. Prime Video on Fire TV Cubes is launcher-hosted (CLAUDE.md Gotcha #9)

See §4.6 in this playbook. `com.amazon.avod` does NOT exist on AFTR / PVFTV Cubes — Prime Video lives in `com.amazon.firebat`. Always `pm path` to verify, never trust the catalog blindly.

### A10. Next.js bundles each route handler separately → module-private singletons are PER-BUNDLE (CLAUDE.md Gotcha #10)

Hoist any cross-route singleton to `globalThis` via `Symbol.for(...)`. Affects: TCP/UDP socket managers, connection pools, in-memory caches mirroring external state, anything binding an OS resource. Applied to `atlasClientManager`, `shureSlxdClientManager`. Pattern:

```typescript
public static getInstance(): YourClass {
  const KEY = Symbol.for('@your-pkg/YourClass.instance')
  const g = globalThis as any
  if (!g[KEY]) g[KEY] = new YourClass()
  return g[KEY] as YourClass
}
```

Add per-key in-flight Promise lock to close race window between concurrent `getClient(K)` calls.

### A11. Nginx allow-list for new /api/ routes

Bartender :3002 proxy uses a strict allow-list. New `/api/foo/` routes return 403 there until added to `scripts/setup-bartender-nginx.sh` AND the script re-run. Update script + add to LOCATION_UPDATE_NOTES manual-steps in the same commit.

### A12. ADB shell 3s timeout silently truncates dumps (CLAUDE.md memory)

`adb-client.ts:executeShellCommand` default is 3000ms — aborts `uiautomator dump` on launcher home screens with empty output. The walker passes 10000ms (v2.32.89). If you write new ADB shell calls that dump long output, pass a 10s timeout.

### A13. IPEX-LLM Ollama SYCL quirks

- `qwen2.5:14b` DOES accelerate on Iris Xe — earlier FLEET_STATUS claim was wrong
- `ollama ps` reports `size_vram=0` even when GPU-loaded — use `intel_gpu_top` to verify GPU is busy
- Default AI Suggest model is `llama3.1:8b` (line ~52 OLLAMA_MODEL in `apps/web/src/app/api/chat/route.ts`)

---

## Where to go next

After bringing equipment online, document the change:

1. **Per-version setup note** — add an entry to `docs/VERSION_SETUP_GUIDE.md` under the current version's "Required Manual Steps" so other locations can replicate
2. **Per-release operator note** — add a one-liner to `docs/LOCATION_UPDATE_NOTES.md` describing what shipped + what to verify
3. **Per-location reference** — if hardware-specific (IPs, ports, quirks), add to `.claude/locations/<branch>.md` (NOT to CLAUDE.md — CLAUDE.md is shared template)
4. **API reference** — if you added/changed an API route, update `docs/API_REFERENCE.md`
5. **Hardware reference** — if a new piece of equipment was added, update `docs/HARDWARE_CONFIGURATION.md`

For deeper dives on any specific subsystem, the canonical sources are:

- **`CLAUDE.md`** — architecture overview, standing rules, gotchas
- **`docs/NEW_LOCATION_SETUP.md`** — fresh-install runbook (more detailed than §1 here)
- **`docs/HARDWARE_CONFIGURATION.md`** — per-hardware setup matrix
- **`docs/VERSION_SETUP_GUIDE.md`** — per-release manual steps
- **`docs/IR_LEARNING_DEMO_SCRIPT.md`** — IR learning walk-through with screenshots
- **`docs/IR_EMITTER_PLACEMENT_GUIDE.md`** — IR emitter placement diagrams
- **`docs/WOLFPACK_HTTP_API_REFERENCE.md`** — Wolf Pack HTTP protocol details
- **`docs/FLEET_STATUS.md`** — per-location OS / version / iGPU / outstanding work
- **`docs/OS_UPGRADE_RUNBOOK.md`** — Ubuntu 22.04 → 24.04 upgrade procedure
- **`packages/<name>/README.md`** — per-vendor SME briefing for that protocol family

For vendor docs (manuals, command-string specs, API references), see:

- `docs/by-equipment/atlas-azm8/` — AtlasIED protocol + firmware notes
- `docs/by-equipment/shure-slxd/` — Shure SLX-D command strings spec
- `docs/by-equipment/shure-sdr/` — SDR roadmap + AI RF SME notes
- `docs/by-equipment/wolfpack-matrix/` — Wolf Pack manuals
- `docs/by-equipment/crestron-dm/` — Crestron DM docs (when populated)
- `docs/by-equipment/dbx-zonepro/` — dbx ZonePRO protocol + models
- `docs/by-equipment/bss-soundweb/` — BSS HiQnet protocol
- `docs/by-equipment/firetv/` — Fire TV ADB API + quick reference
- `docs/by-equipment/directv/` — DirecTV SHEF API
- `docs/by-equipment/global-cache-itach/` — iTach API v1.5 spec
- `docs/by-equipment/dmx-artnet/` — Art-Net protocol + PKnight CR011R notes
- `docs/by-equipment/lutron/` — Lutron LEAP + LIP integration
- `docs/by-equipment/philips-hue/` — Hue CLIP v2 API
- `docs/by-equipment/pulse-eight-cec/` — Pulse-Eight CEC docs
- `docs/by-integration/espn-api/`, `mlb-api/`, `nfhs/`, `rail-media/`, `thesportsdb/` — sports data sources
- `docs/by-integration/ollama-iris/` — IPEX-LLM Ollama specifics
- `docs/by-integration/n8n/` — n8n automation integration
- `docs/by-integration/soundtrack/` — Soundtrack Your Brand music streaming
