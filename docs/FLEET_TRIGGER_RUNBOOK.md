# Fleet Trigger Runbook — propagating a release to all locations

**Purpose:** push a release on `origin/main` out to all `location/*` boxes RIGHT NOW instead of waiting for each box's auto-update cron to fire on its own (which can be hours apart per heartbeat history).

---

## How the fleet is laid out

Each location runs its own Sports-Bar-TV-Controller install on its own LAN. They share `origin/main` via GitHub but otherwise can't see each other directly.

**Tailscale ties them together.** Every fleet host is on the Tailscale tailnet. From any one host (e.g. Holmgren `hw-sports-bar-tv-controller`), you can SSH any other.

| Location | Tailscale name | Tailscale IP |
|---|---|---|
| Graystone | `graystone-tvcontroller` | 100.93.130.14 |
| Lucky's 1313 | `luckys1313` | 100.77.85.89 |
| Stoneyard Appleton | `stoneyard-appleton` | 100.107.223.47 |
| Stoneyard Greenville | `greenville-stoneyard` | 100.112.255.60 |
| Leg Lamp | `leglamp-tvcontroller` | 100.101.200.82 |
| Lime Kiln | `lime-kiln-sports-bar-controller` | 100.89.6.80 |
| Holmgren Way (dev box, excluded from fan-out) | `hw-sports-bar-tv-controller` | 100.117.155.98 |

`tailscale status` on any fleet host shows the live list.

---

## SECURITY: SSH is keys-only, password auth is disabled

**Do not use `sshpass` or any password-based SSH against the fleet.** Following a 2026-06-22 cryptominer compromise via a leaked shared SSH password (full IOCs: memory `project_security_incident_graystone_xmrig`), every box was hardened:

- `PasswordAuthentication no` on all 7 boxes — **keys only.**
- The leaked password was **rotated 2026-06-23** and no longer works anywhere, on top of being disabled. Any doc, script, or memory still referencing the old plaintext password is describing a dead credential — ignore it.
- ufw active fleet-wide, default-deny, Tailscale/LAN only.

Use the `holmgren-claude-fleet` SSH key (present in every box's `authorized_keys`) for key-based SSH.

---

## Canonical method — `fleet-deploy.sh` (CT212 / Hermes box)

**This is the recommended trigger.** Lives at `~/.hermes/scripts/fleet-deploy.sh` on the Hermes box (Tailscale `hermes`, 100.70.56.34). It encodes three hard-won fixes so you don't have to remember them:

1. **cd-prefix.** SSH lands in `/home/ubuntu` (home), NOT the repo — the remote payload must `cd /home/ubuntu/Sports-Bar-TV-Controller` before running `auto-update.sh`, or it fails "No such file or directory" and silently no-ops.
2. **No pgrep pre-check.** `auto-update.sh` has its own internal `flock`-based lock — pre-checking with `pgrep -f auto-update.sh` self-matches the triggering SSH command and produces a false "already running," skipping the trigger. Fire unconditionally and let the internal lock dedupe.
3. **Graystone (15 GB RAM) Ollama-evict.** The smallest fleet box risks OOM (exit 137) mid-build; the script evicts its local Ollama models and caps the Node heap (`--max-old-space-size=2048`) before building there.

It then polls each box's `http://127.0.0.1:3001/api/version` until all report the target version (or times out), printing a convergence table.

```bash
# From CT212 (or wherever the script lives):
bash ~/.hermes/scripts/fleet-deploy.sh                # auto-resolves target from GitHub raw main, triggers + polls to convergence
TARGET=2.93.0 bash ~/.hermes/scripts/fleet-deploy.sh   # pin an explicit target version
TRIGGER_ONLY=1 bash ~/.hermes/scripts/fleet-deploy.sh  # fire the trigger, skip the convergence poll
VERIFY_ONLY=1 bash ~/.hermes/scripts/fleet-deploy.sh   # read-only: poll current versions, don't trigger anything
```

Exit 0 = converged, 2 = timeout (check the straggler manually), 1 = setup error. It excludes Holmgren (the local dev box) and never needs a password — keys-only SSH.

---

## Manual fallback — direct SSH fan-out

If you're not on CT212 and need to trigger by hand (key-based SSH from any fleet-tailnet host with the right key installed):

```bash
REPO=/home/ubuntu/Sports-Bar-TV-Controller
for host in graystone-tvcontroller luckys1313 stoneyard-appleton greenville-stoneyard leglamp-tvcontroller lime-kiln-sports-bar-controller; do
  ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ubuntu@$host \
    "cd $REPO && nohup bash scripts/auto-update.sh --triggered-by=manual_cli > /home/ubuntu/sports-bar-data/update-logs/manual-\$(date +%s).log 2>&1 &" \
    &
done
wait
```

**The `cd $REPO &&` prefix is mandatory** — this is the #1 way manual triggers silently fail (see fix #1 above). `auto-update.sh` detaches itself (`setsid -f`) so the SSH command returns almost immediately; that's expected, not a failure signal.

### Verifying the rollout landed

Wait ~2-4 minutes (longer for Graystone), then poll each box directly:

```bash
for ip in 100.93.130.14 100.77.85.89 100.107.223.47 100.112.255.60 100.101.200.82 100.89.6.80; do
  ver=$(curl -s -m 5 "http://$ip:3001/api/version" | grep -oE '"version":"[^"]+"')
  echo "  $ip → $ver"
done
```

If a box is on the old version after ~5 minutes, check `/home/ubuntu/sports-bar-data/update-logs/` on that box for the failure — `verify-install.sh --json` runs many layers (not a fixed count; read its own output for the current set) and any non-zero exit triggers an automatic rollback via `rollback.sh`.

---

## Central visibility — the SBCC hub

The hub (Tailscale `hub-1`, 100.124.165.26:3010) ingests version + health + update-outcome from every location's `hub-agent` collector. Check `http://100.124.165.26:3010/` for a live overview, including a pinned fleet-target vs actual-version drift indicator (`fleet_target` table, `POST /api/fleet-target {targetVersion}` to pin — see `apps/hub/src/app/api/fleet-target/route.ts`).

---

## When to use this runbook

- You shipped a release to `origin/main` and don't want to wait for the cron herd.
- An emergency fix — security patch, breaking-bug rollback, etc.
- Multi-location feature where staggered rollout would split user-visible behavior across the fleet.

**When NOT to use:**
- Routine commits — let the cron handle them. Fleet trigger should be intentional, not a default.
- A change you're not 100% sure about — let it land at one location first, observe for an hour, then trigger the rest. (The per-box canary bless/soak gate in `auto-update.sh` also protects against this — non-canary boxes won't merge a commit until the canary branch blesses it.)

---

## Permissions note (Claude Code)

Cross-host SSH triggers may be classified as needing explicit authorization by the harness. Confirm scope with the operator before triggering a fleet-wide rollout; the `fleet-deploy.sh` script itself requires no new permission beyond the SSH the harness already grants for the fleet.
