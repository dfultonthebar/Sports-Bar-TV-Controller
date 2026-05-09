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

### Method A — Tailscale SSH (the v2.32.82 pattern)

The historical approach used during the v2.32.82 fleet-wide rollout. Quoting `docs/FLEET_STATUS.md`:

> "Verified live on Holmgren: drift simulated → switched to `location/holmgren-way` → merged main → built → restarted PM2 → verify-install 7/7 PASS → pushed → SUCCESS in 105s. Then triggered the other 5 boxes via parallel SSH; all 5 landed at v2.32.82 with sidecars populated, no Anthropic API rate-limit collisions (single-host coordinated trigger, not cron herd)."

Single-host parallel SSH. From Holmgren's host:

```bash
for ip in 100.93.130.14 100.77.85.89 100.107.223.47 100.112.255.60 100.101.200.82; do
  ( ssh ubuntu@$ip 'bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/auto-update.sh --triggered-by=manual_cli' \
    > /tmp/fleet-trigger-$ip.log 2>&1 ) &
done
wait
echo "all 5 triggered — see /tmp/fleet-trigger-*.log"
```

Each host's `auto-update.sh` runs locally with its own `LOCATION_PATHS_OURS` resolver — protects per-location data files (channel-presets, directv-devices, .env). Wall-clock ~90-120s per host, runs in parallel so total ~2 min.

**Pros:** simplest, exact same code path as the cron, no auth needed beyond SSH key.
**Cons:** SSH key must already be deployed (it is fleet-wide as of v2.32.82). When run from Claude Code, requires explicit Bash permission allowlist for SSH to 100.* — the harness blocks it by default for "high-severity multi-site shared-infrastructure action."

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
- **2026-05-09 — v2.33.1 (planned).** Method discovered + documented; execution gated on user approval.
