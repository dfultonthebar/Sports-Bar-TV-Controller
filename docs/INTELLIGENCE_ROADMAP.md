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
- **Wave 2 — AI Suggest:** [SHADOW SHIPPED v2.55.62 — ai-suggest-solver-shadow.ts, AI_SUGGEST_SOLVER=off|shadow|primary; gather ~7d diffs on canary before primary] wire `DistributionEngine` in **shadow mode** (compute deterministic plan alongside the LLM, log a diff), behind `AI_SUGGEST_SOLVER=shadow|primary`. Promote to primary after a week of clean diffs; LLM → reasoning-only on `llama3.2:3b`.
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

---

## Phase 2 — beyond Waves 1-5: reliability + trust + utilization (added 2026-06-11)

Grounded by a code-explorer pass + Grok after the Wave-2 shadow shipped. The first
shadow data point (LLM chasing obscure streaming while the engine nailed the marquee
MLB game to 23 TVs) is the strongest possible signal these investments pay off on the
primary flip. **Two buckets: ship-now reliability (no flip dependency) and trust-
builders that gate the flip.**

### SHIP NOW (no flip dependency, hardens reliability + the shadow data)

- **Wave 3.5 — health-aware assignment (TOP — same bug class as the OR-gate fix).**
  `StateReader.getAvailableInputs()` (`state-reader.ts:227`) computes `isAvailable`
  from `isSchedulingEnabled` + manual-override ONLY — it never joins device online
  status. So the engine can assign a game to an OFFLINE cable box / Fire TV → tune
  silently fails → wrong channel + green tile (the Greenville Brewers symptom).
  Join real liveness (`fireTVDevices.isOnline` via firetv-connection-manager; matrix/
  IR families need a liveness signal — may only be reliable for Fire TV initially).
  **TRAP:** only exclude on a RELIABLE "definitely offline" signal — false-excluding
  a working device (e.g. transient blip, or an IR cable box with no liveness probe)
  gives a game zero screens, worse than today. Default to include-on-unknown.
  Stretch: cross-device-type fallback (Brewers on cable ch308 AND a Fire TV app — if
  the box is dead, use the Fire TV). Value HIGH · M (check) / L (fallback) · pairs with Wave 3.
- **Wave 3.6 — contention notification.** When games > inputs, low-priority games get
  ZERO screens silently. `reasoning[]` already has the data (`distribution-engine.ts`
  minTVsMet=false) — surface a "N games had no screen" line in the bartender Game Plan.
  Value HIGH · **S**. (Multiview/quad-card integration is a separate XL — do NOT
  conflate; multiview consumes 4 inputs/card, wiring-specific like outputOffset.)
- **Wave 3.7 — persist engine reasoning to SchedulerLog.** Engine "why" only goes to
  PM2 buffer today — not queryable. Write structured rows (`component='distribution-
  engine'`, op `assign`/`drop`, metadata {game, priority, assignedTVs, minTVsRequired,
  reason}) like the guide drop-logging. Value MED-HIGH · **S**. Foundation for trust.

### GATED ON THE PRIMARY FLIP (#346)

- **Wave 6 — engine learning loops.** The DistributionEngine reads NO learned prefs;
  the LLM reads `scheduling_patterns` (team→input/output, built from bartender
  overrides — "Packers on the big wall TVs"). Feed `preferredInputId`/`preferredOutputs`
  in as a scoring bias (reuse the 3+ override-digester threshold; emulate, don't copy,
  `lib/ai/distribution-optimizer.ts`). THE thing that makes the deterministic engine
  genuinely *better* than the LLM, not just faster. Value HIGH · M.
- **Wave 7 — bartender-facing "why" (server-built per Gotcha #12).** One-line rationale
  per suggestion ("Packers home → 20 TVs; cable ch6; you've put them here 12× before").
  Build the string in TS, never let the LLM paraphrase ([[feedback-llm-server-built-verbatim]]).
  Value HIGH · S-M · critical for trusting the new primary.

### LATER / HIGHER-RISK
- **Wave 8 — end-of-game re-allocation.** Freed input → re-tune for queued overflow.
  `auto-reallocator.ts:1155 activatePendingAllocations` only flips DB status today, no
  tune. Value HIGH · M.
- **Predictive pre-tune sequencing** (route-then-tune) — LOW-MED · S, after health stabilizes.
- **Multiview contention resolver** — XL, wiring-specific, post-flip only.

### Phase-2 traps (Grok + code-explorer)
- Health: include-on-unknown; never false-exclude a working device. IR cable boxes have
  no liveness probe — health-awareness is initially Fire-TV-mostly.
- Learning: don't let pattern bias override the home-team minTV floor.
- Explanations: server-build, never LLM-paraphrase (Gotcha #12).
- Two distribution codepaths (`lib/ai/distribution-optimizer` already learns; the
  scheduler `distribution-engine` does not) — converge or keep signals aligned post-flip.
- Don't promote primary until health + learning + explanations land, or the shadow's
  "strong signal" becomes operator pain.
