---
name: fleet-heartbeat-watch
description: Diff-based recurring fleet health heartbeat that only alerts on changes, not on all-green.
version: 1.0.0
author: Sports-Bar TV Controller
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [ops, monitoring, heartbeat, fleet, sports-bar, mcp, telegram]
    model_hint: cheap-generalist
---

# Fleet Heartbeat Watch

A "silent until something dies" heartbeat for the multi-location sports-bar fleet
(Source: "21 Hermes concepts" — the heartbeat/zombie pattern). Runs on a schedule,
snapshots fleet state via MCP tools, diffs against the last snapshot, and only
delivers a Telegram alert when something CHANGED. No change = no message. This
kills "all green" noise so operators trust every ping.

## Wire it up (once)
```bash
hermes cron create --name fleet-heartbeat --deliver telegram \
  --skill fleet-heartbeat-watch "every 15m"
```

## State file
Persist last snapshot at `~/.hermes/state/fleet-heartbeat.json`:
`{ ts, perLocation: { <loc>: { healthOk, version, autoUpdateStalled, activeMatrixRouteCount, rfPriorityActive } } }`

## Workflow

1. **Collect (one sub-agent per location so the sweep finishes in one round).**
   For each location, call the MCP tools:
   - `get_system_health` → `healthOk` + offline-component list + version.
   - auto-update status → `autoUpdateStalled` (true if linger=no, ROLLBACK,
     CONFLICT, or last-update age > 12h).
   - `get_matrix_routes` → `activeMatrixRouteCount`.
   - `get_atlas_status` / `get_shure_rf_status` → `rfPriorityActive`.
2. **Load previous snapshot.** First run = no previous; write the baseline
   silently and exit (no alert on first run).
3. **Diff** each field old→new per location and classify:
   - **ALERT:** `healthOk` true→false, new offline component,
     `autoUpdateStalled` false→true, `rfPriorityActive` false→true.
   - **INFO:** version changed (auto-update landed — confirms success),
     matrix route count changed materially (>2).
   - **RECOVERY:** any ALERT field flipping back to good.
4. **Suppress known-expected states** (avoid false alarms):
   - Epson projector offline during off-hours = expected (Holmgren).
   - `.48` Atmosphere TV offline when its TV is powered down = expected.
   - The local box that IS Holmgren — don't double-count it in the fleet loop.
5. **Deliver.** If alert+recovery+info is empty → send NOTHING and exit. Else
   compose ONE Telegram message, **server-built verbatim** (do NOT let the model
   paraphrase counts/versions/location names — Gotcha #12):
   ```
   Fleet change @ <local-time>
   🔴 <loc>: health DOWN — <component> offline
   🟢 <loc>: recovered — all components healthy
   🟡 <loc>: updated v<old> → v<new>
   ⚠️ <loc>: auto-update STALLED — <reason>
   ```
6. **Persist** the new snapshot (overwrite) every run, even when nothing alerted,
   so the next diff is against current truth.
7. **Escalate, don't act.** Read-only. Any remediation (re-trigger auto-update,
   flip a matrix protocol, fix outputOffset) → emit `propose_action` for operator
   approval. Never auto-execute hardware or git-state changes from a heartbeat.

## Notes
- Use a cheap/general model; this is high-frequency autopilot, not reasoning.
- If MCP calls fail for a location, record `unreachable` and alert ONCE on the
  reachable→unreachable transition, not every cycle.
