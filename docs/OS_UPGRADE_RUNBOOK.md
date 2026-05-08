# OS Upgrade Runbook — Ubuntu 22.04 (jammy) → 24.04 (noble)

**Purpose:** Bring the three Ubuntu 22.04 fleet locations (graystone, greenville, appleton) up to 24.04 to align the fleet on a single LTS, unblock iGPU acceleration via the Intel `noble` apt repo, and extend the support window from April 2027 → April 2029.

**This is a maintenance task, not an emergency.** Each location's upgrade is ~45-60 minutes hands-on plus a reboot. Schedule during slow hours and never run two locations simultaneously.

---

## Locations to upgrade (current as of 2026-05-07)

| Location | Branch | Tailscale IP | Current OS | Hardware notes |
|---|---|---|---|---|
| graystone | `location/graystone` | 100.93.130.14 | jammy 22.04 | i5-1340P + Iris Xe; `/dev/dri/` currently empty (kernel module not bound — upgrade should fix) |
| greenville | `location/stoneyard-greenville` | 100.112.255.60 | jammy 22.04 | i9-13900HK + Iris Xe |
| appleton | `location/stoneyard-appleton` | 100.107.223.47 | jammy 22.04 | i9-13900HK + Iris Xe |

Already on noble, no action needed:
- holmgren-way, leg-lamp, lucky-s-1313

---

## Recommended order

1. **graystone first** — lowest-traffic location of the three (small bar; less catastrophic if rollback is needed). Also the test for the kernel-module-not-bound case — the upgrade will install a newer kernel, which should bind i915 properly.
2. **appleton second** — Stoneyard sister, learn from greenville.
3. **greenville third** — busiest of the jammy three; do this last when the procedure is proven on graystone + appleton.

Spread across three different days/weeks. Don't batch.

---

## Per-location runbook (do this for each)

### Step 0 — Schedule + announce (operator side)

- Pick a 2-hour window during slow hours (Tue/Wed afternoon ideal). Sports Sundays are no-go.
- Tell on-site staff that the bartender remote will be down ~30 min during reboot; old-school IR remotes still work.
- Have a phone open in case Tailscale SSH needs help.
- Confirm a backup operator is reachable.

### Step 1 — Pre-flight backups (15 min)

SSH into the location:
```bash
ssh ubuntu@<TAILSCALE_IP>
```

Take backups:
```bash
TS=$(date +%Y%m%d-%H%M)
mkdir -p /home/ubuntu/sports-bar-data/pre-upgrade-$TS

# Database
cp /home/ubuntu/sports-bar-data/production.db \
   /home/ubuntu/sports-bar-data/pre-upgrade-$TS/production.db

# Built app (so we can restore PM2 to a known-good state)
sudo tar czf /home/ubuntu/sports-bar-data/pre-upgrade-$TS/next-build.tgz \
   -C /home/ubuntu/Sports-Bar-TV-Controller/apps/web .next 2>/dev/null

# PM2 process list
pm2 save
cp ~/.pm2/dump.pm2 /home/ubuntu/sports-bar-data/pre-upgrade-$TS/

# Env + ecosystem
cp /home/ubuntu/Sports-Bar-TV-Controller/.env \
   /home/ubuntu/sports-bar-data/pre-upgrade-$TS/.env

# Package state
dpkg -l > /home/ubuntu/sports-bar-data/pre-upgrade-$TS/packages.txt
uname -a > /home/ubuntu/sports-bar-data/pre-upgrade-$TS/kernel.txt

ls -la /home/ubuntu/sports-bar-data/pre-upgrade-$TS/
```

Verify the backup directory has all 6 files. **If any are missing, stop and investigate before continuing.**

### Step 2 — Note the current state (5 min)

```bash
# What's currently working — record it so we can compare post-upgrade
echo "=== PRE-UPGRADE STATE ==="
lsb_release -cs                                    # jammy
uname -r                                            # current kernel
systemctl is-active nginx ollama
pm2 status
curl -s http://localhost:3001/api/system/health | head -c 200
bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/verify-install.sh
```

Save the output to a paste somewhere (Slack, notes app) — you'll compare against this after the upgrade.

### Step 3 — Update jammy packages first (10 min)

```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get autoremove -y
```

This installs all available jammy security/bugfix updates. **If any package fails to install, stop and resolve before the do-release-upgrade.** A clean jammy is the prerequisite for a clean noble.

### Step 4 — Install update-manager-core if missing

```bash
sudo apt-get install -y update-manager-core
# Verify the upgrade tool is set to LTS-only (default)
grep -E '^Prompt=' /etc/update-manager/release-upgrades
# Expect: Prompt=lts
```

### Step 5 — Run do-release-upgrade (30-45 min)

```bash
sudo do-release-upgrade
# If it says "no upgrade available", try: sudo do-release-upgrade -d
# (the -d gets the latest LTS even if release_upgrade_available isn't yet set)
```

**Interactive prompts to expect:**

- **"Continue running under SSH?"** → **Yes**. The upgrader opens a backup SSHD on port 1022 in case the main one breaks.
- **"Updating repository information"** → wait.
- **"You have changed config files for ___. Use new version / keep old / show diff?"**
  - `/etc/ssh/sshd_config` → **keep old** (we have specific settings).
  - `/etc/sudoers.d/ubuntu-nopasswd` → **keep old** (we set this; don't lose it).
  - `/etc/nginx/sites-available/bartender-remote` → **keep old** (we manage this via setup script).
  - Any config under `/etc/systemd/system/` related to `ollama` or `ollama-ipex` → **keep old**.
  - For everything else (`/etc/services`, `/etc/cron.daily/*`, etc.) → **install new** unless you have specific changes.
- **"Restart services during package upgrades without asking?"** → **Yes** (saves prompts).
- **"Remove obsolete packages?"** → **Yes**.
- Finally **"Reboot required to complete upgrade. Restart now?"** → **No** initially — do final checks first (next step).

### Step 6 — Final checks BEFORE rebooting

```bash
# Confirm noble landed on disk
lsb_release -cs                                    # noble
cat /etc/os-release | grep VERSION_ID              # 24.04

# Confirm pm2/node/sqlite/ollama still installed
which pm2 node sqlite3 ollama
node --version                                     # ≥ 18.17

# Confirm app starts (it might already be online; we're sanity-checking the new libs work)
pm2 status
```

If any of those fail, **stop and investigate before rebooting**. PM2 / Node / Ollama use shared libs from libc — if those got mangled in the upgrade, app won't start after reboot either. Better to fix on a still-running system.

### Step 7 — Reboot (5 min)

```bash
sudo reboot
```

You'll lose SSH for ~2-3 min. Reconnect via Tailscale once the box is up.

### Step 8 — Post-reboot verification (15 min)

```bash
ssh ubuntu@<TAILSCALE_IP>

# Codename + kernel
lsb_release -cs                                    # noble
uname -r                                            # 6.8.x or newer

# /dev/dri/ should now be populated (the new kernel binds i915 properly)
ls /dev/dri/
# Expect: by-path  card1  renderD128
# (graystone specifically: this is what we've been waiting for!)

# PM2 + app
pm2 resurrect                                      # if processes aren't online
pm2 status
curl -s http://localhost:3001/api/system/health | head -c 200

# verify-install
bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/verify-install.sh
# Expect: PASS 7/7

# Bartender proxy
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3002/
# Expect: 302
```

### Step 9 — Hardware reality check (10 min)

Walk through each hardware integration to confirm nothing regressed:

```bash
# Wolf Pack matrix
curl -s http://localhost:3001/api/matrix/routes | head -c 400

# Audio processor (Atlas/dbx/BSS — whichever this venue has)
curl -s http://localhost:3001/api/audio-processor

# Fire TVs (if any are still on the swap list at this venue, expect those to error — that's pre-existing)
curl -s http://localhost:3001/api/firetv-devices/list | head -c 400

# DirecTV
curl -s http://localhost:3001/api/directv-devices | head -c 400
```

If everything responds, walk over to the bar and ask the bartender to:
- Open the channel guide
- Switch a TV to a cable channel
- Toggle a TV's power
- Check audio still routes

If any hardware fails post-upgrade, see Rollback section.

### Step 10 — Run setup-iris-ollama.sh (10 min)

This is the payoff for the upgrade. The script (v2.32.70+) detects noble and uses the right Intel apt repo:

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
bash scripts/setup-iris-ollama.sh
```

Verify success:
```bash
systemctl is-active ollama-ipex                                                # active
sudo journalctl -u ollama-ipex --since=2m | grep "using Intel GPU"             # one match
clinfo -l                                                                       # Intel platform listed

# Trigger an AI Suggest call to confirm GPU usage
curl -s -m 200 http://localhost:3001/api/scheduling/ai-suggest | head -c 100   # HTTP 200, ~100s
```

Open the System Admin → Power tab in a browser; the GPU gauge should show ~100% during the AI Suggest call.

### Step 11 — Auto-update test

The next nightly auto-update should be a no-op since we're already at the latest version. Verify the cron is still scheduled:

```bash
sudo systemctl list-timers | grep auto-update
crontab -l | grep auto-update
```

If those are missing post-upgrade, re-install:
```bash
bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/install-auto-update-timer.sh
```

### Step 12 — Mark complete

Update `docs/OS_UPGRADE_RUNBOOK.md` (this file) with the upgrade date for this location. Cross-check the location off in `docs/VERSION_SETUP_GUIDE.md`'s v2.32.70 location table.

---

## Rollback procedure

If the upgrade leaves the location in a bad state and Step 8/9 fail, the rollback is a clean re-image. **There is no clean `do-release-downgrade`** — Ubuntu doesn't support downgrading. Plan B is to restore from the pre-upgrade backup directory + re-image.

### Quick recovery (try first)

```bash
# Restore the pre-upgrade .next build so PM2 has known-good code
TS=<the-timestamp-you-noted>
sudo tar xzf /home/ubuntu/sports-bar-data/pre-upgrade-$TS/next-build.tgz \
   -C /home/ubuntu/Sports-Bar-TV-Controller/apps/web/

# Restore DB if anything migrated badly
cp /home/ubuntu/sports-bar-data/pre-upgrade-$TS/production.db \
   /home/ubuntu/sports-bar-data/production.db

# Bounce PM2
pm2 restart sports-bar-tv-controller --update-env
```

If the app comes back, you're done — the upgrade is degraded but functional. Flag the bug and dig later.

### Full rollback (if quick recovery fails)

You're on noble now and stuck. Options:

1. **Re-install Ubuntu 22.04 jammy from an ISO** on a USB stick. Takes ~1 hour. The user data at `/home/ubuntu/sports-bar-data/` survives if the partition isn't wiped, but verify before reinstalling.
2. **Spin up a new box** in parallel, install jammy, run `bash install.sh`, restore the production.db backup, re-bootstrap location. Takes ~2 hours.

This is why we test on the lowest-traffic location (graystone) first.

---

## Common pitfalls

- **Don't ignore config file prompts.** "Use new version" can wipe `.env` overrides, sudoers entries, custom systemd units. When in doubt, **keep old** and reconcile differences later.
- **`pm2 resurrect` is required after reboot** if PM2's startup unit doesn't auto-load — verify with `systemctl list-units | grep pm2`. If missing, run the unit-install command in `docs/NEW_LOCATION_SETUP.md` step 7's troubleshooting section.
- **Snap-d daemon may steal CPU on first boot.** Wait 5 min before declaring the upgrade slow.
- **The PHP/legacy bartender-proxy.js is gone** at v2.32.57+; you should already be on Nginx. If not, run `bash scripts/setup-bartender-nginx.sh` post-upgrade.
- **firetv-catalog-walker** and `auto-reallocator` will spam errors during the reboot window — expected, they recover automatically.

---

## Status tracker

| Location | Scheduled date | Operator | Pre-upgrade verify | Post-upgrade verify | iGPU enabled | Notes |
|---|---|---|---|---|---|---|
| graystone | 2026-05-07 | sgtfulton | ✅ | ✅ | ✅ | Kernel-binding fix held — `/dev/dri/` populated with `card1`+`renderD128` post-reboot. verify-install.sh 7/7 PASS, all 40 devices online, hardware reality check + bartender remote operator-confirmed at the bar. setup-iris-ollama.sh clean install on noble (intel-opencl-icd 24.39, intel-level-zero-gpu 1.3.29735, IPEX-LLM 2.3.0b20250725). `ollama-ipex` active; journal: `using Intel GPU`. AI Suggest cold run = 170s on iGPU (vs 200-300s CPU baseline). Note: `clinfo -l` reports 0 platforms — IPEX uses Level Zero so OpenCL ICD detection isn't required, but worth investigating later. |
| appleton | 2026-05-08 | sgtfulton | ✅ | ✅ | ✅ | Smoothest of the three — Intel package set was already in place pre-upgrade so it was effectively a kernel jump. Post-reboot: noble + 6.8.0-111-generic, `/dev/dri/` populated with `card0`+`renderD128` (note: `card0` not `card1` like graystone — different DRI enumeration on this box, `renderD128` is what compute uses). verify-install.sh 7/7 PASS, 35/35 devices online, hardware reality check via API (matrix routes live, Atlas AZMP8 reachable, Fire TV + DirecTV routes alive); operator confirmed bartender remote functional at the bar pre-flight, walk-test skipped. setup-iris-ollama.sh clean install on noble (intel-gpu-tools added since IPEX-LLM portable bundle includes the rest). `ollama-ipex` active; journal: `using Intel GPU`. `clinfo -l` reports `Intel(R) Iris(R) Xe Graphics` (unlike graystone where it returned 0 platforms). AI Suggest cold run = **67.3s** on iGPU (best of the fleet so far — vs 170s graystone, 200-300s CPU baseline). |
| greenville | 2026-05-08 | sgtfulton | ✅ | ✅ | ✅ | One pre-flight reparation needed (the only one not pre-documented before this run, now added to Common pitfalls): pre-existing `/etc/apt/sources.list.d/intel-gpu.list` from a prior failed iGPU-on-jammy attempt pointed at `noble client` packages. libdrm2 in that repo wanted `libc6 ≥ 2.38` (noble) but greenville was on jammy's `libc6 2.35`, blocking `apt-get update` / dep-resolution. Fix: `sudo mv /etc/apt/sources.list.d/intel-gpu.list /etc/apt/sources.list.d/intel-gpu.list.disabled-pre-upgrade` then continue; `setup-iris-ollama.sh` rewrote the file cleanly post-noble. Otherwise standard run via `release-upgrade-claude.service` (transient `systemd-run --collect` unit), deactivated cleanly with 3min 18s CPU; manual `shutdown -r +1` for Phase E (DistUpgradeViewNonInteractive's `confirmRestart()` defaults False without `[NonInteractive] RealReboot=True` in upgrade.cfg, which is the desired Phase D pause behavior). Post-reboot: kernel 6.8.0-111-generic, `/dev/dri/card0+renderD128`, `using Intel GPU` confirmed, AI Suggest cold = **119s** on iGPU, bartender remote HTTP 200. All customizations preserved (sshd / sudoers / nginx-bartender / ollama-override bit-identical). Highest-traffic box of the three; HTTP/PM2 stayed up on :3001 + :3002 throughout — bar service unaffected. |
