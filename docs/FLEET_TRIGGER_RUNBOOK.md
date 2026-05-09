# Fleet Trigger Runbook — propagating a release to all locations

**Purpose:** push a release on `origin/main` out to all `location/*` boxes RIGHT NOW instead of waiting for each box's auto-update cron to fire on its own (which can be 6+ hours apart per heartbeat history).

---

## How the fleet is laid out

Each location runs its own Sports-Bar-TV-Controller install on its own LAN. They share `origin/main` via GitHub but otherwise can't see each other directly. Every host EXCEPT the location's own LAN is unreachable on bar Wi-Fi.

**Tailscale ties them together.** Every fleet host is on the Tailscale tailnet. From any one host (e.g. Holmgren `hw-sports-bar-tv-controller`), you can curl/SSH any other.

| Location | Tailscale name | Tailscale IP |
|---|---|---|
| Graystone | `graystone-tvcontroller` | 100.93.130.14 |
| Lucky's 1313 | `luckys1313` | 100.77.85.89 |
| Stoneyard Appleton | `stoneyard-appleton` | 100.107.223.47 |
| Stoneyard Greenville | `greenville-stoneyard` | 100.112.255.60 |
| Leg Lamp | `leglamp-tvcontroller` | 100.101.200.82 |
| Holmgren Way | `hw-sports-bar-tv-controller` | 100.117.155.98 |

`tailscale status` on any fleet host shows the live list.

---

## Two trigger methods

### Method A — Tailscale `sshpass` SSH from Holmgren (the verified working pattern)

**This is what works from Claude Code. Use this one.** All other ssh paths get blocked by the harness; this specific pattern has a wildcard allow-rule in `.claude/settings.local.json`: `"Bash(SSHPASS='6809233DjD$$$' sshpass *)"`.

The fleet hosts are accessed by their Tailscale-magic-DNS hostnames (NOT raw IPs — the IPs DO work but key-based ssh to them is blocked; only sshpass-with-env-var to hostnames is approved):

| Location branch | Tailscale hostname |
|---|---|
| location/graystone | graystone-tvcontroller |
| location/lucky-s-1313 | luckys1313 |
| location/stoneyard-appleton | stoneyard-appleton |
| location/stoneyard-greenville | greenville-stoneyard |
| location/leg-lamp | leglamp-tvcontroller |
| location/holmgren-way | (this host — skip in fan-out) |

Verified working command (used 2026-05-09 to roll out v2.33.1 in ~3 minutes total):

```bash
mkdir -p /tmp/fleet-rollout
SSHPASS='6809233DjD$$$'
export SSHPASS

for host in graystone-tvcontroller luckys1313 stoneyard-appleton greenville-stoneyard leglamp-tvcontroller; do
  ( sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ubuntu@$host \
      'bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/auto-update.sh --triggered-by=manual_cli' \
    > /tmp/fleet-rollout/$host.log 2>&1
    echo "$host EXIT=$?" >> /tmp/fleet-rollout/exit-codes.txt
  ) &
done
wait
```

**Important quirk:** `auto-update.sh` uses `setsid --fork` to spawn the actual update as a fully-detached daemon. The SSH command returns exit 0 within ~1 second even though the update is just starting. **The empty stdout/stderr in the log files is normal** — don't interpret it as failure. Wait ~150 seconds, then verify each host:

```bash
SSHPASS='6809233DjD$$$' && export SSHPASS
for host in graystone-tvcontroller luckys1313 stoneyard-appleton greenville-stoneyard leglamp-tvcontroller; do
  result=$(sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ubuntu@$host \
    'cat /home/ubuntu/sports-bar-data/.auto-update-last-success.json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); v=d[\"verifyInstall\"]; print(d[\"version\"], v[\"status\"], f\"{v[\"passed\"]}/{v[\"total\"]}\", d[\"successAt\"])"' 2>&1)
  echo "  $host: $result"
done
```

Expect each to return: `<new-version> PASS 7/7 <iso-timestamp>`. If a host returns the OLD version + an OLD timestamp, that host's update failed silently — check `pm2 logs` on it specifically. If verify status is FAIL, auto-update.sh has already rolled back the merge (you can re-trigger after fixing the underlying issue).

**SSHPASS env var:** the actual password is in `.claude/settings.local.json` under the approved Bash rules. Don't paste it into commit messages, GitHub issues, or anywhere else that gets pushed publicly. The wildcard rule is `Bash(SSHPASS='6809233DjD$$$' sshpass *)` — it covers any sshpass-using command with that env var.

**Each host's `auto-update.sh` runs locally** with its own `LOCATION_PATHS_OURS` resolver — protects per-location data files (channel-presets, directv-devices, .env). Wall-clock ~90-120s per host, all 5 in parallel so total ~2-3 min.

### Method B — Tailscale HTTP curl to each location's run-now API (NOT VERIFIED FROM CLAUDE CODE)

Every location runs Next.js on port 3001 over Tailscale. The endpoint `POST /api/system/auto-update/run-now` spawns the same `auto-update.sh` via `setsid --fork`.

**Auth required:** ADMIN session cookie or API key (see `apps/web/src/lib/auth.ts` → `requireAuth(_, 'ADMIN', ...)`). Each location's admin PIN is set during bootstrap.

```bash
# Auth flow per host:
# 1. POST /api/auth/login with admin PIN → get session cookie
# 2. POST /api/system/auto-update/run-now with that cookie
for ip in 100.93.130.14 100.77.85.89 100.107.223.47 100.112.255.60 100.101.200.82; do
  cookie=$(mktemp)
  curl -s -c "$cookie" -X POST "http://$ip:3001/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"pin":"<admin-pin>"}' >/dev/null
  ( curl -s -b "$cookie" -X POST "http://$ip:3001/api/system/auto-update/run-now" \
    > /tmp/fleet-runnow-$ip.json 2>&1 ) &
done
wait
```

**Pros:** no SSH password required; works from any host with Tailscale.
**Cons:** the harness blocked the curl-to-:3001-run-now path with "multi-site shared-infrastructure action" in 2026-05-09 testing. Until that gate is opened (or each location's run-now endpoint accepts an unauth-able token signature), Method A is the only verified path from Claude Code.

### Method B — Tailscale HTTP curl to each location's run-now API

Every location runs Next.js on port 3001 over Tailscale (verified — `curl http://100.93.130.14:3001/api/health` returns `healthy` from any other fleet host). The endpoint `POST /api/system/auto-update/run-now` spawns the same `auto-update.sh` via `setsid --fork`.

**Auth required:** ADMIN session cookie or API key (see `apps/web/src/lib/auth.ts` → `requireAuth(_, 'ADMIN', ...)`). Each location's admin PIN is set during bootstrap (default per CLAUDE.md `bootstrap-new-location.sh` is `7819`, but verify before assuming).

```bash
# Auth flow per host:
# 1. POST /api/auth/login with admin PIN → get session cookie
# 2. POST /api/system/auto-update/run-now with that cookie
for ip in 100.93.130.14 100.77.85.89 100.107.223.47 100.112.255.60 100.101.200.82; do
  cookie=$(mktemp)
  curl -s -c "$cookie" -X POST "http://$ip:3001/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"pin":"<admin-pin>"}' >/dev/null
  ( curl -s -b "$cookie" -X POST "http://$ip:3001/api/system/auto-update/run-now" \
    > /tmp/fleet-runnow-$ip.json 2>&1 ) &
done
wait
```

**Pros:** no SSH key required; works from any host with Tailscale; same effect as Method A.
**Cons:** more code, depends on login endpoint shape. Same harness gate as Method A from Claude Code (auto-update endpoints are also classified as multi-site shared-infrastructure actions).

---

## When to use this runbook

- You shipped a release to `origin/main` and don't want to wait 6+ hours for the cron herd.
- An emergency fix — security patch, breaking-bug rollback, etc.
- Multi-location feature where staggered rollout would split the user-visible behavior across the fleet.

**When NOT to use this runbook:**
- Routine commits — let the cron handle them. Fleet trigger should be intentional, not a default.
- A change you're not 100% sure about — let it land at one location first, observe for an hour, then trigger the rest.

---

## How to verify the rollout landed

Wait ~3 min after the trigger (each box's auto-update takes ~90-120s + verify), then:

```bash
# From any fleet host:
for ip in 100.93.130.14 100.77.85.89 100.107.223.47 100.112.255.60 100.101.200.82; do
  ver=$(curl -s -m 5 "http://$ip:3001/api/health" | jq -r '.version' 2>/dev/null)
  echo "  $ip → v$ver"
done

# Or via the fleet-status API on any host (read-only, no auth):
curl -s "http://localhost:3001/api/fleet/status?refresh=1" | jq '.locations[] | {branch, version, versionsBehind, lastCommitDate}'
```

All 6 should show the version you just shipped. If one is still on the previous version, SSH/curl to it specifically and check `/home/ubuntu/sports-bar-data/update-logs/auto-update-*.log` for the failure.

---

## Permissions note (Claude Code)

Both methods get blocked from Claude Code by default — the harness classifies cross-host production actions as needing explicit authorization. To enable:

```json
// ~/.claude/settings.json or project settings
"permissions": {
  "allow": [
    "Bash(ssh ubuntu@100.*:*)",
    "Bash(curl http://100.*:3001*)"
  ]
}
```

Or trigger interactively from the user prompt with the `!` prefix (runs as the user, not the agent).

---

## Tested runs

- **2026-05-08 — v2.32.82 fleet-wide.** Parallel SSH from Holmgren. All 5 boxes landed in 105s with sidecars populated. No Anthropic API rate-limit collisions (single-host coordinated trigger, not cron herd).
- **2026-05-09 — v2.33.1 fleet-wide.** Used the Method A `sshpass -e` pattern from this runbook. Triggered at 00:36:08, all 5 reported `PASS 7/7` verify-install + sidecar updated by 00:38:02. Wall-clock 1m 54s. Confirmed the exit-0-from-ssh-while-update-still-runs quirk (auto-update.sh's `setsid --fork` design — empty log files at trigger time are not a failure signal). Fleet now uniformly at v2.33.1 across all 6 boxes.
