# Operator-Intelligence Roadmap — Channel Guide / AI Suggest / Auto-Pilot

Synthesized from a 3-subagent research pass (2026-06-11) + Grok roadmap review.
Goal: make the three core operator-facing intelligence subsystems more reliable
and useful, shipped incrementally and low-risk-first to 6 live bars.

## The root findings (one per subsystem)

| Subsystem | Root problem | "Do one thing" |
|---|---|---|
| **Channel Guide** | 6 independent injection paths, 5 different dedup predicates → recurring **silent-drop** bugs (game vanishes, operator complains days later). TEXT/INTEGER channelNumber mismatch; brittle string-equality station-alias resolution (the `+`-suffix RSN bug). | Typed `Program` + **one canonical `String`-normalized dedup key** + **per-source drop logging** (log WHY each game dropped). |
| **AI Suggest** | LLM (llama3.1:8b on iGPU, 180–300s, timed out during GPU contention) is the **wrong tool** for combinatorial game→TV assignment — the deterministic post-processor already repairs every load-bearing field. A `DistributionEngine` already exists but is **unwired**. | Wire the deterministic engine as the baseline (instant, correct, degrades gracefully); demote LLM to optional reasoning on `llama3.2:3b`. Shadow-mode first. |
| **Auto-Pilot** | **No closed-loop verification** — `routeMatrix()` returns true on a bare Wolf Pack `"OK"`, never reads the route back; "success" = command acked, not "right game on TV". OR-gate bug class fixed at 3 sites, **still live at 5**. | Strict `HardwareResult` parser (kills OR-gate class) + `routeAndVerify()` (command→verify→retry→escalate). |

## Cross-cutting: league-direct data (MLB/NHL/NBA)
MLB `statsapi.mlb.com` (free, no key) returns **structured local-RSN-per-game** + live status — directly attacks the guide's channel-resolution root cause. **But** per Grok: do NOT add it as a new guide injection path (that recreates the 6-path problem). Instead **enrich `game_schedules.broadcast_networks` + live status upstream** so the existing `game_schedules` injection benefits. A `packages/streaming/src/api-integrations/mlb-api.ts` client already exists.

## Sequencing (Grok-reviewed)

- **Wave 1 — safe foundations (ship first, this pass):**
  - `HardwareResult` parser + sweep the 5 remaining OR-gate sites (`scheduler-service.ts:~1287/1348`, `schedules/recovery:139`, `execute-single-game:193`, `execute:421/782`).
  - Channel-guide **per-source drop logging** + a **single canonical dedup key** (record `gsSkippedNoChannel` + every drop with reason).
  - Patch release, **canary Holmgren**, then fleet via `auto-update.sh`.
- **Wave 2 — AI Suggest:** wire `DistributionEngine` in **shadow mode** (compute deterministic plan alongside the LLM, log a diff), behind `AI_SUGGEST_SOLVER=shadow|primary`. Promote to primary after a week of clean diffs; LLM → reasoning-only on `llama3.2:3b`.
- **Wave 3 — Auto-Pilot verify:** `routeAndVerify()` (apply `outputOffset` before compare per Gotcha #4; read hardware only on mismatch; **scheduler/auto-pilot paths only, NOT bartender manual**; advisory→escalate, never block the tune). Add `verifiedAt`/`verifyState` to allocations. Scheduler path first, then auto-reallocator revert.
- **Wave 4 — league enrichment:** background job enriches `game_schedules.broadcast_networks` + live status from MLB/NHL APIs **after** Wave-1 drop logs show for ≥1 week exactly where ESPN free-text fails. Resolver consumes structured broadcast fields.
- **Wave 5 — guide consolidation (last):** collapse the 6 inline injectors into source-adapters feeding the Wave-1 typed `Program` + dedup. **Priority-order merge** (Rail primary for cable/sat; `game_schedules` load-bearing for regional gaps) — log every supersede; never let ESPN-shaped rows drop a game Rail has.

## Traps to respect (from Grok)
- Solver must replicate HomeTeam `minTVsWhenActive` padding or Packers games show fewer TVs.
- Verify-readback: apply `outputOffset` before compare; read hardware only on mismatch; scheduler-only; don't strand allocations in `tuning`. TCP-close false-positive at `matrix-control.ts:~200`.
- Consolidation must not prefer ESPN over Rail (would drop regional games Rail has).
- Flags live in `ecosystem.config.js` → need `pm2 delete && pm2 start` (Gotcha #2), not restart.

## One-line priority
Ship `HardwareResult` + OR-gate sweep + guide drop logging now; wire `DistributionEngine` shadow next; league APIs enrich `game_schedules` only after drop logs prove where ESPN fails; touch guide consolidation last.
