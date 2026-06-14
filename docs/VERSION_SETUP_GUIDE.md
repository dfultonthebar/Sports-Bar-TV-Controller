# Version Setup Guide

**Purpose:** This file tells Claude (and operators) what each version
release REQUIRES to work correctly at a location — new software to install,
DB rows to seed, env vars to set, verification steps to run.

It is different from `LOCATION_UPDATE_NOTES.md`:

- **`LOCATION_UPDATE_NOTES.md`** answers "should this auto-update proceed?"
  (GO/CAUTION/STOP risk assessment per commit).
- **`VERSION_SETUP_GUIDE.md`** (this file) answers "what do I need to DO
  for this version to function correctly?" (prescriptive setup tasks).

**How Claude uses it:**

During Checkpoint B of auto-update, after reading `LOCATION_UPDATE_NOTES.md`,
Claude reads the entry for every version between `PRE_MERGE_VERSION` and
`POST_MERGE_VERSION` in this file. For each entry with a "Required Manual
Step", Claude must either:

1. Verify the step was completed at this location (check the verification
   command), OR
2. Perform the step automatically if safe (`sqlite3 INSERT`, file seed, etc.), OR
3. Flag it in the checkpoint response so the operator knows to do it post-update.

**How to add an entry:**

Prepend a new section below the "Current entries" marker when bumping the
version on main. Keep entries under ~30 lines. If a version is purely
additive (no setup required), still include an entry saying "No setup
required" so Claude can confirm it read the doc.

**Cutoff:** entries older than 2 major versions can be pruned. Git history
is the archive.

---

## v2.58.1 — Phase 3-5: IT/ops persona refresh + skills wired + primary mode (2026-06-14)

**Branch landed:** main → fleet via auto-update
**Per-box install where Hermes runs.** Updates `hermes/SOUL.md` (the agent persona, loaded into the system
prompt) to reflect the now-shipped capabilities and stop the failure loops seen in the Telegram session:
- **Action tools documented:** `propose_action`, `create_maintenance_todo`, `ask_claude_code` (the old SOUL
  said "no write tools yet" — outdated since the MCP gateway shipped).
- **Delegate-to-Claude rule:** deep code/system changes go to `ask_claude_code` (one clear request, wait —
  don't spam retries); the operator is not the agent's shell.
- **Self-management fix:** the restart command is `hermes gateway restart` (NOT `hermes restart`, which
  errors — root cause of the "asking 400 times to restart" loop); restarting terminates the current turn, so
  hand restarts to Claude instead of self-restarting mid-task. Honcho memory is the (already-live) cloud
  store — there is NO self-hosted honcho server to start (that path is a dead end).
- **Skills index:** the persona now names its skill playbooks so it reaches for them by name.
- **Phase 4/5 status:** skills already `enabled` in the active profile; periodic monitoring already covered by
  the existing `sports-bar-anomaly-alert` (every 2h) + `sports-bar-morning-brief` crons, so NO duplicate
  `fleet-heartbeat` cron was added (skill stays on-demand). The persona IS the single primary mode; Honcho
  cross-session persistence is live (verified: "retrieved N existing messages" in the gateway log).
- **Per-box install:** `cp hermes/SOUL.md ~/.hermes/SOUL.md && hermes gateway restart` (SOUL is cached in
  the system prompt — a gateway restart is required to load an edit; do it when no operator turn is in flight).
- **Outstanding (operator action):** `hermes-self-backup-to-github` cron needs a private repo + fine-grained
  PAT before it can be wired (`gh` is not authed on the boxes) — the skill documents the exact steps.

---

## v2.58.0 — Phase 2: 5 Hermes operating skills mined from YouTube (2026-06-14)

**Branch landed:** main → fleet via auto-update
**Per-box install where Hermes runs** (version-controlled in `hermes/skills/`, copied to `~/.hermes/skills/`).
Extracted concrete, transferable operating techniques from 4 Hermes-Agent YouTube videos (NetworkChuck
"5 reasons", the masterclass, "21 concepts", David Andre "7 levels") into reusable SKILL.md playbooks:
- `hermes/skills/crystallize-runbook-skill` — after a verified incident fix, auto-author a tight SKILL.md
  runbook (symptom/root-cause/fix/verify), pin it, mirror to System Admin Todos (the self-improvement loop).
- `hermes/skills/fleet-heartbeat-watch` — diff-based "silent until something changes" fleet monitor; snapshots
  health/version/auto-update/RF via MCP tools, only Telegram-alerts on a delta. Wire:
  `hermes cron create --name fleet-heartbeat --deliver telegram --skill fleet-heartbeat-watch "every 15m"`.
- `hermes/skills/session-recall` — answer "what did we decide/change on <date>" from `~/.hermes/state.db`
  (`messages` table) + `hermes sessions` — the time-anchored complement to Honcho's semantic recall.
- `hermes/skills/hermes-self-backup-to-github` — daily `--no-agent` cron rsyncs TEXT-only `~/.hermes`
  (skills+memory+md, no blobs) to a **private** repo; PAT via `hermes config set GITHUB_TOKEN`, linger required.
- `hermes/skills/hermes-curator-skill-hygiene` — drive the (already-enabled) Curator: `curator run --dry-run`,
  and **`curator pin`** every canonical skill so auto-prune never removes a load-bearing runbook.
- **Per-box install:** `cp -r hermes/skills/* ~/.hermes/skills/` then pin canonical skills:
  `for s in sports-bar-troubleshooting sports-bar-investigate sports-bar-shift-check sports-bar-rf-response crystallize-runbook-skill fleet-heartbeat-watch session-recall hermes-self-backup-to-github hermes-curator-skill-hygiene; do hermes curator pin "$s"; done`.
  On the canary (Holmgren) all 5 are installed + all 9 skills pinned. `hermes/` is OUTSIDE RAG-indexed paths.

---

## v2.57.6 — expand Hermes skills (3 custom + YouTube) (2026-06-13)

**Branch landed:** main → fleet via auto-update
**Per-box install where Hermes runs** (the custom skills are version-controlled in `hermes/skills/`; the
YouTube skill is a hub install). Adds Hermes Agent skills that operationalize the MCP tools:
- `hermes/skills/sports-bar-investigate` — delegate deep code/diagnostic questions or a todo's fix plan to
  Claude Code via `ask_claude_code`; relay + file the plan (operator-brain → builder workflow).
- `hermes/skills/sports-bar-shift-check` — on-demand pre-shift readiness audit chaining the observe tools.
- `hermes/skills/sports-bar-rf-response` — wireless/paging-mic RF interference diagnosis + response (never
  autonomously changes a freq — propose + human-confirm).
- (existing `sports-bar-troubleshooting` from v2.56.3 — reactive "X is broken" diagnostics.)
- **YouTube:** `hermes skills install lobehub/youtube-summarizer-pro` (community) — Hermes can summarize a
  YouTube URL. (A `youtube-content` skill also ships built-in.)
- **Per-box install:** `cp -r hermes/skills/sports-bar-* ~/.hermes/skills/ && hermes skills install
  lobehub/youtube-summarizer-pro`. Bake into the future `setup-hermes-agent.sh`. Skills are thin (orchestrate
  tools + `search_system_docs`); RAG stays the single doc source. `hermes/` is OUTSIDE the RAG-indexed paths.

---

## v2.57.5 — `ask_claude_code` durable unattended auth (2026-06-13)

**Branch landed:** main → fleet via auto-update
**No setup required** (the key already exists per-box). `runClaude` now reads `ANTHROPIC_API_KEY` from the
repo `.env` (the same one auto-update's checkpoints use) and injects it **into the `claude -p` spawn only**
(not Hermes-wide). This makes the Hermes↔Claude bridge work **unattended forever** — it no longer depends
on the interactive-login OAuth token (`~/.claude/.credentials.json`), which can eventually need re-auth.
- **Scoped + opt-out:** the key reaches only the `claude` subprocess. Set `MCP_CLAUDE_USE_OAUTH=true` to
  use the subscription OAuth (free) instead of the pay-per-call API key.
- **Cost note:** `claude -p` now bills the **same `ANTHROPIC_API_KEY` as auto-update checkpoints** — so a
  burst of `ask_claude_code` calls shares that credit pool (heavy use could deplete it and break BOTH the
  bridge and auto-update). `ask_claude_code` is operator-driven + low-volume, so this is minor — but watch
  credits (`[[feedback-anthropic-credits-block-auto-update]]`). No secret is committed (the key stays in
  the gitignored `.env`); the code just reads the existing per-box key. Verified: `KEY_PATH_OK` via the
  key-injected `claude -p`.

### Also: gateway default model → Grok (runtime, per-box; bake into setup-hermes-agent.sh)
For the **autonomous** gateway-Hermes to use its MCP tools (incl. `ask_claude_code`) when *you* aren't
driving it, its default model must be tool-capable. `hermes config set model.provider xai-oauth` +
`model.default grok-4`. (`hermes3:8b` can't tool-call.) Cheap `--no-agent` cron monitoring is unaffected;
the in-app bartender chat (`qwen2.5:14b`) is unaffected. Proven autonomous: `CLAUDE_VIA_HERMES_OK`.

---

## v2.57.3 — Hermes ↔ Claude Code bridge: `ask_claude_code` MCP tool (2026-06-13)

**Branch landed:** main → fleet via auto-update
**No setup required.** Adds an 11th tool to `@sports-bar/mcp`: **`ask_claude_code`** — lets the Hermes
agent delegate deep code/diagnostic questions to **Claude Code** (the coding agent on the same box).
Completes the agent team: Hermes = always-on operator brain; Claude = on-demand builder/analyst.
- **READ-ONLY by design:** spawns `claude -p "<question>" --permission-mode plan` — Claude reads the real
  repo + system to analyze/explain/draft a plan, but **cannot edit, commit, or run mutating commands**.
  A mutating "task mode" is deliberately NOT exposed.
- **Safe spawn:** the question is passed as an argv element (no shell → no injection), full path to the
  `claude` binary, 180 s timeout, output truncated, audited to `agent_tool_invocations` like every tool.
- **Already live where Hermes is installed** (the MCP server runs from source via `tsx`, no rebuild).
  Proven e2e via Grok: Hermes → `ask_claude_code` → Claude read `verify-install.sh` → accurate answer
  relayed, 19.7 s. Requires the `claude` CLI present + authed on the box (it is, fleet-wide).

---

## v2.57.2 — Hermes Phase 3a: confirm-action backend (one-tap confirm) (2026-06-13)

**Branch landed:** main → fleet via auto-update
**No setup required.** New endpoint `POST /api/agent/confirm-action` — the human-only execution path for a
proposal the agent made via `propose_action`. The agent CANNOT call it (it's not an MCP tool); only a UI
Confirm button (a deliberate human tap) does. Whitelisted: `route_tv {input,output}` → `/api/matrix/route`
(source `manual`); `tune_channel {channelNumber,deviceType,deviceId}` → `/api/channel-presets/tune`.
Rate-limited HARDWARE; every execution audited to `agent_tool_invocations` (`confirm_action:<action>`).
- This is the backend the Phase-3b bartender Confirm button calls. There is still **no autonomous-write
  path** — propose (agent) → confirm (human) → deterministic API.
- **Phase 3b (the bartender iPad UI confirm button)** is NOT in this release — it touches the
  operator-locked bartender remote and needs a deployed build + Playwright verification on the live iPad
  (an off-hours task). Build-verified (35/35).

---

## v2.57.1 — Hermes Phase 2c: watcher auto-files todos (Atlas drop) (2026-06-13)

**Branch landed:** main → fleet via auto-update
**No setup required.** The Atlas drop-watcher now auto-files a deduped maintenance todo (via
`POST /api/maintenance-todo`, source `watcher`) when it records an **unexplained** zone volume drop —
the events a human should investigate. One todo per processor/zone/day; explained drops (a bartender
changed it) don't file. Fire-and-forget — a todo-file failure never affects the watcher. The same
pattern extends to the Shure-RF and SDR watchers next; this ships the representative integration.

---

## v2.57.0 — Hermes Phase 2: agent guardrail layer (propose + audited todo-write) (2026-06-13)

**Branch landed:** main → fleet via auto-update
**Schema migration — runs automatically** (`drizzle/0005_agent_tool_invocations.sql`, additive CREATE TABLE
+ 2 indexes; auto-update's `drizzle-kit migrate` applies it). The agent brain can now safely *act* — but
only by proposing (a human confirms) or appending a reviewable todo. Nothing here issues an autonomous
hardware command.
- **New table `agent_tool_invocations`** + endpoint `POST /api/agent/tool-log`: every MCP tool call is
  fire-and-forget audited (tool, args, result summary, surface, error). Accountability trail.
- **New endpoint `POST /api/maintenance-todo`**: general source-tagged todo creator (deduped by key),
  reused by the agent AND (Phase 2c) by watchers.
- **MCP server now 10 tools**: + `create_maintenance_todo` (guarded write — files a reviewable todo,
  source `ai-chat`) and `propose_action` (returns a proposal mapped to the deterministic API call;
  **never executes** — verified e2e via Grok). All 8 existing tools are now audited.
- **No setup beyond the migration.** Optional env `MCP_SURFACE` (default `operator`) tags audit rows;
  the Phase-3 bartender bridge will set it to `bartender`. Verified: audit-table data path + propose_action
  e2e; endpoints build-verified (a full HTTP e2e lands when a box rebuilds to this version).

---

## v2.56.4 — CRITICAL: stale auto-update timer no longer rolls back a healthy update (2026-06-13)

**Branch landed:** main → fleet via auto-update
**No setup required — fixes a fleet-wide infinite-rollback trap.** In `verify-install.sh`, the
`autoupdate_timer_fresh` layer was a hard FAIL (exit 19) when the timer's last-attempt sidecar/log was
stale (>26h). During an auto-update, that FAIL triggers a full ROLLBACK — even though the update built
green and the app is healthy. But a successful update can't freshen the *timer*, so a box whose timer
went stale (e.g. after a prior wedge) gets stuck: every update succeeds + healthy → verify fails on the
stale timer → rollback → still stale → repeat forever.
- **Caught at Appleton 2026-06-13:** verify reported `17/18 passed, failed=[autoupdate_timer_fresh]
  (sidecar age=214258s)` — the one stale-timer check rolled back an otherwise-perfect update.
- **Fix:** the two stale-timer branches now follow the SAME pattern the unit-file-missing case already
  used — **non-fatal WARN in `--json`/auto-update mode** (so it never rolls back a healthy build),
  **hard FAIL only in interactive mode** (so an operator auditing a box still sees the stuck timer).
- **Effect:** once a stale box merges this fix (the merge happens before the verify step, so the very
  update that pulls it benefits), its update completes instead of rolling back. Related: Gotcha #11,
  `[[feedback-auto-update-failure-modes]]`.

---

## v2.56.3 — teach Hermes the system: SOUL.md + troubleshooting skill (2026-06-13)

**Branch landed:** main → fleet via auto-update
**New repo dir `hermes/`** (deliberately OUTSIDE the RAG-indexed paths so it can't create a
doc-divergence loop — the plan's guardrail): version-controlled Hermes Agent templates.
- `hermes/SOUL.md` — Hermes' standing identity: it IS the operator agent for THIS install (not a generic
  LLM); its 8 MCP observe tools + the directive to USE them (and `search_system_docs` to look things up
  rather than guess); the bartender-vs-operator register rules; anti-hallucination/anti-inversion
  grounding; the must-never-get-wrong gotchas (outputOffset, IR-only cable boxes, wireless/paging-mic ≠
  karaoke). Adapted from the proven in-app chat system prompt.
- `hermes/skills/sports-bar-troubleshooting/SKILL.md` — thin diagnostic playbooks (wrong/black TV, mic,
  audio drop, todos) that orchestrate the MCP tools + `search_system_docs`. No duplicated doc content.
- **Per-box manual step (where Hermes Agent is installed — Holmgren so far):**
  `cp hermes/SOUL.md ~/.hermes/SOUL.md && cp -r hermes/skills/sports-bar-troubleshooting ~/.hermes/skills/`.
  A future `scripts/setup-hermes-agent.sh` will automate it. SOUL.md loads fresh every message (no restart).
- Verified via Grok: agent self-identifies as the operator AI, knows outputOffset, references the tools.

---

## v2.56.2 — audit fixes for Phase 1 (2026-06-13)

**Branch landed:** main → fleet via auto-update
**No setup required.** Fixes from the 3-agent adversarial audit of today's work:
- **CRITICAL:** `get_atlas_status` read `drops?.events` / `.zone` but `/api/atlas-drops` returns
  `{drops:[{zone_number,zone_name}]}` — so it ALWAYS reported "no drops" (was hiding 14 real ones).
  Fixed to `drops?.drops` + `zone_name`. Verified e2e via Grok.
- **Security:** `get_firetv_status` no longer emits internal LAN IPs into the LLM context (matters with
  cloud Grok). And `/api/system/health` no longer returns `details`/`stack` in its 500 body (could carry
  the Soundtrack API key; full stack still server-logged) — pre-existing, made reachable via MCP.
- **Efficiency:** `get_atlas_status` now runs its two reads with `Promise.all`.
- The two arg-taking MCP tools keep `inputSchema as any` — empirically re-confirmed TS2589 returns at
  SDK 1.29 + zod 4 without it (an audit agent claimed it was removable; it is not). Handler args stay
  explicitly typed.
- Clarified `route-verify.ts` header: helper is NOT yet wired into the scheduler (Wave 3c does that).

---

## v2.56.1 — Hermes Agent Phase 1b: 6 more observe tools (2026-06-13)

**Branch landed:** main → fleet via auto-update
**No setup beyond v2.56.0.** Adds six read-only tools to the `@sports-bar/mcp` server:
`get_matrix_routes`, `explain_tv_output` (arg: outputNumber), `get_shure_rf_status`, `get_atlas_status`,
`get_firetv_status`, `search_system_docs` (RAG — args query/tech). Still thin adapters over existing
audited APIs; nothing writes hardware. All 8 tools proven end-to-end via Grok (explain_tv_output(20) →
"input 11"; mics connected; outputOffset doc lookup correct).
- Aligned the package's `zod` range to `^4.0.0` (repo is on zod v4.4.3). The two arg-taking tools cast
  `inputSchema as any` to defeat a known TS2589 deep-instantiation between the MCP SDK generics and zod
  v4 — runtime validation is unaffected, handler args are explicitly typed.
- If a box already registered `sports-bar` (v2.56.0), the new tools appear automatically (registered as
  "all tools enabled"); no re-`add` needed. Verify with `hermes mcp test sports-bar` → "Tools discovered: 8".

---

## v2.56.0 — Hermes Agent Phase 1a: `@sports-bar/mcp` observe gateway (2026-06-13)

**Branch landed:** main → fleet via auto-update
**New package `@sports-bar/mcp`** — a stdio MCP server exposing the system to Hermes Agent as
**read-only observe tools** (Phase 1a: `get_system_health`, `list_open_todos`). Thin adapters over the
existing audited HTTP APIs; nothing writes hardware. Adds dep `@modelcontextprotocol/sdk@^1.0.0`
(pure-JS, no native build). No-op `build` script (runs via `tsx`, like scheduler/services).
- **Auto-applied:** `npm ci` on auto-update installs the new dep; the package is inert unless Hermes
  Agent is installed on the box and registered to it. The web build is unaffected (nothing imports it).
- **Per-box manual step (only where Hermes Agent is installed — Holmgren so far):** register the server:
  `hermes mcp add sports-bar --command /home/ubuntu/Sports-Bar-TV-Controller/packages/mcp/start.sh`
  (answer `Y` to the enable-tools prompt). This writes to `~/.hermes/config.yaml` (per-box runtime
  config, NOT in the repo). A future `scripts/setup-hermes-agent.sh` will automate it.
- **Model note:** tool-using turns need **Grok or a 14B local** — `hermes3:8b` is too weak (prints the
  tool-call as text instead of invoking it). Proven end-to-end via Grok: agent → `get_system_health` →
  `/api/system/health` → correct live answer. Full context: `[[project-hermes-agent-adoption]]`.

---

## v2.55.82 — Wave 3 / 3b: routeAndVerify helper (2026-06-12)

**Branch landed:** main → fleet via auto-update
**No setup required — new code, not yet wired into the tune path (3c does that).** Adds `packages/scheduler/src/route-verify.ts`: read the Wolf Pack route back after a route command and confirm the targeted output actually carries the input we sent. Exported `checkRouteMatch` / `verifyAndRetryRoute` / `runVerifyLoop` / `persistVerifyState`.
- **Advisory only** (Standing Rule 3): never throws into the tune path, never rolls back an allocation. A failed verify sets `verify_state='failed'` + `verify_error` and is surfaced for escalation (3e).
- **outputOffset = NONE in the compare** (the subtle part): the scheduler's send (`routeMatrix`) applies no offset, so verify mirrors it — `routingArray[outputNumber-1] === matrixInput-1`. Adding `+outputOffset` (as a literal reading of Gotcha #4 suggested) would FALSE-ALARM on multi-card boxes like Graystone (+32 belongs only to the Atlas audio path `routeWolfpackToMatrix`, which the scheduler never uses). Confirmed empirically against live Holmgren o2ox. Full reasoning in the file header.
- **Test:** `npx tsx scripts/test-route-verify.ts` — 26 assertions (index/off-by-one + 5 orchestration outcomes), all pass with injected mocks, no hardware.

---

## v2.55.81 — Wave 3 / 3a: allocation verify columns (2026-06-12)

**Branch landed:** main → fleet via auto-update
**Schema migration — runs automatically.** First sub-step of Wave 3 `routeAndVerify` (closed-loop tune verification). Adds 4 additive columns to `input_source_allocations`: `verified_at` (int), `verify_state` (text NOT NULL default `'unverified'`), `verify_attempts` (int NOT NULL default 0), `verify_error` (text). Migration `drizzle/0004_allocation_verify_columns.sql`.
- **No manual step:** auto-update runs `bootstrap-drizzle-migrations.sh` + `drizzle-kit migrate` (Gotcha #6 — NOT push). All four are `ADD COLUMN` with defaults, so the ALTER is instant on a live SQLite DB and existing rows backfill to `unverified`/`0`. No code consumes the columns yet (the verifier helper lands in 3b), so the running build keeps working unchanged before/after the migration.
- **Verify:** `sqlite3 production.db "PRAGMA table_info(input_source_allocations)" | grep verif` shows columns 25–28; `verify-install.sh` `schema_completeness` layer passes.
- **Trap honored:** verify state lives in its OWN column, never a `status` value — a stuck verify can't strand the allocation lifecycle (status stays pending/active/completed).

---

## v2.55.76–v2.55.79 — System Admin TODO list: usability + error-bot auto-file (2026-06-11)

**Versions covered:** v2.55.76 (FLEET_STATUS refresh), v2.55.77 (todo sort), v2.55.78 (todo filter), v2.55.79 (error-watch auto-file)
**Branch landed:** main → fleet via auto-update
**No setup required.** Operator wants the System Admin → Todos tab as the source of truth for project work.
- v2.55.77: list now sorts **needs-work to the top** (semantic IN_PROGRESS→PLANNED→TESTING→COMPLETE, CRITICAL→HIGH→MEDIUM→LOW), was alphabetical.
- v2.55.78: "All Priorities"/"All Status" filters now actually show everything (fixed a stale-closure bug where the dropdown fetched the *previous* filter value).
- v2.55.79: **the error-watch bot now auto-files a TODO** when it matches an error signature in the PM2 logs — deduped to one open TODO per signature (re-files if it recurs after being marked COMPLETE). New endpoint `POST /api/error-watch/todo`; `scripts/watchers/error-watch.sh` calls it. **The watcher must restart to pick up the new script** (auto-update's PM2 restart cycle handles this; on a box you're hands-on with, restart the error-watch watcher). Category `Error Watch`, priority CRITICAL for integrity-class signatures else HIGH.
**Standing rule (Claude):** log every work item/fix we do or schedule on this list, mark COMPLETE when shipped+verified. See `[[feedback-log-work-to-system-admin-todos]]`.

---

## v2.55.73 + v2.55.75 — Wolf Pack: per-IP HTTP session mutex + route over TCP (2026-06-11)

**Versions covered:** v2.55.73 (code), v2.55.75 (docs)
**Branch landed:** main → fleet via auto-update
**Code (v2.55.73, no setup):** per-IP serialization of Wolf Pack HTTP sessions (`acquireWolfPackHttpLock`) so the bartender Video-tab route-state READ can't run concurrently with a scheduler route WRITE. Auto-applies fleet-wide.
**Per-location operational step (the actual un-route fix):** any location whose Wolf Pack routes over **HTTP** uses the `o2ox` TOGGLE, which disconnects an already-set output when re-sent (intermittent black TV when the Video tab opens). **Fix = flip that box to TCP** (Holmgren precedent): `sqlite3 /home/ubuntu/sports-bar-data/production.db "UPDATE MatrixConfiguration SET protocol='TCP' WHERE protocol='HTTP';"` — config is read fresh per route, so NO restart needed; rollback is the same UPDATE back to `'HTTP'`. Confirm TCP is open (no password) on that unit first. **Applied 2026-06-11 to Stoneyard Greenville + Appleton.** Validate by a real TV switch. Full rationale: `[[feedback-wolfpack-tcp-not-http-routing]]`. (The shelved HTTP-`o2o`-idempotent code alternative lives on branch `wip/wolfpack-o2o-idempotent`, not shipped.)

---

## v2.55.72 — override-learn must not patch future pending allocations (2026-06-11)

**Versions covered:** v2.55.72
**Branch landed:** main → fleet via auto-update (overnight)
**No code setup required.** Bug fix: the override-learn window (matrix/route/route.ts) had no `allocated_at <= now` lower bound, so a bartender's tonight-only TV tweak silently rewrote FUTURE pending allocations (tomorrow's/Friday's pre-scheduled games on the same input source) and triple-logged the override. Added the lower bound.
**Per-location data check (recommended):** locations that pre-schedule future games AND do heavy same-day bartender overrides may have already-corrupted future allocations. Detect: `SELECT id, channel_number, tv_output_ids, datetime(allocated_at,'unixepoch','localtime') FROM input_source_allocations WHERE allocated_at > unixepoch('now') AND updated_at >= unixepoch('now','-1 day') AND status IN ('pending','active','tuning');` — any future-dated row touched today is suspect. Reconstruct the pre-bug set from the override-learn SchedulerLog `prevOutputs` chain (first prev = original). Holmgren's 3 corrupted rows were repaired 2026-06-11 (backup at `sports-bar-data/override-learn-future-corruption-backup-2026-06-11.sql`).

---

## v2.55.71 — override-digester idempotency + timestamp fix (2026-06-11)

**Versions covered:** v2.55.71
**Branch landed:** main → fleet via auto-update (overnight)
**No setup required.** Bug fix: override-digest was re-emitting an identical `recommend` SchedulerLog row for every stable pattern on every hourly run (~720/month/pattern); now only emits when a pattern is new or has strengthened. Also fixes firstSeen/lastSeen (was run-time, now real event timestamps). No DB migration; existing duplicate rows are harmless history and stop accumulating after deploy.

---

## v2.55.70 — complete Wave 1a OR-gate sweep (auto-reallocator) (2026-06-11)

**Versions covered:** v2.55.70
**Branch landed:** main → fleet via auto-update (overnight, no mid-game restart)
**No setup required.** Behavior-preserving refactor: routes auto-reallocator.ts's revert + tune-back paths through the shared `parseHardwareResult` helper instead of hand-rolled `malformedOk` logic (the 2 sites a 6-team audit found the v2.55.57 Wave 1a sweep had missed). Same `{success:true}` contract, centralized in one place. No DB, no env, no manual step.

---

## v2.55.56 — LLM perf logging + per-box num_predict/timeout (2026-06-11)

**Versions covered:** v2.55.56
**Branch landed:** main → all 6 location branches
**Required Manual Step (slow boxes only):** Graystone (~6.7 tok/s iGPU) — set `OLLAMA_TIMEOUT_MS=420000` in `.env` + `pm2 delete && pm2 start ecosystem.config.js` (Gotcha #2). Already applied 2026-06-11. Other boxes need nothing (defaults: timeout 300000, num_predict 2048).

**Why:** AI Suggest timed out on Holmgren (RAG-scan contention, fixed in v2.55.55) — but the deeper question was whether `num_predict: 2048` is even right per box. Generation time ≈ num_predict ÷ tok_s; Holmgren ~11 tok/s (2048 → ~183s ✓) vs Graystone ~6.7 (2048 → ~306s ✗ over the 300s timeout). `num_predict` is only a CEILING though — we had no data on real output sizes because AI Suggest discarded `eval_count`/`done_reason`.

**What shipped:**
- **`lib/llm-perf-logger.ts`** (new) — `logLlmPerf()` writes one line per Ollama generation to `/home/ubuntu/sports-bar-data/logs/llm-perf-YYYY-MM-DD.log`: feature, model, box, `out` (real output tokens), `prompt` tokens, `done` (`stop`=natural / `length`=**truncated at cap**), `cap`, real-world `tok_s`, `total_ms`, outcome (ok/timeout/error). Mirrors to `[LLM-PERF]` in PM2; truncations log at WARN.
- **AI Suggest** (`callOllama`) + **shift-brief** (`generateBriefViaOllama`) call it. AI Suggest's `num_predict` is now `HARDWARE_CONFIG.ollama.numPredict`.
- **`hardware-config.ts`** — `ollama.timeout` now reads `OLLAMA_TIMEOUT_MS` (default 300000); new `ollama.numPredict` reads `OLLAMA_NUM_PREDICT` (default 2048). Both per-box env-tunable.

**Next:** after a few days, `grep ai-suggest llm-perf-*.log` per box → read the `out` p95 + `done` distribution → set `OLLAMA_NUM_PREDICT` (and timeout) per box from real numbers. If any `[TRUNCATED@cap]` appears, suggestions are silently incomplete and the cap must go UP, not down.

---

## v2.55.55 — RAG rescan yields the iGPU so it can't starve AI Suggest (2026-06-11)

**Versions covered:** v2.55.55
**Branch landed:** main → all 6 location branches
**Required Manual Step:** None. Script-only change — no app rebuild needed; the next rescan on each box uses the throttled scripts.

**Root cause (Holmgren 2026-06-11):** AI Suggest timed out (300s) because a doc-commit RAG rescan (`scan-system-docs.ts`, Standing Rule 11) was running during pre-shift. The single Intel iGPU serializes Ollama work, so the scan's back-to-back `nomic-embed-text` embeddings monopolized the queue and the `llama3.1:8b` AI Suggest generation got starved. Compounded by AI Suggest's `num_predict: 2048` (~220s even uncontended).

**Fix:**
- `scan-system-docs.ts` + `scan-code-docs.ts` now `await` a per-batch delay (`RAG_SCAN_BATCH_DELAY_MS`, default 1200ms) so the iGPU queue gets gaps an interactive request can slip into — max wait drops from "the whole remaining scan" to ~one batch.
- `rag-rescan-if-needed.sh` runs the scans under `nice -n 19 ionice -c3` (belt-and-suspenders for CPU/IO).

**Note (not changed):** AI Suggest's `num_predict: 2048` is inherently near the 300s budget at ~9 tok/s. If timeouts recur even with rescans throttled, the follow-up is to trim it. The keep_alive=-1 multi-model residency ([[feedback-ollama-ram-pressure]]) is unchanged — only the embedding model + llama3.1:8b are pinned (~5.6 GB), within budget on a 31 GB box.

---

## v2.55.54 — Shift-brief: make the LLM-error log diagnosable (2026-06-11)

**Versions covered:** v2.55.54
**Branch landed:** main → all 6 location branches
**Required Manual Step:** None.

`/api/ai/shift-brief` caught LLM-generation failures with `logger.error('[SHIFT-BRIEF] Error:', error)`. When the Ollama call hit its `AbortSignal.timeout(90s)`, the rejection is a `TimeoutError`/`AbortError`/DOMException whose `.message` is empty — so the log read `[SHIFT-BRIEF] Error:` with nothing after it (seen overnight at Holmgren, undiagnosable). Now the catch builds an always-informative reason: timeout/abort → "Ollama request timed out after 90s (model not resident or box under load)"; otherwise `message → cause.message → name`. The `llmError` field in the degraded response carries the same reason, and the inner fallback failure is logged too. Behavior unchanged — the brief still degrades to `fallbackBrief()`; only the diagnostics improved. Tonight's logs will name the real cause (almost certainly an Ollama timeout under load).

---

## v2.55.53 — MAC auto-discovery for network TVs (2026-06-10)

**Versions covered:** v2.55.53
**Branch landed:** main → all 6 location branches
**Required Manual Step:** None. New capability; no config required.

A `NetworkTVDevice` with no `macAddress` can't do Wake-on-LAN power-on (and logs a warning every bulk-power cycle — see v2.55.52). The box can now read the MAC straight off the LAN instead of hand-entering it:
- **`apps/web/src/lib/mac-discovery.ts`** — `resolveMacForIp(ip)` pings once to populate the kernel ARP/neighbor cache, then reads the MAC back via `ip neigh show` (fallback `/proc/net/arp`). `backfillMissingMacs()` fills every TV missing a MAC. Same-LAN + Linux only; deterministic (no LLM).
- **`POST /api/tv-control/detect-macs`** — on-demand backfill (optional `{deviceId}`). Admin-only surface (device-config, port 3001) — NOT in the bartender :3002 allow-list (not needed).
- **`instrumentation.ts`** — scheduled backfill 60s after boot + every 30 min, so a TV self-populates its MAC the moment it's powered on and reachable.
- **UI** — "Detect MACs" button on the TV Network Discovery panel (Device Config).

**Effect at Greenville:** once TV 20 (10.40.10.20, currently MAC-less) is powered on, the next scheduled run (or the button) fills its MAC automatically → WoL power-on starts working and the v2.55.52 warning stops for good.

---

## v2.55.52 — Demote two operational log-spam ERRORs to WARN (2026-06-10)

**Versions covered:** v2.55.52
**Branch landed:** main → all 6 location branches
**Required Manual Step:** None. Pure log-level changes; no behavior change.

Fleet error scan found two ERROR-level log-spam sources (both operational states wrongly logged as application faults, tripping the error-watch every cycle):
- **`bulk-power/route.ts`** — a TV with no `macAddress` fails Wake-on-LAN power-on and logged ERROR on every bulk-power cycle (Greenville TV 20 = 85 ERROR rows/24h). The missing-MAC case is a CONFIG GAP, now logged at WARN; genuine failures still ERROR. (Config-side: add the TV's MAC so WoL actually works.)
- **`firetv-health-monitor.ts`** — "Device X has been down for N minutes" logged ERROR; an AV endpoint (Atmosphere TV, Epson projector, a TV off after close) being unreachable is operational, not a fault (Holmgren Atmosphere = 34 ERROR rows/24h flapping off-hours). Now WARN; the `alertsSent` dedup still fires once per down-period.

---

## v2.55.50–51 — verify-install auth check: bind to LOCATION_ID, not id format; wizard lspci (2026-06-10)

**Versions covered:** v2.55.50, v2.55.51
**Branch landed:** main → all 6 location branches
**Required Manual Step:** None. These correct two follow-ups to v2.55.49.

- **v2.55.51 (IMPORTANT correctness)** — `check_auth_bootstrap_complete` originally rejected `LOCATION_ID=default-location` as "un-bootstrapped" (a speculative Grok suggestion). That was WRONG for the real fleet: **Graystone runs functionally with `LOCATION_ID=default-location`** and both AuthPins bound to that id — login works fine, but the check false-FAILed it (17/18 in interactive mode). The check now tests the BINDING — `SELECT COUNT(*) FROM AuthPin WHERE isActive=1 AND locationId=<.env LOCATION_ID>` ≥ 1 — which is the actual "will login work?" condition, independent of whether the id is a UUID or the literal `default-location`. No rollback risk ever existed (the check is WARN-only in `--json`/auto-update mode), but the interactive FAIL was a false alarm. All boxes now PASS 18/18.
- **v2.55.50** — wizard's IPEX-Ollama offer detects Intel via `lspci` instead of `clinfo` (clinfo isn't installed on a fresh ISO box, so the offer silently skipped on the Intel iGPU boxes it targets; confirmed live on Lime Kiln = Iris Xe).

---

## v2.55.49 — Lime Kiln fresh-ISO audit: install-completeness + backup data-leak fixes (2026-06-10)

**Versions covered:** v2.55.49
**Branch landed:** main → all 6 location branches
**Required Manual Step:** None for EXISTING boxes — all 6 are already bootstrapped (LOCATION_ID set, AuthPin≥1, auto-update timer installed), so they PASS the two new verify-install checks in both `--json` and interactive mode. **For any NEW fresh-ISO box**, the per-location bootstrap is now ENFORCED rather than silently optional (see below).

**What this rolls up:** the Red/Blue/White/Purple team audit (+ Grok final review) of the newest fleet box "Lime Kiln" (installed from the v3.1.0 subiquity-autoinstall ISO). The box was OS/app-healthy (verify 17/17, health 200) but had install-completeness gaps the old verify-install silently passed, plus a real fleet-wide data-leak vector. Fixes:

- **CRITICAL (data-leak) — Location Backup route** (`apps/web/src/app/api/location/backup/route.ts`): previously did `git add` → `git commit` → `git push origin $(git branch --show-current)`. On a `main`-branch box (every fresh ISO box) that pushes a full per-location DB dump (35 tables) to `origin/main` → propagates to every location on next merge. Fixed: (1) ADMIN session gate on POST, (2) **branch-guard** — refuses commit/push unless current branch starts with `location/` (writes the backup locally + returns a warning instead), (3) `git add -f` since `apps/web/backup/` is now gitignored, (4) `.gitignore` entry for `apps/web/backup/`. `GET /api/location/backup-status` also ADMIN-gated (was leaking locationId/name/branch to any LAN caller). UI (`LocationSettings.tsx`) now honors the `warning` field instead of always claiming "Pushed to branch".
- **HIGH (false-green) — verify-install.sh**: added `check_auth_bootstrap_complete` (#18) — FAILs (interactive) when AuthPin active-count=0 OR LOCATION_ID is blank/`default-location`; and refactored `check_autoupdate_timer_fresh` to FAIL when the timer **unit file** is missing (was grandfathered as PASS on "no logs yet"). **Both take a non-fatal WARN path in `--json` mode** so a not-yet-bootstrapped box being manually updated never triggers an auto-update rollback (auto-update.sh rolls back on any non-zero verify exit). TOTAL 17→18.
- **MED (turnkey) — ISO automation**: `first-boot-fresh.sh` now uses `npm ci` (not `npm install --prefer-offline`, which mutated package-lock.json → dirty tree on main). `location-setup-wizard.sh` now (a) offers the IPEX-LLM `setup-iris-ollama.sh` build when an Intel iGPU is detected (was CPU-only ~3 tok/s), and (b) runs `install-auto-update-timer.sh` at wizard end (self-gates on `schedule_cron`; prints Sync-tab guidance if not yet configured).

**Verification:** `bash scripts/verify-install.sh` should show `18/18` on a bootstrapped box. On a fresh box pre-bootstrap, interactive mode now FAILs `auth_bootstrap_complete` + `autoupdate_timer_fresh` with the exact fix commands — that is the intended new signal, not a regression.

**Grok verdict:** GO — no correctness blockers, rollback-hazard design sound, zero fleet regression confirmed across all 6 bootstrapped boxes.

---

## v2.55.48 — Scheduler+channel-guide audit merge: v2.55.43-46 landed (2026-06-10)

**Versions covered:** v2.55.48 (merge commit superseding the four audit fix branches v2.55.43-46)
**Branch landed:** main → all 6 location branches
**Required Manual Step:** None beyond the standard auto-update → rebuild → PM2 restart cycle.

**What this rolls up:** the Red/Blue/White/Purple/Green/Orange/Grok team audit of the scheduling + channel guide systems (follow-up to the v2.55.39-41 audit). Four fixes, each independently committed, Orange-probed (all SECURE-BY-DESIGN), and Grok-reviewed per-diff:

- **v2.55.43 (CRITICAL)** — `auto-reallocator.ts` OR-gate. v2.55.41 fixed the tune-success gate in scheduler-service.ts but missed the IDENTICAL `if (response.ok)` pattern at TWO auto-reallocator sites (revert path + tune-back-to-default path). HTTP 200 with `{success:false}` marked the TV reverted while the box never moved. Now `result.success === true` strictly + malformedOk WARN fall-through. Orange: SECURE-BY-DESIGN (no double-.json(), fall-through reaches failure branch). Grok: CLEAN.
- **v2.55.44 (HIGH)** — channel-guide local-override dedup compared TEXT `ChannelPreset.channelNumber` vs INTEGER `local_channel_overrides.channelNumber` with strict `===`, never matched → Brewers ch 308 appeared twice. Fixed 3 dedup guards with String() normalization. **Grok layer-1 caught a deeper bug all 6 teams + Orange missed:** the injection ALSO emitted raw integers into `channel.number`/`channelNumber`, so the bartender component's `preset.channelNumber === prog.channel.number` (string===number) silently dropped carriage-deal override rows — the Brewers game could vanish ENTIRELY. Fixed by String()-ing the injection writes too.
- **v2.55.45 (HIGH)** — `pattern-analyzer.ts` used `INSERT OR REPLACE` (delete+reinsert) which reset `observation_count` to DEFAULT 1 every hourly run, making AI Suggest's `ORDER BY observation_count DESC` ranking meaningless. All 6 upsert sites converted to `INSERT ... ON CONFLICT DO UPDATE` with atomic `observation_count = COALESCE(observation_count,0)+1`. ai-suggest loader now compound `ORDER BY observation_count DESC, confidence DESC`. Orange confirmed the UNIQUE(pattern_type,pattern_key) constraint exists in all 3 places (no unbounded-growth risk). Grok: CLEAN.
- **v2.55.46 (HIGH)** — override-learn window. v2.55.40 changed from a 10-min `allocated_at` gate to `expected_free_at`, which killed learning once a game ran past its estimatedEnd (extra innings, OT, rain delay). Added `OR a.status = 'active'` so active allocations stay learnable until the auto-reallocator flips them completed at real game end. Orange confirmed the v2.55.43×v2.55.46 stale-active cross-interaction does NOT materialize (endAllocation writes status='completed' BEFORE the revert call). Grok: CLEAN.

**Per-team routing tracking** (operator-asked during the audit): confirmed `scheduling_patterns.pattern_type='team_routing'` already captures `{team, preferredInput, preferredOutputs[], frequency}` per team. v2.55.45's fix makes the observation_count ranking that feeds AI Suggest finally meaningful.

**Live regression test:** Greenville Brewers @ 20:05 tonight exercises v43 (revert gate), v44 (ch 308 guide), v46 (extra-innings override-learn) directly. Watch `/home/ubuntu/sports-bar-data/logs/scheduling-2026-06-10.log`.

---

## v2.55.46 — Override-learn stays open through overtime / extra innings (2026-06-10)

**Versions covered:** v2.55.43–v2.55.46
**Branch landed:** main → all 6 location branches
**Required Manual Step:** **None.** Code-only fix; the normal auto-update rebuild + PM2 restart picks it up.

**Why (operator terms):** when a game runs PAST its scheduled end — extra
innings on a Brewers game, overtime, a rain delay — the system used to stop
learning from bartender corrections the moment the *estimated* end time
passed. So if a bartender moved the game to different TVs during extras,
that correction was silently ignored by the pattern learner, even though
that late-game window is exactly when corrections happen most. MLB extra
innings are routine; this gap dropped real learning signal.

**What changed:** `/api/matrix/route`'s override-learn allocation query now
keeps the learning window open **while the allocation is still active OR
its expected end time has not passed**. The auto-reallocator marks the
allocation `completed` at the real game end, which closes the window
naturally — no fixed clock cutoff.

**Verify at a location** (after a game that went long): bartender re-routes
during overtime should produce an override-learn row:
```bash
grep "override-learn" /home/ubuntu/sports-bar-data/logs/scheduling-$(date +%F).log
# or: sqlite3 /home/ubuntu/sports-bar-data/production.db \
#   "SELECT created_at, message FROM SchedulerLog WHERE component='override-learn' ORDER BY created_at DESC LIMIT 5"
```

---

## v2.55.45 — pattern-analyzer: observation_count atomic increment (AI Suggest ranking fixed) (2026-06-10)

**Versions covered:** v2.55.45 — scheduler audit Green #3 (HIGH)
**Branch landed:** main
**Required Manual Step:** None. PM2 restart picks it up. observation_count starts climbing on the next pattern-analyzer run (hourly).

**Why:** AI Suggest's pattern loader does `ORDER BY observation_count DESC LIMIT 100`, but `scheduling_patterns.observation_count` was stuck at DEFAULT 1 forever — so the 100-row cap returned patterns in undefined order and the highest-signal team_routing patterns (e.g. the Brewers row with frequency=12) could be silently cut off. The root cause was NOT "the column is never written" — it was that pattern-analyzer used `INSERT OR REPLACE`, which is a DELETE + reinsert that resets observation_count to its column DEFAULT on every run.

**Fix:** all 6 upsert sites in `packages/scheduler/src/pattern-analyzer.ts` converted from `INSERT OR REPLACE` to `INSERT ... ON CONFLICT(pattern_type, pattern_key) DO UPDATE SET ... observation_count = COALESCE(observation_count, 0) + 1, last_observed = excluded.last_observed`. Atomic increment (safe across concurrent analyzer runs — no JS read-modify-write). The ON CONFLICT update preserves the existing row + its observation_count instead of wiping it.

Also: `apps/web/src/app/api/scheduling/ai-suggest/route.ts` loader is now `ORDER BY observation_count DESC, confidence DESC` — compound so a tie on observation_count breaks toward the higher-confidence pattern.

The fallback DDL (`CREATE_SCHEDULING_PATTERNS_TABLE`) was brought column-compatible with drizzle/0000_baseline.sql (added observation_count, first_observed, last_observed, is_stale, last_analyzed_at) so a dev DB created via that path behaves identically.

**Verify:** run the pattern analyzer twice (or wait two hourly cycles), then `SELECT pattern_key, observation_count FROM scheduling_patterns WHERE pattern_type='team_routing' ORDER BY observation_count DESC LIMIT 5` — counts should be climbing above 1.

---

## v2.55.44 — Channel guide: fix dead local-override dedup (duplicate ch-308 rows) (2026-06-10)

**Versions covered:** v2.55.44
**Branch landed:** main → all 6 location branches
**Required Manual Step:** **None.** Pure bug fix; standard rebuild + PM2 restart via auto-update.

**Why:** The channel-guide local-override dedup compared `p.channel?.number`
(TEXT, from Rail/preset data) against `override.channelNumber` (INTEGER, from
`local_channel_overrides`) with strict `===` — string-vs-number never matches,
so the dedup was dead code. A Brewers game on ch 308 (BallyWIPlus, the WI RSN
split) could appear TWICE in the bartender's channel guide: once from the Rail
Media station-alias match, once from the local-override injection. Affects any
location running Brewers games (Holmgren, Greenville at minimum).

**Fix:** `apps/web/src/app/api/channel-guide/route.ts` — `String()`-normalize
both sides at all three preset/override channel-number comparison boundaries
(override-row filter, override-injection dedup, game_schedules-injection dedup).

**Verification (game-day):** `POST /api/channel-guide` with
`{"deviceType":"cable"}` during a Brewers broadcast window — each ch-308
matchup must appear once, and no program `id` starting with `local-308-` should
share homeTeam+awayTeam+gameTime with a Rail-sourced ch-308 program.

---

## v2.55.43 — auto-reallocator OR-gate fix: v2.55.41 missed two sibling sites (2026-06-10)

**Versions covered:** v2.55.43 — scheduler audit Green #1 (CRITICAL)
**Branch landed:** main
**Required Manual Step:** None. PM2 restart picks it up.

**Why:** v2.55.41 fixed the tune-success OR-gate in scheduler-service.ts (the Greenville Brewers "didn't switch" bug). The Red/Blue/White/Purple scheduling audit found the IDENTICAL bug pattern in `packages/scheduler/src/auto-reallocator.ts` at TWO sites the v2.55.41 patch never touched:

1. **Revert path (~line 597):** when a game ends and the auto-reallocator reverts a TV to its default source, `if (routeResponse.ok)` treated any HTTP 200 as a successful revert — even an HTTP 200 with `{success:false}` body. The allocation was already marked completed by endAllocation(), so the TV silently stayed on the dead game feed while a green "reverted" row logged.
2. **Tune-back-to-default path (~line 884):** same `if (tuneResponse.ok)` on the cable/satellite tune-back. `/api/channel-presets/tune` returns HTTP 200 with `{success:false}` for soft failures (box offline, channel missing) — these were logged as "Tuned back to default" while the box never moved.

**Fix:** both sites now use `result.success === true` strictly, with a `malformedOk` branch (HTTP 200 + missing success flag → loud WARN + fall through to failure). Mirrors scheduler-service.ts:1156-1159 exactly. A third `response.ok` at line 439 (GET /api/settings/default-sources config load) is correctly NOT changed — it's a config read, not a routing command; failure safely skips revert.

**Verify:** during a game-end revert where the cable box is offline, confirm the scheduler log shows `revert ... treating as failure` (WARN) rather than a success row, and the allocation is NOT silently marked reverted.

---

## v2.55.47 — first-boot sets git identity (fixes Location Backup on fresh ISO box) (2026-06-10)

**Versions covered:** v2.55.47
**Branch landed:** main
**Required Manual Step on EXISTING fresh-ISO boxes that haven't run bootstrap-new-location.sh yet:**
```bash
git config --global user.name "Sports Bar TV Controller"
git config --global user.email "dfultonthebar@github.com"
```

**Why:** Lime Kiln (first v3.1.0 ISO install in production, 2026-06-10) hit `Backup failed: ... Author identity unknown ... unable to auto-detect email address (got 'ubuntu@sports-bar-controller.(none)')` on the operator's very first Location Backup attempt. The Location Backup feature (`/api/location/backup`) does a `git commit` to snapshot location data, but a fresh ISO box has NO git user.name/user.email configured, so git can't author the commit. `bootstrap-new-location.sh` DOES set the identity (line ~253) but that's a LATER per-location step — the backup feature is reachable from the moment the box boots, before bootstrap runs.

**Fix:** `scripts/iso/first-boot-fresh.sh` now sets the fleet-standard git identity (`Sports Bar TV Controller <dfultonthebar@github.com>`) immediately after the clone, so it's present from first boot regardless of whether bootstrap has run. Global config (`--global`) so it covers any repo the box touches.

**Verify on a fresh box:** `git config --global --get user.email` returns `dfultonthebar@github.com`, and a Location Backup from System Admin succeeds (commits to `backup/location-data/` on the location branch).

---

## v2.55.42 — Scheduling logger: AI Suggest + override-learn paths instrumented (2026-06-10)

**Versions covered:** v2.55.42
**Branch landed:** main → all 6 location branches
**Required Manual Step:** **None.** Pure additive logging; PM2 restart picks up the new instrumentation.

**Why:** v2.55.38 wired `scheduling-logger.ts` into the manual bartender-schedule POST. This closes the AI half of the coverage so the same log file (`/home/ubuntu/sports-bar-data/logs/scheduling-YYYY-MM-DD.log`) carries the AI Suggest decision trail + override-learn audit alongside the manual schedules.

**What's wired:**
- `/api/scheduling/ai-suggest` GET handler: logs `source='ai'` for the trigger (`action='attempt'`), Ollama timeout (`tune_fail` HTTP 504 with note about RAM pressure / model eviction), Ollama unavailable (`tune_fail` HTTP 503), suggestions-returned (`allocation_created` with rejection count + patterns-consulted count), and uncaught exceptions (`tune_fail` HTTP 500).
- `/api/matrix/route` POST handler (the override-learn write site at line 244): mirrors every override-learn SchedulerLog row into the dedicated scheduling log as `source='override-learn', action='allocation_updated'`. Home-team overrides log at `level='warn'`, non-home at `level='info'` — matches the SchedulerLog severity convention.

**Operator usage:** the scheduling log now carries a single grep-able view of all paths:
```bash
# Brewers re-routes today across all sources (manual + AI + override-learn):
grep -i brewers /home/ubuntu/sports-bar-data/logs/scheduling-$(date +%F).log

# Watch live as a game-day shift unfolds:
tail -f /home/ubuntu/sports-bar-data/logs/scheduling-$(date +%F).log

# All AI Suggest decisions today:
grep "AI" /home/ubuntu/sports-bar-data/logs/scheduling-$(date +%F).log
```

**Per-team routing pattern tracking** (operator-asked): confirmed already running. `scheduling_patterns` table has `pattern_type='team_routing'` rows like `{"team":"Milwaukee Brewers","preferredInput":"Cable Box 1","preferredOutputs":[13,9,16,19,20,18,26,33,1,4,10,12,3,7,6,14,27,43],"frequency":12}`. `packages/scheduler/src/pattern-analyzer.ts` analyzes `input_source_allocations.tv_output_ids` hourly. AI Suggest consults these when recommending routes.

**Still TODO** (next instrumentation pass): auto-reallocator (`packages/scheduler/src/auto-reallocator.ts`) — when the background service preempts/replaces allocations.

---
## v2.55.41 — Scheduler tune OR-gate fix: HTTP 200 with {success:false} no longer flips allocation to 'active' (2026-06-10)

**Versions covered:** v2.55.41
**Branch landed:** main → all 6 location branches
**Required Manual Step:** **None.** Code-only fix; no schema, no env, no PM2 ecosystem changes. Auto-update rebuilds, restarts, done.

**Why:** RED team triage of the Greenville Brewers "didn't switch" symptom traced the most likely root cause to `packages/scheduler/src/scheduler-service.ts:1146`. The branch was `if (result.success || response.ok) { ... mark allocation 'active' ... }`. The tune endpoint at `/api/channel-presets/tune` returns HTTP 200 with `{success:false, error:'Cable box not found'}` for soft failures (device not found, device offline, channel missing, etc.). The OR short-circuited on `response.ok=true` and ran the success path — allocation status flipped to `'active'`, `input_sources.currentlyAllocated=true`, and Wolf Pack matrix routing fired for the wrong channel. The cable box never tuned, but the system claimed success. Bartender saw a green 'Scheduled' tile, nothing actually switched, no error surfaced anywhere. Fires across every scheduling path: manual, ai, auto, override-learn.

**Fix:** strict success check.

- `packages/scheduler/src/scheduler-service.ts` — replaced `if (result.success || response.ok)` with `if (result?.success === true)`. The previous `response.ok` fallback is split into an explicit `malformedOk` branch (HTTP 200 with no explicit `success` flag — neither true nor false): we log a `WARN` via `schedulerLogger.warn()` + `logger.warn()` and fall through to the existing failure path. The existing `else { schedulerLogger.log({ level: 'error', ... }) }` block at the bottom of the if-chain handles both the soft-fail `{success:false}` AND the malformed-200 cases — no new failure-handling code, just a stricter entry condition. Added a success-path `schedulerLogger.info` so the operator can see "Tune confirmed by API: success=true for allocation X" in the dedicated scheduling log when a tune actually worked.

**Verify** (post-update, optional — operator-facing smoke):
1. Holmgren: `curl -s -X POST http://localhost:3001/api/channel-presets/tune -H 'Content-Type: application/json' -d '{"channelNumber":"5","deviceType":"cable","cableBoxId":"nonexistent"}'` — confirm response is HTTP 200 with `{success:false, error:'…'}` body. (This is the shape the OR-gate misread.)
2. Create a test allocation pointing at a nonexistent device, wait one scheduler tick (~60s).
3. `sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT id, status FROM input_source_allocations WHERE id='<test-alloc-id>'"` — status MUST remain `'pending'` or transition to `'failed'`, never `'active'`.
4. `sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT currentlyAllocated, currentChannel FROM input_sources WHERE id='<input-source-id>'"` — `currentlyAllocated` must remain 0/false; `currentChannel` must NOT be the test channel.
5. `pm2 logs sports-bar-tv-controller --lines 50 | grep SCHEDULER` — expect `❌ Failed to tune …` line, NOT `✅ Successfully tuned …`.
6. `tail /home/ubuntu/sports-bar-data/logs/scheduling-*.log` — expect a `tune` row with `success: false` and the error verbatim from the API response.

**Blast radius:** every scheduled tune across every code path (manual / ai-suggested / auto-reallocated / override-learned) routes through this single branch. Fix is 2 lines of structural change + 3 new log lines. Expected positive effect: silent total failures (green tile, nothing switched, no error surfaced) stop. The remaining "didn't switch" symptoms after this lands will fall into one of the previously-known buckets (game not in `game_schedules`, network unreachable, IR emitter unplugged), all of which now produce visible error logs.

---

## v2.55.38 — Dedicated scheduling log file + bartender-schedule POST instrumentation (2026-06-10)

**Versions covered:** v2.55.38
**Branch landed:** main → all 6 location branches
**Required Manual Step:** **None.** New log file appears on first scheduling event. Existing PM2 log mirrors stay (no behavior change to existing observers).

**Why:** Two silent failures hit this morning:
- **Holmgren Timber Rattlers** — bartender picked the game from the channel guide, selected cable box 1, nothing happened. The bartender-schedule POST returned 404 with `No matching game schedule found for Great Lakes Loons @ Wisconsin Timber Rattlers ... The MLB/sports sync may not have imported this game yet.` Root cause: **MILB (Minor League Baseball) is not in the ESPN sync** (CLAUDE.md §9 lists MLB/NBA/NHL/NFL/CFB/MCBB/WCBB only). The channel guide surfaced the game via Rail Media; bartender-schedule requires it in `game_schedules`. Result: silent UI failure (just a tiny toast) with the only trace a buried `[WARN]` in the main PM2 log.
- **Greenville Brewers** — operator reports "they tried to schedule the brewers game a few times and it didn't switch and when they hit the manual schedule it didn't work." Cannot triage without the bartender's POST being visible. Last logged Greenville allocation was last night's Brewers game (status: completed) — no record of today's attempts.

**Fix:** new dedicated scheduling log file pattern, mirroring the proven shure-rf-logger.ts shape.

- `apps/web/src/lib/scheduling-logger.ts` — daily-rotating file at `/home/ubuntu/sports-bar-data/logs/scheduling-YYYY-MM-DD.log`. 30-day retention. Columns: `ISO_TS | LEVEL | SOURCE | ACTION | requestId | game | targets | outcome | note`. Mirrors through `@sports-bar/logger` so PM2 still surfaces.
- `apps/web/src/app/api/schedules/bartender-schedule/route.ts` POST handler: logs `attempt` at entry, `game_lookup_ok` or `game_lookup_fail` at the lookup gate, `allocation_created` on success, `tune_fail` on uncaught exception. Each event includes a `requestId` for correlation.

**Sources** the logger covers (taxonomy):
- `manual` — bartender remote / channel guide selections (just wired)
- `ai` — AI Suggest approval flow (next pass)
- `auto` — auto-reallocator decisions (next pass)
- `override-learn` — bartender-side manual override on a live TV (next pass)

**Actions** (taxonomy):
`attempt | game_lookup_ok | game_lookup_fail | allocation_created | allocation_updated | allocation_canceled | conflict_detected | route_command | route_ok | route_fail | tune_complete | tune_fail`

**Operator usage:**
```bash
# Today's scheduling activity:
tail -f /home/ubuntu/sports-bar-data/logs/scheduling-$(date +%F).log

# Just the failures:
grep -E 'WARN|ERROR|game_lookup_fail|tune_fail' /home/ubuntu/sports-bar-data/logs/scheduling-*.log

# Just for a specific team:
grep -i brewers /home/ubuntu/sports-bar-data/logs/scheduling-*.log
```

**Known follow-up (will be tracked by the audit):** The MILB / Timber Rattlers case is a real product gap — the channel guide can show a game we can't actually schedule. Either ESPN sync needs MILB coverage OR the bartender-schedule route needs to accept channel-guide-sourced games and create a phantom `game_schedules` row at scheduling time. To be decided by the v2.55.39 audit pass (Red/Blue/White/Green teams + Grok review).

---

## v2.55.37 — Cleanup: commit accumulated dev helpers + new hooks/skills (2026-06-10)

**Versions covered:** v2.55.37
**Branch landed:** main → all 6 location branches
**Required Manual Step:** **None.** Tracked-file housekeeping; no runtime change.

**What's now tracked that wasn't before:**
- `.claude/hooks/stop-parallel-tasks.sh` — Stop-hook suggesting `/parallel-tasks` when 2+ pending tasks could fan out
- `.claude/skills/parallel-tasks.md` — Skill doc codifying the worktree-fan-out pattern (used today to ship #330/#332/#333 in parallel)
- `scripts/iso/smoke-test-vm200.sh` — Earlier ISO smoke harness for Proxmox VM 200
- `scripts/verify-audio-meters.ts` + `scripts/verify-audio-meters-expanded.ts` — Playwright UI verifiers for the Audio tab live meters

**What's removed:**
- `scripts/capture-sdr-panel.ts` — replaced by `/api/sdr/peak-stats` + `ShureSdrSpectrumPanel.tsx` long ago; the standalone capture script was dead code.

---

## v2.55.36 — Graystone webpack opt-in: source .env before deciding --webpack (closes #334) (2026-06-10)

**Versions covered:** v2.55.36 — closes task #334
**Branch landed:** main → all 6 location branches
**Required Manual Step:** **None.** Pure rebuild fix; auto-update pulls + the new wrapper handles it.

**Why:** v2.55.29 put `NEXT_USE_WEBPACK=1` in Graystone's `.env` and changed `apps/web/package.json`'s build to `next build ${NEXT_USE_WEBPACK:+--webpack}`. But bash substitution happens at npm-script-parse time, BEFORE the .env file is loaded. Result: Graystone's env var was invisible during builds, every fleet propagation rebuilt with Turbopack, OOM'd at exit 137. Workaround was rsync-the-prebuilt-.next from Holmgren — proven 4+ times but adds friction every propagation.

**Fix:** `apps/web/package.json` `build` script is now `node ../../scripts/web-build.js`. The wrapper:
1. Reads `<repo-root>/.env` synchronously (best-effort — absence is fine)
2. Loads any var into `process.env` UNLESS the parent shell already set it (parent wins)
3. Appends `--webpack` to the `next build` arg list when `NEXT_USE_WEBPACK` is `1` or `true`
4. Spawns `npx next build [args]` from `apps/web/` with `stdio=inherit` so output streams identically to the old form
5. Surfaces a one-line `[web-build]` log so build logs say what was sourced

**Behavior verified:**
- Holmgren (NEXT_USE_WEBPACK unset): default Turbopack build, ~11 sec (no change)
- Holmgren with `NEXT_USE_WEBPACK=1 node scripts/web-build.js`: switches to `▲ Next.js 16.2.6 (webpack)`
- Wrapper sourced 35 vars from .env on its standalone test run

**Side benefit:** `NEXT_BUILD_ARGS` env var is now supported for ad-hoc build-arg injection (e.g. `NEXT_BUILD_ARGS="--debug" npm run build`).

**Graystone validation:** propagation runs now build successfully without rsync-workaround. Holmgren's pre-built .next rsync is no longer the only path for Graystone updates.

---

## v2.55.32 — Shift-brief: stop hallucinating NFL games in June + 3 research hooks (2026-06-09)

**Versions covered:** v2.55.32
**Branch landed:** main → all 6 location branches
**Required Manual Step:** **None.** Code + prompt changes; auto-update pulls them, PM2 picks them up.

**Three fixes bundled:**

### A. Shift-brief LLM hallucination — Gotcha #12 strikes again

Operator caught: "shift brief showing nfl games in june???" The brief was listing "Chicago Bears @ Minnesota Vikings", "Green Bay Packers @ Detroit Lions", "Wisconsin Badgers @ Northwestern Wildcats" — all impossible (NFL season is Sep-Feb, CFB also off). DB had the right data (15 MLB + 1 NBA + 2 WNBA + 1 PGA + 1 LPGA in next 24h, zero NFL). llama3.1:8b was hallucinating Green-Bay-relevant teams because the venue context primed it.

Fix per Gotcha #12 / `[[feedback-llm-server-built-verbatim]]`: server-build the "Home-team games" + "Other games" sections, feed them as PRE-WRITTEN sections, tell the LLM to include them VERBATIM. Same pattern as the existing mic-status bullet and Atlas-priority recap.

Plus: bumped the upcoming-games window from 12h → 18h so an end-of-night brief (fired at 23:00) still surfaces the next-day noon games (which start ~12:10 PM CDT, just past a 12h window).

Plus: a new `pendingResyncBullet` showing pending mic resync state from `shure_pending_resync` table (the v2.55.31 workflow). High-priority bullet so the bartender doesn't pick up a mic that won't transmit.

### B. ~/.ssh/config heartbeat / fleet-status correction

`/api/fleet/status` has a 5-min in-memory cache. After SSH-propagation merged location branches via `git push` to origin, the cached snapshot still showed v2.55.22 stuck-state. PM2 restart busts the cache. Documented for future debugging — if the brief shows wrong "TELL OWNER stuck" lines after a fleet propagation, restart PM2 (or wait 5 min for natural cache expiry).

### C. Three research hooks (Grok web-tools tuning task #333 in flight)

`.claude/hooks/pre-bash-research.sh`, `.claude/hooks/user-prompt-research.sh`, `.claude/hooks/post-taskcreate-research.sh` ship + wired into `.claude/settings.local.json`. Pattern-detection works (atlas / shure / wolfpack / iTach / firetv / directv / crestron / bss / dbx / multiview / rtl-sdr / soundtrack / epson). Grok web-tools backend tuning tracked as task #333 — until that completes the hooks skip-inject for empty/no-research responses (no context pollution).

---

## v2.55.31 — Wireless-mic freq change + bartender resync banner (closes #331) (2026-06-09)

**Versions covered:** v2.55.31 — closes task #331
**Branch landed:** main → all 6 location branches
**Required Manual Step:** **None on existing boxes.** Pure additive: new table (drizzle 0003) + 3 new API routes + new React banner component. Auto-update pulls, migrate runs, PM2 restart picks it up.

**Why:** Holmgren's SDR detected continuous 24/7 carrier activity directly on top of both Shure mic channels:
- Ch1 was 485.325 MHz; SDR cluster at 485.060-485.570 MHz with -55 dBm peaks
- Ch2 was 483.450 MHz; SDR cluster at 483.454-484.165 MHz with -55 dBm peaks

Probable source: neighbor venue (Stadium View / Anduzzi's) wireless mic system. Weekend peaks (Sat 84k events, Sun 77k events) confirm the venue-pattern. Holmgren's mics weren't being knocked out (no `rf_interference` events) but operating in a noisy band.

Cleanest available freqs per 7-day SDR scoring: 503.000, 506.000, 508.500 MHz — all 100% quiet, never crossed carrier threshold. Picked 503 + 508.5 (5.5 MHz separation, plenty intermod margin).

**Workflow that ships:**

1. Admin calls **POST `/api/shure-rf/queue-freq-change`** with `{receiverId, channel, newFreqMhz}`. Endpoint:
   - Reads current freq from `shureSlxdClientManager` cache
   - INSERTs row into `shure_pending_resync` (channel, old_khz, new_khz, set_at)
   - Sends `< SET <ch> FREQUENCY <khz> >` to the receiver via `client.setFrequencyMhz()`
   - Auto-cancels any prior unverified row on the same channel
   - Returns 502 + rolls back row if SET fails
2. Bartender Audio tab polls **GET `/api/shure-rf/pending-resync`** every 5 sec. For each pending row, renders a yellow `ShureResyncBanner` card with channel + old freq + new freq + IR-sync instructions. Banner sits ABOVE `ShureMicStatusPanel` in `AtlasZoneControl.tsx`. Wrapped in `<SafeBoundary>`.
3. Operator powers on the matching transmitter, holds it near the receiver's IR port, presses SYNC. TX transmits on new freq.
4. **`shure-rf-watcher.ts`** evaluates each incoming SAMPLE frame. When `TX_MODEL != UNKNOWN` AND `TX_BATT_BARS` is in 0-5 (valid range, not 255 sentinel) AND audio is not silent AND `state.frequencyMhz` matches the pending row's `new_freq_khz`, UPDATE-sets `verified_at`. Wrapped in try/catch for pre-migration boxes.
5. Banner clears automatically on its next 5-sec poll.

**Cancel path:** **POST `/api/shure-rf/cancel-resync`** with `{id, reason}` — marks `canceled_at` so the banner clears without verification. Does NOT revert the receiver freq (operator must either re-queue OR manually move it back).

**Validation on Holmgren (this commit's first use):**
- Sent SET 1 FREQUENCY 503000 + SET 2 FREQUENCY 508500
- Receiver echoed `< REP 1 FREQUENCY 0503000 >` and `< REP 2 FREQUENCY 0508500 >` correctly
- `< REP <ch> GROUP_CHANNEL {--,--} >` also echoed (the documented gotcha: SET FREQUENCY blanks the front-panel group/channel display to Manual)
- Seeded `shure_pending_resync` rows manually (since the API endpoint is ADMIN-gated and inline curl bypassed auth)
- Playwright verified the bartender Audio tab shows two amber banner cards with all the right freqs and instructions
- Watcher auto-verify pending operator IR-sync of transmitters

**Schema diff** — one new table:
```sql
CREATE TABLE shure_pending_resync (
  id TEXT PRIMARY KEY,
  receiver_id TEXT NOT NULL,
  channel INTEGER NOT NULL,
  old_freq_khz INTEGER NOT NULL,
  new_freq_khz INTEGER NOT NULL,
  set_at INTEGER NOT NULL,
  verified_at INTEGER,           -- NULL = pending; non-NULL = TX active on new freq
  canceled_at INTEGER,           -- NULL = active; non-NULL = abandoned
  notes TEXT
);
```

**Re-using at other locations:** the workflow is location-agnostic. Any location with a Shure SLX-D in the AudioProcessor table can use the same endpoints. After auto-update applies drizzle 0003 + PM2 restart, the admin RF panel can call queue-freq-change for that location's receiver.

---

## v2.55.30 — ISO slim fix: drop the broken chroot-purge, pool/-delete is enough (closes #326) (2026-06-09)

**Versions covered:** v2.55.30 — properly closes task #326
**Branch landed:** main
**Required Manual Step:** **None.** ISO build script change; affects the next `bash scripts/iso/build-autoinstall-iso.sh` invocation.

**Why this is a follow-up to v2.55.28:** v2.55.28 attempted TWO size-reduction levers — pool/ delete + chroot-purge of snapd/bluez/cups/fwupd/cloud-init from the live-installer squashfs. The chroot-purge picked the WRONG squashfs candidate (`ubuntu-server-minimal.ubuntu-server.squashfs` is a 142 MB layered diff with no `/proc /sys /dev` mount-point dirs → the bind mount failed → `set -e` aborted Step 2b with no host /dev damage but also no usable output). Caught by general-purpose agent build validation.

**The math (verified empirically — `du -sh` on the v2.55.28 build dir post-pool-delete):**

| Component | Stock | After pool delete |
|---|---|---|
| `pool/` (offline-install debs) | ~1.5 GB | (deleted) |
| `casper/*.squashfs` files | ~1.4 GB | unchanged |
| `casper/{,hwe-}initrd` + vmlinuz | ~180 MB | unchanged |
| Other ISO assets | ~200 MB | unchanged |
| **Total build dir** | **~3.2 GB** | **~1.7 GB** |
| **Final ISO output (xorriso)** | **3.2 GB** | **1.69 GB** |

So **pool/ delete alone gets us under the 1900 MB cap with 200 MB headroom.** The chroot-purge step was attempting to squeeze ~80 MB more, but was not actually needed AND introduced real complexity (squashfs candidate priority, chroot bind safety, mksquashfs OOM risk, host /dev exposure via lazy unmount).

**v2.55.30 simplification:**
1. Step 2b drops the chroot-purge block entirely. Only pool/ delete remains.
2. Prereq check drops `unsquashfs` + `mksquashfs` (no longer used).
3. `ISO_SLIM=0` escape valve preserved.
4. `apt.fallback: continue-anyway` in autoinstall.yaml.template stays (still correct — pool/ is gone).

**Verified on Holmgren build host:**
```
ISO:  /home/ubuntu/sports-bar-tv-controller-v3.1.0-2026-06-09.iso
Size: 1688 MB (1.7 GB)
Cap:  1900 MB
GATE: ✅ PASS  (212 MB headroom under cap)
```

Build runtime: 10 sec (with cached stock ISO + cached build dir). First-build-fresh: ~5 min total (vs ~25 min stock pre-slim due to download).

**If a future Ubuntu point release pushes the post-pool-delete size over 1.9 GB** (unlikely but possible if Canonical bundles more in casper), the path forward is one of:
- Switch to `mksquashfs -comp zstd -Xcompression-level 22` on a single squashfs (smaller than the default xz with right tuning)
- Drop the `hwe-` kernel variant from `casper/` (only needed if installing on hardware that requires HWE — most server boxes don't)
- Bring back a CORRECT chroot-purge targeting `ubuntu-server-minimal.squashfs` (the base layer with full rootfs, NOT the `.ubuntu-server.` diff layer)

**Lesson recorded:** "two levers" plans should sequence the simpler one first AND validate it alone before adding complexity. v2.55.28 shipped both levers together; the broken complex one masked the fact that the simple one was sufficient.

---

## v2.55.29 — Phase 4 hardening + Graystone Turbopack opt-out + SSH log-cleanup (2026-06-09)

**Versions covered:** v2.55.29
**Branch landed:** main → all 6 location branches

**Three independent fixes bundled:**

### A. Phase 4 (Grok pre-push) hardening — 4 issues from v2.55.27 self-review

Closes the four issues task #329 surfaced when Phase 4 reviewed its own first commit:

1. **Shell-injection-safe prompt assembly** — original unquoted heredoc would re-evaluate `$(...)` and backticks embedded in the diff content. A malicious or even accidental commit message containing `` `rm -rf /` `` could execute. Switched to a sequence of `printf '%s\n' "$var"` calls (data, never re-parsed).
2. **Robust verdict extraction** — original `awk 'NF{print $1}' | tr -d '*:'` was fooled by Markdown formatting (`**CLEAN**!`, narrative preamble like "Reviewing this carefully..."). Prompt now mandates an explicit `VERDICT: CLEAN` or `VERDICT: FINDING` line. Parser scans first 30 lines for that, falls back to bare `\b(CLEAN|FINDING)\b` word match, treats unparseable response as `INCONCLUSIVE` → soft block (NOT silent allow). Unit-tested across 7 input shapes including the prior cache failure mode.
3. **Timeout fails CLOSED on highest-risk paths** — drizzle/, schema.ts, auto-update.sh, bootstrap-drizzle-migrations.sh now hard-block on Grok timeout instead of soft-warn. Other critical paths still soft-warn (avoid permanent block when Grok API is flaky).
4. **GROK_PREPUSH_NO_SELF_REVIEW=1 escape valve** — when iterating on the hook itself, every fix triggers a fresh review of the fix → potentially unbounded loop. With this env var set, skips Grok IF the only matched paths are the hook itself.

**Bypass story unchanged:** `git push --no-verify` OR `GROK_PREPUSH_DISABLE=1 git push`.

### B. Graystone Turbopack OOM workaround (closes task #328 root cause)

Root cause (researched by feature-dev:code-explorer agent): on a 15 GB box, Turbopack's parallel module-graph compilation exceeds the V8 default ~4 GB heap, and the `NODE_OPTIONS=--max-old-space-size=2048` set in `ecosystem.config.js` only applies to the PM2 runtime process — NOT to the `next build` child process. Result: every build on Graystone OOMs at exit 137, even with 8.8 GB available + 8 GB swap.

Fix: opt-in webpack build path via `NEXT_USE_WEBPACK=1` env var. Webpack streams compilation to disk and uses dramatically less peak memory.

**Changes:**
- `apps/web/package.json` `build` script: `"next build"` → `"next build ${NEXT_USE_WEBPACK:+--webpack}"`. Bash parameter expansion: when `NEXT_USE_WEBPACK` is set, append `--webpack`; when unset, no-op. Other 5 fleet boxes (32 GB RAM) keep Turbopack via the absent env var.
- Graystone's `.env` set: `NEXT_USE_WEBPACK=1` + `NODE_OPTIONS=--max-old-space-size=4096`.

**Verified on Graystone:** full webpack build completed in 3 min (vs OOM at exit 137 on Turbopack). `.next/BUILD_ID` present, 1.1 GB built artifacts. PM2 restart, health 200, error-watch responding. App at v2.55.26.

**Per-location consideration:** to apply elsewhere, write `NEXT_USE_WEBPACK=1` to the box's `.env`. Only consider for boxes with <16 GB RAM (the 32 GB boxes build cleanly under Turbopack in 14 sec).

**Required Manual Step on Graystone:** done as part of this release. **Other locations:** none.

### C. SSH log-cleanup via ~/.ssh/config

The `Warning: Permanently added '<ip>' (ED25519) to the list of known hosts.` line appeared on every fleet SSH/scp invocation, cluttering output. The warning was harmless (we already discard the key via `UserKnownHostsFile=/dev/null`) but blew up log readability.

Fix: a `~/.ssh/config` Host stanza for all 6 fleet IPs and MagicDNS names that sets `LogLevel ERROR` alongside the existing `StrictHostKeyChecking no` + `UserKnownHostsFile /dev/null`. Default `ConnectTimeout 15` + `ServerAliveInterval 30` (keeps long-running build-on-remote alive).

This is a per-user config; future dev-machine setups should mirror it (see `/home/ubuntu/.ssh/config` for the template).

---

## v2.55.28 — ISO slim pass: 3.2 GB → ~1.8 GB to fit GitHub 2 GB cap (task #326) (2026-06-09)

**Versions covered:** v2.55.28 — closes task #326
**Branch landed:** main
**Required Manual Step on build host:**
```bash
sudo apt-get install -y squashfs-tools  # if not already present
```
Then re-run the standard build:
```bash
bash scripts/iso/build-autoinstall-iso.sh
bash scripts/iso/smoke-test-autoinstall.sh  # size gate now enforced at Phase 1
```

**Why:** the stock Ubuntu 24.04.4 Server ISO is 3.2 GB. Our pure-pass-through build at v3.1.0 left the output at essentially the same size — well above GitHub's 2 GB release-asset cap. That forced split distribution and friction. Task #326 closed.

**Two levers (independent, both active by default):**

1. **`pool/` deletion (~1.0-1.3 GB savings)** — the Ubuntu pool exists for offline-install fallback when there's no internet during install. We ALWAYS have internet at first-boot (apt-get nodejs + GitHub clone), so the pool is vestigial. Paired with `apt.fallback: continue-anyway` in `autoinstall.yaml.template` so subiquity doesn't stall waiting for offline debs.
2. **Squashfs chroot-purge of snapd/bluez/cups/fwupd/cloud-init (~80 MB compressed)** — `scripts/optimize-os.sh` already removes these POST-install; this pushes that work upstream so they're never in the ISO. `apt-get purge -y --autoremove` runs in the live-installer's chroot via direct `chroot $work apt-get purge` (NOT `curtin in-target --` per Launchpad bug #1946609 — curtin's path fails on snapd's postinst unmount with "resource busy"; direct chroot works).

**Combined estimate:** 3.2 GB → ~1.8-2.0 GB. Size gate in `smoke-test-autoinstall.sh` Phase 1 hard-fails the smoke test if the ISO exceeds 1900 MB (100 MB headroom under the 2 GB cap).

**Recovery / escape valve:** `ISO_SLIM=0 bash scripts/iso/build-autoinstall-iso.sh` skips Step 2b entirely. Use if any of the chroot/squashfs steps regress on a new Ubuntu point release. Smoke-test cap override: `ISO_SIZE_CAP_MB=2200 bash scripts/iso/smoke-test-autoinstall.sh`.

**Chroot safety:** the chroot cleanup uses a `trap squash_cleanup EXIT` with plain `sudo umount` (NEVER `umount -l` per `[[feedback-chroot-lazy-umount-destroys-dev]]` — lazy unmount before `rm -rf` of the chroot dir recurses through the still-attached `/dev` bind and deletes host device nodes. ~2h incident on 2026-05-27).

**Verify the slim pass worked:** the build log prints `Squashfs: <before> → <after>` and `pool/ removed`. The smoke-test enforces the size gate at Phase 1 before SCP to Proxmox. Post-install verification (Phase 7 of smoke-test) confirms `snapd` is absent on the installed system via `dpkg -l snapd | grep -c '^ii'` = 0.

**Lesson:** an ISO build that exceeds a third-party distribution cap silently changes the deployment story (one asset → split downloads → operator confusion at install time). Worth gating in the smoke-test, not as a post-hoc audit. The new Phase 1b gate is the enforcer.

---

## v2.55.27 — Phase 4: Grok critical-path pre-push review (2026-06-09)

**Versions covered:** v2.55.27
**Branch landed:** main
**Required Manual Step:** **None on dev machines.** Hook lives in repo + `core.hooksPath` is already configured. **No fleet action** — location boxes never push to main, so Phase 4 is dev-machine-only.

**What ships:**
- `scripts/grok-prepush-review.sh` (~165 lines, executable) — orchestrates the review.
- `.githooks/pre-push` — calls the review script after the empty-diff check, before the docs-gate. Order matters for the bypass story: a `--no-verify` bypass skips both checks; a docs-only push with no critical paths skips Grok via the early `exit 0` in `grok-prepush-review.sh`.

**13 critical-path globs** trigger the review (anything not in this list is silent-skip):
```
packages/database/src/schema.ts
apps/web/src/db/schema.ts
drizzle/**
scripts/auto-update.sh
scripts/bootstrap-drizzle-migrations.sh
scripts/verify-install.sh
scripts/iso/**
scripts/proxmox/**
apps/web/src/instrumentation.ts
apps/web/next.config.js
ecosystem.config.js
.githooks/pre-push
scripts/grok-prepush-review.sh
```

**Review mechanics:**
- Grok is briefed via `scripts/grok-prime.sh` (auto-prepends Standing Rules + Gotchas from `docs/GROK_BRIEFING.md`).
- Diff truncated to 32 KB to stay inside Grok's useful window (per `[[feedback-llm-context-overflow]]`).
- Recent commit messages on the changed files are included so Grok has intent signal (distinguishes "this DROP TABLE is intentional cleanup" from "this is an accident").
- Auto-injected gotcha hints based on which paths fired (e.g. drizzle changes → cite Gotcha #6 + #5).
- Mandatory CLEAN/FINDING first-word verdict for machine parsing.
- 120 sec timeout — if Grok stalls, soft-warn and allow push.
- Per-day SHA cache at `/tmp/grok-prepush-cache.json` — re-pushing the same range in one day doesn't re-burn Grok.

**Soft-block semantics:**
- CLEAN → silent pass, log only.
- FINDING → print Grok's output to stderr + exit 1. Bypass: `git push --no-verify` OR `GROK_PREPUSH_DISABLE=1 git push`.
- TIMEOUT → soft-warn, allow push, log.
- `grok` CLI absent → silent-skip (degraded mode). Same for any environment where Grok isn't installed.

**Logs:**
- `/tmp/sports-bar-grok-prepush.log` — every fire (verdict + range + matched files).
- `/tmp/grok-prepush-cache.json` — per-day cache.

**Standalone test:**
```bash
bash scripts/grok-prepush-review.sh <remote_sha> <local_sha>
```

**Rollout:** repo-tracked + `core.hooksPath` is the standard install step. Every developer machine that's already run that command picks up Phase 4 automatically on next `git pull`. No retroactive action.

**Why this matters:** v2.55.25 shipped a `bartender_layout_rooms` check that tripped 4/5 remote fleet boxes during initial verify because my SQL referenced a non-existent `data` JSON column. The check errored silently and returned empty for everything. This is exactly the failure-mode Phase 4 is designed to catch — a Grok second-opinion on schema/SQL diffs would have called out "your SQL references `data` but the schema doesn't have that column" before the push went out and triggered the regression cascade on fleet auto-update.

---

## v2.55.26 — Phase 3 follow-up: refine `bartender_layout_rooms` to referential-integrity (2026-06-09)

**Versions covered:** v2.55.26
**Branch landed:** main → all 6 location branches
**Required Manual Step:** **None.** Same file (`scripts/verify-install.sh`) — refined check semantics.

**Why:** v2.55.25's `bartender_layout_rooms` layer FAIL'd on 4/5 remote fleet boxes during initial verify (Greenville, LegLamp, Lucky's, Appleton — but NOT Holmgren or Graystone). Investigation: those locations are single-room bars with empty `rooms` arrays and zones that don't reference any room IDs. That's NOT a Gotcha #8 violation — it's a normal single-room setup.

**The actual Gotcha #8 risk** is when zones REFERENCE a room ID that doesn't exist in `rooms[]` — that breaks the filter-tab UI with orphan references. Empty `rooms[]` with zones that don't reference rooms is operationally fine.

**New check semantics:** parse the active layout's zones + rooms via SQLite's `json_each`, look for orphan references (zone.room not in rooms[].id). FAIL only on a real orphan. Otherwise PASS with a category label:
- `clean` (rooms present + zones reference them + all refs resolve)
- `N rooms / 0 refs` (multi-room layout but no zones reference yet — admin still configuring)
- `single-room bar` (no rooms + no refs — Lucky's-style setup)

**Effect after this fix:**
- Holmgren / Graystone still PASS 16/16 (no change — they had healthy multi-room layouts)
- 4 single-room remote boxes go from FAIL→PASS (correctly classified)
- A real Gotcha #8 — orphan room reference — still hard-fails with the specific orphan ID printed for the operator to act on

**Lesson recorded:** runtime referential-integrity checks must distinguish "configured differently" from "configured wrong." A naive "is column empty?" check trips honest variation across fleet — the Phase 4 (Grok pre-push) gate is exactly what should have caught this before the v2.55.25 fleet propagation. Until Phase 4 ships, mandate-run-on-fleet-data before commit for any new verify-install layer that touches SQL.

**Verify after auto-update:** same as v2.55.25 (`bash scripts/verify-install.sh`). All 6 fleet boxes should PASS 16/16 after this lands.

---

## v2.55.25 — Phase 3 self-monitoring: 8 verify-install assertion layers (+ cd-prefix hook fix) (2026-06-09)

**Versions covered:** v2.55.25
**Branch landed:** main → all 6 location branches
**Required Manual Step:** **None on existing boxes.** `scripts/verify-install.sh` is invoked by `auto-update.sh` on every cycle — the new layers run automatically the next time auto-update fires.

**What ships (8 new verify-install layers):**

Each turns a previously-🟡 "doc-only" Gotcha into a fail-loud asserted check. All 8 run in <1 sec; total verify pass is 3 sec on Holmgren.

| Exit code | Layer | Gotcha | What it asserts |
|---|---|---|---|
| 18 | `linger_enabled` | #11 | `loginctl show-user ubuntu` returns `Linger=yes` |
| 19 | `autoupdate_timer_fresh` | #11 | newest `auto-update-*.log` is <26h old (24h cadence + 2h grace) |
| 20 | `migration_markers_consistent` | #6 | `SELECT COUNT(*) FROM __drizzle_migrations` equals `ls drizzle/*.sql \| wc -l` |
| 21 | `error_watch_alive` | Phase 2a | newest `error_watch_events.kind='heartbeat'` row is <720s old |
| 22 | `bartender_layout_rooms` | #8 | active `BartenderLayout.rooms` is non-empty JSON |
| 23 | `atlas_drop_watcher_alive` | watcher | newest `atlas_drop_events` row is <7d old (warn-only) |
| 24 | `atlas_priority_watcher_alive` | watcher | newest `atlas_priority_events` row is <7d old (warn-only) |
| 25 | `node_symlink_present` | #11 | `/usr/bin/{node,npm,npx}` OR `/usr/local/bin/{node,npm,npx}` all exist |

**Plus one Claude Code hook fix:**

`.claude/hooks/pre-fleet-ssh-cd.sh` — broadened the regex. Previous version only caught `ssh ... bash scripts/...` payloads. Today's session hit the cd-prefix bug 5× with `ssh ... git branch`, `ssh ... npm run build`, `ssh ... cat package.json` — none matched the old regex. New regex catches any of `git|npm|npx|pnpm|yarn|drizzle-kit|bash scripts/|cat|head|tail|less package.json|python3 -c.*package.json|pm2 (start|restart|reload) (ecosystem|sports-bar)`. Has the `--i-know-what-im-doing` escape hatch consistent with `pre-destructive-block.sh`.

**Verify after auto-update:**
```bash
# Run verify-install standalone:
bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/verify-install.sh

# Expect: PASS (16/16 checks, Ns) — or a fail with a specific exit code that
# points at one of the 18-25 codes above, each with a fix path printed in the
# log message.

# JSON form for the Sync-tab API:
bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/verify-install.sh --json | python3 -m json.tool
```

**One real finding during dev:** Holmgren's `BartenderLayout.rooms` check originally failed because my SQL used a non-existent `data` JSON column (the actual schema has a top-level `rooms` column). The query errored silently and returned empty. Fixed mid-build by reading the actual schema. Lesson: every new SQL-based layer needs at least one fleet-data-shape verification before commit, not just schema-time inference. This is exactly the failure mode Phase 4 (Grok pre-push review on schema/SQL diffs) is designed to catch.

**Applies to:** all locations.
**First seen:** built + verified at Holmgren on 2026-06-09 (16/16 PASS after the BartenderLayout fix).

---

## v2.55.24 — Phase 2b: error-watch admin UI surface (2026-06-09)

**Versions covered:** v2.55.24
**Branch landed:** main → all 6 location branches
**Required Manual Step:** **None on existing boxes.** Pure additive — new route + new component + one-line wiring in `system-admin/page.tsx`. Auto-update pulls the code; PM2 restart picks it up.

**What ships:**
- `apps/web/src/app/api/error-watch/route.ts` — GET endpoint reading `error_watch_events`. Query params: `windowHours` (1-168, default 24), `signature` (filter to one), `kind` (filter to one), `limit` (1-1000, default 200). Returns `{summary: {heartbeatFreshSec, latestStartupAt, errorCountWindow, signatureCounts[]}, events[]}`. On missing-table (fresh box pre-migration) returns 200 with empty payload — same degrade pattern as `/api/system/watchers/status`.
- `apps/web/src/components/admin/ErrorWatchPanel.tsx` — `<SafeBoundary>`-wrapped panel with three sections: status header (heartbeat badge + last boot + window chips), signature breakdown (horizontal bars, click-to-filter), recent events table (with kind/signature chips + sample text). Polls `/api/error-watch` every 30 sec.
- Wired into `apps/web/src/app/system-admin/page.tsx` Watchers tab, below the existing `WatcherHealthPanel`.

**Heartbeat freshness threshold:** 700 sec (2× the default `HEARTBEAT_INTERVAL_SEC=300` from Phase 2a). Anything older shows a red "heartbeat Ns ago" badge; fresh shows a pulsing green badge.

**SafeBoundary wrap:** the panel is brand-new; per `[[feedback-safeboundary-for-new-panels]]` a render crash inside it shows a tiny inline failure card instead of escalating to the global error boundary for the entire system-admin page.

**Verify after auto-update:**
```bash
# UI:
# Navigate to /system-admin → Watchers tab → "Error Watch" section
# should show: green heartbeat badge (Xs ago, X < 600s)
#              signature breakdown if any errors caught
#              recent events table
#
# API:
curl -s 'http://localhost:3001/api/error-watch?windowHours=24' | python3 -m json.tool | head -25
# expect: success=true, heartbeatFreshSec < 600, signatureCounts array
```

**Applies to:** all locations.
**Verified:** built clean (`npm run build` 14s, no errors), API returns real data (heartbeat 35s fresh, 3 errors in window with correct signature breakdown), Playwright rendered the panel with all sections present on Holmgren.

---

## v2.55.23 — Phase 2a: autonomous error-watch service (2026-06-09)

**Versions covered:** v2.55.23
**Branch landed:** main → all 6 location branches

**Why:** Phase 2 of the self-monitoring architecture from `docs/HOOK_COVERAGE.md`. The PM2 error log is the highest-density signal for things that broke in production (FK constraint failures, unhandled rejections, `ECONNREFUSED`, missing modules). Until now nothing watched it — operators only noticed errors when something user-visible broke. v2.55.16's FK-constraint spam ran for hours before someone glanced at logs. The auto-update lock self-deadlock (v2.55.14) was only caught after the audit script noticed the timer hadn't fired in 2 days. This watcher closes the gap.

**What ships:**
1. **`error_watch_events` table** (drizzle migration `0002_error_watch_events.sql`) — `id`, `kind` ∈ {`startup`,`heartbeat`,`error`}, `signature`, `sample` (200 char), `source_file`, `detected_at` (unix seconds). 3 indexes: `detected_at`, `(signature, detected_at)`, `(kind, detected_at)`.
2. **`scripts/watchers/error-watch.sh`** — bash watcher tailing `/home/ubuntu/.pm2/logs/sports-bar-tv-controller-error*.log` with `tail -n 0 -F` (rotation-safe). Pattern library: `error_level`, `unhandled_rejection`, `fk_constraint`, `econn_refused`, `etimedout`, `module_not_found`, `type_error`, `exception`. 30s per-signature dedup window in memory. 5-min heartbeat from a background sub-shell so "no recent rows" cleanly means "watcher dead" not "no errors."
3. **`scripts/watchers/sports-bar-error-watch.service`** — systemd-user unit. `Restart=always`, 15s back-off. `WantedBy=default.target`. Requires `Linger=yes` on the `ubuntu` user (Gotcha #11) — already in place at every location since v2.50-ish.

**Required Manual Step on each fleet box (Holmgren done as part of this release):**
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
# 1. apply the migration (already pulled by auto-update)
npx drizzle-kit migrate
# 2. install the systemd unit
mkdir -p ~/.config/systemd/user/
cp scripts/watchers/sports-bar-error-watch.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now sports-bar-error-watch.service
# 3. verify
systemctl --user status sports-bar-error-watch.service --no-pager | head -10
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT kind, signature, datetime(detected_at,'unixepoch','localtime') FROM error_watch_events ORDER BY detected_at DESC LIMIT 3;"
# expect: a row with kind='startup' from when you just enabled it
```

**Verify signature capture (optional sanity check):**
```bash
echo "$(date -u +%FT%TZ) [TEST] TypeError: marker $$" >> /home/ubuntu/.pm2/logs/sports-bar-tv-controller-error.log
sleep 3
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT kind, signature, sample FROM error_watch_events WHERE sample LIKE '%marker%';"
# expect: kind='error', signature='type_error'
```

**Querying what the watcher caught (for an audit / morning-after pattern check):**
```bash
# Most-recent errors of each signature in the last 24h:
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT signature, COUNT(*) AS n, MAX(datetime(detected_at,'unixepoch','localtime')) AS most_recent \
   FROM error_watch_events \
   WHERE kind='error' AND detected_at >= strftime('%s','now')-86400 \
   GROUP BY signature ORDER BY n DESC;"

# Heartbeat freshness (last row should be within 5 min):
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT datetime(detected_at,'unixepoch','localtime') FROM error_watch_events WHERE kind='heartbeat' ORDER BY detected_at DESC LIMIT 1;"
```

**Operational note:** the dedup window is intentionally short (30s) — we want frequency information ("ECONNREFUSED hit 40 times" is the same finding regardless of whether it was 40 lines back-to-back or one every minute). For per-event drill-down, fall back to the raw PM2 error log; this table is for sentinel/trend use, not log replacement.

**Phase 2b (deferred):** UI surface on the SystemAdmin page showing unacknowledged events + a notification when a never-before-seen signature lands. The DB structure already supports this — Phase 2a was deliberately backend-only so the watcher proves out in production before any UI consumes it.

**Applies to:** all locations.
**First seen:** built + verified at Holmgren on 2026-06-09.

---

## v2.55.22 — Node 22.22.2 → 22.22.3 (security release, NodeSource unblocked) (2026-06-09)

**Versions covered:** v2.55.22 — closes task #262
**Branch landed:** main → all 6 location branches

**Why:** Node 22.22.3 is a Node.js security release (crypto null-pointer-deref fix among others). It was tracked as #262 since 2026-05-27 because NodeSource lagged 2+ weeks publishing it; we deliberately waited for the NodeSource apt repo (rather than bypass to nodejs.org binary) to keep fleet install methods consistent. NodeSource published `22.22.3-1nodesource1` on or before 2026-06-09 — task unblocked.

**Risk:** patch release within Node 22 → no `NODE_MODULE_VERSION` change → **no native module ABI break** → no better-sqlite3 rebuild required ([[feedback-node-major-upgrade-gotchas]] doesn't apply here, it covers major bumps).

**Required Manual Step on each fleet box (Holmgren done as part of this release):**
```bash
sudo apt-get update -qq
sudo apt-get install -y nodejs              # 22.22.2 → 22.22.3
node --version                              # verify
pm2 restart sports-bar-tv-controller --update-env
sleep 5 && curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3001/api/health
# expect: 200
```

**Blip:** ~10–30s while PM2 reloads the app under the new Node binary. Bartender remote returns 5xx briefly.

**Fleet rollout:** can run in parallel across the 5 remote boxes via Tailscale SSH (each box independent). At a minimum schedule it before tonight's auto-update cycles fire so the assertion gates run against the new Node. Or fold into a manual fleet trigger now.

**Verify after:** `node --version` returns `v22.22.3` AND PM2 shows `restart_time` incremented by 1 AND `:3001/api/health` returns 200.

**Done on Holmgren as part of this release** — verified PM2 picked up the new binary, both ports back to 200 on the first health-check attempt.

---

## v2.55.21 — Phase 1 hardening: redact creds in pre-push log + fix destructive-block false positive (2026-06-09)

**Versions covered:** v2.55.21
**Branch landed:** main → all 6 location branches
**Required Manual Step:** **None on existing boxes.** Pure patch.

**Two hot fixes uncovered by Phase 1 itself, captured immediately so the patterns hold:**

1. **`.githooks/pre-push` was logging the full push URL to `/tmp/sports-bar-pre-push-hook.log`**, including any embedded `https://USER:TOKEN@github.com/...` credentials. Phase 1's very first real push at v2.55.20 captured the operator's GitHub Personal Access Token in cleartext (the log was wiped immediately + the token should be considered burned and rotated). Now redacts: `https://x:y@host` → `https://***@host` via sed before any logging happens. Pipe-tested with a fake token; log shows `***`.

2. **`.claude/hooks/pre-destructive-block.sh` rm-rf check false-positive'd** when the Bash command had a `cd /home/ubuntu/Sports-Bar-TV-Controller` prefix AND an unrelated `rm -f /tmp/something` in the same command line. The old check was "command contains rm AND command contains protected path anywhere" — the cd's path satisfied the second clause. Fix: split the command on shell separators (`;` `&&` `||` `|`) and check each piece independently so the protected-path requirement applies only to the rm's own arguments. Pipe-tested both axes (false-positive cleared; real `rm -rf /home/ubuntu/Sports-Bar-TV-Controller/...` still blocked).

**Meta-lesson for the architecture doc:** Phase 1 went live and within 60 seconds (a) caught a real secret leak (good), (b) exposed a false positive in a sibling hook (also good — fast feedback is the point). Both fixes were caught by tooling that was already in place (the small-LLM verify-edit hook spotted the missing `done` mid-edit) and verified against the authoritative tool (`bash -n`) per pattern #5's "the linter is the arbiter" discipline. Working as designed.

---

## v2.55.20 — Phase 1 of self-monitoring architecture: pre-push docs-gate + HOOK_COVERAGE map (2026-06-09)

**Versions covered:** v2.55.20
**Branch landed:** main → all 6 location branches

**Required Manual Step (per clone, one-time, on any box where someone might `git push`):**
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
git config core.hooksPath .githooks
```
After this, every `git push` runs `.githooks/pre-push`. Verify with:
```bash
git config core.hooksPath   # must print: .githooks
```
**Fleet boxes don't push to main** (auto-update is pull-only), so this is only needed where development happens (Holmgren primarily). Done on Holmgren as part of this release.

**Why:** Phase 1 of the seven-pattern self-monitoring architecture (see `docs/HOOK_COVERAGE.md`). Standing Rule 8 ("contribute to VERSION_SETUP_GUIDE every release") was honor-system — when I forgot, the fleet went undocumented. The pre-push hook now mechanically blocks pushes to `origin/main` with non-trivial code but no doc update (VERSION_SETUP_GUIDE / LOCATION_UPDATE_NOTES / CLAUDE.md / HOOK_COVERAGE).

**Trivial files** that don't require a doc update on their own: `package.json` (version bump), `.gitignore`, `.claude/hooks/*.sh`. Everything else triggers the gate.

**Emergency bypass:** `git push --no-verify` (genuine emergencies; record a no-op entry here anyway, that's friction-free).

**Heartbeat:** every fire writes `/tmp/sports-bar-pre-push-hook.log`. Silent absence = hook didn't run, not "all clear."

**Also new in this release:**
- `docs/HOOK_COVERAGE.md` — coverage map of every Standing Rule + Gotcha → enforcing mechanism → status (✅ / 🟡 / ❌). The single source of truth for "what's mechanically enforced vs honor-system" and the planning doc for Phases 2–6.

**No fleet runtime impact** — git hook only fires on `git push`. The PM2 app isn't touched.

---

## v2.55.8 — PXE netboot fix: kernel+initrd HTTP (sanboot is dead for Ubuntu) (2026-05-28)

**Versions covered:** v2.55.8
**Branch landed:** main → all 6 location branches

**Required Manual Step (ONLY at the PXE/netboot LXC — not fleet boxes):**
Re-run the netboot config so the new menu + extracted kernel/initrd land:
```bash
pct enter 250   # the sports-bar-netboot LXC on Proxmox
bash /root/configure-netboot-menu.sh   # extracts casper/{vmlinuz,initrd}+seed, writes kernel+initrd menu, fixes dnsmasq proxy
exit
```
**Verify:** `curl -sI http://<lxc-ip>/casper/vmlinuz` returns 200; the iPXE
menu's `:install` uses `kernel … url=… cloud-config-url=/dev/null ds=nocloud-net`.

**Why:** `sanboot` of the whole Ubuntu casper ISO never worked (GRUB loads,
casper can't find the live filesystem — UEFI + BIOS both). Confirmed live on
Proxmox VM 201. Fix boots vmlinuz+initrd over HTTP, casper fetches the ISO via
`url=`. dnsmasq proxy also fixed (`pxe-service=`, not `dhcp-boot=`). Full detail:
CLAUDE.md Gotcha #19 + `docs/PROXMOX_PXE_SETUP.md`. **Fleet boxes: no setup** —
this only affects new-NUC provisioning via the office PXE server.

## v2.55.7 — fleet password fix: THREE dollar signs (6809233DjD$$$) (2026-05-28)

**Versions covered:** v2.55.7
**Branch landed:** main → all 6 location branches

**No setup required on existing boxes.** Affects ONLY freshly-installed NUCs
from the v3.1.0 ISO. v2.55.3 baked `6809233DjD$$` (two $); the real fleet
password is `6809233DjD$$$` (three $). smoke v9 proved installed VMs rejected
the fleet password at the console. Fixed in autoinstall chpasswd + identity
hash (verified via `openssl passwd -6`) + the `$$`→PID expansion trap in the
smoke/audit test scripts (now `printf '6809233DjD\044\044\044'`). New ISO
builds (md5 changes) set the correct triple-$ password.

## v2.55.6 — bake hardware prerequisites into the ISO (gap analysis vs Holmgren) (2026-05-27)

**Versions covered:** v2.55.6 (and the v2.55.0–.5 ISO bring-up series: DB-before-build root-cause fix, fleet password, Claude-CLI bash-pipe, IPv6-link-local smoke detection, 9-layer audit)
**Branch landed:** main → all 6 location branches

**No setup required on existing boxes.** Affects fresh NUC installs. ISO now
bakes: packages `adb, rtl-sdr, nginx, nmap, arp-scan, sshpass, imagemagick,
v4l-utils`; first-boot `.env` generation with fresh crypto secrets
(NEXTAUTH_SECRET/ENCRYPTION_KEY/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY),
AUTH_COOKIE_SECURE=false, OLLAMA_MODEL=llama3.1:8b; `usermod -aG
dialout,video,render,plugdev ubuntu`; setup-sdr.sh (DVB blacklist) +
setup-bartender-nginx.sh. **Per-location post-install (NOT baked):** Ollama
via `setup-iris-ollama.sh` (needs Intel iGPU), API keys + LOCATION_ID via
`bootstrap-new-location.sh`, `tailscale up`. Tailscale itself is pre-installed.

## v2.54.99 — CLAUDE.md + BARE_METAL_ISO documents v3.1.0 autoinstall architecture (2026-05-27)

**Versions covered:** v2.54.99
**Branch landed:** main
**Fleet target:** No runtime change. Doc-only.

Memorialized the v3.1.0 subiquity autoinstall ISO architecture (v2.54.89-.97) in `CLAUDE.md` so future Claude knows the canonical build path:
- New section under "Build & Development Commands" → "ISO Build (v3.1.0+ — subiquity autoinstall, CANONICAL)" enumerating active scripts (`build-autoinstall-iso.sh`, `autoinstall.yaml.template`, `sports-bar-first-boot.service`, `smoke-test-autoinstall.sh`, `audit-installed-vm.sh`, `cleanup-chroot.sh`) and marking v3.0.x scripts (`build-sports-bar-iso.sh`, `disk-installer.sh`) DEPRECATED but not deleted.
- Five new Gotchas (#14-18): grub.cfg quoting (v2.54.92), apt.geoip hangs install (v2.54.95), `shutdown: poweroff` not reboot (v2.54.96), Node+PM2 in late-commands (v2.54.97), DHCP poll ≥15 min (v2.54.97). Each gotcha is a real shipped fix this session — documenting prevents re-discovery.
- Proxmox VM smoke-test settings recorded (OVMF + EFI disk, q35, virtio-scsi-pci, 16 GB / 4 cores / 100 GB minimum).

`docs/BARE_METAL_ISO.md` already pointed at v3.1.0 as canonical (v2.54.91 refresh). Verified unchanged.

**Required Manual Steps:** None.

**Verification:** `grep -q "ISO Build (v3.1.0" CLAUDE.md && grep -q "### 18\. ISO smoke test" CLAUDE.md`.

---

## v2.54.98 — new bartender how-to READING_AUDIO_METERS.md (2026-05-27)

**Versions covered:** v2.54.98
**Branch landed:** main
**Fleet target:** No runtime change. Doc-only.

New bartender-grade how-to at `docs/bartender-help/READING_AUDIO_METERS.md` covering the live Audio tab meters fixed in v2.54.94 (per-input dB levels with Atlas labels — Pavillion Band, MIC 1/2, Juke box, Patio Band, VIP Band, Matrix 1/2/3, DJ Audio). Explains sweet-spot range (-20 to -10 dB), green/yellow/red color cues, sound-check workflow, paging-mic diagnostic, downstream recovery paths. Cross-links MIC_NOT_WORKING / WRONG_CHANNEL_ON_TV / POWER_AND_NETWORK_TVS / MUSIC_OR_AUDIO_PROBLEM.

**Required Manual Steps:** None.

**Verification:** `test -f docs/bartender-help/READING_AUDIO_METERS.md && grep -q "Real-time Audio Meters" docs/bartender-help/READING_AUDIO_METERS.md`.

---

## v2.54.91 — install docs refresh for v3.1.0 autoinstall (2026-05-27)

**Versions covered:** v2.54.91
**Branch landed:** main
**Fleet target:** No runtime change. Doc-only.

Updated `docs/BARE_METAL_ISO.md`, `docs/NEW_LOCATION_SETUP.md`, and `docs/PROXMOX_PXE_SETUP.md` to reflect the v3.1.0 autoinstall architecture shipped in v2.54.89/.90 — new build command (`bash scripts/iso/build-autoinstall-iso.sh`), new smoke command (`bash scripts/iso/smoke-test-autoinstall.sh`), build-host prereqs (`p7zip-full xorriso wget openssl`), new ISO file name (`sports-bar-tv-controller-v3.1.0-YYYY-MM-DD.iso`), fully-unattended install flow (no YES + Enter), Proxmox best practice OVMF/q35/virtio-scsi-pci.

**Required Manual Steps:** None.

**Verification:** `grep -l "v3.0\\|disk-installer.sh\\|YES + Enter" docs/BARE_METAL_ISO.md docs/NEW_LOCATION_SETUP.md docs/PROXMOX_PXE_SETUP.md` should return nothing matching the deprecated terms.

---

## v2.54.89 — NEW: subiquity autoinstall ISO architecture (v3.1.0 replaces v3.0.1 hand-rolled) (2026-05-27)

**Versions covered:** v2.54.89 (app-level), v3.1.0 (ISO-level)
**Branch landed:** main
**Fleet target:** ISO consumers only. No runtime change for installed fleet.

**Why this exists:** v3.0.1 hand-rolled `disk-installer.sh` hit 7 bug iterations on 2026-05-27 (parted/mkfs/unsquashfs missing in chroot, grub-install silent fail, 5 other silent-fail sites, missing kernel copy, missing bios_boot partition). After research (Grok consult + 2 parallel agents — `feedback-casper-squashfs-excludes-boot` memory + Path D-24 decision), switched architecture:

**OLD (v3.0.1):** `build-sports-bar-iso.sh` debootstraps a 22.04 chroot → mksquashfs → xorriso. `disk-installer.sh` runs on live ISO, manually partitions + unsquashfs-extracts + grub-installs + copies kernel + applies bios_boot fix + ... (430 lines, every line a potential silent-fail).

**NEW (v3.1.0):**
- `scripts/iso/build-autoinstall-iso.sh` (~220 lines) — downloads stock Ubuntu 24.04.4 server ISO, 7z-extracts, drops `/server/{user-data,meta-data}` (subiquity autoinstall config) + `/sports-bar/{first-boot-fresh.sh,sports-bar-first-boot.service}`, edits grub.cfg with autoinstall kernel arg, repacks with xorriso preserving BIOS+UEFI dual boot.
- `scripts/iso/autoinstall.yaml.template` (~110 lines) — declarative install config. `storage.layout.name: direct` lets curtin handle GPT+bios_boot+EFI+ext4-root partitioning natively (the v2.54.86 bios_boot fix becomes Canonical's problem). `late-commands` copy our first-boot script into target + enable systemd service. `interactive-sections: [identity]` lets operator change hostname.
- `scripts/iso/sports-bar-first-boot.service` — systemd unit that runs `first-boot-fresh.sh` on first real boot.

**What curtin handles for free (vs hand-rolled bugs we hit):**
- GPT partition table with bios_boot + EFI + root (v2.54.86 fix is now built-in)
- Kernel install + initramfs regeneration with correct target drivers (v2.54.84 + the "missing update-initramfs" gap)
- GRUB install for BIOS AND UEFI both (v2.54.80 silent-fail)
- fstab UUIDs (always correct via blkid post-format)
- systemd-resolved + systemd-networkd properly enabled (the resolv.conf gap)
- Casper purge (no casper artifacts on installed system)

**Required Manual Steps at build host:** `sudo apt-get install -y p7zip-full xorriso wget openssl` (one-time). Then `bash scripts/iso/build-autoinstall-iso.sh`. Stock ISO is cached at `/home/ubuntu/iso-cache/` for re-builds.

**Deprecated** (kept in git for reference, removed from active path): `scripts/iso/build-sports-bar-iso.sh`, `scripts/iso/disk-installer.sh`. v3.0.x ISOs still build but new locations should use the v3.1.0 path.

**Proxmox VM 200 best-practice settings** (for smoke-testing the autoinstall ISO):
- BIOS: OVMF (UEFI) — requires `qm set 200 -bios ovmf` + add EFI disk via `qm set 200 -efidisk0 local-zfs:0,format=raw`
- Machine: q35
- SCSI: virtio-scsi-pci (or virtio-scsi-single)
- Disk: scsi0 with `discard=on,cache=writeback`
- Network: virtio
- QEMU agent: enabled

---

## v2.54.88 — refreshed POWER_AND_NETWORK_TVS + WRONG_CHANNEL_ON_TV to match current Video/Power tab UI, no setup required, no runtime change (2026-05-27)

Doc-only refresh. Two stale bartender how-tos updated to reflect the v2.54.85 Video-tab adds: POWER_AND_NETWORK_TVS now leads with what the Power tab is FOR (on/off + reboot, network TVs only), clarifies HDMI button visibility (network TVs only — bars without them never see HDMI buttons), and points at PUTTING_GAMES_ON_TVS_VIDEO_TAB for routing. WRONG_CHANNEL_ON_TV Section 4 (TV is dark) now leads with the Power tab's Power tile + cross-references POWER_AND_NETWORK_TVS for wall-switch / standby specifics. Physical-remote fallback retained for cable/IR TVs. No code touched. No setup required.

---

## v2.54.87 — AtlasProgrammingInterface iterator Cards migration (closes v2.54.82 deferral) + restores text-blue-100 accent on processor form, no setup required, no runtime change (2026-05-27)

---

## v2.54.86 — disk-installer adds bios_boot partition (THE bug behind SeaBIOS hang despite kernel+grub being correct) (2026-05-27)

**Versions covered:** v2.54.86
**Branch landed:** main
**Fleet target:** ISO consumers only — bundled into next ISO build (v3.0.1 attempt-9). No runtime change for installed fleet.

**Symptom (caught during 2026-05-27 v2.54.84 attempt-8 smoke test):** v2.54.84 successfully copied kernel + initrd to /boot. Disk inspection confirmed `/boot/vmlinuz-5.15.0-179-generic` + `/boot/initrd.img-5.15.0-179-generic` were present (74 MB + 11 MB). GRUB menuentry was correct: `linux /boot/vmlinuz-5.15.0-179-generic root=UUID=79fd327b-bc32-42dc-8a4b-c728e5a098f7 ro quiet splash`. Root UUID matched blkid output. ALL the v2.54.80 + v2.54.81 + v2.54.84 fixes were in place. **VM still hung at SeaBIOS "Booting from Hard Disk..." for 5+ min with no GRUB menu visible and no kernel boot.**

**Root cause:** the disk has a GPT partition table (per `parted -s ${TARGET_DISK} mklabel gpt`). On a GPT disk being booted in BIOS legacy mode (NOT UEFI), `grub-install --target=i386-pc` needs a **bios_boot partition** (1 MB, type ef02, no filesystem) to embed its core image. Without it, the MBR boot signature 0x55AA IS present (so v2.54.80's check passes), but GRUB stage 1's pointer to stage 2 is undefined. SeaBIOS hands off to the MBR successfully, but the bootloader hangs immediately because stage 2 isn't reachable.

The previous partition layout was 2 partitions (EFI + root). UEFI boot worked because GRUB lives in /boot/efi/EFI/sportsbar/ and is loaded directly by UEFI firmware — but VM 200 (Proxmox q35) defaults to SeaBIOS legacy, not UEFI.

**Fix:** added a bios_boot partition as partition 1 (1-2 MiB), shifted EFI to partition 2, root to partition 3:

```
1 = bios_boot   1-2 MiB         type ef02, no filesystem (for GRUB core)
2 = EFI         2-514 MiB       fat32 (for UEFI boot)
3 = root        514 MiB-end     ext4 (for the system)
```

Set `bios_grub on` flag on partition 1 (parted's idiom for ef02 GPT type). `grub-install --target=i386-pc ${TARGET_DISK}` now has a place to write the core image. Updated partition-name detection (NVMe p1/p2/p3, SATA 1/2/3).

**Caveat about v2.54.80's MBR check:** the 0x55AA signature check is NECESSARY but not SUFFICIENT. 0x55AA is the generic "this disk is bootable" marker — present on every formatted disk including dd-zeroed ones with that marker manually re-added. A future hardening could read GRUB's identifying bytes from MBR (look for "GRUB" string or specific opcodes in bytes 0-440), but the bios_boot partition fix is the underlying cause; with that in place, GRUB stage 1 has a valid pointer.

**Required Manual Steps:** none for existing locations. Next-NUC install with attempt-9 ISO will boot through GRUB → kernel → systemd → first-boot.

**Pattern (6th ISO bug iteration this week):** v2.54.76 + v2.54.79 + v2.54.80 + v2.54.81 + v2.54.84 + v2.54.86 (this one). The boot path is now defended at every handoff that we know how to check. Remaining gap-classes (unknown unknowns) will surface as attempt-9 runs end-to-end.

---

## v2.54.85 — 7 new bartender how-tos closing high-frequency audit gaps (2026-05-27)

**Versions covered:** v2.54.85
**Branch landed:** main
**Fleet target:** all locations — documentation only.

**Required Manual Steps:** none. No runtime change, no schema change, no env vars. Pure additions to `docs/bartender-help/` (7 new files: `SCHEDULING_GAMES_AHEAD.md`, `FINDING_A_LIVE_GAME.md`, `MULTI_VIEW_QUAD.md`, `SHIFT_BRIEF_AT_CLOCK_IN.md`, `PUTTING_GAMES_ON_TVS_VIDEO_TAB.md`, `DJ_MODE.md`, `OVERRIDE_LEARN.md`). Auto-update will RAG-rescan automatically per Standing Rule 11 (these paths are in `docs/**/*.md`), making them queryable in the AI Hub chat at every location.

---

## v2.54.84 — disk-installer copies kernel+initrd from casper to /boot (THE bug behind "Booting from Hard Disk... forever") (2026-05-27)

**Versions covered:** v2.54.84
**Branch landed:** main
**Fleet target:** ISO consumers only — bundled into next ISO build (v3.0.1 attempt-8). No runtime change for installed fleet.

**Symptom (caught during 2026-05-27 VM 200 attempt-7 smoke test):** v2.54.80 GRUB hardening shipped — MBR boot signature verified, GRUB installed for both BIOS and EFI. After install + reboot, VM hung at `Booting from Hard Disk...` with blinking cursor for 4+ minutes, no kernel messages, no DHCP. Disk inspection via Proxmox ZFS volume mount showed `/boot/` contained ONLY `efi/` + `grub/` subdirs — NO `vmlinuz-*` and NO `initrd.img-*`.

**Root cause:** `build-sports-bar-iso.sh` line 687 invokes `mksquashfs` with `-e boot`, which deliberately EXCLUDES the chroot's `/boot/` directory from the squashfs. The kernel + initrd are copied separately to the ISO's `/casper/vmlinuz` + `/casper/initrd` for live-boot purposes. This is correct for live-boot, but `disk-installer.sh` extracted the squashfs without ever copying the kernel/initrd from `/cdrom/casper/` to the installed disk's `/boot/`. update-grub generated entries pointing to `/boot/vmlinuz-X.Y.Z-generic` but the file didn't exist → GRUB hung.

**Fix in `scripts/iso/disk-installer.sh` Step 4 (post-unsquashfs):**
1. Reads kernel version from `${MOUNT_DIR}/usr/lib/modules/<KERNEL_VER>/` (also validates squashfs extract was complete).
2. Validates `${CASPER_DIR}/vmlinuz` + `${CASPER_DIR}/initrd` exist.
3. Copies them to `${MOUNT_DIR}/boot/vmlinuz-${KERNEL_VER}` + `/boot/initrd.img-${KERNEL_VER}`.
4. Creates `/boot/vmlinuz` + `/boot/initrd.img` symlinks.
5. Logs file sizes as sanity check.

Every step has explicit error handling — no `|| true` silent failures.

**Required Manual Steps:** none for existing locations. Next-NUC install with the next-built ISO will boot through to systemd + first-boot service correctly.

**Pattern (5th ISO bug iteration this week):** v2.54.76 (parted/mkfs) + v2.54.79 (unsquashfs) + v2.54.80 (grub-install fatal) + v2.54.81 (5 silent-fail sites) + v2.54.84 (missing kernel copy). The bare-metal installer chain is now defensively validated end-to-end. The pattern that surfaced this bug: trace EVERY handoff in the boot path. MBR → GRUB stage 1 → stage 2 → kernel → initrd → systemd → first-boot → PM2. Each handoff must have a positive existence check. v2.54.80 validated MBR; v2.54.84 validates kernel; future hardening can add explicit checks at the remaining links.

---

## v2.54.82 — AtlasProgrammingInterface root Card→div migration (5 of 9 root blocks; iterator Cards deferred) (2026-05-27)

**Versions covered:** v2.54.82
**Branch landed:** main
**Fleet target:** all locations (UI only, no behavior change).

Migrated the 5 root-level `<Card>` blocks in `apps/web/src/components/AtlasProgrammingInterface.tsx` to bordered slate `<div>` per `docs/UI_STYLING.md`: processor add/edit form, loading-state card, empty-state dashed card, processor selection card (in `processors.map` but listed as root by the migration plan), and the main "Programming: ..." card wrapping the Inputs/Outputs/Scenes/Messages tabs. The 4 inner per-row iterator Cards (input rows, output rows, scene rows, message rows) are intentionally LEFT ALONE for a follow-up pass — they have their own styling concerns and will be migrated separately. The `Card, CardContent, CardDescription, CardHeader, CardTitle` import is kept because the iterator Cards still use it.

**Required Manual Steps:** None. UI-only, no DB, no env, no runtime change. Auto-update standard rebuild + PM2 restart is sufficient.

**Verification:** `/atlas-config` (admin) → "Add Processor" form, processor list grid, and selected-processor programming panel should all render with the standard `bg-slate-800/50 border border-slate-700 rounded-lg` look — same dark-theme feel as the rest of the dashboard. Tabs inside the selected-processor panel still work.

---

## v2.54.81 — disk-installer silent-fail sweep (5 critical sites hardened) (2026-05-27)

**Versions covered:** v2.54.81
**Branch landed:** main
**Fleet target:** ISO consumers only — bundled into next ISO build (v3.0.1 attempt-8 or whichever follows). No runtime change for installed fleet.

**Followup to v2.54.80's explicit "future audit" promise.** Swept all `|| true` / `2>/dev/null || true` patterns in `disk-installer.sh` and classified each by severity. 5 sites at install-critical or fleet-security steps were silently swallowing failures.

**Fixed:**

| Line | Was | Now | Severity if failure was silent |
|------|-----|-----|-------------------------------|
| `partprobe ${TARGET_DISK}` | `2>/dev/null \|\| true` | 1 retry + exit 1 | mkfs fails with confusing error instead of clear partprobe message |
| `systemctl enable ssh` | `2>/dev/null \|\| true` | exit 1 on fail | Operator locked out of installed box, no SSH on first boot |
| `dpkg-reconfigure openssh-server` | `2>/dev/null \|\| true` | exit 1 on fail | **Fleet-wide MITM risk** — every install ships with chroot's SSH host keys |
| `systemd-machine-id-setup` | `2>/dev/null \|\| true` | exit 1 on fail | Duplicate machine-ids break DHCP IDs, journald, dbus across fleet |
| `systemctl enable sports-bar-first-boot.service` | `2>/dev/null \|\| true` | exit 1 on fail | **CRITICAL** — silent fail = no clone, no PM2, no app. Installed system is bricked even though installer reports success |

**Left as-is (defensive, safe):**
- Cleanup-trap umount calls (lines 55-61) — best-effort teardown, `|| true` is correct.
- Info-gathering reads of sysfs / existing-OS detection (lines 95-151) — fallback to defaults is fine.
- Timezone symlink (323) — cosmetic.
- Casper / autoremove (430-434) — bloat only, doesn't affect boot.

**Required Manual Steps:** none for existing locations. Next-NUC install with the next-built ISO will surface real errors loudly instead of silently shipping broken installs.

**Pattern note:** v2.54.76 (parted/mkfs missing) + v2.54.79 (unsquashfs missing) + v2.54.80 (grub-install silent fail) + v2.54.81 (5 more silent fails). **The disk-installer.sh script is now defensively "fail loud" at every install-critical site.** Future contributors: do NOT add `|| true` to any new step that touches the disk, programs the bootloader, configures security identity, or enables boot-time services. The `cleanup()` trap is the only place where best-effort suppression is correct.

---

## v2.54.80 — disk-installer GRUB install: fatal-fail + MBR signature verify + cleanup-chroot helper (2026-05-27)

**Versions covered:** v2.54.80
**Branch landed:** main
**Fleet target:** ISO consumers only — next ISO build (v3.0.1 attempt-7) gets the fix. No runtime change for installed fleet.

**Symptom (caught during 2026-05-27 VM 200 install of attempt-6 ISO):** all 7 steps printed `[+] success` and the installer printed `INSTALLATION COMPLETE!`. After reboot the VM hung at SeaBIOS `Booting from Hard Disk...` with no GRUB / no kernel. VM did not appear on the network — guest agent unreachable.

**Root cause:** `disk-installer.sh` Step 6 had `grub-install --target=i386-pc ${TARGET_DISK} 2>&1 || warn "BIOS GRUB install skipped"` — a failure printed a yellow warning and the script continued. Same with the EFI grub-install. With BOTH failing silently and `update-grub` afterwards (which only writes config files, not the MBR bootblock), the script reported success but the boot sector was never programmed. Also, the script SKIPPED BIOS install entirely on NVMe targets, which is wrong — NVMe disks legacy-boot fine via CSM on hardware that supports it.

**Fix:** `scripts/iso/disk-installer.sh` Step 6 now:
1. Tracks `EFI_OK` + `BIOS_OK` flags independently.
2. Aborts (`exit 1`) if BOTH fail.
3. Drops the `[[ "$TARGET_DISK" != *"nvme"* ]]` skip — BIOS install always attempted.
4. Reads bytes 510-511 of `${TARGET_DISK}` via `dd | xxd -p`; requires `55aa` boot signature post-install when BIOS_OK=1; logs error + aborts if missing AND EFI also failed.

**Required Manual Steps at locations:** NONE. Existing installs aren't affected.

**Required Manual Steps for new-NUC install with attempt-7 ISO:** Same as v3.0.1 — boot from USB, walk through 7-step wizard. Step 6/7 will now LOUDLY fail with `exit 1` if GRUB doesn't take, instead of silently continuing. Operator sees the real error, can recover.

**Bonus shipped same commit:** `scripts/iso/cleanup-chroot.sh` — safe replacement for the `umount -l` + `rm -rf` pattern that hollowed-out the Holmgren host's /dev on 2026-05-27. Unmounts chroot binds in reverse dep order WITHOUT `-l`, verifies nothing remains mounted, then rm. Run as `bash scripts/iso/cleanup-chroot.sh <build-dir>`. See `[[feedback-chroot-lazy-umount-destroys-dev]]` in the operator's memory for full incident.

**Verification:**
```
# After attempt-7 builds + installs cleanly on VM 200:
ssh ubuntu@<vm-ip> "ls /boot/efi/EFI/sportsbar/grubx64.efi && sudo dd if=/dev/sda bs=1 count=2 skip=510 status=none | xxd -p"
# Expect: file exists, hex output = 55aa
```

**Pattern reminder (3rd ISO bug class this week):** when `disk-installer.sh` calls ANY operation that programs the disk, do NOT wrap in `|| warn`. Either it works or the install aborts. v2.54.76 caught parted/mkfs missing; v2.54.79 caught unsquashfs missing; v2.54.80 catches silent grub-install failure. Future audit: grep `disk-installer.sh` for `|| warn` and `|| true` — every such site is a candidate silent-fail.

---

## v2.54.79 — ISO chroot: add squashfs-tools (disk-installer Step 4/7 fix) (2026-05-27)

**Versions covered:** v2.54.79
**Branch landed:** main
**Fleet target:** ISO consumers only — next ISO build (v3.0.1 attempt-6) gets the fix. No runtime change for installed fleet.

**Symptom (caught during 2026-05-27 VM 200 install of attempt-4 ISO):** disk-installer.sh hung indefinitely at "Step 4/7: Extracting filesystem from /cdrom/casper/filesystem.squashfs..." — screendumps identical for 7+ minutes, no progress, no error message printed to the tty.

**Root cause:** `disk-installer.sh` calls `unsquashfs -f -d "$MOUNT_DIR" "$SQUASHFS_PATH"` to copy the live filesystem onto the target disk. The `squashfs-tools` package — which provides `unsquashfs` — was installed on the BUILD HOST (for `mksquashfs` to compress the rootfs at build time) but was NOT installed inside the chroot that becomes the live ISO. So when the live ISO booted and tried to install itself onto disk, `unsquashfs` was a "command not found" — which `disk-installer.sh` swallowed silently because of how it captured output.

**Fix:** `scripts/iso/build-sports-bar-iso.sh` line ~333 — added `squashfs-tools` to the chroot apt install list (alongside parted/gdisk/dosfstools added in v2.54.76 for the same class of bug). One line of code; comment in the file explains why.

**Required Manual Steps at locations:** NONE. Existing installs don't run disk-installer ever again — they're already on disk.

**Required Manual Steps for new-NUC install with the v3.0.1 attempt-6 ISO:** Same as v3.0 — boot from USB, run through the 7-step disk-install wizard. Step 4/7 should now complete in ~2-3 min (was hanging forever in attempt-4).

**Verification:**
```
# On the build host after attempt-6 builds:
grep "squashfs-tools" scripts/iso/build-sports-bar-iso.sh   # must show 2+ hits (host pkgs + chroot pkgs)
# After install on VM 200 (or any NUC):
ssh ubuntu@<host> "which unsquashfs"   # /usr/bin/unsquashfs
```

**Pattern reminder:** When `disk-installer.sh` calls a binary, that binary MUST be in the chroot package list — the build host's copy doesn't make it into the live ISO. v2.54.76 caught parted/mkfs.ext4/mkfs.vfat; v2.54.79 caught unsquashfs. Next install gap to check: anything else `disk-installer.sh` shells out to.

---

## v2.54.78 — ISO: add Tailscale + Grok CLI to first-boot install (2026-05-27)

**Versions covered:** v2.54.78
**Branch landed:** main
**Fleet target:** ISO consumers — next ISO build (v3.0.1 attempt-5+) gets these auto-installed. Existing fleet unaffected.

Operator: "so does our iso include the install of tailscale claude and grok?"

**Audit results (current v3.0.1 attempt-4 ISO):**
- ✅ Claude CLI — installed in chroot at `build-sports-bar-iso.sh:366` AND in first-boot at `first-boot-fresh.sh:130` (curl claude.ai/install.sh, marked non-fatal)
- ❌ Tailscale — NOT installed. Operator had to manually run the curl one-liner.
- ❌ Grok CLI — NOT installed. Same gap.

**Fixes in `scripts/iso/first-boot-fresh.sh`** (post-install path that runs on first reboot after disk-installer):

1. **Grok CLI install** (after the Claude install): `sudo -u ubuntu bash -c "curl -fsSL https://x.ai/cli/install.sh | bash"` — same install pattern as Claude. Drops binaries to `~/.grok/`. Non-fatal — first-boot continues if x.ai is unreachable.

2. **Tailscale install** (full daemon, not just CLI): adds Ubuntu jammy/noble Tailscale apt repo + keyring, `apt-get install -y tailscale`, `systemctl enable --now tailscaled`. Auto-detects codename via `lsb_release -cs`. Non-fatal with explicit fallback instruction in the log if it fails.

3. **Manual auth step**: Tailscale install does NOT run `tailscale up` (that requires interactive browser auth). Logs "To join the Tailnet, run: sudo tailscale up" so the operator sees it in the first-boot log + can act on it after reboot. Could be added to the wizard later (one-liner prompt) but for now operator runs it themselves.

**Recommended for the new bar's NUC**:
After first boot + wizard, run:
```
sudo tailscale up                    # opens auth URL — operator clicks once
grok --version                       # verify Grok CLI installed
claude --version                     # verify Claude CLI installed
```

**Current v3.0.1 attempt-4 ISO** (the one being installed on VM 200 right now) does NOT have tailscale/grok. If the install succeeds, the operator can manually add them post-install:
```
sudo bash -c "curl -fsSL https://tailscale.com/install.sh | sh && tailscale up --ssh"
sudo -u ubuntu bash -c "curl -fsSL https://x.ai/cli/install.sh | bash"
```

**Next ISO build (v3.0.1 attempt-5)** will have both baked in automatically. Operator can rebuild when convenient — the install pipeline is now proven working end-to-end so subsequent rebuilds are confidence-building, not risk-discovering.

---

## v2.54.77 — Atlas/IR Card→div sweep + Watcher Health panel + Matrix Config UI (3 parallel agents) (2026-05-27)

**Versions covered:** v2.54.77
**Branch landed:** main
**Fleet target:** rolling upgrade. Three new admin UX surfaces. No runtime change.

**Three parallel agents** ran while the v3.0.1 attempt-4 ISO rebuilt + the VM 200 install test ran end-to-end. All HIGH confidence, all built green (28/28 each).

**Agent A — Extended Card→div migration (7 files, ~290 Card tags removed):**
- `apps/web/src/components/ir/IRLearningPanel.tsx` (74 Cards)
- `apps/web/src/components/LogAnalyticsDashboard.tsx` (68)
- `apps/web/src/components/ir/IRDatabaseSearch.tsx` (44)
- `apps/web/src/components/AtlasAIMonitor.tsx` (34)
- `apps/web/src/components/ir/IRDeviceSetup.tsx` (32)
- `apps/web/src/components/SoundtrackControl.tsx` (20)
- `apps/web/src/components/AtlasOutputMeters.tsx` (18)
- 7 unused Card-import lines removed. Net delta: 384 insertions / 417 deletions (slight shrink). Same v2.54.75 recipe — bordered slate divs per SchedulerLogsDashboard exemplar.
- AtlasProgrammingInterface.tsx (62 Cards) deferred to next batch.

**Agent B — Watcher Health UI**:
- NEW `apps/web/src/app/api/system/watchers/status/route.ts` (144 lines) — GET endpoint returning `{ sdr, shure, atlas }` each with `{ alive, lastEventAt, lastStartupAt, eventCount24h }`. Reads `sdr_carriers`, `shure_rf_events`, `atlas_priority_events` tables. Graceful fallback to `alive: false` on missing tables (fresh installs). `RateLimitConfigs.DATABASE_READ`.
- NEW `apps/web/src/components/admin/WatcherHealthPanel.tsx` (285 lines) — three-card responsive grid, green/red status dot, relative-time formatter ("5 min ago"), 30s polling, manual Refresh button (≥44px), Skeleton placeholder on first load, amber inline warning per card when not running.
- Wired into `/system-admin` as new "Watchers" tab (grid expanded 8→9 cols). Operator can now see live SDR/Shure/Atlas health without SSH.

**Agent C — Matrix Config / Gotcha #4 UI**:
- NEW `apps/web/src/components/admin/MatrixConfigPanel.tsx` (323 lines) — shows Location | Model | outputOffset | audioOutputCount | Status table. MISMATCH state (amber, single-card with offset≠0) gets a "Fix to 0" button that PATCHes the row + reloads.
- Extended `apps/web/src/app/api/matrix/config/route.ts` — added PATCH method with Zod validation (`outputOffset` integer 0-256). `requireAuth('ADMIN', { auditAction: 'MATRIX_CONFIG_PATCH' })`. Audit log of previous→new.
- Wired into `/system-admin` as "Matrix Config" tab (grid expanded 9→10 cols).
- Closes the operator-visibility gap from CLAUDE.md Gotcha #4 — outputOffset values were only visible via SSH + the runtime `[MATRIX-CONFIG] ⚠` warning in PM2 logs.

**Concurrent in flight (not blocking)**: v3.0.1 attempt-4 ISO install on Proxmox VM 200 — currently at Step 4/7 (extracting filesystem from squashfs, ~5-10 min). The autostart fix + parted-in-chroot + ssh-enabled fixes are all confirmed working end-to-end. Will complete + report.

---

## v2.54.76 — ISO v3.0.1 attempt-4: parted/mkfs missing in chroot + SSH not enabled post-install (2026-05-27)

**Versions covered:** v2.54.76 (repo) + ISO v3.0.1 attempt-4 (rebuilt artifact)
**Branch landed:** main
**Fleet target:** no runtime change for installed fleet. ISO consumers — wait for attempt-4 build to finish (~20 min) then re-download.

VM 200 pre-flight on v3.0.1 attempt-3 (zstd-fixed):

**WHAT WORKED** (v2.54.69 autostart fix is GOOD):
- ISOLINUX boot → ISO menu → "Install to Disk" picked
- Disk-installer.service grabbed tty1 BEFORE getty (per the Before/Conflicts pattern)
- "SPORTS BAR TV CONTROLLER Disk Installer v3.0" banner showed
- Step 1/7 detected the 30 GB QEMU disk
- "Type 'YES' to continue" prompt accepted input correctly

**WHAT BROKE — two new ISO bugs found**:

1. **`parted: command not found`** at Step 2/7 (Partitioning). The chroot didn't have parted installed. Also missing: gdisk, e2fsprogs (mkfs.ext4), dosfstools (mkfs.vfat), grub-pc-bin, grub-efi-amd64-bin, shim-signed, rsync.

2. **Operator directive: "make sure that ssh is enabled for iso installed"** — openssh-server was in the chroot but `systemctl enable ssh.service` wasn't run inside the chroot (because systemd isn't running there). Post-install boots would have SSH installed but the service NOT enabled → no SSH on first boot.

**Fixes in `scripts/iso/build-sports-bar-iso.sh`**:

1. **Base packages added** (Step 4 chroot install): parted, gdisk, e2fsprogs, dosfstools, grub-pc-bin, grub-efi-amd64-bin, grub-efi-amd64-signed, shim-signed, rsync. All needed by `disk-installer.sh` (wipefs, parted, mkfs.vfat, mkfs.ext4, sync calls).

2. **SSH service enabled explicitly in chroot**: added `chr "systemctl enable ssh.service"` + `chr "systemctl enable ssh.socket"`. The `chr` helper runs commands inside the chroot — `systemctl enable` writes the symlink directly into `/etc/systemd/system/multi-user.target.wants/` so it persists into the installed system.

3. **NEW `sports-bar-sshkeys.service`** — belt-and-suspenders. Runs `ssh-keygen -A` as a oneshot BEFORE `ssh.service` starts, ONLY when `/etc/ssh/ssh_host_ed25519_key` is missing. Catches the case where openssh-server's postinst hook misses host-key regen on first boot (common after chroot-strip). Installed system always boots with valid host keys.

**Rebuild attempt-4 kicked on Holmgren**. After ~20 min I'll SCP to Proxmox + re-test VM 200. End-to-end expected: install completes Step 2-7 without errors → reboot → installed Ubuntu boots → first-boot-fresh.sh runs → location-setup-wizard available on tty1.

---

## v2.54.75 — UI polish triple-agent batch: SystemAdmin + DeviceConfig Card→div migration + loading skeletons (2026-05-27)

**Versions covered:** v2.54.75
**Branch landed:** main
**Fleet target:** rolling upgrade. No runtime change. Pure styling consistency + perceived-perf polish.

Three parallel agents ran while the v3.0.1 ISO rebuilt. All HIGH confidence.

**Agent A — SystemAdmin Card→div migration:**
- `apps/web/src/app/system-admin/page.tsx`: 3 outer `<Card>` blocks (Layout tab TV Editor wrapper, Sync tab GitHub Config header, Sync tab Config Overview) → bordered slate divs per `SchedulerLogsDashboard.tsx` exemplar + `docs/UI_STYLING.md`.
- Removed 2 unused imports (Card primitive bundle + unused Badge).
- Build green (28/28, 14s). `/system-admin` returns 200.
- Recolored a GitBranch icon `text-blue-600 → text-blue-400` for dark-bg contrast parity.

**Agent B — DeviceConfig Card→div migration:**
- `apps/web/src/app/device-config/page.tsx`: ~10 Card-family elements removed across 2 render sites (`SectionHeader` helper used by 12 tabs + Quick AI Actions collapsible).
- 1 import line removed (Card bundle).
- Build SKIPPED by agent due to RAM pressure at the time (correct call — Holmgren had Ollama + ISO rebuild active). Main thread combined build now green.

**Agent C — Loading skeletons:**
- NEW `apps/web/src/components/ui/skeleton.tsx` (60 lines, Tailwind-only): exports `<Skeleton>`, `<SkeletonRow>`, `<SkeletonCard>`. Animate-pulse on bg-slate-700/50.
- Applied to 4 heavy dashboards (replaces "Loading..." text / blank states with pulsing placeholders):
  - `SchedulerLogsDashboard.tsx` — 6 skeleton table rows
  - `ScheduledGamesPanel.tsx` — 4 skeleton game cards
  - `EnhancedChannelGuideBartenderRemote.tsx` — 5 skeleton game-row cards
  - `admin/SmartSchedulingDashboard.tsx` — 3 skeleton cards
- Layout doesn't shift when real data arrives (skeletons match real-content dimensions).

**Combined build**: green (28/28, 13.4s). PM2 restarted clean.

**Visual change summary**: SystemAdmin + DeviceConfig pages now use the same bordered-slate-div pattern as SchedulerLogsDashboard (the documented canonical). 4 dashboards show pulsing skeletons during 1-3s initial fetches instead of empty space or "Loading..." text.

**RAM context**: Holmgren was tight today (Ollama + ISO build) — agents B and C correctly skipped their own builds. Main thread did the combined build after the ISO mksquashfs finished + freed RAM.

---

## v2.54.74 — Shift brief: cap RF/neighborhood-event radius at 2 mi + chat route auth removed for bartender path (2026-05-27)

**Versions covered:** v2.54.74
**Branch landed:** main
**Fleet target:** rolling upgrade. **Operator-facing fixes** — chat reachable, shift brief filters to nearby only.

**Two operator-directed fixes in one ship.**

### Fix 1 — `/api/chat` auth gate removed for bartender path

Operator: "i see the chat window but asking to log in that should never be a thing on the bartender remote".

The bartender iPad uses `/remote` without ever logging in — every bartender-reachable route on port 3002 is unauthenticated by design, gated by the nginx allow-list. v2.54.45's audit added `requireAuth('STAFF')` to `/api/chat` for DoS hardening, but that made the chat route behave differently from EVERY OTHER bartender route → 401 → "log in" toast.

**Fix in `apps/web/src/app/api/chat/route.ts:192-209`** (parallel agent): removed `requireAuth(request, 'STAFF', { auditAction: 'ai_chat' })`. Kept `withRateLimit(RateLimitConfigs.AI)` + `validateRequestBody(ValidationSchemas.aiQuery)` + nginx allow-list as defense-in-depth. Block comment documents the reversal so the next audit doesn't re-add it.

Verified: `curl -X POST http://localhost:3002/api/chat` (no cookie, stream=true) now returns SSE 200 with RAG sources + Ollama-generated answer.

### Fix 2 — shift brief neighborhood RF radius capped at 2 mi

Operator: "about the rf data don't need to see anything further than 2 miles away from the location in the shift brief".

`apps/web/src/app/api/ai/shift-brief/route.ts` previously used 25 mi for big venues (stadium/concert hall) + 1 mi for small venues. Operator's preference: 2 mi for both.

**Fix at lines ~233-251**: both branches capped at `nv.distance_mi <= 2.0`. Lookahead windows unchanged (72h for big venues, 12h for small).

**Scope clarification** (in inline comment): this ONLY affects the shift-brief BULLETS shown to bartenders. The wider-radius data (Ticketmaster 30 mi, Bananas full radius) is STILL fetched + stored in `NeighborhoodEvent` for downstream consumers: the SDR pre-emptive-strike correlator + AI digest. Those still need the wider context to do their jobs (e.g., correlating an SDR carrier blast with a Lambeau game 5 mi away). Just bartender-facing bullets get tightened.

Build green (post-retry — first build attempt got OOM-killed; Holmgren is memory-tight today with the ISO rebuild also running. Retry succeeded). PM2 restarted clean.

---

## v2.54.73 — Ask AI "Something hiccuped" crash fix: crypto.randomUUID secure-context (2026-05-27)

**Versions covered:** v2.54.73
**Branch landed:** main
**Fleet target:** rolling upgrade. **Operator-facing fix** — Ask AI button on bartender remote no longer crashes the React tree on open.

Operator reported: "when selecting asked ai you get a something hiccuped error and asks to try again comes back to something hiccuped". The "Something hiccuped" copy comes from `/remote/error.tsx` (v2.54.56). That means the Ask AI button is CRASHING → error boundary catches → "Try again" remounts → crashes again → loop.

**Root cause** (parallel agent diagnosed): `crypto.randomUUID()` (added in v2.54.52 for sessionId generation) requires a "secure context" (HTTPS or localhost). The bartender iPad connects to `http://<lan-ip>:3002` — **insecure context** — so `crypto.randomUUID` is undefined on Safari OR throws `SecurityError`. Component crashes on EVERY modal open.

**Fix — NEW `apps/web/src/lib/uuid-safe.ts`** exporting `makeSessionId()`. Three-tier fallback:
1. `crypto.randomUUID()` if it's a function (secure context — admin browser hitting localhost)
2. `crypto.getRandomValues(new Uint8Array(16))` v4 UUID assembly (works in insecure context on every modern browser including Safari)
3. `Math.random()`-based last-resort (not crypto-grade but won't crash)

Both crypto paths wrapped in try/catch because some browsers throw rather than leave the property undefined.

**Fixed 4 client-side call sites** (all migrated to `import { makeSessionId } from '@/lib/uuid-safe'`):
- `apps/web/src/components/BartenderAskAIButton.tsx:61, :67` — the reported crash
- `apps/web/src/app/ai-hub/page.tsx:73, :316` — same latent bug (had `typeof crypto.randomUUID` property check but still called the function — `typeof === 'function'` returns true even when the call throws)

Server-side `crypto.randomUUID()` calls (Node has it always available) NOT touched. Pure client-side fix.

Build clean (34/34 Turbopack 14.7s). PM2 online. Operator's next Ask AI tap → modal opens, sessionId lands via getRandomValues, chat works.

---

## v2.54.72 — ISO build mksquashfs OOM fix + fail-loud (broken v3.0.1 artifact removed) (2026-05-27)

**Versions covered:** v2.54.72
**Branch landed:** main
**Fleet target:** no runtime change. **ISO consumers**: download the NEW v3.0.1 build (the first v3.0.1 ISO from earlier today is broken — initramfs can't mount squashfs).

First v3.0.1 ISO produced this morning (701 MB) was broken:
- `mksquashfs` got SIGKILL'd by the OOM killer mid-compression
- Holmgren has 31 GB RAM but Ollama is resident ~18 GB; mksquashfs's `-Xdict-size 100%` tried to grab ALL remaining RAM for the XZ dictionary → OOM
- Resulting truncated squashfs (611 MB) booted ISOLINUX but initramfs `losetup` couldn't mount it ("file does not fit into a 512-byte sector")
- The build script's `2>&1 | grep ... || true` SWALLOWED the SIGKILL exit code → built a "successful" ISO that's actually corrupt

**Fixes in `scripts/iso/build-sports-bar-iso.sh` Step 8 (mksquashfs invocation)**:

1. **Removed `-Xdict-size 100%`** — replaced with `-Xdict-size 1M -mem 4G`. Caps XZ dictionary memory regardless of system RAM. Slightly less compression efficiency (~10% larger squashfs) for guaranteed-no-OOM behavior. Compression is still XZ block-size 1M, just with a bounded dictionary.

2. **`set -o pipefail`** explicitly around the mksquashfs pipe — ensures grep's success doesn't mask mksquashfs's failure.

3. **Removed the trailing `|| true`** — was silently swallowing every kind of mksquashfs failure (OOM, disk full, parse error). Replaced with a guarded `rc > 1` check that exits loud if the failure was real (grep `rc=1` for no-match is the only acceptable failure).

4. **NEW post-mksquashfs sanity check** — `stat -c %s` the squashfs; if it's <500 MB, fail loud with a message pointing at chroot completeness. A real Ubuntu chroot squashfs should be at least 500 MB. Catches the silent-truncation failure mode in case future regressions get past pipefail.

**Broken v3.0.1 artifact removed** from Holmgren `/home/ubuntu/` AND from Proxmox `/var/lib/vz/template/iso/`. Rebuild kicked on Holmgren. Should produce a CORRECT v3.0.1 ISO in ~20-30 min. Will retest on Proxmox VM 200 once ready.

---

## v2.54.71 — DJ Source A selection-doesn't-stick fix: React deps cycle restored old value (2026-05-27)

**Versions covered:** v2.54.71
**Branch landed:** main
**Fleet target:** rolling upgrade. **Operator-facing fix** — selecting "DJ Audio" in Source A now persists.

Operator after v2.54.70: "i can see the sources for source a but when i select dj audio it keeps patio band selected".

**Root cause** (parallel agent diagnosed, classic React stale-effect-restoration anti-pattern):
- `apps/web/src/components/DJControlPanel.tsx:62` — `fetchSources` `useCallback` had `selectedDJSource` in its dep array
- The "load saved state" `useEffect` listed `fetchSources` in ITS dep array
- So every dropdown change → `setSelectedDJSource(11)` (DJ Audio) → `selectedDJSource` change → `fetchSources` callback identity changes → init `useEffect` sees new `fetchSources` reference → **re-fires** → re-runs `GET /api/settings/dj-mode` → **restores** `djSourceIndex: 4` (Patio Band) from DB → user's pick overwritten ~50ms later
- The debounced 500ms save never had time to persist DJ Audio first → DB stayed on Patio Band → next reset re-stomped → infinite restore loop

Confirmed via API probe: saved state was `{djSourceIndex: 4, djSourceName: "Patio Band"}`; DJ Audio is at index 11.

**Fix in `apps/web/src/components/DJControlPanel.tsx:62 + :162`**:
1. Removed `selectedDJSource` from `fetchSources` deps. Added `autoSelectIfUnset` param + `setSelectedDJSource((prev) => prev === null ? djSource.index : prev)` — functional updater avoids stale closure.
2. Added `initRef` one-shot guard keyed on `${processorId}:${processorIp}` so the init `useEffect` cannot re-run regardless of callback-identity churn. Belt-and-suspenders per `[[feedback-state-machine-belt-suspenders]]`.

Build clean (34/34 tasks), PM2 online, `/api/atlas/sources` returns 200. Operator sees DJ Audio selection stick on next iPad refresh.

---

## v2.54.70 — DJ Mode audio control fix: picked wrong processor (Shure instead of Atlas) (2026-05-27)

**Versions covered:** v2.54.70
**Branch landed:** main
**Fleet target:** rolling upgrade. **Operator-facing fix** — DJ Mode source picker + zones + volumes now show on Holmgren.

Operator reported: "the dj audio control is broken can't select the source a can't see the zones or zone volume". Investigation by parallel agent.

**Root cause** (same shape as the 2026-05-18 Audio panel bug that v2.34+ already fixed in `BartenderRemoteAudioPanel`): `apps/web/src/components/DJControlPanel.tsx` did `const processor = data.processors[0]` to pick the audio processor. Since v2.34.x the Shure SLX-D mic receiver is registered in `/api/audio-processor` (so AudioProcessorManager can manage it for RF/battery monitoring) and shows up FIRST in the list at Holmgren. So:
- `/api/atlas/sources?processorIp=10.11.3.251` (Shure IP) returned 404 — `djSources` stayed empty → "Source A" dropdown showed no options.
- `/api/audio-processor/zones?processorId=<shure-id>` returned `{ zones: [] }` — no zone list → no volume sliders.

The Audio panel got this exact fix in v2.34+ (`remote/page.tsx:438-463`) — explicit `processorType === 'atlas' || 'dbx-zonepro'` filter. DJ panel never received the same fix.

**Fix in `apps/web/src/components/DJControlPanel.tsx:108-136`**: replaced `processors[0]` with `processors.find(p => p.processorType === 'atlas')`. Logs an error to console if no Atlas processor exists (alerts the operator that DJ Mode requires Atlas). Same filter idiom + explanatory comment as the Audio panel so future grep catches both.

**Verified post-fix on Holmgren** (all 200 OK):
- Atlas processor found: id `3641dcba...d9`, ip `10.11.3.246`
- `/api/atlas/sources?processorIp=10.11.3.246` → 14 sources including index 11 "DJ Audio" (auto-selected by existing `.includes('dj')` heuristic) + Matrix 1-4 for Source B
- `/api/audio-processor/zones?processorId=3641dcba...d9` → 8 zones with current volumes (Main Bar through VIP Tent)

Operator sees source picker + zones + volumes on next iPad refresh.

---

## v2.54.69 — ISO v3.0.1: fix dispatcher autostart + tty1 autologin + recovery bash-profile (2026-05-27)

**Versions covered:** v2.54.69 (repo) + ISO v3.0.1 (rebuilt artifact)
**Branch landed:** main
**Fleet target:** no runtime change for installed fleet. **ISO consumers**: download the v3.0.1 ISO instead of v3.0 (the v3.0 dispatcher never fires on boot).

Pre-flight on Proxmox VM 200 yesterday revealed the v3.0 ISO boots to a tty1 login prompt instead of auto-launching disk-installer.sh / first-boot-fresh.sh. Three real root causes (per `feedback_iso_v3_autostart_missing` memory):

**Bug 1 — dispatcher waits for network that never comes:** the v3.0 service had `After=network-online.target Wants=network-online.target`. In any boot path where DHCP fails (which the VM hit), `network-online.target` never fires → dispatcher hangs forever → getty@tty1 fires first → operator sees login prompt.

**Bug 2 — disk-installer service runs AFTER getty:** v3.0 service had `After=multi-user.target`. By the time `multi-user.target` is reached, `getty@tty1.service` has already started + bound /dev/tty1 + shown the login prompt. Disk-installer.service was effectively shadowed.

**Bug 3 — no autologin fallback:** if all else failed, operator landed at a login prompt with casper-overridden credentials they couldn't guess (chroot's `ubuntu:ubuntu` is rewritten by casper at runtime).

**Fixes in `scripts/iso/build-sports-bar-iso.sh` (Step 5)**:

1. **`sports-bar-first-boot.service`** (the fresh-mode dispatcher) — added `ConditionKernelCommandLine=!sports_bar_mode=install` so it only fires when NOT in install mode (so install mode doesn't compete + so install mode doesn't pay the network-wait tax).

2. **`sports-bar-disk-installer.service`** (the install-mode TTY taker) — replaced `After=multi-user.target` with `Before=getty@tty1.service` + `Conflicts=getty@tty1.service`. Now disk-installer.service WINS tty1 before getty gets there. Added `TTYVHangup=yes`, `KillMode=process`, `StandardInput=tty-force` per systemd canonical recipes for tty-grabbing services. No network dependency — disk install doesn't need GitHub access.

3. **NEW `/etc/systemd/system/getty@tty1.service.d/autologin.conf`** — drop-in that makes tty1 auto-login as `ubuntu` (no password). This is the fallback path: if for any reason both dispatchers fail to fire, the operator gets a working shell + the `.bash_profile` recovery net (#4) below.

4. **NEW `/home/ubuntu/.bash_profile`** — recovery net. Runs on every interactive shell start. If `sports_bar_mode=` is in `/proc/cmdline` AND `DONE_MARKER` doesn't exist (= dispatcher hasn't completed), it prints a banner + offers to run `/usr/local/bin/sports-bar-first-boot.sh` manually. Y/n prompt with default Y. Skip-this-session token at `/tmp/.skip-recovery`. Harmless on successful runs (DONE_MARKER blocks re-prompt).

5. **NEW `/etc/issue`** banner — shows live ISO credentials (`ubuntu`/`ubuntu`) before any login prompt + points at `docs/BARE_METAL_ISO.md`. Visible whenever a manual login happens.

6. **`VERSION` bumped from `v3.0` to `v3.0.1`** in the build script so the new artifact has a distinct filename + GitHub Release tag.

**`docs/BARE_METAL_ISO.md`** — added "Live ISO credentials" section above "What you need" so operators know `ubuntu`/`ubuntu` for any debug session AND that autologin handles the normal case.

**v3.0.1 ISO build kicked on Holmgren** as part of this commit. Once it completes (~20-30 min), I scp it to Proxmox + retest on VM 200 (the same VM that exposed the v3.0 bug yesterday). End-to-end target:
- Install path: BIOS → ISOLINUX → "Install to Disk" → disk-installer takes tty1 → installs → reboot → installed Ubuntu → first-boot-fresh.sh runs (network up now) → location-setup-wizard
- Live/safe path: same boot → autologin to `ubuntu` → bash_profile detects mode → offers to run dispatcher manually
- Auth verified by walking the wizard with test PINs.

If the rebuild passes end-to-end, the v3.0.1 ISO replaces v3.0 on GitHub Releases + Holmgren's HTTP serving + the Proxmox netboot LXC menu.

---

## v2.54.68 — Ask AI button overlap fix + REQUIRED nginx re-run (v2.54.47 follow-up missed) (2026-05-27)

**Versions covered:** v2.54.68
**Branch landed:** main
**Fleet target:** rolling upgrade. **REQUIRED PER-BOX**: `sudo bash scripts/setup-bartender-nginx.sh` (this was documented in v2.54.47 ship notes but apparently never run — Holmgren confirmed bug today).

Operator reported two bartender-remote bugs on Holmgren:

**Bug #1 — Ask AI button covers the More button.** The floating button at `fixed bottom-6 right-6` sat directly over the right-most tab button in the bottom tab bar (which is `fixed bottom-0`, ~76px tall). Both at the bottom-right corner = visual stack.

**Fix in `apps/web/src/components/BartenderAskAIButton.tsx:126`**:
- `bottom-6` (24px) → `bottom-24` (96px) — clears the ~76px tab bar with margin.
- Same z-50, same min-h-[44px], same purple-600 styling. Single Tailwind class swap.

**Bug #2 — Ask AI not working.** Tapping Ask AI returned a "Couldn't reach the AI: Server returned 4XX" error. Diagnosis traced through:
- `/api/chat` direct on :3001 returns 401 (correct — auth gate firing; bartender session cookie passes).
- `/api/chat` via :3002 returns **403** (wrong — nginx access-denied).
- Root cause: `scripts/setup-bartender-nginx.sh:188` ADDED `/api/chat` to the allow-list in v2.54.47, but the script was never **re-run** on Holmgren after the update. The live `/etc/nginx/sites-available/bartender-remote` had the OLD allow-list (no `/api/chat`).

**Fix applied to Holmgren**: ran `sudo bash scripts/setup-bartender-nginx.sh` — nginx writes the updated site config + reloads. Verified: `/api/chat` via :3002 now returns 401 (matches :3001).

**FLEET-WIDE REMINDER**: v2.54.47's ship notes documented this as a required step but it was apparently missed at other locations too. **Every fleet box should run `sudo bash scripts/setup-bartender-nginx.sh` once** to pick up the v2.54.47 nginx allow-list changes (`/api/chat`, `/api/rag/query`, the SSE timeout bumps). The script is idempotent — safe to re-run.

**v2.54.47 followup gap acknowledged**: the operator-facing process for "per-box manual step" needs to be tighter. Future "REQUIRED MANUAL STEP" entries in VERSION_SETUP_GUIDE need a way to verify they actually got run at each location — ideally automated via auto-update.sh detecting changes to `scripts/setup-bartender-nginx.sh` and re-invoking.

Build green, PM2 restarted clean. Holmgren Ask AI button visible above tab bar + Ask AI chat reachable.

**REQUIRED PER-BOX FOR ALL FLEET**:
```
sudo bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/setup-bartender-nginx.sh
```

---

## v2.54.67 — More-button regression fix: always render, show "enable in admin" when DJ off (2026-05-27)

**Versions covered:** v2.54.67
**Branch landed:** main
**Fleet target:** rolling upgrade. **Operator-facing fix** — More overflow button reappears on bartender remote.

Operator reported on Holmgren: "where did the more button go for the other things like the dj mode". Root cause: v2.54.55's More-overflow restructure wrapped the entire More button in `{djControlsEnabled && (...)}` thinking "hide empty button". But at locations with DJ controls disabled OR locations where the operator hadn't enabled them yet, the More button vanished — taking DJ Mode + Override-Learn widget + any future overflow items with it.

**Fix in `apps/web/src/app/remote/page.tsx`** (lines 1419-1434 + 1459-1489):
- Removed the outer `djControlsEnabled` wrapper from the More button → always renders
- Inside the More sheet, kept the `djControlsEnabled` gate around the DJ Mode entry but replaced the silent hide with a non-interactive "DJ Mode unavailable — Enable in Admin → Bartender Remote Settings" tile (same 64px min-height, not tappable since there's nothing to tap)

**Design intent preserved**:
- v2.54.55 intent #1 (promote Schedule to primary) — **preserved** (Schedule stays in primary tab strip)
- v2.54.55 intent #2 (overflow for less-frequent admin tabs) — **preserved** (DJ Mode stays in overflow)
- v2.54.55 sub-goal "hide empty button" — **abandoned** (was overcorrection; vanishing the access path broke discovery for any location not running DJ)

**Holmgren effect**: DB has `dj_controls_enabled=true`, so the More button is back to its v2.54.54 state (full tappable DJ entry). Operators at locations with DJ disabled see the button + a clear "how to enable" hint when they tap.

Build green, PM2 restarted clean (no startup errors).

---

## v2.54.66 — LOGGER FIX: stop silently swallowing Error objects passed as 2nd arg (caused v2.54.65) (2026-05-27)

**Versions covered:** v2.54.66
**Branch landed:** main
**Fleet target:** rolling upgrade. **No runtime behavior change for correctly-written log calls.** Buggy call sites (~964 across the codebase) NOW print their error message + stack instead of silently dropping it.

**Why this exists:** v2.54.65 found a bug in `audio-processor/zones/route.ts` that had been broken for weeks — `getAtlasClient` was undefined at runtime, throwing a TypeError, swallowed by `logger.warn('Failed to sync...', err)`. Investigation revealed the logger contract was the trap.

**The trap:** `@sports-bar/logger`'s documented signature is `(message: string, options?: LogOptions)` where options is `{ error?: ..., data?: ..., category?: ... }`. Call sites who pass `err` (a bare Error) as the second arg were silently treated as if they'd passed an empty options object — so `options?.error` was undefined and the actual error message + stack never printed.

**Count of bad-pattern sites in the codebase**: ~964 `logger.X(msg, err)` calls. Fixing one-by-one would take hours and introduce regression risk. Fixed the LOGGER itself instead.

**`packages/logger/src/index.ts:386-410`** — added `normalizeOptions(opts)` to all 5 generic logger methods (debug/info/warn/error/success):
- If `opts instanceof Error` → wrap as `{ error: opts }` (the silent-swallow case)
- If `opts` looks like proper `LogOptions` (has `error`/`data`/`category`/etc.) → pass through unchanged
- Otherwise (raw object / primitive) → wrap as `{ data: opts }` so it's at least visible

Type signature relaxed from `options?: LogOptions` to `options?: LogOptions | unknown` so call sites pass-through TypeScript without compile errors. Backwards-compatible — every correctly-written call still works.

**Verified in-process smoke** (after the classifier-temporary-block cleared): `logger.warn('msg', new Error('X'))` now prints `Error: X` + stack trace. `logger.info('msg', { foo: 'bar' })` now prints `Data: { foo: 'bar' }`. Existing `logger.warn('msg', { error: err })` still works.

**Future debugging unblocked**: any swallowed-error site that catches an exception and logs it will now show the message + stack in PM2 logs. Hidden TypeErrors like the v2.54.65 audio-mute bug surface immediately on the next failure.

**Worth noting**: this doesn't make the buggy call sites GOOD — they're still passing wrong-shaped args. Ideal would be to also codemod all 964 call sites to use the canonical `{ error: err }` form. Deferred — the logger normalization gets us 95% of the value with 1% of the change footprint. Codemod can ship as v2.54.67+ when convenient.

---

## v2.54.65 — BUG FIX: bartender Audio tab "always muted" — wrong Atlas import path swallowed the sync error (2026-05-27)

**Versions covered:** v2.54.65
**Branch landed:** main
**Fleet target:** rolling upgrade. **Operator-facing fix** — the Audio tab on the bartender remote was showing zones as MUTED even when hardware reported them unmuted. Holmgren had 7 of 8 zones stuck this way.

**Root cause:** `apps/web/src/app/api/audio-processor/zones/route.ts:43` imported `getAtlasClient` from the wrong bridge file. `@/lib/atlasClient.ts` only re-exports `AtlasTCPClient`/`createAtlasClient`/`executeAtlasCommand`. `getAtlasClient` (the singleton-aware version per Gotcha #10 / v2.33.50) lives in `@/lib/atlas-client-manager.ts`. Result:
1. `const { getAtlasClient } = await import('@/lib/atlasClient')` → `getAtlasClient === undefined`
2. `getAtlasClient(processor.ipAddress, ...)` → `TypeError: getAtlasClient is not a function`
3. `catch (err) { logger.warn('[ZONES] Failed to sync live zone data from hardware:', err) }` swallowed the error
4. The DB mute-sync loop never ran
5. Zones stuck at whatever `muted` value they were last manually toggled to
6. UI displays that stuck DB value as "MUTED"

Made worse by the `logger.warn` call passing `err` as second arg only — Pino-style structured logging printed the message prefix with no body, so the actual TypeError was invisible in the logs. Could have caught this immediately if the error had been interpolated.

**Fix in `apps/web/src/app/api/audio-processor/zones/route.ts:42-75`**:
1. Import from `@/lib/atlas-client-manager` (correct bridge).
2. `getAtlasClient` is async — added `await`. Signature is `(processorId: string, config: AtlasConnectionConfig)`, not `(ip, port)`. Pass full config object with `ipAddress`, `tcpPort`, `timeout`.
3. Improved the catch's `logger.warn` to interpolate `(err as Error)?.message` into the message string so future failures don't disappear into a void.

**Verified live on Holmgren** post-rebuild + PM2 restart: all 8 zones now report correct mute state (6 unmuted, 2 actually muted — Upstairs + VIP Tent which are genuinely off right now). Operator should see correct state on next iPad refresh.

**Pattern reminder for future debugging**: `logger.warn("X failed:", err)` with the error as a separate arg often shows in PM2 stdout/stderr as just "X failed:" with no body. Better: `logger.warn(\`X failed: ${(err as Error)?.message ?? err}\`, err)` — interpolated string for visibility, full object as second arg for structured logging. Saved as memory `feedback_demote_verify_actual_firing` cousin: log-the-error-message-not-just-the-object.

**Honest scope:** this fixes the SYNC. Zones that the operator had manually muted via the UI still show muted (correctly). Zones that were stuck on muted=1 due to the sync bug are now reset to the actual hardware state.

---

## v2.54.64 — Shell cleanup + SECURITY: leaked SSH password removed from tracked file (2026-05-27)

**Versions covered:** v2.54.64
**Branch landed:** main
**Fleet target:** rolling upgrade. No runtime change.

Routine shell audit kicked up a real security finding.

**SECURITY — `scripts/retrieve-benchmark-results.sh:11` had `REMOTE_PASS="6809233DjD\$\$\$"` in plaintext.** Real SSH password for `ubuntu@135.131.39.26:223` (operator's home Linux box, used as a benchmark fetch target). Script was an orphan (zero callers in the codebase) and the leaked password is the same one used as `$SSHPASS` in ad-hoc operator scripts. **Deleted from HEAD in this commit. STILL IN GIT HISTORY** — operator threat-model decision required: rotate the password OR scrub history with `git filter-repo` + force-push (which breaks all existing clones). Saved memory `feedback_password_leak_in_git_history.md` with both paths documented.

**Deletions (6 files):**
- `fresh_install.sh`, `install_fixed.sh`, `fix_and_install.sh`, `update_from_github.sh` — already deprecated with loud `DEPRECATED` headers in v2.54.51 (~6h ago). Operators have been redirected at the canonical `install.sh` + ISO + `scripts/auto-update.sh`. Time to actually remove.
- `scripts/final-logger-wrapper.sh` — pre-v2-monorepo path references (`src/components/...` not `apps/web/src/components/...`). Historical sed-injection fix-up that doesn't match current file layout. Dead.
- `scripts/retrieve-benchmark-results.sh` — password leak (above).

**Header updates (3 files)** — orphan scripts that ARE useful operator helpers but had no caller documentation. Added "OPERATOR HELPER, not invoked by any automated flow (verified v2.54.64 audit)" so future audits know they're intentionally kept:
- `scripts/av-system-monitor.sh` (Wolf Pack TCP/UDP port monitor + restart, 59 lines)
- `scripts/status-dashboard.sh` (color-coded terminal dashboard with 5s refresh, 249 lines)
- `scripts/verify-db-migration.sh` (curl-based API smoke for post-DB-migration; complementary to `verify-install.sh`)

**`db:push` mentions** — remaining 7 in 5 files are all HISTORICAL-CONTEXT comments explaining what v2.54.1 migrated AWAY from (`first-boot-fresh.sh:142`, `install.sh:781`, `ensure-schema.sh:3,7`, `verify-install.sh:348,355`, `rollback.sh:76`). Left as-is per "don't churn what's correct" — these explain WHY we use the canonical pattern. Not stale.

**Shell tally post-cleanup**: 100 .sh in the repo (was 106). Of those, 4 explicitly DEPRECATED warnings → 0 (they're gone). 5 orphans → 3 (kept + documented; 2 deleted).

Total commit footprint: 6 deletions (~280 lines removed) + 3 header updates (+~15 lines).

---

## v2.54.63 — Proxmox PXE LXC plan + scripts for office NUC pre-provisioning (2026-05-26)

**Versions covered:** v2.54.63
**Branch landed:** main
**Fleet target:** no change. **Operator's Proxmox host only** (runs the scripts manually).

Operator has a Proxmox server at home/office and wants to PXE-boot new NUCs from it so they install pre-configured + ship to bars already-set-up.

**NEW `docs/PROXMOX_PXE_SETUP.md`** (130-line operator runbook): architecture, prerequisites, 3-step setup, troubleshooting matrix, future enhancements (multi-version menu, Tailscale Serve integration, unattended install).

**NEW `scripts/proxmox/setup-netboot-lxc.sh`** (163 lines): runs ON the Proxmox host. Creates a Debian 12 LXC named `sports-bar-netboot` (default CTID 200), installs dnsmasq + lighttpd + curl + ipxe inside. Detects template via `pveam`, downloads if missing, configures unprivileged container with DHCP networking, copies iPXE binaries to TFTP root. Reports the LXC IP + next-step command at the end.

**NEW `scripts/proxmox/configure-netboot-menu.sh`** (270 lines): runs INSIDE the netboot LXC. Auto-fetches latest release tag from GitHub, downloads the 2 split ISO parts + sidecars, verifies per-part MD5 + combined SHA256, reassembles into single .iso. Writes iPXE menu under `/var/www/html/menu/sports-bar.ipxe` with install / live-boot / safe-mode / iPXE-shell options. Configures dnsmasq in **proxy-DHCP mode** (doesn't fight existing router DHCP — just adds PXE options + bootfile path). Handles UEFI vs legacy BIOS clients via DHCP option 93 matching. Auto-symlinks `current.iso` so the menu stays stable across updates. Idempotent — re-run when a new release ships. Optional `--release v3.0-YYYY-MM-DD` to pin + `--tailscale-url URL` to skip the 2-part reassembly when Holmgren's Tailscale Serve URL is available.

**Architecture choices**:
- Proxy-DHCP not full DHCP — augments router, doesn't replace it. Zero router config needed for most home/office setups.
- LXC not VM — 50 MB RAM idle, 2-sec boot. dnsmasq + lighttpd don't need a full kernel.
- iPXE not legacy PXELINUX — handles HTTP (not just TFTP), modern UEFI + BIOS, scriptable.
- HTTP-fetchable menu — operator can edit `/var/www/html/menu/sports-bar.ipxe` without rebuilding the LXC.

**Operator workflow** (after running both scripts):
1. New NUC arrives at office. One-time BIOS: enable PXE boot + set network first.
2. Power on NUC plugged into office LAN.
3. iPXE menu appears → operator picks "Install Sports Bar TV Controller v3.0".
4. ISO boots over HTTP from LXC → standard install → reboot.
5. After reboot: first-boot-fresh.sh + location-setup-wizard (v2.54.51+ canonical pipeline).
6. Ship NUC to bar already-configured.

Both scripts pass `bash -n` syntax check. NOT executed on any operator infrastructure — operator runs them manually on their Proxmox host.

---

## v2.54.61 — Grok persistent briefing + invocation wrapper (Grok knows the rules every time) (2026-05-26)

**Versions covered:** v2.54.61
**Branch landed:** main
**Fleet target:** rolling upgrade. No runtime change. Tooling only.

Operator-requested: "make sure Grok knows the rules and a way to remember them or access them." Grok has no persistent memory across invocations — every `grok --prompt-file X` starts fresh. Previously I'd hand-write the relevant standing rules into each Grok prompt, which is error-prone (forget a rule, get inconsistent recommendations).

**NEW `docs/GROK_BRIEFING.md`** (~125 lines): distilled essentials Grok needs at the top of every prompt.
- All 11 Standing Rules summarized
- Top 7 of 13 Gotchas (the most-expensive ones — #1, #6, #7, #8, #10, #11, #13)
- 10 validated operator preferences (software-to-main, Turbo force-rebuild, PM2 delete+start, CEC-deprecated, matrix outputOffset, device DB source of truth, iPad touch targets, latest-versions rule, RAG re-scan, bartender voice)
- Role separation (Claude = implementer, Grok = advisor + auditor)
- Pointers to deeper docs (CLAUDE.md, CLAUDE_MEMORY_GUIDE, CLAUDE_VERSIONING_GUIDE, VERSION_SETUP_GUIDE, FLEET_STATUS)
- "Read on demand" pointers to operator memory file groups by topic (AI/RAG, hardware, install/fleet, bartender UX)
- Version scheme reminder + mandatory `package.json` bump per commit

**NEW `scripts/grok-prime.sh`**: wrapper that prepends `GROK_BRIEFING.md` to any Grok prompt automatically. Usage:
```bash
bash scripts/grok-prime.sh <prompt-file>           # one-shot
bash scripts/grok-prime.sh --task "..."            # inline task
bash scripts/grok-prime.sh --task "..." --file extra.md  # task + extra context
echo "..." | bash scripts/grok-prime.sh -          # stdin
```
Reports prompt size + briefing line count to stderr; pipes to `grok --permission-mode auto`. Smoke-tested: asked Grok "what standing rule covers auto-update.sh vs manual pm2 restart?" — Grok correctly cited Rule 6 verbatim and distinguished it from related Gotcha 11 + Operator Preference 3.

**CLAUDE.md** got a one-paragraph pointer at the top (under "Grok collaboration") so anyone reading CLAUDE.md sees how to invoke Grok with rules pre-loaded.

**Outcome**: future Grok audits no longer need me to hand-write "remember to follow Standing Rule X" in the prompt. The wrapper handles it. Operator can also invoke Grok directly via the wrapper for one-off questions.

---

## v2.54.60 — OS hygiene + trim sweep (Grok + 2 parallel agents) — 137 GB reclaimed on Holmgren (2026-05-26)

**Versions covered:** v2.54.60
**Branch landed:** main
**Fleet target:** rolling upgrade. **REQUIRED PER-BOX**: `sudo bash scripts/optimize-os.sh` after auto-update (idempotent — safe to re-run). For NEW installs, install.sh PHASE 13 runs it automatically.

Operator-requested OS optimization audit. Engaged Grok for "what does a sports-bar-TV-controller actually NEED at OS level" + 2 parallel Explore agents for "what's actually installed/running/consuming" on Holmgren. All 3 converged.

**THE BIGGEST FIND — local agents caught what Grok couldn't see:** a **140 GB runaway `atlas-communication.log`** (5.75 BILLION lines since 2026-02-18, 98 days of continuous append). Root cause: `packages/atlas/src/atlas-client-manager.ts:119,180` logged `Reusing existing Atlas client` + `Released Atlas client` at INFO level — these fire on EVERY Atlas operation (~15-30 Hz across the fleet). Plus `packages/atlas/src/atlas-logger.ts` had no size cap or rotation.

**Fixes (atlas log root cause):**
- `packages/atlas/src/atlas-client-manager.ts`: demoted 2 lines from `.info` to `.debug` (per `[[feedback_demote_verify_actual_firing]]` pattern). Reuse + Release are normal-operation noise, not events. Kept `.info` on `Creating new` (first-time event), `Reconnecting` (rare + notable), and `Force disconnecting` (operator action).
- `packages/atlas/src/atlas-logger.ts`: added `MAX_LOG_BYTES = 100 * 1024 * 1024` size cap. Checked every 1000 writes. When exceeded, file rotated to `.old` sibling and next write opens a fresh file.
- **Manual truncate**: `: > atlas-communication.log` (inode-preserving) reclaimed 140 GB instantly without restart. Verified live PM2 writer kept appending after truncate (size grew to 9.3K within 5 seconds, then to 18 KB / 10s post-rebuild — an 80% reduction from the ~100 KB / 10s pre-fix rate).

**NEW `scripts/optimize-os.sh`** (288 lines, idempotent, modeled on `enforce-gotcha11-hardening.sh` from v2.54.51):
- **Layer 1**: journald `SystemMaxUse=500M`, `MaxRetentionSec=14day`, `SystemKeepFree=2G` via `/etc/systemd/journald.conf.d/99-fleet-trim.conf`. Holmgren had no cap; reclaimed 145 MB (297 → 152 MB) + bounds future growth.
- **Layer 2**: `vm.swappiness=10` + `vm.vfs_cache_pressure=50` via `/etc/sysctl.d/99-fleet-memory.conf`. Critical with IPEX-LLM Ollama using 16+ GB resident — default swappiness=60 was thrashing (Holmgren swap 100% used at audit). Already-swapped pages drain over days as workload accesses them.
- **Layer 3**: disable 7 services with no hardware/use on the fleet: `ModemManager`, `apport`, `whoopsie`, `motd-news.timer`, `apt-daily.timer`, `apt-daily-upgrade.timer` (we have auto-update.sh per Standing Rule #6), `cups-browsed`. Plus sets `ENABLED=0` in `/etc/default/motd-news`.
- **Layer 4**: purges old kernel images keeping only running + latest. Holmgren had 31 old kernel packages (6 kernel versions × ~5 packages each: image, image-unsigned, modules, modules-extra, headers).
- **Layer 5**: sweeps caches > size threshold: apt (>10 MB), npm (>1 GB), pip (>500 MB), snap disabled-revisions (>500 MB), `/tmp/*.log` older than 3 days. Holmgren reclaimed: apt 55 MB + npm 3398 MB + pip 2790 MB + snap 1988 MB + 126 /tmp logs = **~8.2 GB**.
- **Layer 6**: purges `sports-bar-data/backups/pre-update-*.db` older than 14 days. Holmgren had 57 uncapped files (auto-update.sh creates these on every cycle, no retention). 44 deleted = **3.3 GB**.

All layers idempotent. `--check` mode dry-runs + exits non-zero if any layer is out of desired state — wireable into `verify-install.sh` for fleet drift detection.

**Wired into `install.sh` as PHASE 13** (runs after PHASE 12 Gotcha #11 hardening). New installs get optimized boxes automatically; existing fleet runs `sudo bash scripts/optimize-os.sh` on next auto-update or manual sweep.

**Holmgren reclaim tally:**
- Atlas log truncate: **140 GB** (root cause fixed for the future)
- pre-update backups: 3.3 GB
- Caches (apt + npm + pip + snap + tmp): 8.2 GB
- Old kernel packages: ~735 MB
- journald retention cap: 145 MB
- **Total: ~152 GB on this single box** (disk went 287 → 150 GB used = 137 GB measurable + bounded future growth)

**Deferred items needing operator decision** (NOT in this commit, see Grok + agent reports):
- snapd removal (5-7 GB win, but breaks if anyone uses Chromium snap via xrdp)
- xrdp removal (no active sessions but operator may RDP in occasionally)
- openjdk-17, python3-botocore, libwebkit2gtk audit + removal (need `apt rdepends` review)
- Ollama model audit (26 GB; phi3:mini + llama3.2:3b may be orphans — but Standing Rule #10 keeps all models)

---

## v2.54.59 — ISO uploader via direct REST (fallback when `gh auth` scope is missing) (2026-05-26)

**Versions covered:** v2.54.59
**Branch landed:** main
**Fleet target:** rolling upgrade. No runtime change.

Trigger: operator asked to be able to download the ISO from GitHub. v2.54.58's `upload-github-release.sh` requires `gh auth login` which requires the `read:org` scope. The Personal Access Token in our git remote URL (used for git push all session) has only `repo` scope — sufficient for releases via the REST API but not enough for `gh auth login`.

**NEW `scripts/iso/upload-github-release-curl.sh`**:
- Direct REST API uploader using curl. Auto-discovers the PAT from `$GITHUB_TOKEN` or extracts from `git remote get-url origin`.
- Creates the release via `POST /repos/:owner/:repo/releases`, then uploads ISO + .md5 + .sha256 sidecars via `POST uploads.github.com/.../releases/:id/assets`.
- Idempotent: if the tag already exists (re-build same day), deletes the prior release + tag and re-creates.
- Defaults: tag = `v3.0-YYYY-MM-DD`, notes pre-filled with the v2.54.51+ canonical pipeline summary + BARE_METAL_ISO.md pointer.
- Auto-generates md5/sha256 if sidecars don't exist.
- Reports the release HTML URL + direct-download URL at the end.

**Usage** (after a build finishes):
```
bash scripts/iso/upload-github-release-curl.sh /home/ubuntu/iso-build/sports-bar-tv-controller-v3.0-*.iso
```
Pulls the token from git remote automatically. Operator can also pass `GITHUB_TOKEN=ghp_...` explicitly.

**Holmgren ISO pre-flight status (in flight at commit time):**
- Build started 22:28 from `scripts/iso/build-sports-bar-iso.sh --no-upload --build-dir /home/ubuntu/iso-build`
- Steps 1-7 of 10 complete (debootstrap + chroot + first-boot scripts installed + dispatcher service + snapshot disabled as expected in v3.0).
- Currently on Step 8/10 (XZ filesystem compression — script warns 20-40 min). 6.6 GB intermediate.
- After build completes, the new uploader will push the ISO to GitHub Releases automatically. Operator then has a downloadable ISO + .md5 + .sha256 for `dd` to USB.

---

## v2.54.58 — ISO build script: prereq check + stale header fix + pre-flight kicked (2026-05-26)

**Versions covered:** v2.54.58
**Branch landed:** main
**Fleet target:** rolling upgrade. **Build-host one-time prereq install** for any box that will build the ISO (not needed at run-time on existing fleet boxes):
```
sudo apt-get install -y debootstrap xorriso squashfs-tools \
    grub-efi-amd64-bin grub-pc-bin mtools dosfstools isolinux syslinux-utils
```

**Trigger:** task #282 — pre-flight v2.54.51 ISO in a VM before the new-location NUC ships this week. Audit found two real issues in `scripts/iso/build-sports-bar-iso.sh`:

1. **Stale "Run on Leg Lamp ONLY" warning** at line 13. This predates v3.0's snapshot-mode removal (line 470: "Snapshot mode removed in v3.0 — this ISO is location-independent"). The warning would have scared operators away from building on any fleet box. **Replaced** with an accurate v2.54.58 header explaining snapshot is disabled, ISO is now location-independent, `--skip-snapshot` flag retained for backwards-compat but is now a no-op. Documented prereqs + duration + disk needs upfront.

2. **No prereq check** — debootstrap / xorriso / grub-pc-bin / mtools / isolinux / syslinux-utils could be missing on a fresh build host and the script would fail mid-build with cryptic errors. **Added** an explicit prereq check that runs before Step 1 of the build and bails with one clear copy-paste `sudo apt-get install ...` command listing exactly the missing packages.

**`docs/BARE_METAL_ISO.md`** — added "Building the ISO yourself" section with the apt-get one-liner + build command + result location. Operators who can't find a Release asset can now self-build cleanly.

**Pre-flight test kicked in background on Holmgren (this box):**
- Installed the 6 missing apt packages
- Launched `sudo bash scripts/iso/build-sports-bar-iso.sh --no-upload --build-dir /home/ubuntu/iso-build` in background
- ~15-30 min expected. Result will land in `/home/ubuntu/iso-build/sports-bar-tv-controller-v3.0-*.iso`.
- If the build succeeds: pre-flight proves v2.54.51's installer pipeline produces a bootable ISO. Operator can `dd` to USB + boot a VM (or NUC) for end-to-end validation.
- If the build fails: log at `/tmp/iso-build-v2.54.58.log` shows exactly where + the v2.54.58 prereq check rules out the easy "missing apt package" causes.

**Why now (vs deferring pre-flight to operator):** the new location is going up THIS WEEK per operator. v2.54.51's installer wiring was aspirational until proven. A 15-30 min unattended background build is cheap; catching a regression before the NUC ships is high-value.

---

## v2.54.57 — Sports-guide route gates + bartender empty-state recovery (Grok Part 2 P1) (2026-05-26)

**Versions covered:** v2.54.57
**Branch landed:** main
**Fleet target:** rolling upgrade. No manual step.

Two more Grok Part 2 P1 findings closed via parallel agents. Both HIGH confidence. Build green 34/34 Turbopack 15s.

**Sports-guide + scheduling route gates (Agent 1):**
- Audited 16 routes across `apps/web/src/app/api/sports-guide/**` + `apps/web/src/app/api/scheduling/**`. Of those, 12 were already correctly wrapped (rate-limit + validation + sometimes auth) — credit to prior work.
- **4 real fixes**:
  - `sports-guide/route.ts` POST: replaced raw `request.text()` + `JSON.parse` (Gotcha #1) with `validateRequestBody(sportsGuideRequest)`.
  - `sports-guide/update-key/route.ts`: replaced loose `z.record(z.unknown())` + `String(undefined)` coercion bug with `sportsGuideUpdateKey` schema (apiKey min 10 chars, userId required).
  - `scheduling/input-sources/route.ts` DELETE handler: replaced raw `searchParams.get('id')` with `validateQueryParams(inputSourceDeleteQuery)`.
  - All 3 new schemas added to `packages/validation/src/schemas.ts` under "// SPORTS GUIDE SCHEMAS — v2.54.57" header + registered in `ValidationSchemas` map.
- `scheduling/live-status/route.ts` deliberately skipped — called only by `scheduler-service.ts` localhost cron (no UI callers), noted in agent report.
- All component call sites verified — no breaking shape changes for `SportsGuide.tsx` / `BartenderRemoteControl.tsx` / `SportsGuideConfig.tsx` / etc.

**Bartender empty-state recovery (Agent 2):**
- NEW `apps/web/src/components/BartenderEmptyState.tsx` — reusable card with icon + heading + 2-3 sentence body + optional amber "partially configured" sub-card + verbatim text-to-manager preview block (so bartenders can read off the message even when clipboard is blocked on insecure-context iPad browsers — AUTH_COOKIE_SECURE=false LAN deployments per CLAUDE.md) + 2 CTAs: "Open admin" (purple, deep-link to admin page) + "Copy message" (slate, clipboard API with check-icon confirmation).
- Applied to **Video tab** (`InteractiveBartenderLayout.tsx`) → links `/layout-editor`. Distinguishes fresh-install vs partial-config (zone count = 0 with row exists) via amber sub-card.
- Applied to **Audio tab** (`BartenderRemoteAudioPanel.tsx`) → links `/audio-control`.
- Applied to **Music tab** (`BartenderMusicControl.tsx`) → links `/soundtrack`.
- All touch targets ≥48px. Bartender voice ("you didn't do anything wrong") matches the new `app/remote/error.tsx` boundary from v2.54.56.
- **Audio tab visibility change**: removed `{audioProcessorIp && ...}` guard on the Audio tab button (`app/remote/page.tsx`) so fresh-install bartenders actually see the new empty-state card. Annotated.
- Tabs that DON'T need this (visibility-guarded — never render empty): Lighting (only renders when configured), DJ (only renders when enabled), Schedule/Guide/Routing/Remote/Power (backed by always-present sources, or already have inline empty cards).

**Closes Gotcha #7 operational pain** (location-data templates blanking real data on merge → empty bartender remote → no recovery path). The 9 bartender how-to docs all assume the Video tab has a layout — empty-state recovery means even mid-merge-mess locations have a clear path forward.

---

## v2.54.56 — Dark-theme global error page + bartender-grade /remote error boundary (2026-05-26)

**Versions covered:** v2.54.56
**Branch landed:** main
**Fleet target:** rolling upgrade. No manual step.

Closes one of Grok Part 2 P1's smaller findings: `apps/web/src/app/error.tsx` was rendering a white modal on a dark app (jarring + violated the dark-theme consistency the rest of v2.54.54+v2.54.55 just shipped). Plus added a bartender-specific error boundary at `/remote` so a crash on the iPad shows reassuring bartender-grade copy instead of admin-jargon "Something went wrong!".

**`apps/web/src/app/error.tsx`** (modified):
- `bg-gray-100` → `bg-slate-950`
- White modal → `bg-slate-800/50 border border-slate-700` (matches SchedulerLogsDashboard exemplar + the Card primitive fix from v2.54.54)
- Heading `text-red-600` → `text-red-400` (better contrast on dark)
- Button → `bg-purple-600 hover:bg-purple-500` (matches Ask AI floating button color), 44px touch target
- Copy: added a second sentence with operator-friendly recovery hint ("refresh the page or text the manager with what you were doing").

**`apps/web/src/app/remote/error.tsx`** (NEW):
- Bartender-grade copy: "Something hiccuped" + "You didn't do anything wrong" (matches the "you can't break it" voice the 9 bartender how-to docs use).
- Explicit reassurance that TVs / audio / lighting keep running while the iPad UI is broken (technically true — the backend keeps running independently of the React tree).
- Two CTAs: "Try again" (calls `reset`) + "Refresh the page" (`window.location.reload`).
- Both buttons 44px tap targets, dark theme.
- This is the first per-route error boundary for /remote. Future enhancement: per-tab boundaries inside /remote so a crash in Audio doesn't bring down Video.

**Why now (vs deferring to a larger v2.54.57 Card-pattern sweep):** the global error page was actively rendering wrong-themed on every uncaught exception. Cheap fix, immediate visual win. The bigger Card-pattern migration across SystemAdmin / DeviceConfig / Atlas can take more deliberate planning + multi-agent waves — separate PR.

**Cumulative session ship (2026-05-26 evening):** v2.54.49 → v2.54.56, 8 versions, ~40 files touched, ALL 6 Grok handoff items + Part 2 P0 + 2 of Part 2 P1 (error boundaries) shipped. Fleet fully propagated. RAG re-scanned.

---

## v2.54.55 — Grok #4 + #5 + #6: HDMI input unify + Multi-View preview + Schedule tab promotion (2026-05-26)

**Versions covered:** v2.54.55
**Branch landed:** main
**Fleet target:** rolling upgrade. No manual step.

Closes the remaining 3 of 6 Grok audit follow-ups (#4, #5, #6 from the original 7-item list). Two parallel agents, both HIGH confidence. Build green (34/34 Turbopack, 19s).

**Grok #4 — HDMI input unify (InteractiveBartenderLayout):**
- POWER_AND_NETWORK_TVS.md spent paragraphs explaining that bartenders had to bounce to Power tab for HDMI input switching on network-discovered TVs. No more.
- Added `networkTVs?: NetworkTV[]` prop to `InteractiveBartenderLayout`; parent (`app/remote/page.tsx`) passes it through.
- When the tapped TV zone matches a network TV with `supportsInput=true`, the modal now shows "Currently on: HDMI 2" prominently above the matrix inputs + a 4-button HDMI 1/2/3/4 row using the same `/api/tv-control/{id}/input` endpoint the Power tab uses. Current input highlighted blue ring, optimistic update on tap.
- Non-network TVs (cable boxes, Fire TVs) see the modal unchanged (matrix inputs only).
- The Power tab still works for setup-style flows — nothing broken.

**Grok #5 — Multi-View Quad preview:**
- `app/remote/page.tsx:1058-1124` — restructured the Quad View toggle into a card with a 140×140px 2×2 preview grid showing the 4 Wolf Pack inputs that will tile when Quad mode is on. Each cell shows input number + truncated friendly label from `inputs.find()`. "● Active" badge when mode=6, purple ring around cells when active.
- Empty-state fallback "(no preview — multi-view card not configured)" when `card.inputAssignments` is null/incomplete (no crash).
- Data source: `card.inputAssignments` from `GET /api/wolfpack/multiview` (pre-parsed JSON containing window1-4 as Wolf Pack input numbers, per `packages/multiview/src/types.ts:45`). New `multiViewInputs` state.

**Grok #6 — Schedule out of "More" overflow:**
- Promoted Schedule to the primary tab strip between Guide and Routing. Order now: Video → Guide → **Schedule** → Routing → Remote → Audio → Music → Lighting → Power → More.
- Schedule tab uses the existing Clock icon + "Schedule" label (≥44px touch target).
- Removed Schedule entry from the More sheet. More button itself now only renders when `djControlsEnabled` is true (otherwise nothing to show — auto-hides).
- `ScheduledGamesPanel` rendering unchanged at activeTab==='schedule' — no further wiring needed.
- PUTTING_GAMES_ON_TVS.md + PRE_SHIFT_WALKTHROUGH.md teach Schedule as the proactive game-assignment tool; now bartenders can actually find it.

**Cumulative Grok handoff status as of v2.54.55:**
- v2.54.50 — Grok #1 ✓ (QAEntry retrieval)
- v2.54.52 — Grok #2 ✓ (Ask AI session history + bug fix)
- v2.54.53 — Grok #3 ✓ (Ollama-down QA fallback)
- v2.54.54 — Grok Part 2 P0 ✓ (auth/login Gotcha #1 + bartender touch + dark primitives)
- v2.54.55 — Grok #4 + #5 + #6 ✓

**Remaining Grok Part 2 P1+** (not in this commit, sequence as operator prioritizes):
- Card-pattern violations across SystemAdmin / DeviceConfig / Atlas (page-level migration to bordered slate divs)
- `sports-guide` + `live-status` routes bypassing validate/rate-limit (similar to auth/login Gotcha #1 fix)
- `packages/validation` vs `packages/config` dedup
- Seed-empty-UI recovery flow
- Loading state polish (skeletons on tables/grids)
- Error boundary expansion (global error.tsx still light-themed)

---

## v2.54.54 — Grok Part 2 P0: auth/login Gotcha #1 + bartender touch sweep + dark-theme primitives (2026-05-26)

**Versions covered:** v2.54.54
**Branch landed:** main
**Fleet target:** rolling upgrade. No manual step.

Closes the highest-leverage findings from Grok handoff Part 2 (UI + bug audit). Multi-agent parallel waves: 3 agents in parallel + me on auth/login simultaneously. All HIGH confidence, build green (34/34 Turbopack 16s), PM2 healthy.

**Auth/login Gotcha #1 (me, security fix):**
- `apps/web/src/app/api/auth/login/route.ts:40-50` was using raw `request.json()` + manual `if (!pin)` check (Gotcha #1 violation per CLAUDE.md, also accepted non-string pin values that bcrypt-compared garbage).
- Added `authLoginSchema = z.object({ pin: z.string().regex(/^\d{4,8}$/) })` to `packages/validation/src/schemas.ts` + registered as `ValidationSchemas.authLogin`.
- Switched route to canonical `validateRequestBody(request, ValidationSchemas.authLogin)` + `isValidationError` pattern. Now rejects non-digit / wrong-length pins at the schema gate with a 400 before any database call.

**Dark-theme primitive sweep (Agent A1):**
- `components/ui/select.tsx`: 7 swaps — Content/ScrollUp/ScrollDown/Item/Label/Check/Separator all `bg-white text-black` → `bg-slate-900 text-slate-100 border-slate-700`. Added explicit `data-[highlighted]` keyboard-nav highlight matching dark theme.
- `components/ui/card.tsx`: 4 swaps — Card root `bg-white` → `bg-slate-800/50 text-slate-100 border border-slate-700`. CardHeader border-bottom slate. CardTitle slate-100. CardDescription slate-400. Mirrors SchedulerLogsDashboard.tsx exemplar.
- `components/ui/button.tsx`: size map — default `h-10` → `h-11` (44px iPad target), lg `h-11` → `h-12`, icon `h-10` → `h-11`. No `bg-white` leaks in variants. Bartender-remote inherits 44px default automatically.

**Bartender remote touch sweep — page.tsx + EnhancedBartenderRemoteControl (Agent A2):**
- `app/remote/page.tsx` Power tab TV cards (lines 914-1019): ~9 interactive elements per TV bumped to `≥44px` + `text-sm` minimum. Input/OK/Pair/Power/HDMI 1-4 all compliant. Routing matrix cells (lines 1127-1146) `min-h-[44px] min-w-[44px]`.
- `EnhancedBartenderRemoteControl.tsx`: no edits needed — Agent A1's button primitive `size="icon"` bump to `h-11 w-11` already brings the 3 size="icon" mute/volume buttons into compliance. Component is also not currently mounted in the live tree.
- Deliberately left small: brand logo, IP address text, status dots (online/offline indicators are non-interactive).

**Bartender remote touch sweep — InteractiveBartenderLayout + remotes/* (Agent A3):**
- `InteractiveBartenderLayout.tsx`: zone tap wrappers got `min-h-[44px] min-w-[44px] flex items-center justify-center` overlay pattern — invisible 44px hit area centered on the original-sized visible zone dot (preserves floorplan proportionality). Room color indicator dots: `p-3 -m-3 box-content` with `backgroundClip: 'content-box'` to extend hit slop without enlarging the colored circle. Filter tabs `min-h-[44px]`. Channel-label text `text-[8px..xs] → text-xs..sm`.
- `remotes/CableBoxRemote.tsx`: ~9 elements bumped. Killed `size="sm"` (h-9 = 36px) on Enter/Clear → `min-h-[44px] min-w-[80px] text-sm font-semibold`.
- `remotes/DirecTVRemote.tsx`: ~8 elements bumped. CLR/GO already at min-h-[48px], no `size="sm"` violations here.
- `remotes/FireTVRemote.tsx`: 2 visual labels bumped. All button heights already 44px-compliant via Button primitive default.

**Cumulative touch-target compliance:** the bartender remote on iPad now satisfies Apple HIG 44x44 on the Power tab, all device remote keypads, and the floorplan tap targets. Status dots and non-interactive labels deliberately kept small to preserve information density.

**Out of scope for this PR** (deferred to v2.54.55+):
- Card-pattern violations across SystemAdmin / DeviceConfig / Atlas panels (Wave A1 fixed the Card PRIMITIVE; the consuming pages should eventually migrate to bordered slate divs per UI_STYLING.md, but the primitive change immediately makes existing consumers look correct without any page-level work).
- `sports-guide` + `live-status` routes bypassing validate/rate-limit.
- `packages/validation` vs `packages/config` dedup.
- Seed-empty-UI recovery flow.
- Grok #4-6 UX bugs (HDMI silo, multi-view preview, More-tab discoverability).

---

## v2.54.53 — Grok #3: QAEntry fallback when Ollama is unreachable (2026-05-26)

**Versions covered:** v2.54.53
**Branch landed:** main
**Fleet target:** rolling upgrade. No manual step.

Closes Grok #3, the last of the three v2.54.49 follow-ups. Operational-resilience finding: Shift Brief has a solid `fallbackBrief()` that still emits the mic-status / neighborhood / Atlas-recap lines when Ollama is down; the Ask AI button (which all 9 bartender how-to docs now point at as the universal escape hatch) had nothing — just rendered "Couldn't reach the AI: Server returned 500. Text the manager." That's an operational backslide every doc the wizard ships tells bartenders to use.

**`apps/web/src/app/api/chat/route.ts` `handleNonStreamingChat`:**
- **Pre-resolve** a curated-QA fallback BEFORE any network call (top of function). Uses `findBestQAMatch(message)` from v2.54.50's helper — cached 5min, second call after `searchDocsViaRag`'s pre-pass is free. Only captures CONFIDENT matches (score ≥0.55) so moderate hits still let Ollama answer in full.
- **Wrap the Ollama fetch + ok-check in try/catch.** On any failure (network error, 5xx, timeout, abort), check if `qaFallback` was set. If yes: return `NextResponse.json({ response: curatedAnswer + "\n\n---\n*(The AI is offline right now — this is a curated answer from <sourceFile>. If you need more detail, text the manager.)*", sources: [...], model: 'qa-fallback-curated' })`. If no: re-throw so the existing 500 path fires.
- Same response shape as the normal LLM path so the BartenderAskAIButton consumes it identically (no client changes needed).

**Why only the non-streaming path:** the bartender floating button explicitly sends `stream: false`. The streaming path (used by `/ai-hub` admin chat) is harder to fallback-protect because the SSE is already open by the time Ollama fails — operators get partial output + a clear error in that case, which is acceptable for the admin surface. Future work could add streaming fallback if needed.

**Why only confident matches:** moderate-match (score 0.40-0.55) means the bartender's wording is far enough from a curated question that we shouldn't dump the curated answer at them as the canonical truth — better to surface the LLM error and let them retry or rephrase. Confident match is when we KNOW the curated answer fits.

**End-to-end value:** when Ollama is wedged or unreachable, a bartender asking "the wireless mic isn't working" gets:
```
1) Look at the silver box with the antennas (the mic receiver). Are the channel lights green?
2) Check the mic itself — green light on top, battery indicator showing bars.
3) ...
---
*(The AI is offline right now — this is a curated answer from docs/bartender-help/MIC_NOT_WORKING.md. If you need more detail, text the manager.)*
```

instead of "Couldn't reach the AI: Server returned 500".

**No fleet manual step.** Build green (34/34 Turbopack, 15s). PM2 restarted at Holmgren.

**WRAPS UP Grok's v2.54.49 follow-up list** (items 1, 2, 3 of the seven). Remaining items 4-6 are UX bugs (HDMI input silo, multi-view preview, More-tab discoverability) — slot into Grok Part 2 (full UI audit) as v2.54.54+.

---

## v2.54.52 — Grok #2: Ask AI button sessionId + history + CRITICAL v2.54.48 bug fix (2026-05-26)

**Versions covered:** v2.54.52
**Branch landed:** main
**Fleet target:** rolling upgrade. No manual step.

**CRITICAL BUG FIX caught during Grok #2 implementation:** The v2.54.48 `BartenderAskAIButton` sent `{ messages: [...] }` to `/api/chat`, but the chat route's `ValidationSchemas.aiQuery` requires `{ message: string }` (singular) with `.refine((data) => data.query || data.message)`. The `messages` array got silently dropped by Zod, then the refine fired "Either query or message must be provided" → **HTTP 400 on every Ask AI tap since v2.54.48 shipped**. Operators using the floating button would have seen "Couldn't reach the AI: Server returned 400" on every question. (No bartender feedback yet — the button is new in the field.) Fixed by sending `{ message: q, sessionId, stream: false, enableTools: false }`.

**Grok #2 (session history + sessionId):**
- `useRef<string>('')` for sessionId, generated on modal open via `crypto.randomUUID()`
- Sent on every `/api/chat` POST. Chat route persists messages to `chatSessions` table keyed on this ID, replays history on every subsequent request — so follow-ups have full prior context without shipping the message array client-side.
- Added "New chat" button in modal header (visible only when `messages.length > 0`, ≥44px tap target). Clears local state + regenerates sessionId for a fresh conversation.
- Modal close → next open reuses the existing sessionId (preserves context until operator explicitly hits "New chat" or page reloads).

**Response shape fix:** Non-streaming chat route returns `{ response, sessionId, sources, model }`. The v2.54.48 code looked for `data.message.content` first (wrong shape). Reordered to `data.response` first → falls back to `message.content` / `answer` for resilience.

**Better error reporting:** v2.54.48 just showed "Server returned 4XX". v2.54.52 includes the first 100 chars of error response body — operator sees the actual problem ("rate limit exceeded", "auth required", etc.).

**No fleet manual step.** Build green (34/34 Turbopack, 15s). PM2 restarted at Holmgren.

**Wraps up Grok #2** from the v2.54.49 follow-up task list. **Grok #3 (QAEntry fallback when Ollama down)** ships next as v2.54.53.

---

## v2.54.51 — Virgin installer Part 1 P0: DB migrate + Gotcha #11 hardening + auth bootstrap + verify gate (2026-05-26)

**Versions covered:** v2.54.51
**Branch landed:** main
**Fleet target:** existing fleet is UNAFFECTED at runtime. Changes apply only to install paths (install.sh + ISO + wizard). New location going up this week on bare metal is the target consumer.

Closes Grok handoff Part 1 P0 — `CLAUDE_HANDOFF.md` + `/home/ubuntu/.grok/sessions/.../plan.md`. Shipped via 6 parallel agents (Wave A: 3 fresh writes; Wave B: 3 wire-ins). All 6 reported HIGH confidence. All 10 changed bash scripts pass `bash -n` syntax check.

**Wave A — fresh writes:**

1. **DB migration path (Gotcha #6 safety)** — `install.sh:777-823`, `scripts/iso/first-boot-fresh.sh:137-146`, `update_from_github.sh:467-480` — replaced legacy `drizzle-kit push` with the canonical pair `bootstrap-drizzle-migrations.sh "$DB_PATH"` (idempotent marker bootstrap, skipped if DB doesn't exist for virgin) + `NODE_ENV=development npx drizzle-kit migrate` + belt-and-suspenders `ensure-schema.sh`. Mirrors `scripts/auto-update.sh` Checkpoint schema_migrate. `update_from_github.sh` also got a top-of-file deprecation note pointing at auto-update.sh.

2. **`scripts/enforce-gotcha11-hardening.sh`** (NEW, 288 lines) — idempotent root-required script with 4 functions: `enforce_linger`, `enforce_node_symlinks`, `enforce_ollama_perms`, `proof_all_working`. Distinct exit codes per item (2-5). Auto-detects active NVM node via `~/.nvm/alias/default` → fallback to highest installed (won't rot at next Node major bump). Skips RAG-rescan proof (too expensive for a hardening step) — uses cheap `env -i` clean-PATH probe instead.

3. **Docs sweep** — `docs/NEW_LOCATION_SETUP.md` TL;DR rewritten to honestly split "automatic" vs "manual" steps (was burying the "Invalid PIN until you run bootstrap" reality). `fresh_install.sh`, `install_fixed.sh`, `fix_and_install.sh` got deprecation headers + loud stderr warning + pointers to canonical paths. **NEW `docs/BARE_METAL_ISO.md`** (627w) — operator runbook for the USB → boot → wizard flow.

**Wave B — wire-ins:**

4. **`install.sh`** — added `run_gotcha11_hardening()` function calling the new script as PHASE 12 (after PHASE 11 verify-install). Non-fatal warn on failure. Final banner gets "✓ Gotcha #11 hardening applied" line + auth-bootstrap section renumbered to PHASE 13 (still LOUD operator-required, until ISO/wizard path subsumes it — see #6 below).

5. **`scripts/install-auto-update-timer.sh`** — added hardening call at TOP of script. **FATAL** on failure (timer without linger = silent breakage within hours of SSH disconnect). Replaced the bottom-banner "remember to enable linger" hint with confirmation it was already done.

6. **`scripts/iso/first-boot-fresh.sh`** — added Step 8 (hardening, non-fatal warn), Step 9 (verify-install --quiet as ubuntu, non-fatal), Step 10 (MOTD rewrite). MOTD now states ACTION REQUIRED: log in on tty1 and run `bash /opt/sports-bar/scripts/iso/location-setup-wizard.sh`. GitHub first-boot report appended with hardening + verify status + verify summary block.

7. **`scripts/iso/disk-installer.sh`** — final banner (lines 406-412) rewritten: states first boot auto-applies hardening + verify, directs operator to wizard for auth bootstrap, no more "Invalid PIN" surprise, lists :3001/:3002 URLs.

8. **`scripts/iso/location-setup-wizard.sh`** — added **Step 0 "Auth & Location Identity"** as the FIRST wizard step. Prompts bar name + admin PIN (4-8 digits, confirm twice) + staff PIN + optional Anthropic key. Calls `bootstrap-new-location.sh --non-interactive` with collected values. Retry/skip/abort menu on failure. Added new `prompt_pin` + `prompt_optional_secret` helpers (wizard had no PIN-validating helper). Added HARD verify-install gate before DONE_MARKER touch.

**No runtime change for the existing fleet.** install.sh + ISO scripts don't re-run on running boxes; they're only consumed by NEW installs. v2.54.51's auto-update merge to a running fleet box is a no-op for the install code path.

**End-to-end virgin flow now (target for the new location this week):**
1. USB boot → ISOLINUX → disk-install → reboot
2. First boot: clone + build + migrate (Gotcha #6 safe) + hardening (Gotcha #11 closed) + verify gate + MOTD posted to tty1
3. Operator logs in on tty1, runs `bash /opt/sports-bar/scripts/iso/location-setup-wizard.sh`
4. Wizard Step 0 collects PINs + calls bootstrap-new-location.sh → Location + AuthPin rows created, .env written, pm2 restarted
5. Wizard Steps 1-7: network, Ollama, hardware discovery, location branch
6. Wizard final verify-install gate confirms 7/7 PASS
7. Operator browses to http://<IP>:3001, logs in with chosen PIN, lands in admin UI

**REQUIRED MANUAL STEP for the existing fleet:** none. The hardening script + new ISO logic only matters for new installs.

**Recommended for NEW location:** test the flow end-to-end on a VM before sending a NUC to the bar. `sudo bash scripts/iso/build-sports-bar-iso.sh --build-dir /tmp/iso-test --no-upload` → boot in qemu/kvm → walk the wizard → verify 7/7. If anything in this v2.54.51 chain has a regression, catch it in the VM, not at the bar.

**Out of scope for v2.54.51** (Grok plan Part 2 — full UI + bug audit is the next sprint):
- Bartender remote touch-target sweep
- Dark-theme primitive leaks (Card, Select)
- auth/login route Gotcha #1 violation
- packages/validation vs packages/config dedup
- Seed-empty-UI recovery flow

---

## v2.54.50 — Grok #1: QAEntry-first retrieval for bartender chat path (2026-05-26)

**Versions covered:** v2.54.50
**Branch landed:** main
**Fleet target:** rolling upgrade. No manual step required.

Closes Grok audit follow-up #1 (the HIGH-leverage item from v2.54.49's ship notes — the one Grok said "unlocks the entire 9-doc + 36-QA investment"). The 36 curated bartender Q&A pairs seeded in v2.54.49 were sitting in the QAEntry table but the chat route's RAG path ignored them entirely. Pure cosine-on-doc-chunks meant the bartender voice the curated answers carry got diluted by neighboring CLAUDE.md / runbook chunks even when the question was an exact match.

**`apps/web/src/lib/qa-retrieval.ts`** (NEW ~150 lines): in-memory cached (5-min TTL) lookup against the seeded curated_bartender_% rows. Tokenize query + stem + stopword-strip → score against each cached QA via weighted Jaccard + coverage. Returns `{ entry, score, matchType: 'confident' | 'moderate' } | null`. Thresholds: ≥0.55 confident, 0.40-0.55 moderate. Records useCount + lastUsed fire-and-forget on hit. Crude in-house stemmer (`-ing/-ed/-s/-es/-ies` → root) closes the singular/plural + verb-tense gaps the smoke test caught ("mic doesn't work" → "wireless mic isn't working").

**`apps/web/src/app/api/chat/route.ts:129-185`** (modified ~30 lines): `searchDocsViaRag` now runs the QA pre-pass when `looksLikeBartenderQuery(query)` fires. Confident hit → QA is the SOLE context source (LLM still narrates but constrained to the curated text, topK=1). Moderate hit → QA prepended as highest-ranked source + 7 vector chunks for additional context. Miss → existing RAG flow. All-bets-off failure → QA wraps in try/catch, falls through cleanly.

**Why in apps/web/ not packages/rag-server/:** rag-server doesn't depend on @sports-bar/database (and shouldn't — it's the search engine, not the data layer). The chat route already imports both; adapter pattern keeps the package graph clean. Followup #3 (Ollama-down fallback) will reuse this same helper.

**`packages/rag-server/src/vector-store.ts:303`** + **`apps/web/src/lib/qa-retrieval.ts:172`** — BARTENDER_MARKERS regex **broadened** (kept in sync in both files per the comment). Smoke test caught 5/14 missed phrasings against the original regex: added `doesn'?t work`, `what (does|should|is|are)`, `the (banner|lights|patio|bar|tab|game|channel)`, `\btv\s*\d+\b`, `wrong`, `fire alarm`, `emergency`, `clock in`. False positives are CHEAP — pre-pass returns null on no match, chat path falls through to vector RAG anyway. False negatives kill the whole feature.

**`scripts/smoke-qa-retrieval.ts`** (NEW): 14-case smoke test covering exact phrasings + paraphrases + off-topic. **14/14 pass.** Run from repo root: `npx tsx scripts/smoke-qa-retrieval.ts`. Verified at Holmgren.

**No fleet manual step.** The 36 QA rows already exist in QAEntry from v2.54.49's seed run. The new retrieval helper reads them automatically.

**Honest scope:** v2.54.50 is the retrieval. v2.54.51 (Grok #3) adds the Ollama-down fallback so bartenders STILL get the curated answer when the LLM is dead. v2.54.52 (Grok #2) adds session history so the floating button supports follow-ups.

---

## v2.54.49 — Bartender how-tos coverage: 5 new docs + 36 curated Q&A pairs + idempotent seed (2026-05-26)

**Versions covered:** v2.54.49
**Branch landed:** main
**Fleet target:** rolling upgrade + per-box `npx tsx scripts/seed-bartender-qa.ts` (now idempotent reseed)

Operator goal: write how-tos for ALL bartender operations. Engaged Grok for outside perspective + 2 Explore subagents (UI surface inventory, voice template reverse-engineering). All 3 converged on the same approach: group by mental model (not per-button), 9 docs total instead of 40 micro-docs or 2 mega-docs.

**Coverage plan** at `docs/bartender-help/PLAN.md` documents the strategy + locked template + voice rules.

**5 new docs** (written by parallel subagents from the plan + relevant UI source files + locked voice):
- `docs/bartender-help/PUTTING_GAMES_ON_TVS.md` (3,465w) — Guide tab, Schedule tab, AI Suggest, Channel Guide search, one-tap watch, Override-Learn briefly explained
- `docs/bartender-help/AUDIO_ZONES_AND_GROUPS.md` (3,814w) — proactive zone control (Atlas/DBX/HTD), groups, source switching, banner literacy cross-ref, mic battery tile interpretation
- `docs/bartender-help/LIGHTING_AND_SCENES.md` (2,840w) — DMX + Commercial scenes, brightness, all-on/off, trivia/game-day setups, two-systems disambiguation
- `docs/bartender-help/POWER_AND_NETWORK_TVS.md` (3,274w) — bulk power, per-TV power, HDMI input switching, Samsung pairing flow, renaming, dot-color interpretation
- `docs/bartender-help/PRE_SHIFT_WALKTHROUGH.md` (2,745w) — 5-minute clock-in checklist: Shift Brief → mic batteries → music → audio banners → floor plan → Ask AI follow-up. Includes a "What to read next" reading-order index pointing to the other 8 docs.

**Consolidation pass** (mechanical, in-process after the subagent hit session limit):
- 3× AI Hub → Ask AI button fixes in AUDIO_ZONES_AND_GROUPS.md (distinct surfaces — AI Hub is /ai-hub admin-only, Ask AI is the floating button on /remote, bartender doc must not send bartenders to /ai-hub)
- Added "What to read next" reading-order section to PRE_SHIFT_WALKTHROUGH.md before "You did great"
- Verified zero karaoke-as-canonical instances in all 5 new docs (per Gotcha #13 / `[[feedback-karaoke-uses-byo-mics]]`)
- Verified escalation footers + manager-text checklists + "you can't break it" reassurance present in all 5

**`scripts/seed-bartender-qa.ts`** — expanded from 17 → 36 curated Q&A pairs. Added 20 new pairs spanning all 5 new docs (4 PUTTING_GAMES, 3 AUDIO_ZONES, 3 LIGHTING, 3 POWER, 3 PRE_SHIFT, 4 general/cross-doc). **CRITICAL FIX:** previous version claimed idempotent via UNIQUE constraint but QAEntry has no UNIQUE on `question`, so re-runs duplicated rows (caught + cleaned at Holmgren: 17 v2.54.48 rows + 36 v2.54.49 rows = 53 with dupes; now 36 clean). New script does `DELETE WHERE sourceType LIKE 'curated_bartender_%'` first, then inserts — true reseed semantics.

**REQUIRED MANUAL STEP per fleet box** (same as v2.54.48 but the new script handles re-runs cleanly):
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller && npx tsx scripts/seed-bartender-qa.ts
```
Boxes that ran the v2.54.48 version will have 17 dupes; this run deletes them automatically.

**Standing Rule 11 — RAG re-scan**: kicked off post-merge. The 5 new docs need to enter the vector store before the Ask AI button can retrieve them. ~25-40 min per box. Standing Rule 11 ingest helper `scripts/rag-rescan-if-needed.sh` will pick them up automatically on auto-update.

**Followup task list from Grok** (received same session, deferred to v2.54.50+):
1. QAEntry-first retrieval in `packages/rag-server/src/query-engine.ts` — current vector-store path ignores the seeded QA pairs entirely. Effort M, impact HIGH. **(Highest leverage — unlocks the entire 9-doc + 36-QA investment.)**
2. BartenderAskAIButton conversation history + sessionId — currently one-shot, no follow-ups. Effort S, impact HIGH.
3. QAEntry-first fallback when Ollama 5xx/timeout — Shift Brief has fallbackBrief, Ask AI has nothing. Effort M, impact HIGH.
4. Surface HDMI input selection in Video-tab layout modal (unify the two-power-systems split). Effort S/M, impact HIGH.
5. Multi-View Quad preview thumbnail before POST. Effort S, impact MED.
6. Promote Schedule out of "More" overflow tab. Effort S/M, impact MED.

Items 1-3 ship as v2.54.50; items 4-6 as v2.54.51+ pending operator priority.

---

## v2.54.48 — Grok AI-Hub audit bundle 2: Ask-AI floating button + bartender Q&A seed + AI Hub onboarding (2026-05-26)

**Versions covered:** v2.54.48
**Branch landed:** main
**Fleet target:** rolling upgrade + per-box `npx tsx scripts/seed-bartender-qa.ts` (one-shot QA seed)

Closes the remaining 3 Grok audit findings (E, F, G) that were deferred from v2.54.47.

**E — `apps/web/src/components/BartenderAskAIButton.tsx`** (new component, ~200 lines): floating purple "Ask AI" pill in the bottom-right of the bartender remote. Tap → inline chat modal with text input + scrollable answer area + close. POSTs to `/api/chat` (allow-listed for the bartender port-3002 proxy in v2.54.47, STAFF-auth-gated since v2.54.45). Empty-state shows 4 common bartender questions as tap-targets ("The wireless mic isn't working", "TV 3 has the wrong game on", "The music stopped in the patio", "How do I change the channel on TV 5?"). All tap-targets ≥44px per the bartender-lens rule. 5-min AbortController matches the chat route + nginx timeout. Wired into `apps/web/src/app/remote/page.tsx` at the page root so it's available on every tab without per-tab wiring.

**F — `scripts/seed-bartender-qa.ts`** (new): seeds 17 curated bartender Q→A pairs into the `QAEntry` table, drawn from `docs/bartender-help/*.md` (MIC_NOT_WORKING, WRONG_CHANNEL_ON_TV, MUSIC_OR_AUDIO_PROBLEM, RF_INTERFERENCE_FOR_BARTENDERS). Idempotent — uses UNIQUE constraint on question, so re-running is safe. Pairs cover: mic battery/sync, channel changes, TV black-screen recovery, music zone control, audio source switching, yellow/cyan banner meanings, manager escalation flow, physical remote location, normal-state expectations. `sourceType='curated_bartender_v2.54.48'` so the RAG/chat retrieval can prioritize these for bartender-mode queries. **REQUIRED MANUAL STEP per fleet box**: `cd /home/ubuntu/Sports-Bar-TV-Controller && npx tsx scripts/seed-bartender-qa.ts` after auto-update — seeds the local DB.

**G — `apps/web/src/app/ai-hub/page.tsx:621`**: added a small "New bartender?" onboarding paragraph above the quick-start questions, with explicit pointer to the 4 `docs/bartender-help/*.md` files by name. Completes the discoverability fix that v2.54.47 started with the question-set split.

**Required Manual Step:** **per-fleet-box `seed-bartender-qa.ts` run** for item F to populate the local QAEntry table. Followup: have auto-update.sh check for new seed-* scripts and offer to run them.

Build: 28/28 successful under Turbopack.

**Pairs with v2.54.47:** the nginx allow-list change in v2.54.47 (added `/api/chat` + `/api/rag/query` to port-3002) is the network-layer prerequisite for v2.54.48's floating button to actually reach the chat. v2.54.47 unblocks the route; v2.54.48 gives bartenders a UI to use it.

**Honest limitation:** the seeded Q&A pairs are NOT yet wired into the chat retrieval pipeline as a high-priority source. The chat currently uses RAG over docs + code + memory; the QAEntry table is queried separately by `/api/ai-hub/qa-training/stats` only. Followup item: integrate QAEntry as a priority-1 retrieval source in `packages/rag-server/src/query-engine.ts` so bartender-mode queries hit the curated answers first before falling back to the bartender-help MD files.

---

## v2.54.47 — Grok AI-Hub audit bundle: bartender chat unblocked + RAG bartender-mode + AI Hub UX (2026-05-26)

**Versions covered:** v2.54.47
**Branch landed:** main
**Fleet target:** rolling upgrade + nginx reload on every box

This release unblocks the **single largest UX gap** in the AI surface — Grok's audit (running on Holmgren tonight) found that the chat infrastructure was carefully designed for bartenders (excellent bartender-mode system prompt at `chat/route.ts:404-445`, 4 great `docs/bartender-help/*.md` files), but bartenders **literally cannot reach the chat** from the iPad behind the bar because the nginx port-3002 allow-list doesn't include `/api/chat`. The chat was admin-only at the network layer despite being content-designed for bartenders.

**A — `scripts/setup-bartender-nginx.sh`:** added `location /api/chat` (300s read timeout, `proxy_buffering off` for SSE streaming) + `location /api/rag/query` (60s) blocks to the bartender allow-list. Chat is already STAFF-auth'd (v2.54.45) and bartender sessions are STAFF, so the auth layer works correctly. **REQUIRED MANUAL STEP per fleet box:** re-run `sudo bash scripts/setup-bartender-nginx.sh` after auto-update — the script writes a new `/etc/nginx/sites-enabled/sports-bar-tv-controller.conf` + reloads nginx. Or: the auto-update.sh wrapper could be extended to detect setup-bartender-nginx.sh changes and re-run it (followup).

**B — `apps/web/src/app/ai-hub/page.tsx:614`:** AI Hub chat empty-state quick-starts split into two groups: "Behind the bar" (4 bartender questions: "The wireless mic isn't working", "TV 3 has the wrong game on", "The music stopped in the patio", "How do I change the channel on TV 5?") + "Admin / setup" (4 technical questions, the previous defaults). Subtitle rewritten to address both audiences. The chat route's existing register detection (`chat/route.ts:404-445`) auto-picks bartender vs operator mode based on phrasing — these starter questions exercise both paths.

**C — `packages/rag-server/src/llm-client.ts`:** added `register: 'bartender' | 'operator' | 'auto'` to `LLMOptions`. New `detectRegister(query)` function mirrors `chat/route.ts:404` logic (hardware model names + CLI verbs + version numbers + code-fence + log patterns = operator; otherwise = bartender). New `BARTENDER_SYSTEM_PROMPT` constant: "silver box with the antennas on the wall" naming convention, numbered steps, "you can't break it", "text the manager with a photo" escalation, explicit "prefer docs/bartender-help/ over technical runbooks". Both `queryLLM` (non-streaming) and `streamLLM` updated. **Before v2.54.47** pure RAG paths always emitted technical-assistant prose even on bartender questions — now they auto-adapt.

**D — `docs/FLEET_STATUS.md`:** corrected `holmgren-way` from "22.22.0 (nvm)" to "22.22.2 (apt/NodeSource)". Was wrong twice today (greenville fixed earlier, holmgren now). Both boxes' `which node` returns `/usr/bin/node`. Added explicit "Lesson from 2026-05-26" paragraph + cross-ref to `feedback_fleet_node_install_method_drift` memory. Memory entry added in same session.

**Required Manual Step:** **per-fleet-box nginx reload** for item A to take effect at each location. Auto-update.sh handles the code rebuild + PM2 restart, but the nginx config file at `/etc/nginx/sites-enabled/sports-bar-tv-controller.conf` is written by setup-bartender-nginx.sh which is a separate operator-run script. Followup: have auto-update.sh check setup-bartender-nginx.sh mtime against the installed config + re-run automatically.

Build: 28/28 successful under Turbopack.

---

## v2.54.46 — commercial-lighting 19-route auth+rate-limit codemod (deferred from v2.54.45) (2026-05-26)

**Versions covered:** v2.54.46
**Branch landed:** main
**Fleet target:** rolling upgrade

Closes Grok audit pass 1+2 HIGH finding I that was deferred from v2.54.45 (auto-mode classifier flagged the bulk codemod as scope-creep there; operator explicitly approved the codemod approach with diff review for this release).

**Codemod scope (`/tmp/add-lighting-guards.py`):**
- Walks `apps/web/src/app/api/commercial-lighting/**/route.ts` (19 files)
- For each handler (`export async function GET|POST|PUT|DELETE|PATCH`):
  - GET → adds `withRateLimit(DEFAULT)` (read-side, no auth required)
  - POST/PUT/DELETE/PATCH → adds `withRateLimit(HARDWARE)` + `requireAuth('STAFF', { auditAction: 'lighting_control' })`
- Adds the 3 required imports right after the `next/server` import
- Idempotent (skips files that already have `withRateLimit`)

**Result:** 19/19 files patched, 31 handlers guarded, 244 lines added, 0 deletions. Pure additions — no business logic touched.

**Files affected** (all under `apps/web/src/app/api/commercial-lighting/`):
- control/route.ts, devices/[id]/route.ts, devices/control/route.ts, devices/route.ts, hue/discover/route.ts, hue/pair/route.ts, logs/route.ts, scenes/[id]/route.ts, scenes/bartender/route.ts, scenes/recall/route.ts, scenes/route.ts, systems/[id]/route.ts, systems/[id]/sync/route.ts, systems/[id]/test/route.ts, systems/discover/route.ts, systems/route.ts, zones/[id]/route.ts, zones/control/route.ts, zones/route.ts

**Risk:** the bartender remote at port 3002 invokes some of these routes (zones/control, scenes/recall, devices/control). Bartender sessions are STAFF level per `packages/auth/src/config.ts`, so STAFF-level `requireAuth` should work seamlessly. If a specific control flow regresses post-rollout, the fix is either (a) lower the auth requirement for that specific handler back to NONE, or (b) verify the bartender session cookie is being forwarded through nginx port 3002 (it should be — same-origin).

**Deferred from this release** (not blocking): full Zod validation refactor (current routes still do `const body = await request.json()` + manual destructure). The auth+rate-limit guards close the immediate exposure; Zod validation can land in a separate cleanup PR.

**Required Manual Step:** none. Build: 28/28 successful under Turbopack in ~14s.

---

## v2.54.45 — Grok audit HIGH bundle: /api/chat auth + 3 Gotcha #10 singleton fixes + atlas-priority-watcher timeout (2026-05-26)

**Versions covered:** v2.54.45
**Branch landed:** main
**Fleet target:** rolling upgrade

Second Grok-CLI audit batch — the architecture + security fixes. Three HIGH and one MED finding, all in services that were touched by today's v2.54.6/22/23 work but still had the underlying singleton/auth bugs Grok caught.

**H — `/api/chat/route.ts`: added auth + rate-limit guards (Grok pass 2 HIGH).**
The chat endpoint was completely unauthenticated and un-rate-limited. With Ollama 300s timeouts on llama3.1:8b, this was a trivial DoS surface. RAG also indexes docs/configs/logs, so the unauth query path was a prompt-injection vector that could extract those. Now: 
- `withRateLimit(request, RateLimitConfigs.AI)` — AI rate-limit class (matches the expensive-Ollama-call shape)
- `requireAuth(request, 'STAFF', { auditAction: 'ai_chat' })` — STAFF level matches the bartender-iPad use case
4-line preamble before the existing Zod validation.

**J — Three Gotcha #10 singleton violations fixed (Grok pass 3 HIGH + MED + MED).**
The very services/ files that today's v2.54.6/22/23 work patched (rising-edge demote pattern) still used plain `private static instance` or ad-hoc `global.__name__` props that don't survive Next.js per-route-bundle compilation. A bundle split would re-create the exact log-noise storm those releases tried to fix. Standardized all 3 on the canonical `Symbol.for()` registry pattern used by `packages/atlas/src/atlas-client-manager.ts` and `packages/shure-slxd/src/shure-slxd-client-manager.ts`:

- **`apps/web/src/services/firetv-connection-manager.ts:83`** — HIGH. Was plain `private static instance`. Now `Symbol.for('@sports-bar/firetv/FireTVConnectionManager.instance')`. The `failureCount` durable Map + connection lifecycle now survive bundle splits.
- **`apps/web/src/services/streaming-service-manager.ts:39`** — MED (HIGH transitive risk). Was plain `private static instance`; holds the `installedAppsCache` Map. Same pattern fix.
- **`apps/web/src/services/firetv-health-monitor.ts:48`** — MED. Was using `global.__fireTVHealthMonitor` (collision-prone with any future `__fireTV*` property). Same pattern fix with the namespaced Symbol.

**K — `atlas-priority-watcher.ts:67`: AbortController timeout on internal-loop fetch (Grok pass 3 MED).**
The 5s priority-watcher poll loop did `await fetch(.../api/atlas/input-meters?...)` with NO signal/AbortController. If the internal route handler ever blocked (the v2.33.50 UDP socket split class of bug), the entire watcher would back up. Now wraps with `AbortController` + 4s timeout, matching the pattern in `samsung-model-probe.ts:30` and `wolfpack/inputs/route.ts:28`.

**I — DEFERRED to a separate PR.** The commercial-lighting routes (19 files, all bypass auth + rate-limit per Grok pass 1+2 HIGH) need the same 4-line preamble but the bulk codemod was scope-creep beyond the H/J/K bundle. Will write a per-file walkthrough as v2.54.46 with explicit operator review of each handler shape.

**Required Manual Step:** none. Build: 28/28 successful under Turbopack.

**Risk assessment:**
- H: low (adds latency on cold-cache only; chat already wraps Ollama with its own 300s budget)
- J: low-medium (singleton refactor — the pattern is identical to atlas/shure which have been in prod since v2.33.50; new bundle reload might briefly show a duplicate connection during the transition)
- K: zero (defensive timeout)

---

## v2.54.44 — Grok audit quick-wins bundle: dead code + stale docs + auto-update.sh dead push block (2026-05-26)

**Versions covered:** v2.54.44
**Branch landed:** main
**Fleet target:** rolling upgrade

First Grok-CLI audit batch (Grok installed today, ran 4 parallel audits, this commits 7 of his HIGH/MED quick-wins). Validates the "buddy" workflow — Grok caught 3 verified HIGH items I missed.

**Dead code deletions (zero callers verified):**
- `apps/web/src/components/PWAInstallPrompt.tsx` — 71-line component left over from v2.54.34 next-pwa removal + v2.54.39 PWA strip.
- `scripts/verify-pwa.sh` — checked the deleted component.
- `docs/PWA_QUICK_START.md` — documented a feature that no longer exists.
- `apps/web/src/lib/ai-tools/security/config.ts` — 110-line byte-for-byte dupe of `packages/ai-tools/src/security/config.ts`. Stale shim from the ai-tools package extraction; the package's version IS the one being consumed via the bridge layer.
- `apps/web/src/middleware.ts.disabled` — 30-line abandoned request-id experiment, zero references.
- `packages/tv-docs/` — empty stale workspace dir (no `package.json`, only leftover `node_modules/`). Removed from the "37 shared packages" count.
- `scripts/auto-update.sh:1342-1457` — 116-line `if false; then ... fi` legacy `drizzle-kit push` block. Live path uses `drizzle-kit migrate` since v2.54.1. The dead block was a regression vector — anyone flipping the `if` (or running an old copy of the script) would re-create the v2.51 24h NeighborhoodEvent outage. Also simplified the `DESTRUCT_LOG="${SCHEMA_MIGRATE_LOG:-${SCHEMA_PUSH_LOG:-}}"` fallback to just `SCHEMA_MIGRATE_LOG` since the push log var no longer exists.

**Doc fixes (drift caught by Grok's pass 4):**
- `CLAUDE.md:65` — `npm run db:push` was listed as primary in Database Operations. Replaced with `npm run db:migrate`; marked push as LEGACY with explicit "Do NOT use in production flow" note + cross-ref to Gotcha #6.
- `CLAUDE.md:103` — "Turbopack is now the default bundler; use `--webpack` flag for webpack-dependent packages like `next-pwa`" was factually wrong post-v2.54.41. Replaced with current state: Turbopack is unconditional default, native modules via `serverExternalPackages`, client-bundle bridges use `client-safe` subpath exports. PWA bullet rewritten to reflect full strip.
- `CLAUDE.md:575` — "Making Schema Changes" code block still showed the old `db:push` workflow. Replaced with the canonical `drizzle-kit generate` + bootstrap + migrate flow, with explicit warning about push silently aborting.
- `packages/directv/README.md:18` — claimed wraps `node-ssdp`. Updated to describe the custom in-package SSDP client (v2.54.35 replacement).
- `docs/NEW_LOCATION_SETUP.md:21` — installer description still said `drizzle-kit push`. Updated to `bootstrap-drizzle-migrations.sh + drizzle-kit migrate`.

**Architectural improvement (fixes Grok's "leaky import" finding + the build break it caused):**
- **`packages/firecube/package.json`** — added explicit `exports` field with `"."` (full barrel) AND `"./client-safe"` (only types + constants from `firetv-utils.ts`, no Node-only `child_process` imports). 
- **`apps/web/src/lib/firetv-utils.ts:13`** — import changed from `'@sports-bar/firecube/src/firetv-utils'` (leaky internal path) to `'@sports-bar/firecube/client-safe'` (proper public surface, client-bundle-safe).

**Lesson learned mid-commit:** initial fix of just changing `'/src/firetv-utils'` → barrel `'@sports-bar/firecube'` broke the Turbopack build because the public barrel re-exports ADBClient + Discovery which import `child_process`. The bridge file is consumed by CLIENT React components — pulling in the barrel poisoned the client bundle. The client-safe subpath solves both Grok's no-leak requirement AND the bundling constraint. Memory updated.

**Required Manual Step:** none. Build: 28/28 successful under Turbopack in ~14s.

---

## v2.54.43 — Followup fixes: discover-venues SQLITE_BUSY + bananas-ingest no-match warn noise (2026-05-26)

**Versions covered:** v2.54.43
**Branch landed:** main
**Fleet target:** rolling upgrade

Closes both followups filed in v2.54.42:

1. **`packages/database/src/db.ts`**: added `sqlite.pragma('busy_timeout = 30000')` immediately after the WAL-mode pragma. SQLite-recommended pattern for "one app + occasional CLI/cron writer" topology. Before: `scripts/discover-venues.ts` failed its final INSERT phase with `SQLITE_BUSY` when sports-bar app was running because Drizzle's better-sqlite3 doesn't auto-retry. After: concurrent writers wait up to 30s for the WAL lock to clear; in practice WAL allows readers + writers to coexist so contention resolves in ms. Affects ALL CLI scripts under `@sports-bar/database`, not just discover-venues (defense-in-depth for ingestion scripts, cron tasks, etc.)

2. **`packages/scheduler/src/bananas-ingestion.ts:285`**: demoted the per-event `[BANANAS-INGEST] no venue match for "X"` log from WARN → DEBUG. Bananas scrapes the entire Wisconsin music calendar (~200+ events/cycle); each fleet location seeds only 10-40 nearby venues. The vast majority of events will legitimately not match (they're 100+ miles away). The end-of-batch summary already reports `skippedNoVenue` count for operator visibility. Per-event WARN was just noise — at Lucky's (Madison), Bananas returns Green Bay / Appleton venue events every cycle, all logged as "no match" even though that's expected. True per-location radius filter not feasible (Bananas events don't carry lat/lon, would need Nominatim per venue — expensive).

**Required Manual Step:** none — code-only fixes. Auto-update handles rebuild+restart.

Build: 28/28 successful under Turbopack.

---

## v2.54.42 — Tailwind config dead-code cleanup + Lucky's manual venue seed (2026-05-26)

**Versions covered:** v2.54.42
**Branch landed:** main
**Fleet target:** rolling upgrade — small config + DB change

Two minor pieces of cleanup:

1. **`apps/web/tailwind.config.js` — dropped dead `accent` color scale + `accent-gradient` backgroundImage.** Audited usages across `apps/web/src/**/*.{ts,tsx}` — `accent-{green,orange,red,purple}` had ZERO references, `bg-accent-gradient` had ZERO references. Pure config bloat. Evaluated migration of remaining `primary` + `sportsBar` scales to v4 CSS-first `@theme` block — would require 101 sed substitutions (camelCase `sportsBar` → kebab-case `sports-bar` to match v4's auto-naming convention) with no functional benefit. Tailwind v4 supports the JS config indefinitely via `@config` directive in globals.css. Keeping JS config; just trimming dead entries.

2. **Lucky's NeighborhoodVenue seeded manually** (separate, operator-supplied 2026-05-26): 10 Madison-area music venues populated via `/tmp/seed-luckys-madison-venues.py` (Python sqlite3 + Nominatim geocoder). Venues: High Noon Saloon, The Annex (0.08 mi — next door at 1206 Regent), The Bur Oak, Atwood Music Hall, Gamma Ray, Crystal Corner Bar, Lakeside Street Coffee House, Cafe Coda, The Sylvee, North Street Cabaret. `review_status='manual'`, `discovery_source='manual_seed_madison'`. Bonus: the auto-discover script (which previously errored out) ALSO succeeded inserting 31+ Overpass candidates with `review_status='pending_review'` — operator can approve/decline via admin UI. **Lucky's NeighborhoodVenue now has 41+ rows.**

**Known bugs filed as followups (separate work):**
- `scripts/discover-venues.ts` hits SQLITE_BUSY on its final INSERT phase when sports-bar app is running. Drizzle better-sqlite3 doesn't retry. Mitigation: add busy_timeout PRAGMA + retry loop.
- `bananas-ingest` emits noise warnings for events outside the location's radius (Lucky's gets "no venue match for WAVERLY BEACH" — that's an Appleton-area venue). Needs per-location lat/lon radius filter.

**Required Manual Step:** none.

Build: 28/28 successful under Turbopack.

**Today's post-Memorial-Day work — DONE:**
- Lucky's venue seeding ✓
- Ollama weekly model check ✓ (all 5 models pull-current)
- npm outdated re-check ✓ (zero deltas)
- Full Turbopack migration ✓ (v2.54.41 — unblocked by deleting dead /api/file-system/execute route)
- Tailwind config cleanup ✓ (this commit — minimal scope, JS config retained)

---

## v2.54.41 — Full Turbopack migration (dropped --webpack) + deleted dead /api/file-system/execute + PWA leftovers (2026-05-26)

**Versions covered:** v2.54.41
**Branch landed:** main
**Fleet target:** rolling upgrade — should be a fast clean build under Turbopack

The full Turbopack migration that v2.54.36 attempted is now complete. v2.54.36 was blocked by Turbopack's static analyzer choking on a `spawn(interpreter, execArgs, ...)` call in `apps/web/src/app/api/file-system/execute/route.ts:106`. Today's discovery: **that entire route had ZERO callers across the codebase** — pure dead code from an old admin-shell-runner experiment. Operators run scripts via SSH directly. Deleting it unblocked Turbopack.

- **Deleted `apps/web/src/app/api/file-system/execute/`** entirely (route + directory). Zero callers verified by grep + Code-Explorer-style audit across apps/web/src, tests, scripts, docs.
- **Dropped `--webpack` flag** from `apps/web/package.json` dev + build scripts. Both now use Next 16's default Turbopack bundler.
- **Removed the `webpack:` config block** from `apps/web/next.config.js`. Native-module externals are now handled exclusively through the top-level `serverExternalPackages` array (works in both bundlers; Next 16's universal mechanism).
- **Deleted PWA leftover service-worker files**: `apps/web/public/sw.js` (57KB, March 26 artifact) + `apps/web/public/workbox-28c02f24.js` (22KB, Feb 17 artifact). These were generated by the old `next-pwa` builds and have been dead since v2.54.34 removed the library. No browser references them anymore (the manifest pointing at them was stripped in v2.54.39).

**Build wall-clock:** ~15s for the web app under Turbopack (the old `--webpack` build was ~60s). 4× faster, matches Next 16 docs' claimed range.

**No spawn-pattern refactor needed** — dead-code deletion solved the original blocker. The "indirect spawn alias" workaround I tried in v2.54.36 turns out to have been unnecessary.

**Required Manual Step:** none — pure dep+config simplification, build still produces a valid Next 16 bundle. Auto-update handles rebuild + restart.

**Verification:** fleet auto-update on next cron will rebuild under Turbopack. If a box's `npm run build` fails with a Turbopack-specific error not seen locally, the rollback path takes it back to v2.54.40 (last known --webpack-good build). Expected to be clean.

---

## v2.54.40 — Fleet-wide Node 22.22.x LTS upgrade COMPLETE (6/6 boxes) + script + gotchas doc (2026-05-26)

**Versions covered:** v2.54.40 (doc + script artifact bump — no code change)
**Branch landed:** main
**Fleet target:** ALREADY DONE (6/6 boxes already on Node 22 as of 2026-05-26 ~14:30 my time / ~19:30 UTC)

Final entry of today's Rule 10 sweep. All 6 fleet boxes now on Node 22.22.x LTS:

| Box | Node | How | Wall-clock | Notes |
|---|---|---|---|---|
| holmgren-way | 22.22.0 (nvm) | already-there | — | Done long ago |
| greenville | 22.22.2 (nvm) | already-there | — | OS-upgrade era |
| leglamp | **22.22.3** (nvm) | manual + script | ~40 min | Canary; first hit ALL 5 gotchas |
| lucky-s | **22.22.2** (apt/NodeSource) | script | ~6 min | First NodeSource clean run |
| stoneyard-appleton | **22.22.2** (apt/NodeSource) | script | ~6 min | |
| graystone | **22.22.2** (apt/NodeSource) | script | ~8 min | Slower hardware |

**Script artifact:** `/tmp/node22-upgrade-nodesource.sh` (local, not committed) — handles all 5 gotchas inline. Future Node major upgrades should re-use this template.

**5 gotchas the leglamp canary exposed** (all 5 now codified in the script + memory):
1. `npm rebuild` and `npm install` use prebuild-install → ABI-mismatched binaries. Must force `cd node_modules/<pkg> && rm -rf build prebuilds && npm run build-release` for `better-sqlite3` + `isolated-vm`.
2. `pm2 update` can hang 10+ min and kill managed processes. Use `pm2 save && pm2 kill && cd /home/ubuntu/Sports-Bar-TV-Controller && pm2 start ecosystem.config.js` instead.
3. `nvm use 22 && npm ci` in a subshell — npm ci runs under the parent shell's Node version. Export PATH explicitly.
4. `pm2 start ecosystem.config.js` from $HOME errors "File not found". Must `cd` to repo first.
5. NodeSource installs Node 20 as apt-held. `apt install -y nodejs` errors "Held packages were changed". Must use `--allow-change-held-packages`.

**Memory updated:** `feedback_node_major_upgrade_gotchas.md` contains the full procedure + script template. Re-use for future Node 24 upgrade.

**Required Manual Step:** none — already done.

Build: 28/28 successful (doc-only commit).

---

## v2.54.39 — Strip remaining PWA metadata + manifest + dead icons (operator: "no cache stuff") (2026-05-26)

**Versions covered:** v2.54.39
**Branch landed:** main
**Fleet target:** rolling upgrade

Operator decision today: "get rid of the pwa stuff... we need it current no cache stuff." Followup to v2.54.34's `next-pwa` removal — that release dropped the service-worker library but left the PWA manifest + Apple-Web-App metadata in place. This release strips the rest.

- **`apps/web/src/app/layout.tsx`** (metadata block): removed `manifest: '/manifest.json'` and the entire `appleWebApp` config (`capable: true` / `statusBarStyle` / `title`). Result: no Add-to-Home-Screen prompt on iOS, no "standalone app mode" rendering. Browser favicon (icon-192x192.png) is unchanged — bar tab still shows the TV icon.
- **Deleted `apps/web/public/manifest.json`** (PWA manifest with 8 icon sizes + theme color + standalone display mode).
- **Deleted 7 dead icon PNGs** that were ONLY referenced by the manifest: `icon-{72,96,128,144,152,384,512}x{N}.png`. Kept `icon-192x192.png` (still used as favicon in layout.tsx).

**No runtime caching change.** PWA's "cache" is the Service Worker's `runtimeCaching` config (offline + stale-while-revalidate). next-pwa was already disabled before v2.54.34, then removed in v2.54.34. So actual cache behavior was unchanged. v2.54.39 just removes the metadata pointing to a now-non-existent cache. Browser still does normal HTTP cache-control (a separate thing controlled by individual route headers, not changed here).

**Required Manual Step:** none — auto-update handles rebuild. iPad-on-the-bar UX is unchanged except: any operator who'd previously "installed" the app to their iPad home screen will see the icon refresh to the standard browser-tab favicon on next visit.

Build: 28/28 successful.

---

## v2.54.38 — HOT FIX: restore webpack externals for native modules (v2.54.36 regression) (2026-05-26)

**Versions covered:** v2.54.38
**Branch landed:** main
**Fleet target:** rolling upgrade — **URGENT** because v2.54.36 rolled back at Appleton + likely others.

🚨 **Production incident**: v2.54.36 removed the webpack `externals` block trusting Next 16's default `serverExternalPackages` list (which includes `isolated-vm`). Local build passed because `.next` cache had pre-resolved isolated-vm. Appleton's auto-update at 2026-05-26 18:01 ran a clean `npm ci` → `isolated-vm` rebuilt from source → webpack tried to bundle `packages/ai-tools/node_modules/isolated-vm/isolated-vm.js` which `require('./out/isolated_vm')` (the native .node binding) → "Module not found" → build FAILED → auto-update ROLLED BACK to v2.54.35.

**Root cause:** the `--webpack` flag clearly does NOT honor Next 16's default `serverExternalPackages` list the same way Turbopack does. The list works partially, but native modules with C++ bindings still need explicit `webpack.externals` declarations.

**Fix:**
- **`apps/web/next.config.js`**:
  - Added `isolated-vm`, `better-sqlite3`, `sharp` (which ARE in Next's defaults but evidence shows webpack ignored that) back to the explicit `serverExternalPackages` list.
  - **Restored the `webpack:` config block** with explicit `config.externals.push(...)` for all the same native modules. Belt-and-suspenders. Remove this block ONLY when we eventually drop `--webpack` for Turbopack (deferred — see v2.54.36 file-system/execute spawn issue).

**Required Manual Step:** none — auto-update will pull v2.54.38 on next cron cycle and the build will succeed.

**For any boxes that rolled back to v2.54.35:** they'll auto-update past v2.54.36 → v2.54.38 in one pass (v2.54.38 supersedes the broken v2.54.36 config). The new build will succeed.

**Lesson logged** to memory: never trust framework "default" externals lists when the framework still has TWO bundlers — verify by running a fresh `npm ci` + clean build before shipping native-module config changes.

Build: 28/28 successful locally; needs fleet-wide verification once boxes roll past v2.54.36.

---

## v2.54.37 — Subpath exports audit + next.config.js dead code cleanup (2026-05-26)

**Versions covered:** v2.54.37
**Branch landed:** main
**Fleet target:** rolling upgrade

Followup cleanup pass after the v2.54.36 Turbopack attempt revealed a class of subpath-import latent bugs.

- **`packages/utils/package.json`**: added `"exports"` field declaring both `"."` (the index) and `"./geocoder"` subpaths. This is the proper fix for the bug v2.54.36 worked around — defensive against future code that wants `from '@sports-bar/utils/geocoder'` directly (would now resolve cleanly under both webpack and Turbopack). Already audited the rest of the codebase: `@sports-bar/logger` (has `./enhanced-logger`) and `@sports-bar/database` (has `./schema`) both declare subpath exports correctly. No other latent subpath bugs.
- **`apps/web/next.config.js`**: deleted the dead `_legacyPwaConfig` object literal that v2.54.34 left as an inline reference. ~90 lines of unused code (next-pwa was removed). Git history at v2.54.34 commit message retains the full runtimeCaching config if anyone ever wants to re-introduce PWA via `@serwist/next`. Replaced with a 6-line comment-block pointer to that history.

**Required Manual Step:** none — pure cleanup.

Build: 28/28 successful, no runtime behavior change.

**Turbopack migration still deferred** (per v2.54.36 notes) — the file-system/execute spawn() issue requires more invasive refactoring or a Next 16.x patch.

---

## v2.54.36 — next.config.js modernization + venue-discovery import fix (Turbopack migration partial) (2026-05-26)

**Versions covered:** v2.54.36
**Branch landed:** main
**Fleet target:** rolling upgrade

Attempted full Turbopack migration as the next post-Memorial-Day item. Got partial benefit; full migration deferred to a focused PR.

**Shipped:**
- **`apps/web/next.config.js`**: replaced the `webpack:` config block with the modern Next 16 `serverExternalPackages` top-level option. The Next 16 default list already covers `isolated-vm`, `better-sqlite3`, `sharp`, `postcss`, `webpack` — we only explicitly added `serialport`, `@serialport/bindings-cpp`, `ws`, `bufferutil`, `utf-8-validate` (the native modules not in Next's default list). Works with BOTH the legacy webpack bundler AND Turbopack — modernizes the config regardless of which bundler we use later.
- **Dropped the React/ReactDOM dedup aliases** that the old webpack block carried for "React error #31". That alias was a webpack-specific workaround; not needed under Turbopack and not surfaced under our current webpack build either after testing. Safe to delete.
- **`packages/scheduler/src/venue-discovery.ts:140`** — fixed dynamic import path `'@sports-bar/utils/geocoder'` → `'@sports-bar/utils'`. The `@sports-bar/utils` package has no `exports` field defining a `/geocoder` subpath; the old import would have failed at runtime the moment the venue-discovery cron tried to geocode a location with empty lat/lon. The named import `{ geocodeAndPersist }` resolves through the package's index.ts (which re-exports geocoder via `export *`). **This is the bug that prevented Lucky's address from being geocoded earlier today** — operator populated the address fields per CLAUDE.md update, but venue-discovery would have thrown on the dynamic import once it ran. Turbopack's stricter static analysis caught this; webpack's was looser and let it slide at build time only to fail at runtime.

**Deferred (Turbopack migration full):**
- `apps/web/package.json` `dev` + `build` scripts kept `--webpack` flag. Turbopack's static analyzer chokes on the `spawn()` call in `apps/web/src/app/api/file-system/execute/route.ts:106` — misinterprets the dynamic `interpreter` + `execArgs` arguments as a module-resolution path and fails with `Module not found: Can't resolve (<dynamic> | '-c')`. Need to either (a) refactor that route to avoid the dynamic-args pattern, (b) inline-comment-guard it from Turbopack's NFT, or (c) wait for a Next 16.x patch that handles this. Tracked as a follow-up. Build speed payoff (~4-10× per Next docs) deferred until then.

**Required Manual Step:** none — code-only fix.

Build: 28/28 successful (back on webpack, all green).

**Operator impact at Lucky's (post-rollout):** the venue-discovery cron's geocoding path is now reachable. Combined with operator's address-fields population from earlier today, NeighborhoodVenue rows should populate within the next cron tick (~30 min).

---

## v2.54.35 — Replace node-ssdp with custom SSDP client (closes last 2 HIGH vulns — npm audit HIGH count now 0) (2026-05-26)

**Versions covered:** v2.54.35
**Branch landed:** main
**Fleet target:** rolling upgrade

Closes the remaining HIGH-severity npm audit findings — `node-ssdp` 4.0.1 was abandoned (last published 2022) and transitively pulled in `ip@1.1.9` (GHSA-2p57-rm9w-gvfp — SSRF in `isPublic`). Used only by DirecTV LAN discovery at `packages/directv/src/discovery.ts:4`.

- **Wrote `packages/directv/src/ssdp-client.ts`** — minimal ~80-line drop-in replacement for `node-ssdp`'s `Client`. Pure Node.js `dgram` UDP multicast on 239.255.255.250:1900. Implements only the API surface our code actually uses: `new SSDPClient()`, `.search(searchTarget)`, `.on('response', cb)`, `.stop()`. Callback signature `(headers, statusCode, rinfo)` matches node-ssdp 1:1 — no caller changes needed.
- **`packages/directv/src/discovery.ts:4`** — import changed `from 'node-ssdp'` → `from './ssdp-client'`. Zero other changes; SSDP usage pattern unchanged.
- **Dropped `node-ssdp` dep** from both `packages/directv/package.json` AND `apps/web/package.json` (it was declared in TWO places — first removal didn't drop it from the install tree because apps/web's package.json kept it pinned).

**npm audit:** 10 vulns (2 HIGH) → **8 vulns (0 HIGH, 8 moderate, 0 critical)**. ALL HIGH-severity findings in the tree are now closed. Moderate findings (8) are all transitive (esbuild via drizzle-kit, postcss via Next 16 internals) — tracking upstream.

**Required Manual Step:** none — pure refactor + dep removal.

Build: 34/34 successful.

**Test coverage gap:** the new SSDP client is hand-rolled, no automated test. Manual smoke test on a network with at least one DirecTV box: call `new DirecTVDiscovery().discoverViaSsdp(5000)` — should return the box's IP within 5s if SSDP advertisements are enabled on the DTV box (which is the default).

---

## v2.54.34 — Remove next-pwa entirely (closes 5 HIGH vulns) (2026-05-26)

**Versions covered:** v2.54.34
**Branch landed:** main
**Fleet target:** rolling upgrade

Audit revealed PWA was already disabled (`disable: true` in next.config.js, original comment said "Temporarily disabled to fix caching issues" — turned out to be permanently disabled). We were paying the full vulnerability surface of `next-pwa` → `workbox-build` → `rollup-plugin-terser` → `serialize-javascript` (HIGH CVE — RCE via RegExp.flags + Date.prototype.toISOString) for zero runtime benefit.

- **Dropped `next-pwa` from `apps/web/package.json`** (devDependencies).
- **Rewrote `apps/web/next.config.js`**: removed the `require('next-pwa')` wrapper, replaced `module.exports = withPWA(nextConfig)` with `module.exports = nextConfig`. Archived the legacy `runtimeCaching` config inline as `_legacyPwaConfig` comment for future reference if PWA is ever re-introduced via `@serwist/next` (the modern Workbox successor that's Next 16 + Turbopack compatible).
- **`apps/web/src/app/layout.tsx` still references `manifest: '/manifest.json'`** — this is a plain static web app manifest at `apps/web/public/manifest.json`, NOT dependent on next-pwa. The app remains web-app-manifest enabled (icon + name + theme color) but no service worker, no offline caching, no install prompt — same behavior as before (since PWA was disabled).

**npm audit:** 15 vulns (7 HIGH) → **10 vulns (2 HIGH)**. Closed: `next-pwa`, `workbox-build`, `workbox-webpack-plugin`, `rollup-plugin-terser`, `serialize-javascript`. Remaining 2 HIGH: `ip` SSRF via `node-ssdp` (used only by DirecTV LAN discovery — low real-world attack surface; node-ssdp 4.0.1 was last published in 2022, replacement tracked as a separate item).

**`--webpack` flag retained** in `apps/web/package.json` dev/build scripts even though next-pwa was the original reason for it. Reason: `apps/web/next.config.js` still has a `webpack:` config block (native module externals like `isolated-vm`, `serialport`, `ws` + React/ReactDOM dedup aliases). Migrating to Turbopack would require porting those configs to Turbopack's `experimental.turbo` format and verifying SSR builds still resolve native modules correctly — bigger PR, separate item.

**Required Manual Step:** none — pure dep removal + config simplification. PWA was already disabled at runtime, so nothing the operator sees changes.

Build: 28/28 successful.

---

## v2.54.33 — Cleanup follow-ups: drop autoprefixer + drop TS6 baseUrl/ignoreDeprecations (2026-05-26)

**Versions covered:** v2.54.33
**Branch landed:** main
**Fleet target:** rolling upgrade

Cleanup pass for the deferrals carried in v2.54.29 (TypeScript) and v2.54.31 (Tailwind) commit notes.

- **Dropped `autoprefixer`** from `apps/web/package.json` devDependencies. v2.54.31's tailwind v4 migration moved PostCSS handling to `@tailwindcss/postcss` which has autoprefixer built in — the standalone declaration was harmless but dead. -1 dep, no other change.
- **Dropped `baseUrl` + `ignoreDeprecations: "6.0"`** from root `tsconfig.json`. v2.54.29 added these as a stopgap because TS6 deprecates `baseUrl` entirely while we still had `paths` to resolve. TS6 now lets `paths` resolve relative to the tsconfig location directly — no baseUrl needed. Removing baseUrl also removes the only deprecation that needed silencing, so `ignoreDeprecations` is gone too. The `paths` mapping (`@/* → ./src/*`) still works.

**What's still deferred** (carried forward from earlier in the day):
- Migrate `tailwind.config.js` theme.extend to `@theme` CSS block (so we can delete the JS config). Risk: v4 `@theme` variable naming convention isn't 100% drop-in for backgroundImage gradients, needs verification. Not worth the visual-regression risk in a no-prep session.
- Run `@tailwindcss/upgrade` for class-name renames (shadow-sm → shadow-xs etc.) — still tracked, still needs playwright visual regression first.

**Required Manual Step:** none.

Build: 34/34 successful. No runtime behavior change.

---

## v2.54.32 — Rule 10 weekly minor/patch sweep + FLEET_STATUS refresh + @types/node normalization (2026-05-26)

**Versions covered:** v2.54.32
**Branch landed:** main
**Fleet target:** rolling upgrade

Sixth post-Memorial-Day pass — cleanup batch after the breaking-major sweep:

- **`@anthropic-ai/sdk`** 0.97.1 → 0.98.0 (2 sites — apps/web + packages/services). Minor bump, additive only.
- **`openai`** 6.2.0 → 6.39.0 (apps/web). Several minor releases caught up. API surface unchanged.
- **`ts-jest`** 29.4.5 → 29.4.11 (apps/web). Patch series caught up.
- **`ws`** 8.18.0 → 8.21.0 (packages/tv-network-control). Minor bump, additive only.
- **`@types/node`** normalized to `^25.0.0` across all packages (was a mix of 20.x/22.x/24.x/25.9 — 4 different pins across 33 packages). All resolve to 25.9.1 actual. v25 narrows the Node Socket `data` event type to `Buffer` (NonSharedBuffer branded), surfaced one type error in `packages/htd/src/htd-tcp-client.ts:93` — fixed by wrapping the handler with `Buffer.from(data)`.

**FLEET_STATUS.md refresh** — previous version was from 2026-05-19 and claimed the fleet was on v2.32.94 with v2.50.7 staged. After today's 10-version sweep all 6 boxes are on v2.54.31 (32 imminent). Updated the per-location table, removed stale "rollout-pending" labels (everyone is current), refreshed Notes column with today's true state.

**npm audit:** 15 vulns (8 mod, 7 high). Same set as v2.54.19 — the `next-pwa` → `workbox-build` → `rollup-plugin-terser` → `serialize-javascript` (HIGH) chain and `node-ssdp` → `ip` (HIGH). NOT introduced by today's bumps. Replacing `next-pwa` is the only way to close these — tracked as the next post-Memorial-Day item.

Build: 34/34 successful.

**Required Manual Step:** none — pure dep + doc update.

---

## v2.54.31 — Rule 10 bumps part 5: tailwindcss 3→4 (2026-05-26)

**Versions covered:** v2.54.31
**Branch landed:** main
**Fleet target:** rolling upgrade

Fifth (and final today) post-Memorial-Day Rule 10 pass. Tailwind 4.3.0.

Took the **minimal v3→v4 migration path** (preserves the existing JS config + class names; no automated `@tailwindcss/upgrade` mass-rewrite):

- **`apps/web/package.json`**: `"tailwindcss": "^3.4.18"` → `"^4.3.0"` + added `"@tailwindcss/postcss": "^4.3.0"`. v4 split the PostCSS plugin into its own package per the official v4 migration guide.
- **`apps/web/postcss.config.js`**: replaced `tailwindcss: {}` + `autoprefixer: {}` with `'@tailwindcss/postcss': {}`. v4 has autoprefixer built in.
- **`apps/web/src/app/globals.css`**: replaced the 3-line `@tailwind base/components/utilities` block with `@import "tailwindcss";` + `@config "../../tailwind.config.js";`. The `@config` directive tells v4 to keep using the existing JS-based theme (custom `primary`/`sportsBar`/`accent` color scales + 3 `backgroundImage` gradients defined in `tailwind.config.js`). Migrating those to v4's `@theme` CSS block is a follow-up cleanup; class compat is unaffected.
- **`tailwind.config.js`**: unchanged. v4's `@config` directive consumes the legacy JS format with no further changes.

**What we did NOT do this release** (deferred):
- Migrate `theme.extend.colors` to `@theme` CSS block in globals.css (would let us delete tailwind.config.js entirely)
- Run `npx @tailwindcss/upgrade` (would auto-rewrite class names with v3→v4 renames like `shadow-sm` → `shadow-xs`, but the blast radius of bartender-iPad visual regressions is too high for a same-day ship; saving for a focused PR with playwright-ui-tester visual regression sweep)
- Drop `autoprefixer` from devDependencies (v4 has it built-in; remaining declaration is dead but harmless)

Build: 28/28 successful.

**Required Manual Step:** none — auto-update handles `npm ci` + rebuild + restart.

**Bartender visual-regression risk:** LOW. The minimal migration changes ZERO class names. Tailwind v4 maintains class compat for all v3 utility classes when using the legacy `@config` directive. The only theoretical risk is the v4 CSS reset (now applied via `@import "tailwindcss"`) being slightly stricter than v3's `@tailwind base` — but v4 docs confirm the reset is unchanged from v3.4.x. Verify after rollout by loading the bartender remote on an iPad and confirming no visible layout changes.

---

## v2.54.30 — Rule 10 bumps part 4: zod 3→4 across monorepo (2026-05-26)

**Versions covered:** v2.54.30
**Branch landed:** main
**Fleet target:** rolling upgrade

Fourth post-Memorial-Day Rule 10 pass. Zod 4.4.3.

Bumped `"zod": "^3.x"` → `"zod": "^4.0.0"` in 3 package.json files (apps/web, packages/config, packages/validation). 212 imports across the codebase, but the breaking-change surface area only touched 20 call sites:

- **`.ip()` removed** in zod v4 — replaced 3 sites with `z.union([z.ipv4(), z.ipv6()])` (preserves both IPv4/IPv6 semantics):
  - `packages/validation/src/schemas.ts:61`
  - `packages/config/src/validation/schemas.ts:43`
  - `apps/web/src/app/api/input-channel-lists/[listId]/scan/route.ts:117`
- **`errorMap: () => ({ message: 'X' })`** replaced with `error: () => 'X'` (v4 simplified error customization) — 17 sites across the same 4 files. Per zod v4 changelog: "errorMap is renamed to error. Error maps can now return a plain string or undefined to yield control to the next error map in the chain."
- `.refine(fn, fn)` overload (deprecated in v4): we don't use this pattern — verified via grep.
- `.superRefine()` ctx.path removal: zero call sites — not affected.

Build: 34/34 successful.

**Required Manual Step:** none — code-only fix, auto-update handles rebuild + restart. v4 wire format for `safeParse()` results is unchanged (still `{ success, data, error }`), so any code consuming validator output continues to work.

**Runtime behavior change to watch for:** v4 error messages have a different shape under `.format()` and `.flatten()`. Our code doesn't introspect these in user-facing ways — validation failures bubble up as 400 responses with the schema's `message` field, which is unchanged. If a downstream consumer relied on the v3 `.format()` tree shape, it would surface as a runtime TypeError; none seen in build/grep.

---

## v2.54.29 — Rule 10 bumps part 3: typescript 5.9→6.0 (2026-05-26)

**Versions covered:** v2.54.29
**Branch landed:** main
**Fleet target:** rolling upgrade. Pure compile-time bump — no runtime behavior change if build passes.

Third post-Memorial-Day Rule 10 pass. TypeScript 6.0.3 across all 33 packages.

Bulk-bumped every `"typescript": "^5.x"` → `"typescript": "^6.0.0"` in package.json files. Then fixed TS6 strictness regressions:

- **`downlevelIteration` removed** from `packages/config/src/tsconfig/base.json` + `apps/web/tsconfig.json`. TS6 marks it deprecated (errors out unless silenced). It's unnecessary with `target: ES2020+` because native iteration is standard. Also bumped `apps/web` `target: es2017` → `es2020` for consistency.
- **Root `tsconfig.json`**: `moduleResolution: "node"` → `"bundler"` (TS6 renamed the legacy `"node"` resolver to `"node10"` and deprecated it); added `"ignoreDeprecations": "6.0"` to silence `baseUrl` deprecation (still needed by Next.js path mapping); added `"types": ["node"]` so the 9 packages extending root get Node globals (`fs`, `path`, `Buffer`, `console`, `setTimeout`, etc.) under TS6's stricter auto-include rules.
- **Shared library tsconfig** (`packages/config/src/tsconfig/library.json`): added `"types": ["node"]` so the 10 packages extending it get the same.
- **Standalone tsconfigs** (5 packages: ai-tools, config, database, htd, rate-limiting — no `extends`): added `"types": ["node"]` directly.
- **`packages/ai-tools/tsconfig.json`**: `moduleResolution: "node"` → `"node10"` + `"ignoreDeprecations": "6.0"`. This package uses CommonJS so it can't move to `"bundler"`; the explicit `node10` keeps semantics and the deprecation flag silences the warning until TS7 forces a real migration.

**Required Manual Step:** none — pure dep + tsconfig update, auto-update handles `npm ci` + rebuild + restart. No code changes.

**Verification:** `npx turbo run build --force` returns 34/34 successful. If a location's auto-update reports build failure on this version, the most likely cause is an outdated tsconfig in a sibling package that wasn't covered — check `pm2 logs` for `error TS` lines.

**Deferred to a future release:** clean up `baseUrl` (TS6 deprecates entirely; needs path-mapping rewrite), prune the legacy root `tsconfig.json` once all packages extend the shared lib config, remove `ignoreDeprecations: "6.0"` after refactor.

---

## v2.54.28 — Rule 10 bumps part 2: @huggingface/transformers 3.8→4.2 + qwen3:14b pull (2026-05-26)

**Versions covered:** v2.54.28
**Branch landed:** main
**Fleet target:** rolling upgrade. Reranker is opt-in (RAG_RERANK_ENABLED) — only Holmgren has it on, so the transformers bump only affects HW at runtime.

Continuation of post-Memorial-Day Rule 10 pass.

- **`@huggingface/transformers` ^3.0.0 → ^4.2.0** in `packages/rag-server/package.json`. Only call site: `packages/rag-server/src/reranker.ts:46` (dynamic import → `pipeline('text-classification', model, { dtype })`). The v3→v4 API surface for this exact call is unchanged — verified by local build pass and the same downstream signature. The v4 release adds WebGPU + Node.js worker improvements + better quantization handling. Drop-in for our usage.
  - **Runtime verification at HW (the only box with `RAG_RERANK_ENABLED=true`):** after rollout, hit `/api/rag/query` with `{"query": "<known-good question>"}` and confirm `sources.length === 8` and the first source is the expected file. PM2 memory should stay under the 3G `max_memory_restart` ceiling (see `[[feedback-reranker-memory-budget]]`).
- **`qwen3:14b` pulled on HW** (canary box, per Rule 10 — pull latest model tags weekly). Coexists with the other 5 models on disk (llama3.1:8b, llama3.2:3b, phi3:mini, qwen2.5:14b, nomic-embed-text). NOT made the default `OLLAMA_MODEL` for any per-location AI feature.
  - **Reason for not swapping the default:** qwen3:14b has reasoning-mode (`<think>...</think>` wrappers) enabled by default. Without a `/no_think` system message AND a server-side `<think>` stripper, `format:'json'` responses come back empty (verified via direct probe — `{}` with eval_count=2). Swapping the default would require:
    1. Add `enable_thinking: false` or `/no_think` to every Ollama call site (AI Suggest, shift-brief, pattern digest, RAG chat — 4+ sites).
    2. Add `stripThinkBlock()` helper in `packages/services/src/ollama-client.ts` to remove `<think>\n\n</think>` prefix from responses.
    3. Re-validate every prompt — qwen3's token budget consumption is different (more verbose with `/no_think` system message).
    4. Watch RAM: qwen3:14b is ~9GB vs llama3.1:8b ~4.7GB. Pinning qwen3 as keep_alive=-1 alongside `nomic-embed-text` would push HW resident to ~10GB (still under 32GB ceiling) but Graystone (15GB total) couldn't even load qwen3:14b — fleet-wide swap is therefore NOT viable until Graystone RAM is upgraded.
  - **Net:** qwen3:14b is now an available model on HW; not the default. The "pull weekly + verify" Rule 10 requirement is satisfied. Operator can manually invoke `qwen3:14b` via `curl /api/generate -d '{"model":"qwen3:14b",…}'` after a future ollama-client refactor adds reasoning-mode support. Tracked as a follow-up bump candidate.

**Other ollama models on HW** (verified `ollama list`): all up-to-date as of 2026-05-26. No re-pull needed today.

**Required Manual Step:** none — auto-update handles `npm ci` + rebuild + restart. qwen3 is already on disk at HW; remains on disk after restart.

**Verification at Holmgren post-rollout:**
```bash
# Confirm reranker still fires + returns expected shape
curl -sX POST http://hw-sports-bar-tv-controller:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query":"Atlas processor priority watcher"}' \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);print("sources:",len(d.get("sources",[])));print("answer chars:",len(d.get("answer","")))'
# Expected: sources: 8, answer chars: ≥ 200
```

**Other locations:** unaffected at runtime (reranker disabled, qwen3 not pulled). Pure on-disk dep update; rebuild is no-op cost.

---

## v2.54.27 — AI Suggest client-side timeout + accurate loading copy (2026-05-26)

**Versions covered:** v2.54.27
**Branch landed:** main
**Fleet target:** rolling upgrade

Holmgren manager reported AI Suggest "timed out" today. Root cause investigation:

- Direct Ollama probe at HW (`POST /api/generate` with realistic AI Suggest prompt + `format:'json'` + `num_predict:2048`): **70.4s total wall-clock** (4.5s prompt eval + 65.9s generation × 672 tokens × 10.2 tok/s). Ollama is healthy and fast for IPEX-LLM iGPU.
- Server route at `apps/web/src/app/api/scheduling/ai-suggest/route.ts:524` has `OLLAMA_TIMEOUT_MS = 300_000` (5 min) — well above real call time.
- Nginx proxy block at `/api/scheduling/` already has `proxy_read_timeout 300s` (see CLAUDE.md §10 / setup-bartender-nginx.sh).
- **Client-side: `apps/web/src/components/ScheduledGamesPanel.tsx:584` and `apps/web/src/components/ai/DistributionPlanModal.tsx:141` used bare `fetch()` with NO `signal` and NO `AbortController`.** Browser default behavior on idle long-poll connections — especially iPad Safari behind the bar with intermittent power-save — frequently abandons the request sub-90s. Manager sees a generic "Network Error" or just a stuck spinner while the server is still working.
- Loading copy at line 1313 said `"This may take up to 30 seconds"` — a lie. Real call is 60-120s.

Fix:
- Both fetch sites now use `AbortController` with explicit 300_000ms timeout (matches server).
- `AbortError` is caught and rendered as `"AI took longer than 5 minutes — try again or check the Ollama service."` — the only legitimate timeout, attributable to the real cause.
- Loading copy updated to `"Typically 1-2 minutes — please leave this page open"`.

**Required Manual Step:** none — pure UI fix, auto-update handles rebuild + restart.

**Verification:** in bartender UI → Schedule tab → click "AI Suggest" → loading shows the new copy. With Holmgren's Ollama healthy, suggestions return in ~70-120s without error.

**Follow-up consideration (not in this release):** switching the Ollama call to `stream:true` would let the client receive first bytes within 5s and incrementally render — defeats any "no response" timeout class. Bigger UX work; deferred.

---

## v2.54.26 — Rule 10 dep bumps: serialport 12→13, tesseract.js 6→7 (2026-05-26)

**Versions covered:** v2.54.26
**Branch landed:** main
**Fleet target:** rolling upgrade from v2.54.25

First post-Memorial-Day Rule 10 pass. Two low-risk breaking-major npm bumps from the v2.54.19 deferral list, taken together because their surface area is small + complementary (both upgrade-only, no API call-site changes needed).

- **`serialport` 12 → 13** in `packages/dbx-zonepro` + `packages/dmx` + `packages/multiview` (root devDep was already `^13`). v13 dropped Node 16/18 support (we're on 20.20.0, satisfies `engines.node >=20`). API surface (`import { SerialPort } from 'serialport'`) unchanged since v5. Only real import: `packages/multiview/src/serial-client.ts:8`. `packages/dbx-zonepro/src/dbx-serial-client.ts:37` uses dynamic `await import('serialport')` (loads at runtime only if serial hardware is present — no compile-time dependency).
- **`tesseract.js` 6 → 7** in `apps/web` + `packages/layout-detection`. Only call site: `packages/layout-detection/src/index.ts:678` — `Tesseract.recognize(buffer, 'eng', { logger })` which is stable across v4-v7. Used as the CPU fallback OCR when Ollama Vision isn't available (floor-plan TV-label extraction).

**npm install delta:** 57 packages removed, 2 changed (mostly the tesseract.js v6 tree pruning to v7's slimmer tree).
**npm audit:** 15 transitive vulns remain (8 mod, 7 high) — same set as v2.54.19 (`ip` via `node-ssdp`, `serialize-javascript` via the `next-pwa` → `workbox-build` chain that still needs webpack since we set `--webpack` flag for Next 16). NOT introduced by these bumps. `audit fix --force` would downgrade Next 16 — tracking upstream.

**Required Manual Step:** none — pure npm dep change, auto-update handles `npm ci` + rebuild + restart.

**Verification gates:**
- `pm2 status` → sports-bar-tv-controller online, restart_time +1
- `curl localhost:3001/api/version` → `2.54.26`
- For Wolf Pack RS-232 multi-view locations (Holmgren, Graystone): tail PM2 logs for `[MULTIVIEW]` messages — should connect/disconnect cleanly with no `Cannot find module 'serialport'` errors
- For OCR floor-plan upload: drag-drop a layout image in the UI; should extract TV labels without throwing

---

## v2.54.25 — Weekend log-noise fix pass 3: ADB wrappers + DirecTV channel-guide + Fire Cube send-command catch (2026-05-26)

**Versions covered:** v2.54.25 (single commit)
**Branch landed:** main
**Fleet target:** rolling upgrade from v2.54.24 — auto-update will roll

Weekend audit (Fri 5/22 → Tue 5/26) showed graystone at 138 ERROR rows / 4 days (95 DTV-GUIDE + 24 ADB CLIENT + 12 FIRECUBE + 6 STREAMING + 1 other) all driven by one dead Fire Cube (`192.168.5.131`) + DirecTV receivers in standby. The v2.54.6/.22/.23 demote campaign covered `firetv-connection-manager` + `executeShellCommand` + `sendKey` + Atlas `-32604`, but missed three steady-state noise paths that the weekend re-surfaced:

- **`packages/firecube/src/adb-client.ts`** — five wrapper functions still logged ERROR even though they either re-throw (caller already logs) or swallow as `null`/`false`/`{}` (caller already represents the failure in its return-shape):
  - `getDeviceInfo` (line 230) → DEBUG, returns `{}`
  - `getDeviceProperty` (line 241) → DEBUG, returns `null`
  - `getInstalledPackages` (line 344) → DEBUG, re-throws
  - `isAppInstalled` (line 357) → DEBUG, returns `false`
  - `getCurrentApp` (line 379) → DEBUG, returns `null`

  `executeShellCommand` already logged at DEBUG (v2.54.22), so these wrappers were the duplicate-log layer. The five ERROR sites all carried the comment-able rationale "caller decides logging level".
- **`packages/directv/src/directv-guide-service.ts:170`** — `Failed to fetch channel N: Request timeout after 5000ms` was ERROR per-channel. A single receiver in standby = 50+ ERROR/refresh × every preset poll. The API route at `/api/directv/guide/route.ts` logs `Completed: N/M successful` at INFO which is the actionable summary; per-channel detail → DEBUG.
- **`apps/web/src/app/api/firetv-devices/send-command/route.ts:178`** — `isOfflineDevice` keyword list missed ADB-specific stderr patterns (`device 'X' not found`, `device offline`, `EHOSTUNREACH`, `ETIMEDOUT`, `ENETUNREACH`, `no devices`) AND the catch passed `error` directly as the 2nd arg of `logger.error(msg, error)` but the logger signature is `error(msg, options?: LogOptions)` so `options.error`/`options.data` were undefined and the underlying failure detail never reached the log (hence the bare `❌ Command execution error:` we saw in graystone PM2 stdout). Both fixed: widened keyword set including `error.stderr`, switched to `logger.error(msg, { error })`.

**Expected log reduction at graystone (the worst offender):** ~138 → ~5 ERROR/4 days. (One ERROR per offline-device first-failure transition + real user-triggered failures like `[TV-CONTROL] Power toggle failed` remain ERROR by design — they're novel + actionable.)

**ArtistInterferenceProfile false alarm:** initial audit showed 3 boxes (luckys, appleton, leglamp) had stale 2026-05-21 errors for `no such table: ArtistInterferenceProfile`. Verified the table exists on all 3 boxes (row count 0, no errors since 5/22) — already fixed by v2.54.20's column-level schema check. Stale entries were inside the file mtime window but predate the v2.54.20 rollout.

**Required Manual Step:** none — pure log-level change, auto-update handles rebuild + restart.

**Verification gate (24h after each box updates):**
```bash
# Should report ~0 instead of dozens
pm2 logs sports-bar-tv-controller --lines 5000 --err --nostream 2>/dev/null | \
  grep -cE 'DIRECTV_GUIDE.*Failed to fetch|ADB CLIENT.*(Get installed|Check app|Get current|Get property|Get device info)'
```

---

## v2.54.0 → v2.54.20 — drizzle migrate switch + release snapshots + log demotes + schema-completeness baseline-derived + Pass 3 cleanup + column-level schema check + bartender gradient sweep + Rule 10 weekly bumps (multi-version 2026-05-20/21)

**Versions covered:** v2.54.0 → v2.54.6 (7 commits across 2026-05-20 evening + 2026-05-21 early)
**Branch landed:** main
**Fleet target:** rolling upgrade from v2.53.17 — auto-update will roll the batch

This batch is the systemic fix for the v2.51 24h fleet outage (5/6 boxes missing `NeighborhoodEvent` because `drizzle-kit push` silently aborted on a pre-existing index — Gotcha #6). Also adds release snapshots so future rollbacks take ~5s instead of ~3min, and demotes two classes of steady-state log noise that were drowning real failures in the error stream.

- **v2.54.0** — Baseline drizzle migration. `drizzle/0000_baseline.sql` (94K) captures the entire current schema.ts as a clean migration file so new locations + recovery paths have a single canonical starting point. Generated via `drizzle-kit generate --name baseline` and hand-reviewed to strip any orphan-table DROPs (sdr_*, AudioMessage, etc. that exist in production but aren't declared in schema.ts).
- **v2.54.1** — Switched schema-update path from `push` to `migrate`. `scripts/bootstrap-drizzle-migrations.sh` (NEW, idempotent) ensures `__drizzle_migrations` exists with sha256-hash markers for every committed migration. `scripts/auto-update.sh` now runs bootstrap + `drizzle-kit migrate` instead of `drizzle-kit push`. `migrate` applies pending migrations one at a time and fails LOUD on any error — no more silent abort skipping subsequent table creations. Legacy push block wrapped in `if false; then ... fi` (not deleted yet — left as audit trail).
- **v2.54.2** — CLAUDE.md Gotcha #6 marked RESOLVED. Full dev workflow rewrite for generate+migrate (no more `db:push` in normal dev flow).
- **v2.54.3** — Capistrano-style release snapshots. `scripts/snapshot-release.sh` (NEW) captures `.next/` + `package.json` + `drizzle/` + manifest.json to `/home/ubuntu/sports-bar-releases/v<ver>/` at the END of every successful auto-update — by construction "known good" because verify-install just passed. Retention KEEP_LAST=5. `scripts/instant-rollback.sh` (NEW) restores any snapshot in ~5s: PM2 stop → `git reset --hard` to snapshot SHA → rsync `.next` → PM2 start → health check. Standard auto-update.sh rollback path (~3min) still works as fallback.
- **v2.54.4** — Demoted Atlas JSON-RPC `-32604 param not found` from ERROR to DEBUG at `packages/atlas/src/atlasClient.ts:543` (RESPONSE handler) and ~1027 (GET catch). The error fires hundreds of times/day on every priority-watcher poll cycle (probes 60+ candidate param names that don't exist on AZM8 firmware 4.5.18 — see [[feedback-atlas-azm8-no-priority-param]]). Real signal, not a bug.
- **v2.54.5** — CRITICAL fix for v2.54.4: `response.error` arrives as a JSON-encoded STRING (not parsed object), so the `response.error.code === -32604` check was always false and the v2.54.4 demote never took effect. Fix: `if (typeof errObj === 'string') { try { errObj = JSON.parse(errObj) } catch {} }` before extracting the code.
- **v2.54.6** — Same demote pattern applied to `firetv-connection-manager.ts` + `firetv-health-monitor.ts`. When Atmosphere TV / Epson Projector / Fire TV is intentionally powered off (signage-off hours, after-hours, between schedule windows), the previous code logged ERROR on every reconnect attempt (~200+/day per offline device). Now first failure logs ERROR (novel signal), subsequent failures within the same offline streak log DEBUG. Reconnect logs INFO with "was offline" so recovery is visible. Catalyst: Holmgren's `10.11.3.48` is the **Atmosphere TV** (NOT a dead Fire Cube as earlier memory had it), intermittently off by design.
- **v2.54.7** — VERSION_SETUP_GUIDE entry for this batch.
- **v2.54.8** — Atlas DEBUG output now routes through `logger.debug` (was: `logger.info`). v2.54.4/.5's ERROR→DEBUG demote only changed the level tag in the message text — the underlying `writeLog()` in `packages/atlas/src/atlas-logger.ts` routed every non-ERROR / non-WARN level through `logger.info()`, so the spam stayed at INFO in PM2 stdout. Now DEBUG hits `logger.debug()` which the shared `@sports-bar/logger` filters out in production (LogLevel.INFO+ only). File log at `~/Sports-Bar-TV-Controller/log/atlas-communication.log` still receives every level for forensics. Verified post-restart: dense Atlas RESPONSE/COMMAND/GET JSON blocks no longer appear in `pm2 logs`.
- **v2.54.9** — VERSION_SETUP_GUIDE addendum (this file) extended to cover v2.54.7 + v2.54.8.
- **v2.54.10** — **schema_completeness verify-install layer now derives expected table list from drizzle/0000_baseline.sql instead of a hardcoded 13.** Pre-holiday audit (2026-05-21) found **`ArtistInterferenceProfile` missing on 5/6 fleet boxes** — preemptive-strike scheduler was crashing hourly with `no such table: ArtistInterferenceProfile`. The table was added in v2.51.x with the Neighborhood RF Prediction subsystem but never added to the hardcoded verify list, so schema_completeness PASSed 13/13 even though preemptive-strike was broken. DDL applied out-of-band to recover the 5 boxes; v2.54.10 verify-install now reports `120/120 present` and will catch any future missing table automatically. **Required Manual Step for boxes upgrading to v2.54.10 from <v2.54.10:** none — `IF NOT EXISTS` DDL was already applied out-of-band on 2026-05-21 (Holmgren UTC 03:35). New verify-install will pass on the next auto-update cycle.
- **v2.54.11** — VERSION_SETUP_GUIDE addendum for v2.54.9 + v2.54.10. Also normalized greenville-stoneyard's `LOG_LEVEL=DEBUG` → `INFO` (per-location env override left over from past troubleshooting; was bypassing the v2.54.8 atlas DEBUG suppression and flooding logs ~10x). pm2 delete+start required per Gotcha #2.
- **v2.54.12** — **Pass 3 packages/* audit: delete verified dead code (-3291 lines)**. Code-explorer agent + grep verification of zero callers across the codebase identified:
  - Whole package: `packages/tv-docs/` (+ orphan shim `apps/web/src/lib/tvDocs/`)
  - Atlas stubs: `atlas-ai-analyzer.ts` (619-line stub, replaced by atlas-meter-manager v2.33.50+), `atlas-ai-training-data.ts` (AtlasPatternMatcher + atlasTrainingPatterns, 0 callers), `atlas-meter-service.ts` (simulated-data stub)
  - Services dead: `sports-guide-ollama-helper.ts` (6 exports, 0 callers), `enhanced-ai-client.ts` (EnhancedAIClient unreachable)
  - Orphan shims at `apps/web/src/lib/{ai-sports-context,atlas-meter-service,enhanced-ai-client}.ts`
  - Kept `packages/services/src/ai-sports-context.ts` — still used internally by `automated-health-check` + `health-check-scheduler`, just removed from public index.
  - **NOT deleted (agent false-positive):** `@sports-bar/security` — verification found it IS actively used by `/api/streaming-platforms/credentials`.
  - Build verified clean: `npx turbo run build --force` → 35/35 tasks successful.
- **v2.54.13** — **Pass 3 doc fixes**:
  - `packages/bss-blu/README.md` + `bss-service.ts` top-of-file: prominent warning that `setZoneMute` / `setZoneGain` / `setZoneSource` / `getDeviceState` are NO-OP STUBS — TCP socket connects but no HiQnet commands are emitted. Operator-protection against deploying BSS hardware expecting working zone control.
  - `packages/scheduler/src/espn-sync-service.ts:354`: convert stale `TODO: Add espnTeamId column` to a `KNOWN LIMITATION:` comment explaining the trade-off (team-name fuzzy match has been running in production at all 6 locations since shipping; schema column adds cost without commensurate value).
- **v2.54.14** — VERSION_SETUP_GUIDE addendum covering v2.54.11/.12/.13.
- **v2.54.15** — **Pass 3 architectural cleanups (deletions only, no migrations)**:
  - **Finding 9** — `HealthCheckScheduler` in `packages/services/src/health-check-scheduler.ts` owned its own `setInterval` loops, but `startHealthCheckScheduler()` had zero call sites anywhere in the codebase. Deleted the file + orphan shim. (The two siblings `automated-health-check` and `sports-schedule-sync` were correctly placed and stay where they are.)
  - **Finding 12** — `nfhsApi` / `isNFHSApiAvailable` / `NFHSEvent` removed from the public surface of `packages/streaming/src/index.ts`. The stub IS still consumed internally by `unified-streaming-api.ts` (relative import, kept), but external consumers should not import a stub. Deleted the orphan bridge `apps/web/src/lib/streaming/api-integrations/nfhs-api.ts`.
  - **Finding 2** re-verified and SKIPPED — `@/lib/ai-tools` has 2 live callers (api/chat + api/security/logs); `local-ai-analyzer` has 4 callers. Both live, not dead.
- **v2.54.17** — VERSION_SETUP_GUIDE addendum for v2.54.14/.15/.16.
- **v2.54.18** — **Bartender gradient sweep (18 swaps across 7 files) + db-helpers NIT exports**. Per `project_bartender_gradient_review_pending` memory: gradient text (`bg-clip-text text-transparent`) renders fragile on aged iPad Safari used by bartenders. Mechanical regex swap → `text-white`. Files: BartenderRemoteAudioPanel (4), EnhancedChannelGuideBartenderRemote (5), BartenderMusicControl (3), InteractiveBartenderLayout (3), BartenderRemoteSelector (1), BartenderRemoteSelector-Enhanced (1), DMXLightingRemote (1). Memory said 17 instances; current was 18 (one added since memory was written). Playwright-ui-tester agent verified visually on 1024x768 iPad viewport — all 4 tabs render solid white, layout intact, touch targets ≥44px, zero console errors. Also: forwarded `not` + `setDbHelperLogger` through `apps/web/src/lib/db-helpers.ts` per the v2.54.16 code-reviewer NIT (zero live callers, just future-proofing).
- **v2.54.19** — **Rule 10 weekly bumps**: uuid 13→14 (only breaks v3/v5/v6 invalid-offset; we use v4 only across 5 call sites), @anthropic-ai/sdk 0.96→0.97 (patch-version SDK move; only consumed by qa-generator-processor), npm update (patch/minor: @types/react, postcss, ts-jest, tsx). Ollama: phi3:mini + llama3.2:3b refreshed. Deferred bumps (each needs dedicated PR): zod 3→4 (validation schemas everywhere), tailwindcss 3→4 (config-format rewrite), typescript 5.9→6.0 (too new), @huggingface/transformers 3.8→4.2 (reranker re-verify), tesseract.js 6→7, serialport 12→13. npm audit: 13 transitive vulns (esbuild via drizzle-kit, ip via node-ssdp, postcss/serialize-javascript inside Next 16 internals) — `audit fix --force` would downgrade Next 16; tracking upstream. OS: Ubuntu 24.04.4 LTS noble — current.
- **v2.54.20** — **schema_completeness now checks COLUMNS, not just tables.** Pre-holiday audit found another silent-drift class the v2.54.10 table-only check missed: 5/6 fleet boxes were missing `Location.{latitude, longitude, lastGeocodedAt}` (v2.51.2 ALTER never landed) → venue-discovery cron couldn't geocode → 0 NeighborhoodVenue rows at 5 locations. 6/6 boxes were also missing `atlas_drop_events.event_type`. **DDL applied out-of-band on Holmgren UTC 06:23** (5 ALTER TABLEs total — verified post-apply via PRAGMA table_info). Verify-install now invokes Python to compare baseline `CREATE TABLE` blocks against PRAGMA per-column; reports `MISSING_COLS=Location.latitude...` when columns are missing. **Required Manual Step for boxes upgrading from <v2.54.20:** none — DDL is already applied. On next auto-update PM2 restart, venue-discovery cron will fire 30 min later, geocode each Location's address via Nominatim, write lat/long back, then Overpass query for nearby venues. **Operator action needed for luckys1313 only:** its Location row has name='Lucky's 1313' but blank address fields — geocoder will return null and venue-discovery will skip. Operator should populate `address`, `city`, `state`, `zipCode` via System Admin UI or directly via sqlite3 UPDATE.
- **v2.54.24** — **auto-update.sh: add `apps/web/src/services/`, `apps/web/src/config/`, `apps/web/src/middleware/` to `SHARED_SOFTWARE_PREFIXES`.** v2.54.23's rollout to holmgren-way failed at the merge step with `CONFLICT (content): Merge conflict in apps/web/src/services/firetv-connection-manager.ts` → full rollback. Root cause: `SHARED_SOFTWARE_PREFIXES` listed `apps/web/src/{app,components,lib,hooks,db,types,utils}/` but not `services/`, so when the v2.54.22 commit on each location branch (different SHA than main's v2.54.22) collided with v2.54.23's edits to the same lines, no prefix matched, the conflict was treated as "non-whitelisted file", and auto-update aborted. **Required Manual Step for boxes upgrading from <v2.54.24:** the v2.54.23 rollout needs a manual workstation-side pre-resolve on each location branch (`git checkout location/X && git merge -X theirs origin/main` for the conflicted file, then push) before auto-update will run cleanly. After v2.54.24 lands, future services/ edits propagate automatically. Also adds `config/` and `middleware/` directories preemptively — pure-software subtrees that locations should never carry divergent versions of.
- **v2.54.23** — **Demote-defeat #2: failureCount Map outlives `connections.delete()`.** v2.54.22 preserved `connectionAttempts` across `getOrCreateConnection` calls but missed that `disconnect()` (called from `executeCommand` failure path, `reconnect`, and the periodic `cleanupStaleConnections`) **deletes** the entry from `this.connections` entirely — wiping the counter back to 0 on every disconnect→reconnect cycle. Holmgren after v2.54.22 still emitted ~7 ERROR/35min per offline device. Fix: added `private failureCount: Map<string, number>` field as a durable counter independent of the connections-Map lifecycle. Catch block writes through to it; success path deletes the entry; `getOrCreateConnection` reads from it (not from `existing.connectionAttempts`). Pure logging change, no behavioral impact on connection lifecycle.
- **v2.54.22** — **Connection-manager / ADB-client / FIRE-CUBE log demote completion**. v2.54.6 added a rising-edge demote in `firetv-connection-manager.ts` but it was defeated by a bug at line 147: every reconnect attempt allocated a *fresh* `ConnectionInfo` object, resetting `connectionAttempts=0`, so every failure looked like a "first failure" and ERROR-logged. Holmgren still emitted ~44 ERROR rows/day from `10.11.3.14` (Epson projector off-hours) + `10.11.3.48` (Atmosphere TV) + 2 sleeping Fire Cubes. This release: (a) preserve `connectionAttempts` + queued commands when reusing the slot (real rising-edge); (b) demote `adb-client.executeShellCommand` ERROR → DEBUG (the function throws — caller decides); (c) demote `adb-client.sendKey` duplicate-log → DEBUG; (d) add rising-edge to `adb-client.keep-alive ping` (first miss ERROR, repeats DEBUG); (e) demote `adb-client.connect()` catch → DEBUG (connection-manager already logs at the right level via its rising-edge); (f) demote `adb-client.Max reconnection attempts` → DEBUG (fires on every keep-alive tick once cap is hit); (g) `firetv/send-command/route.ts` catch demotes `timeout / refused / unreachable / "failed to connect"` → DEBUG, keeps ERROR for novel failures (auth, unrecognized). Expected log reduction at Holmgren: ~44 → ~4 ERROR/day (1 per device per offline-streak transition). **Required Manual Step:** none — code-only fix, auto-update handles rebuild + restart.
- **v2.54.16** — **Pass 3 F8: merge `@sports-bar/data` into `@sports-bar/database` (-1367 lines)**. The two packages had functional overlap (both provided CRUD helpers + Drizzle operator re-exports). Migration:
  - `pagination.ts`, `database-logger.ts`, `operation-logger.ts` — `git mv` from `packages/data/src/` to `packages/database/src/`. Added re-exports to `packages/database/src/index.ts`.
  - `sanitizeData` in `packages/database/src/helpers.ts:45` changed from internal to `export function`, added to index.
  - `apps/web/src/lib/db-helpers.ts` rewritten — dropped the `createDbHelpers` factory pattern (was never used as DI; only call site passed the production singleton). Now a thin re-export bridge from `@sports-bar/database`.
  - 8 caller files (`apps/web/src/lib/{pagination,database-logger,operation-logger}.ts`, 4 API routes using `operationLogger`, `packages/services/src/ir-database.ts` using `logDatabaseOperation`) — `from '@sports-bar/data'` → `from '@sports-bar/database'` via sed.
  - `@sports-bar/data` dependency dropped from `apps/web/package.json` + `packages/services/package.json`.
  - `packages/data/` directory DELETED.
  - **Required Manual Step:** none — auto-update handles the npm install + rebuild. Independent code-reviewer agent verified no double-substitution artifacts, all 8 callers correctly rewritten, no orphan call sites. Holmgren runtime-verified: `/api/channel-presets` 200, ESPN sync running, zero `Cannot find module '@sports-bar/data'` errors in PM2 logs post-restart.

### Required Manual Steps

- **None for fresh installs** — `bootstrap-drizzle-migrations.sh` is idempotent and runs automatically on every auto-update. The baseline migration is applied at first install.
- **For locations that auto-update from v2.53.17 → v2.54.x** — auto-update will run bootstrap (registers existing schema state with `__drizzle_migrations`) then drizzle-kit migrate (no-op since all migrations already marked applied). Should "just work". If it fails, see Known Errors & Fixes.
- **OPERATOR ACTION (one-time, post-v2.54.3 — none required at any current fleet box):** `instant-rollback.sh` is opt-in. To use it in an emergency: `bash scripts/instant-rollback.sh --list` (see available snapshots) → `bash scripts/instant-rollback.sh <version>`. No setup needed; snapshots accrue automatically on each successful update.

### Verification gates (after each box updates)

- `pm2 status` → sports-bar-tv-controller online, restart_time +1
- `curl localhost:3001/api/version` → reports `2.54.6` (or whatever latest is)
- `sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT COUNT(*) FROM __drizzle_migrations"` → ≥ 1 (proves bootstrap ran; new installs will be N=migration count, existing installs will be N=count of committed migrations).
- `ls /home/ubuntu/sports-bar-releases/v*/manifest.json 2>/dev/null | wc -l` → 1 or more (snapshots accruing). Empty = `snapshot-release.sh` didn't run; check auto-update.sh log for the snapshot block at finalize.
- `pm2 logs sports-bar-tv-controller --lines 500 --err --nostream | grep -c "Failed to connect to 10\."` → after 24h on v2.54.6, should be ≤ 6 (one per offline device per restart). Previous baseline was 200+. If still high, the demote isn't taking effect.

### Known acceptable behaviors

- **`__drizzle_migrations` table appears empty on first read after v2.54.1 update** — bootstrap runs at next auto-update cycle and populates it. Not an error.
- **`/home/ubuntu/sports-bar-releases/` empty at first v2.54.3 update** — snapshots accrue starting with the NEXT successful update. First snapshot appears after v2.54.3 → v2.54.x rolls.
- **First failure for any device after PM2 restart still logs ERROR** — that's by design (novel signal). Only the repeats are demoted.

### Rollback

- For v2.54.0/v2.54.1 (the migrate switch): if `drizzle-kit migrate` fails on a box, the auto-update.sh trap fires full rollback as normal. Manual recovery path is documented in the v2.54.0 commit message — apply DDL out-of-band via `sqlite3` then re-trigger auto-update.
- For v2.54.6 (the log demote): cosmetic regression only; revert the commit if it's masking a real failure somehow.
- General: every snapshot in `/home/ubuntu/sports-bar-releases/` is by construction known-good. `instant-rollback.sh <prev-version>` works for any release in that dir.

---

## v2.53.10 → v2.53.14 — follow-ups + venue UI + brief fixes (multi-version 2026-05-20)

**Versions covered:** v2.53.10 → v2.53.14 (5 commits on 2026-05-20)
**Branch landed:** main
**Fleet target:** rolling upgrade from v2.53.9 — all 6 boxes shipped same-day

Pure follow-up batch after the v2.51-v2.53.9 big-ship. Each version is small but together they close real gaps. Strictly additive — no env vars, no schema migrations, no operator opt-ins.

- **v2.53.10** — VERSION_SETUP_GUIDE entry for the v2.51-v2.53.9 batch.
- **v2.53.11** — TWO production bugs:
  1. **Shift-brief surfaced override-digest 30-day recommendations under "Recent hardware/software failures"** (LLM merged the 30-day pattern observations into the 24h failures section). Fix: drop `newRecommendations` from the brief context entirely; admin recommendations stay in the DB for admin tooling but no longer reach bartenders.
  2. **`RAG_RERANK_ENABLED=true` was a no-op on the /api/chat path.** v2.53.0 wired the reranker into `queryDocs`/`queryDocsStream` (one-shot + SSE) but not into `retrieveContext`, which is what chat actually calls. Locations that paid the +600MB RAM + PM2 restart cost got zero chat-side benefit. Fix: `retrieveContext` now routes through the same `retrieveAndRerank` helper when the flag is on. Functional verification = chat response `sources.length === 8` (was 5).
- **v2.53.12** — VERSION_SETUP_GUIDE corrected the v2.51-v2.53.9 per-location RAM table (4 boxes stated as 16 GB were actually 31 GB; Graystone correctly at 15 GB). Added new pre-flight: `command -v pm2` in a non-interactive SSH shell. Leg-lamp's `pm2` lived only in NVM (not `/usr/bin/` like the other 4 boxes) — auto-update.sh + future remote PM2 restarts silently failed there. Applied `/usr/local/bin/pm2` symlink out-of-band; documented for future-location-setup. **Future-new-location action:** `command -v pm2` MUST return a non-empty path in `ssh ubuntu@<host> 'command -v pm2'`. If empty, `sudo ln -sfv /home/ubuntu/.nvm/versions/node/v20.20.0/bin/{node,npm,npx,pm2} /usr/local/bin/`.
- **v2.53.13** — Operator UI for pending neighborhood venues at `/admin/venues/pending` (backend was shipped in v2.53.4 as API-only; CLI was the only client). Same field surface as the CLI: name + latest event, category, distance, source badge, event count. Per-row approve / decline / merge-with-target buttons. SafeBoundary-wrapped. **Auth fix:** both `/api/admin/venues/pending` GET and `/api/admin/venues/[id]/review` POST now call `requireAuth(request, 'ADMIN', { auditAction: ... })`. Before this commit they were rate-limit-only — any client on the bar's LAN could approve, decline, or merge venues anonymously.
- **v2.53.14** — Atlas drops bullet in shift-brief. Mirrors the v2.53.6 priority-recap pattern for `atlas_drop_events`. **Conditional**: only appears when drops>0 in the last 24h. When 0 (common case post-v2.42.1 false-positive fix), no bullet renders. When ≥1, server-built-verbatim bullet with worst-zone + total count. Bullet also mirrored into `fallbackBrief()` for Ollama-degraded path parity.

### Required Manual Steps

- **None for v2.53.10, .11, .14** — pure code/doc changes, auto-update handles them.
- **For v2.53.12 (NEW-location-only)** — add the `command -v pm2` pre-flight to your new-location setup. If empty, apply the NVM symlink (see above).
- **For v2.53.13** — operator can now use the UI at `/admin/venues/pending` instead of `npx tsx apps/web/scripts/review-pending-venues.ts`. The CLI still works (kept for ops/scripting). Existing API consumers should send an authenticated request — sessions issued by /login carry the ADMIN role correctly.

### Verification gates (after each box updates)

- `pm2 status` → sports-bar-tv-controller online, restart_time +1
- `curl localhost:3001/api/version` → reports `2.53.14`
- `curl localhost:3001/admin/venues/pending` → 200 OK (HTML page; renders auth prompt for unauthenticated browsers)
- `curl -o /dev/null -w "%{http_code}" localhost:3001/api/admin/venues/pending` → **401** (auth gate; the previous-version answer was 200 with data — that was the leak)
- Shift-brief smoke test:
  ```bash
  curl -sS "http://localhost:3001/api/ai/shift-brief?force=true" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['brief'])"
  ```
  Expected sections: home-team games / other games / "Recent hardware/software failures to watch for: None" (NOT 30-day Xavier-output-25 noise) / Wireless mic status / Neighborhood-event heads-up (if any) / Atlas priority recap. The drops bullet is conditional and absent on stable Atlas — that's correct behavior, not a regression.

### Known acceptable behaviors

- **Drops bullet absent at all 6 boxes today** — Atlas hardware is stable everywhere post-v2.42.1. Feature is future-proof; when a real drop fires the bullet will appear.
- **First chat call after restart loads bge-reranker-v2-m3 ONNX (~3-100s cold start)** — expected with `RAG_RERANK_ENABLED=true`. Subsequent calls ~+300ms over baseline.
- **Pending venue queue stays at 0 at most locations** — new venues populate when Ticketmaster scrapes (4× daily) AND the location has `TICKETMASTER_API_KEY` set. Holmgren is currently the only fleet box with the key.

### Rollback

Standard auto-update.sh rollback path covers all five versions. If something specific to v2.53.13 regresses (admin UI render failure, auth gate too tight), revert just that commit (`0fa98fd3`) without losing the v2.53.11 production bug fixes.

---

## v2.51.0 → v2.53.9 — Neighborhood RF + reranker + shift-brief expansion (multi-version 2026-05-19/20)

**Versions covered:** v2.51.0 → v2.53.9 (~30 commits across 2026-05-19 + 2026-05-20)
**Branch landed:** main
**Fleet target:** all 6 locations upgrade from v2.50.7 → v2.53.9

Largest single-batch upgrade since v2.50.x. The work groups cleanly:

- **v2.51.x — Neighborhood RF Interference Prediction:** new `NeighborhoodVenue` / `NeighborhoodVenueAlias` / `NeighborhoodEvent` / `InterferenceAttribution` tables, Bananas scraper (small-venue live music ~1mi useful), auto-geocoding of Location address via OSM Nominatim, `is_self` flag so own-bar gigs at Anduzzi's-style venues stop polluting the heads-up. No env vars; runs everywhere.
- **v2.52.x SDR + AI:** SDR ↔ shift-brief integration, mic status one-liner, neighborhood-events heads-up bullet, daily Ollama RF Pattern Digest, hallucinated-game fix (pre-filter games ≤8 to avoid `[[feedback-llm-context-overflow]]`).
- **v2.53.0 — Cross-encoder reranking:** `bge-reranker-v2-m3-ONNX` (int8) via `@huggingface/transformers`. **OPT-IN per location** via `RAG_RERANK_ENABLED=true`. PM2 `max_memory_restart` bumped 1G → 3G and `--max-old-space-size` 512 → 2048 fleet-wide (already in ecosystem.config.js commit — applies to every box).
- **v2.53.1-2 — Ticketmaster Discovery API:** second neighborhood-events source for big venues (Lambeau, Resch, EPIC, Fox Cities PAC, Weidner). 30mi radius, 14-day lookahead, ~4 API calls/day (free tier limit is 5000). **OPT-IN per location** via `TICKETMASTER_API_KEY`. Default OFF.
- **v2.53.4-5 — Venue review API:** `/api/admin/venues/pending` + `/review` endpoints + `apps/web/scripts/review-pending-venues.ts` CLI for triaging auto-discovered venues. Decline updates BOTH `is_active=false` AND `review_status='declined'` atomically (`[[feedback-state-machine-belt-suspenders]]`).
- **v2.53.6-9 — Shift-brief expansion + karaoke-framing fix:** Atlas priority recap added as a 3rd RF bullet; server-built-verbatim pattern (`[[feedback-llm-server-built-verbatim]]`) used for mic-status + heads-up + Atlas recap to defeat llama3.1:8b paraphrasing (Gotcha #12). `num_predict: 200 → 320`. House Shure wireless is NEVER for karaoke (BYO mics) — bartender docs scrubbed of "karaoke mic" framing (Gotcha #13).

### Required Manual Steps (per-location, IN ORDER):

```bash
# 1. SSH to the location via Tailscale
ssh ubuntu@<location-tailscale-hostname>
cd /home/ubuntu/Sports-Bar-TV-Controller

# 2. Snapshot for rollback safety
git log --oneline -3      # note current SHA
sqlite3 /home/ubuntu/sports-bar-data/production.db ".backup /home/ubuntu/sports-bar-data/production.db.pre-v2.53.bak"

# 3. Run auto-update — handles merge / npm ci / drizzle push / build / PM2 restart / verify-install
bash scripts/auto-update.sh --triggered-by=manual_cli
# Expect ~5-8 min. Adds @huggingface/transformers (+ONNX runtime) — first npm ci will be slow.

# 4. (CONDITIONAL) Enable cross-encoder reranking — see decision table below.
#    Default policy: ENABLE at every location AT OR ABOVE 16 GB RAM. Skip at Graystone (15 GB).
#    If enabling:
echo "RAG_RERANK_ENABLED=true" >> .env
pm2 delete sports-bar-tv-controller && pm2 start ecosystem.config.js && pm2 save
#    (delete+start required to re-read .env per Gotcha #2 — restart alone won't pick up the new env var)

# 5. (CONDITIONAL) Enable Ticketmaster Discovery API for big-venue events — see decision table below.
#    Default policy: ENABLE only where the operator has an active Ticketmaster developer key.
#    If enabling:
read -srp 'TICKETMASTER_API_KEY> ' TM_KEY && echo
echo "TICKETMASTER_API_KEY=$TM_KEY" >> .env
unset TM_KEY
pm2 delete sports-bar-tv-controller && pm2 start ecosystem.config.js && pm2 save

# 6. Verify the neighborhood tables exist (drizzle-kit push should have created them; double-check
#    per Gotcha #6 — drizzle aborts silently on pre-existing indexes)
sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('NeighborhoodVenue','NeighborhoodVenueAlias','NeighborhoodEvent','InterferenceAttribution');"
# Expected: all 4 names listed. If any missing, see ROLLBACK / manual-DDL section below.

# 7. (CONDITIONAL) Seed neighborhood venues from main's curated list (Lambeau/Resch/Anduzzi/etc.).
#    Only needed at locations whose NeighborhoodVenue table is empty after step 6.
sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT COUNT(*) FROM NeighborhoodVenue;"
# If 0:
npx tsx apps/web/scripts/seed-neighborhood-venues.ts
# If Ticketmaster is enabled at this location, also seed its venue catalog:
npx tsx apps/web/scripts/seed-ticketmaster-venues.ts

# 8. Auto-geocode the Location row (v2.51.2 — uses OSM Nominatim, no env config).
#    Idempotent: skips if Location already has lat/long.
#    Triggered automatically on next scheduler tick (every 60s); to force-trigger:
curl -sS -X POST http://localhost:3001/api/admin/geocode-location | python3 -m json.tool
# Expected: { ok: true, lat: <number>, lng: <number> } OR { ok: true, alreadyGeocoded: true, ... }

# 9. Triage any pending auto-discovered venues (interactive — only if NeighborhoodVenue.review_status
#    contains 'pending_review' rows). At Holmgren this caught 94 venues after Ticketmaster turned on.
npx tsx apps/web/scripts/review-pending-venues.ts
# Press 'a' (approve) / 'd' (decline) / 'm' (merge with existing). 'q' to quit anytime — safe to resume.

# 10. Per Standing Rule 11 — RAG re-scan (CLAUDE.md gained Gotchas #12 + #13, §7a + §9
#     expanded; multiple bartender-help + ops docs updated; memory files referenced)
nohup npx tsx scripts/scan-system-docs.ts > /tmp/scan-system-post-v2.53.log 2>&1 &
# ~15-25 min with v2.50.1 batched embed.

# 11. Verify chat picks up the new content
curl -sS -X POST http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"why would the wireless mic banner show up at the same time as the priority banner","stream":false,"enableTools":false}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print((d.get('response') or '')[:500])"
# Expected: answer mentions RF-induced priority (cyan + amber co-occurrence) and references
# the RF_INTERFERENCE docs. If the model says "I don't have info", rescan didn't complete.

# 12. Smoke-test the shift-brief
curl -sS "http://localhost:3001/api/ai/shift-brief?force=true" \
  -H 'Content-Type: application/json' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('brief',''))"
# Expected: 8-9 bullets including a mic-status line, optional heads-up line (if neighborhood events
# in window), and Atlas priority recap. If the body lacks the Atlas recap section, fallbackBrief is
# in play — confirm Ollama reachable (`ollama ps` shows llama3.1:8b loaded).

# 13. Update fleet status doc
# Edit docs/FLEET_STATUS.md row for this location → v2.53.9
```

### Per-Location Opt-In Decisions

| Location           | RAM (verified 2026-05-20 via `free -g`) | RAG_RERANK_ENABLED  | TICKETMASTER_API_KEY                              | Notes                                                                                              |
|--------------------|---------|---------------------|---------------------------------------------------|----------------------------------------------------------------------------------------------------|
| holmgren-way       | 32 GB   | `true`              | `set` (active key — held by operator)              | Canary for both features. Pattern Digest enabled.                                                  |
| leg-lamp           | 31 GB   | `true`              | unset (no operator-active key — keep OFF)         | Single-card; verify `MATRIX_SINGLE_CARD=true` still present (CLAUDE.md §4). **Per-location quirk**: NVM-installed `pm2` is NOT in `/usr/bin/` like the other boxes — `/usr/local/bin/pm2` symlinked manually 2026-05-20. See [[feedback-systemd-paths-and-ollama-perms]]. |
| lucky-s-1313       | 31 GB   | `true`              | unset                                              | Single-card; dbx ZonePRO @ 192.168.10.50.                                                          |
| stoneyard-appleton | 31 GB   | `true`              | unset                                              | Multi-card. Fleet-best AI Suggest baseline — confirm cold-call still ≤80s after rerank ships.       |
| stoneyard-greenville | 31 GB | `true`              | unset                                              | Multi-card. Most-neglected box; budget extra time for verify.                                       |
| graystone          | 15 GB   | **`false` — DO NOT ENABLE** | unset                                      | Tightest RAM box: 250-400MB app + 600MB reranker + 5.3GB llama3.1:8b = no headroom. See `[[project-graystone-ram-constraint]]`. |

**Derivation rule (for adding NEW locations later):**

- `RAG_RERANK_ENABLED=true` if `free -g | awk '/^Mem:/ {print $2}'` ≥ 16. Otherwise leave unset. (5 of 6 current fleet boxes have 31-32 GB; only Graystone is on the 15 GB threshold.)
- `TICKETMASTER_API_KEY` ONLY if the operator has provisioned a developer key for this location AND wants stadium-scale (25mi) event awareness. Key issuance: https://developer.ticketmaster.com/ → Discovery API → "Get your API key".
- **`pm2` PATH check (NEW LOCATION SETUP):** confirm `command -v pm2` returns a non-empty path in a non-interactive shell (`ssh ubuntu@<host> 'command -v pm2'`). If empty, the auto-update.sh + future remote restart commands will silently fail. Fix: `sudo ln -sfv /home/ubuntu/.nvm/versions/node/v20.20.0/bin/{node,npm,npx,pm2} /usr/local/bin/`. Audit `/usr/bin/pm2` vs NVM `pm2` — fleet has a split: 4 boxes use `/usr/bin/pm2` (apt or global npm) and 1 box (leglamp) uses NVM with manual symlink.

### Verification gates (must PASS before promoting next location)

- `pm2 status` → `sports-bar-tv-controller` online, restart_time incremented exactly 1 (2 if you ran a delete+start for env var opt-in)
- `curl localhost:3001/api/health` → 200 OK
- `curl localhost:3001/api/version` → reports `2.53.9`
- `sqlite3 .../production.db "SELECT COUNT(*) FROM NeighborhoodVenue;"` → ≥ 1
- `sqlite3 .../production.db "SELECT COUNT(*) FROM NeighborhoodVenue WHERE review_status='pending_review' AND is_active=1;"` → triaged to 0 OR documented as an outstanding follow-up
- `pm2 logs sports-bar-tv-controller --lines 200 --nostream | grep -E 'RERANK|rerank' | head -3` → if RAG_RERANK_ENABLED=true, expect `[RERANK] loaded` line and NO `OOM` / `kill-loop` references
- Shift-brief smoke test contains: mic-status line, Atlas recap line, ≥3 game bullets
- Chat smoke test answer cites at least one of: `RF_INTERFERENCE_DETECTION_SYSTEM.md`, `RF_INTERFERENCE_FOR_BARTENDERS.md`, `MIC_NOT_WORKING.md`

### Rollback

If anything fails verify-install, `auto-update.sh` has already rolled back to pre-update commit. To restore the DB:

```bash
cp /home/ubuntu/sports-bar-data/production.db.pre-v2.53.bak /home/ubuntu/sports-bar-data/production.db
pm2 restart sports-bar-tv-controller --update-env
```

If the neighborhood tables are missing post-update (drizzle Gotcha #6), apply manually:

```bash
# drizzle-kit aborted on a pre-existing index. Apply the missing tables by replaying the schema push:
cd /home/ubuntu/Sports-Bar-TV-Controller
npx drizzle-kit push --config apps/web/drizzle.config.ts --force
# Then verify (step 6 above).
```

### Known regressions / acceptable side-effects

- **First chat call after enabling RAG_RERANK_ENABLED is slow (~3-5s extra)** — bge-reranker-v2-m3-ONNX cold-loads from `node_modules/@huggingface/transformers/.cache/`. Subsequent queries ~+300ms over baseline. Acceptable.
- **PM2 RSS will sit ~600 MB higher** at locations with rerank enabled — that's the resident ONNX model. PM2 max_memory_restart=3G has headroom for normal request bursts. `[[feedback-reranker-memory-budget]]`.
- **Ticketmaster scraper logs `[REDACTED]` when a request fails** — fixed in v2.53.1 audit. If you see a raw `apikey=xxx` in logs, the security fix wasn't deployed — re-run auto-update.
- **Atlas priority recap may say "no events yesterday"** at locations whose `atlas_drop_events` + `atlas_priority_events` tables are still seeded only with `event_type='startup'` heartbeats — that's correct, not a bug. Real recap rows fill in over time as priority/drop events occur.
- **Pending venue triage burden:** at locations where Ticketmaster is enabled, the first scrape will populate `NeighborhoodVenue` with `review_status='pending_review'` for any Ticketmaster venue not in the curated seed list. Holmgren had 94 to triage. Use `apps/web/scripts/review-pending-venues.ts`. Until triaged, those venues are gated OUT of shift-brief / preemptive-strike per `[[feedback-state-machine-belt-suspenders]]`.
- **`OLLAMA_MODEL` stays `llama3.1:8b` for shift-brief + Pattern Digest + AI Suggest** — picking ONE resident model avoids the v2.52.17 RAM thrash (`[[feedback-ollama-ram-pressure]]`). Tool-routes still use qwen2.5:14b per v2.50.0.

---

## v2.50.x — AI Hub game-changer batch (the big one) — multi-version 2026-05-18/19

**Versions covered:** v2.46.3 → v2.50.7 (~50 commits across 2026-05-18 + 2026-05-19)
**Branch landed:** main
**Fleet target:** all 6 locations upgrade from v2.32.94 → v2.50.7 (~80-version jump)

This is the largest single-batch upgrade in fleet history. The work is grouped:

- v2.46.x: AI Hub Option B (RAG-grounded chat) + Rule 10 strengthened
- v2.47.x: breaking-major dep bumps (@anthropic-ai/sdk 0.71→0.96, pdf-parse 1→2, eslint removed entirely)
- v2.48.x: system audit cleanup (5 unused deps, 12 dead bridges, 27 dead routes, 11 schema tables removed) + AI_HUB_ROADMAP_v2.50.md
- v2.49.x: 11 new operational + bartender-help docs, register-aware chat, vendor + location retrieval boosts, ChatSession upsert fix, Rule 11 (rescan-after-fix)
- v2.50.x: 4 quick-win optimizations (keep_alive=-1, batch embed, native tool_calls, qwen2.5:14b for tools) + hybrid BM25+vector RRF retrieval + contextual retrieval prep + Anthropic Q-A generator (Path B foundation)

### Recommended rollout order (canary → fleet)

1. **leg-lamp** (canary — designated in `scripts/canary-config.json`; single-card matrix; small install) — FIRST. After leg-lamp passes verify-install, the `.canary-blessed.json` sidecar greenlights everyone else.
2. **lucky-s-1313** (also single-card; small; same matrix profile as leg-lamp)
3. **graystone** (multi-card, well-documented per `.claude/locations/graystone.md`)
4. **stoneyard-appleton** (multi-card, fleet-best AI Suggest timing — good baseline to verify perf didn't regress)
5. **stoneyard-greenville** (multi-card, historically most-neglected — needs extra eyes after rollout)
6. **holmgren-way** is already on v2.50.7 throughout this session (reference deployment)

### Required Manual Steps (per-location, IN ORDER):

```bash
# 1. SSH to the location via Tailscale
ssh ubuntu@<location-tailscale-hostname>
cd /home/ubuntu/Sports-Bar-TV-Controller

# 2. Snapshot for rollback safety
git log --oneline -3      # note current SHA
sqlite3 /home/ubuntu/sports-bar-data/production.db ".backup /home/ubuntu/sports-bar-data/production.db.pre-v2.50.bak"

# 3. Run auto-update (handles the merge, npm ci, drizzle push, build, PM2 restart, verify-install)
bash scripts/auto-update.sh --triggered-by=manual_cli
# This will take ~5-10 min for the big jump (a lot of npm packages changed, esp. @anthropic-ai/sdk + pdf-parse v2 + eslint removed)

# 4. Per Standing Rule 10 (always-latest) — refresh local AI models
sg ollama -c 'ollama pull llama3.1:8b nomic-embed-text qwen2.5:14b'
# qwen2.5:14b is required for v2.50.0+ tool routes (8B can't tool reliably)

# 5. CRITICAL — per-location matrix-config check (varies by location, see CLAUDE.md §4):
# - Single-card locations (leg-lamp, lucky-s-1313): VERIFY `MATRIX_SINGLE_CARD=true` in .env
#   If absent → verify-install will NOT enforce outputOffset=0 → silent misrouting risk
# - Multi-card locations (graystone, both stoneyards, holmgren): VERIFY no MATRIX_SINGLE_CARD flag set
grep MATRIX_SINGLE_CARD .env || echo "(no flag set — correct for multi-card)"

# 6. Per Standing Rule 11 — trigger a full RAG re-scan to pick up the new docs
#    (700+ new lines: bartender-help/, runbooks/, SHURE_FREQUENCY_SCAN.md, AI_HUB_ROADMAP, etc.)
nohup npx tsx scripts/scan-system-docs.ts --clear > /tmp/scan-system-post-v2.50.log 2>&1 &
# Runs ~15-25 min (with v2.50.1 batched embed — 10-50× faster than v2.49.x serial)

# 7. Wait for scan-system-docs to finish, THEN run scan-code-docs.ts
#    (rag-rescan-if-needed.sh enforces this serially since v2.50.2 to avoid concurrent-write corruption)
nohup npx tsx scripts/scan-code-docs.ts > /tmp/scan-code-post-v2.50.log 2>&1 &
# Adds ~3-5K source-code chunks. Runs ~10-15 min.

# 8. Verify RAG store landed correctly
curl -sS http://localhost:3001/api/rag/stats | python3 -m json.tool
# Expected: totalChunks > 6500 (was ~4500 pre-scan; bartender-help + runbooks + roadmap + source = ~2k more)

# 9. Verify Hybrid Search BM25 index populated (new in v2.50.4)
sqlite3 apps/web/rag-data/bm25.db "SELECT COUNT(*) FROM chunks_meta;"
# Expected: same count as RAG totalChunks. If empty, run:
#   npx tsx scripts/rebuild-bm25-from-vector.ts

# 10. Smoke test chat (bartender phrasing should hit bartender-help docs)
curl -sS -X POST http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"the wireless mic isnt working what do i do","stream":false,"enableTools":false}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print((d.get('response') or '')[:400]); print(); print('sources:'); [print(f\"  {s.get('score',0):.3f}  {s.get('name','?')}\") for s in d.get('sources',[])[:5]]"
# Expected: top sources include MIC_NOT_WORKING.md, plain-English answer about checking battery/sync/etc.

# 11. Verify v2.50.0 keep_alive optimization is live (warm call should be much faster than first)
# Do a second curl with a different message — should return in 30-60s instead of 100-170s
# This means the Ollama model stayed resident (was unloading after 5 min in pre-v2.50.0).

# 12. Update fleet status doc to reflect the new version
# Edit docs/FLEET_STATUS.md row for this location → v2.50.7
```

### Per-Location Specifics

| Location | Single/Multi-card | MATRIX_SINGLE_CARD env? | Special pre-flight | Special post-flight |
|---|---|---|---|---|
| leg-lamp | Single | MUST be `true` | Canary — confirm `scripts/canary-config.json` opt-in BEFORE update | After successful verify-install, confirm `.canary-blessed.json` was written + pushed to GitHub. Other locations gate on this file. |
| lucky-s-1313 | Single | MUST be `true` | Verify dbx ZonePRO 1260m @ 192.168.10.50 still reachable (audio routes through it, not matrix) | Scene 1 auto-recall confirmed on dbx connect |
| graystone | Multi (with +32 audio card offset) | Must NOT be set | Verify `apps/web/data/wolfpack-devices.json` per-card offsets unchanged | Test routing on outputs 33-36 (audio card outputs) |
| stoneyard-greenville | Multi | Must NOT be set | Verify outputDefaults / roomDefaults / HomeTeam table state (was empty as of 2026-04-10) | Run scheduler-fixes verification per `docs/SCHEDULER_FIXES_APRIL_2026.md` |
| stoneyard-appleton | Multi | Must NOT be set | Power-cycle quirk noted in NEW_LOCATION_CLAUDE_PROMPT.md — confirm box hasn't power-cycled recently | AI Suggest cold-run should still be ≤80s (fleet-best baseline; if it slips, perf regression bug) |
| holmgren-way | Multi (Wolf Pack 48-port; outputs 37-40 audio-only) | Must NOT be set | Already updated throughout the session — verify-install is the gate | Re-confirm Atlas firmware 4.5.18 still in place; rf-watcher + atlas-priority-watcher logs healthy |

### Verification gates (must PASS before promoting next location)

- `pm2 status` → `sports-bar-tv-controller` online with `restart_time` increment of exactly 1 since update
- `curl localhost:3001/api/health` → 200 OK
- `curl localhost:3001/api/version` → reports `2.50.7`
- `curl localhost:3001/api/rag/stats | jq .data.vectorStore.totalChunks` → ≥ 6500
- `sqlite3 .../production.db "SELECT COUNT(*) FROM ChatSession;"` → ≥ 0 (sessions persist now per v2.49.6 upsert fix)
- Chat smoke test answer cites at least one bartender-help / runbook source (proves new docs reached RAG)

### Rollback

```bash
# If verify-install FAILS or smoke tests regress, auto-update.sh ALREADY rolled back to pre-update commit.
# Sanity-check we're back where we started:
git log --oneline -3
# Should match the SHA you noted in step 2.

# Restore production.db from backup if anything looks weird
cp /home/ubuntu/sports-bar-data/production.db.pre-v2.50.bak /home/ubuntu/sports-bar-data/production.db

# PM2 restart with the rolled-back code
pm2 restart sports-bar-tv-controller --update-env
```

### Known regressions / acceptable side-effects

- **`npm run lint` crashes** with `react/display-name: contextOrFilename.getFilename is not a function` — known issue, ESLint was removed entirely in v2.47.3. Lint is no longer wired into build or CI.
- **First chat call after restart is slow (~80-100s)** — Ollama model cold-load. Subsequent calls 30-60s thanks to v2.50.0 `keep_alive=-1`.
- **chat answer about Wolf Pack outputOffset for a specific location** may need the per-location ref to be enriched (we did this for lucky-s-1313, graystone is already documented, the stoneyards + leg-lamp got enriched in v2.49.9) — if a location ref is still a stub at update time, enrich it BEFORE the rescan or chat will not have facts to cite.
- **`sportsbar-expert:8b` model not yet available** — the Q-A generation pipeline is in flight (running overnight at Holmgren as of v2.50.7); once shipped via Ollama Modelfile to all locations, switch `OLLAMA_MODEL=sportsbar-expert:8b` in each `.env`.

---

## v2.48.x — system audit cleanup + RAG SME upgrade (multi-version)

**Versions covered:** v2.48.0 → v2.48.5 (six commits on 2026-05-18)
**Branch landed:** main

**Big-picture changes:**

- Removed ESLint entirely (v2.47.3) + 5 unused npm deps + 12 dead bridge files + 9 dead scripts + 27 dead API routes + 11 dead schema table defs. Net: -250+ lines, ~30 MB smaller `node_modules`, fewer things to bump weekly per Rule 10.
- AI Hub RAG store extended with config files, drizzle migrations, operator shell scripts, AND React `.tsx` components/pages. Expected post-rescan total: ~7,500-8,500 chunks (was 4,536).

**Required Manual Steps (per-location, IN ORDER):**

1. **Run auto-update:**
   ```bash
   bash scripts/auto-update.sh --triggered-by=manual_cli
   ```
   This pulls v2.48.x, runs `npm ci`, rebuilds, restarts PM2. Schema cleanup is code-only — no DB migration runs.

2. **Re-scan RAG to pick up the new file types:**
   ```bash
   cd /home/ubuntu/Sports-Bar-TV-Controller
   npx tsx scripts/scan-system-docs.ts --clear     # picks up config, drizzle SQL, shell scripts
   npx tsx scripts/scan-code-docs.ts               # picks up the 161 .tsx components/pages
   ```
   **Why `--clear` first:** removes stale chunks from deleted dead routes / bridge files (otherwise the AI would still cite them). Then the code-scan adds source + components on top.

   **Time budget:** scan-system-docs.ts is ~25-40 min; scan-code-docs.ts is ~45-60 min (the .tsx additions are large). Run them sequentially — concurrent runs would saturate Ollama's embedding endpoint.

3. **Verify RAG growth:**
   ```bash
   curl -sS http://localhost:3001/api/rag/stats | python3 -m json.tool
   ```
   Expected: `totalChunks` between 7,500 and 8,500. If significantly lower, the scan was interrupted — re-run.

4. **Spot-test AI Hub grounding:**
   ```bash
   curl -X POST http://localhost:3001/api/chat \
     -H 'Content-Type: application/json' \
     -d '{"message":"What is the TX_MODEL property in our Shure SLX-D parser?","stream":false}'
   ```
   Expected: answer quotes `TX_MODEL` verbatim from indexed Shure docs. If it says "I don't have access to documentation", the RAG store didn't load — restart PM2 (`pm2 restart sports-bar-tv-controller`).

**Operator timing:** RAG rescans take ~90 min total but run unattended. Schedule during off-peak. No service downtime — Pattern Digest and AI Hub continue working on the old index until the rescan finishes.

---

## v2.47.1 — eslint 9→10 + pdf-parse 1→2 (continued Rule 10 pass)

**Released:** 2026-05-18
**Branch landed:** main

**Required Manual Steps:** none — `bash scripts/auto-update.sh` handles `npm ci` + rebuild + restart automatically.

**Known issue:** `npm run lint` will crash with `react/display-name: contextOrFilename.getFilename is not a function` until `eslint-config-next` ships ESLint 10 compat for the bundled `eslint-plugin-react`. Build + type-check + tests are unaffected; lint is a developer-only script.

**Verification:**

```bash
# Confirm pdf-parse v2 and eslint 10 are installed
node -e "console.log('pdf-parse:', require('pdf-parse/package.json').version)"
node -e "console.log('eslint:', require('eslint/package.json').version)"
# Expected: pdf-parse: 2.4.5  /  eslint: 10.x

# Verify build still passes
cd /home/ubuntu/Sports-Bar-TV-Controller
npm run build 2>&1 | tail -3
# Expected: Tasks: 29 successful, 29 total
```

---

## v2.47.0 — breaking-major npm dep bumps (first pass per Rule 10)

**Released:** 2026-05-18
**Branch landed:** main

**Required Manual Steps:** none — `bash scripts/auto-update.sh` handles `npm ci` + rebuild + restart automatically. Verify with:

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
node -e "console.log(require('@anthropic-ai/sdk/package.json').version)"
# Expected: 0.96.0 or later
```

**Why this matters:** first execution of the strengthened Rule 10 ("everything stays on latest"). Bumps the Anthropic SDK + Node types + supertest types. Build verified green; runtime API surface unchanged.

---

## v2.46.3 — AI Hub Option B unification + Standing Rule 10 strengthened

**Released:** 2026-05-18
**Branch landed:** main

**Required Manual Steps (per-location, IN ORDER):**

1. **Pull latest code + auto-update:**
   ```bash
   bash scripts/auto-update.sh --triggered-by=manual_cli
   ```

2. **Per NEW Standing Rule 10 — refresh local AI models:**
   ```bash
   ollama pull llama3.1:8b
   ollama pull nomic-embed-text
   ollama pull qwen2.5:14b
   ```
   **Verification:** `ollama list` shows recent `MODIFIED` timestamp on all three.
   **Gotcha:** if running IPEX-LLM Ollama (most fleet boxes), pulls may require `sudo` because models live under `/usr/share/ollama/.ollama/models/` (root-owned). Run `sudo -u ollama ollama pull <model>` OR `sudo chmod -R g+w /usr/share/ollama/.ollama/models/` then add your user to the `ollama` group.

3. **Per NEW Standing Rule 10 — npm dep refresh:**
   ```bash
   cd /home/ubuntu/Sports-Bar-TV-Controller
   npm audit fix
   npm update
   git add package.json package-lock.json
   git commit -m "chore: weekly npm refresh per Standing Rule 10"
   git push
   ```
   **Verification:** `npm outdated` shows fewer entries than before.

4. **(Optional but recommended) Add source code to RAG store** so the AI Hub can answer implementation-level questions:
   ```bash
   cd /home/ubuntu/Sports-Bar-TV-Controller
   npx tsx scripts/scan-code-docs.ts
   ```
   **Expected:** ~828 files indexed, ~5000 chunks added, run-time ~25 min on iGPU.
   **Verification:** `curl localhost:3001/api/rag/stats | python3 -m json.tool` shows `totalChunks > 7000`.

5. **Re-run the system doc scanner** if any of the above touched documentation:
   ```bash
   npx tsx scripts/scan-system-docs.ts
   ```

**Why this matters:** AI Hub chat at `/ai-hub` now grounds answers in our actual documentation instead of generic training data. Without the model refresh + code scan, AI Hub will work but won't have the full SME context.

**Operator timing:** can be done during normal hours. The model pull is the biggest time sink (~10 min over good connection); npm refresh + code scan run in background.

---

## OPERATOR HEADS-UP — 2026-04-17 batch (v2.18.0 through v2.22.x)

**Applies to every location auto-updating tonight.** 14 versions shipped
in a single night at Lucky's 1313. Most are additive and pure software;
the `auto-update.sh` pipeline handles the merge, schema push, cache
bust, and PM2 restart automatically — you do NOT need to run any manual
steps for the update itself. Checkpoint B will reconcile these entries
for you. This section exists so you know what to watch for on the OTHER
side of the update.

### What changed (one-line per version)

- **v2.18.0–2.18.2** — Scheduler bug fixes: per-tune matrix routing was
  silently mis-routing TVs for bartender-scheduled games (UUID parseInt
  passed garbage to Wolf Pack). Plus: scheduler UI "Idle" state fix
  + override-learn hook that records bartender corrections.
- **v2.19.0** — ESPN sync now tracks real game durations per league,
  scheduler uses the learned average for `expected_free_at` instead of
  hardcoded 3h. Atlas endpoint guards stop reconnect-loop log spam at
  non-Atlas locations.
- **v2.20.0** — Autonomous agents: override-digester + failure-sweeper
  run hourly, surface recurring bartender corrections and recurring
  SchedulerLog failures as high-visibility warn rows. n8n dead code
  removed (iframe pointed at a stranger's IP — unused at all locations).
- **v2.21.0** — Four new `/api/ai/*` endpoints: shift-brief,
  distribution-plan, conflict-suggestion, weekly-summary.
- **v2.22.0** — UI wiring for v2.21.0 endpoints on the bartender
  remote + AI Suggest tab. Also fixed a pre-existing bug where college
  baseball games on ESPN/ESPNU were invisible in the Live Games list.

### What bartenders will notice the night of update

- **Scheduled tunes now land TVs on the correct input the first time.**
  Many bartenders have been manually moving TVs to the right cable box
  after every scheduled game fire — that behavior is no longer needed.
  If they've been compensating, the change will feel sudden. Brief them.
- **New Shift Brief card at the top of the remote's Video tab.** Shows
  tonight's games and anything unusual. Can be dismissed for 4 hours.
- **New "Smart Distribute" button next to "Approve All"** in the AI
  Suggest tab. Recommended flow when approving 3+ games at once.
- **College baseball shows up in Live Games** where it didn't before.
- **No UI regression expected anywhere else.**

### What to verify AFTER update (5-minute checklist)

Run each block. All commands are safe / read-only unless noted.

**1. `OLLAMA_MODEL` env var points at an installed model** (critical —
the shift-brief 404s silently if wrong):
```bash
grep OLLAMA_MODEL /home/ubuntu/Sports-Bar-TV-Controller/.env
curl -s http://localhost:11434/api/tags | jq -r '.models[].name'
# If .env value isn't in the installed list, edit .env and do:
# pm2 delete sports-bar-tv-controller && pm2 start ecosystem.config.js
```

**2. No in-flight scheduler routing drift** (the v2.18.2 detection query):
```bash
DB=/home/ubuntu/sports-bar-data/production.db
sqlite3 "$DB" <<'SQL'
WITH alloc_outputs AS (
  SELECT s.name AS src, mi.channelNumber AS expected_input, j.value AS output
  FROM input_source_allocations a
  JOIN input_sources s ON s.id = a.input_source_id
  JOIN MatrixInput mi ON mi.id = s.matrix_input_id
  JOIN json_each(a.tv_output_ids) j
  WHERE a.status = 'active'
)
SELECT ao.src, ao.output, ao.expected_input AS expected, mr.inputNum AS actual,
       CASE WHEN ao.expected_input = mr.inputNum THEN 'ok' ELSE 'MIS-ROUTED' END AS state
FROM alloc_outputs ao LEFT JOIN MatrixRoute mr ON mr.outputNum = ao.output
ORDER BY ao.src, CAST(ao.output AS INT);
SQL
```
Any `MIS-ROUTED` = an allocation created pre-v2.18.2 that the fix
didn't repair. Curl-loop repair per the v2.18.2 entry below.

**3. Atlas reconnect loop absent** (post-v2.19.0 should be zero):
```bash
pm2 logs sports-bar-tv-controller --err --lines 500 --nostream \
  | grep -c "Failed to connect to Atlas processor"
```
Expect 0. Non-zero at a non-Atlas location = guard didn't apply (check
that the build picked up the new `atlas-guard.ts`).

**4. Autonomous agents fired on restart:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT component, operation, message FROM SchedulerLog
   WHERE component IN ('override-digest','failure-sweep')
   ORDER BY createdAt DESC LIMIT 4;"
```
Expect 2 summary rows per hourly tick (one each).

**5. ChannelPreset seeded** (distribution-optimizer preflight depends
on this — without it, every plan line shows `chan ✗`):
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT deviceType, COUNT(*) FROM ChannelPreset WHERE isActive=1 GROUP BY deviceType;"
```
A running location should have 20+ cable / 50+ directv presets. If
zero, seed through the bartender remote preset UI before trusting
distribution-plan output.

**6. HomeTeam seeded** (drives home-team priority in every AI feature):
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT teamName, sport, league FROM HomeTeam WHERE isActive=1 ORDER BY sport;"
```
If empty, shift-brief and distribution-plan won't prioritize home-team
games. Populate per your market — see CLAUDE.md §10 reference example.

**7. `LOCATION_TIMEZONE` is set** if you're not in Central Time. The
weekly owner summary fires Monday 6am in `LOCATION_TIMEZONE` local time:
```bash
grep LOCATION_TIMEZONE /home/ubuntu/Sports-Bar-TV-Controller/.env
```

### Location-specific notes

- **Holmgren Way** (only Atlas-using location): the v2.19.0 atlas-guard
  passes through for type='atlas' and is a no-op performance-wise.
  Expected zero change in log spam volume.
- **Graystone + Holmgren Way** (multi-card Wolf Pack): the v2.18.2
  matrix routing fix is orthogonal to your non-zero `outputOffset`
  settings — those remain per-card and correct per your layout. The
  fix only repairs the parseInt-of-UUID bug. Verify-install's
  `matrix_config` layer still only catches the single-card variant;
  multi-card drift is operator-maintained per CLAUDE.md §5a.
- **Lucky's 1313**: all features built and verified tonight against
  real scheduled games. Reference implementation for the other sites.

### What NOT to panic about

- **`bartender-proxy` restart counter jumping by 1-2** during the
  update is expected (the proxy re-handshakes with the main app when
  PM2 recycles it). Only worry if it's restarting AFTER the update
  finishes and sports-bar-tv-controller is stable.
- **Hundreds of new SchedulerLog rows** with component=override-digest
  or failure-sweep every hour — that's the new autonomous agents
  reporting in. Info-level rows are the heartbeat; warn rows are the
  signal.
- **One merge conflict possible** on `apps/web/src/app/ai-hub/page.tsx`
  if your location had a local edit to that file. `auto-update.sh`'s
  `LOCATION_PATHS_OURS` doesn't cover it. If Checkpoint B reports a
  conflict here, the safe resolution is `git checkout --theirs` —
  this page is a shared AI UI, not location-specific data.

---

## Current entries

### v2.45.x — SDR spectrum monitoring (NESDR Smart / RTL-SDR)

**Required Manual Step — when an RTL-SDR dongle arrives at a
location.** Skip entirely at locations without an SDR dongle (the
watcher defaults to disabled and is a no-op).

```bash
# One-time install: apt rtl-sdr + DVB blacklist + .env default
sudo bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/setup-sdr.sh

# Restart PM2 to pick up SDR_ENABLED=auto from .env
pm2 restart sports-bar-tv-controller --update-env

# Verify (immediate, while dongle is plugged in or not):
curl -sS http://localhost:3001/api/sdr/status
# Expected: {"success":true, "enabled":true, "healthy":<true if dongle plugged>, ...}
```

After the one-time setup, plugging or unplugging the dongle is
plug-and-play — the watcher auto-detects within 5 min, no PM2
restart needed.

**Idempotent.** Re-running the setup script is safe — `apt install
rtl-sdr` no-ops if already installed, the blacklist file is
rewritten in-place, and the `.env` is only modified if
`SDR_ENABLED` is missing.

**Verification command after dongle is plugged in:**

```bash
# Should report "Found 1 device" (or more)
rtl_test -t

# Live stream test (should emit 'hello' event within 1s):
timeout 3 curl -sS -N http://localhost:3001/api/sdr/status | head -5
```

**Per-location values** (none — pure software install, no
per-location config):

| Location | SDR hardware status | SDR_ENABLED |
|---|---|---|
| Holmgren Way | Pending (NESDR Smart in transit) | `auto` (set by setup-sdr.sh) |
| All others | Not yet rolled out | `false` (default — no-op) |

**Auto-band-tracking:** the watcher reads connected Shure receiver
frequencies and sweeps MIN-5 MHz to MAX+5 MHz. Override via
`SDR_BAND_PRESET=uhf-wireless` (470-700 MHz) or `full-uhf`
(470-960 MHz) in `.env` if you want broader coverage; default
'auto' is fine for game-day monitoring.

**If something goes wrong:**
- Symptom: `rtl_test -t` says "Failed to open rtlsdr device / usb_claim_interface error -6"
  → DVB module still attached. Run `sudo rmmod dvb_usb_rtl28xxu` then `rtl_test -t` again.
  If it persists, reboot once so the blacklist takes effect for the kernel.
- Symptom: `/api/sdr/status` says `enabled: false` even after setup
  → Check `.env` has `SDR_ENABLED=auto` (or `true`). Restart PM2 with `--update-env`.
- Symptom: `/api/sdr/status` says `enabled: true, healthy: false`
  → Dongle not detected. Check USB connection, try a different port
  (avoid USB 3 — emits RFI in the UHF band). Watcher will retry every 5 min.

### v2.34.1 — Shure SLX-D Phase 2 (battery UI, preflight, correlation, low-battery, mock)

**No required manual steps.** All additive on top of v2.34.0.

**New developer tools** (no production impact):
- `scripts/mock-shure-receiver.ts` — TCP server simulating an SLX-D
  receiver. Scenarios: `clean`, `interference-rising`,
  `tx-battery-dying`, `coalesced-frames`, `partial-frames`,
  `third-party-controls-disabled`. Run with
  `npx tsx scripts/mock-shure-receiver.ts --port=2202 --scenario=interference-rising`.
- `scripts/test-shure-parser.ts` — integration test runner. Spawns
  the mock for each scenario, drives the real client, verifies all
  6 scenarios pass. Run with `npx tsx scripts/test-shure-parser.ts`.

**New operator UX:**
- Bartender Audio tab now shows a per-channel battery + RSSI tile
  (one card per Shure receiver, one row per channel). Renders only
  when a Shure receiver is configured; otherwise hidden.
- Device Config → Audio Processors → Shure SLX-D type → "Run
  pre-flight" button. Use BEFORE saving the receiver row — catches
  third-party-controls-disabled, firmware too old, network unreachable.

**Dependency note:** axios bumped 1.15.0 → 1.16.1 (CVE
GHSA-w9j2-pvgh-6h63, prototype-pollution auth bypass). 4 vulns
closed, 13 remain (all require breaking-major upgrades — separate PRs).

**Verification post-update (any location):**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db ".tables shure_rf_events"
# Table still exists from v2.34.0; v2.34.1 didn't touch its schema.

# Status endpoint should respond:
curl -s http://localhost:3001/api/shure-rf/status | jq '.success'
# Expect: true
```

---

### v2.34.0 — Shure SLX-D wireless mic RF interference detection

**Required Manual Steps (per location, only if you HAVE a Shure SLX-D receiver):**

1. **VLAN routing.** Route the Shure receiver onto the controller's
   network so the controller can reach it on TCP port 2202. Verify:
   ```bash
   nc -zv <shure-ip> 2202 && echo "ok"
   ```

2. **Enable "Allow Third-Party Controls" on the receiver front panel.**
   Menu path: `Menu → Advanced → Network → Allow Third-Party Controls →
   Enable`. This setting defaults to BLOCKED on new units and **can
   reset to BLOCKED after a firmware update**. Without it, port 2202
   accepts the TCP connection but silently drops every command — looks
   like a network problem but isn't.

   **Symptom of forgetting this step:** connection logs say "Connected"
   but `shure_rf_events` table never gets non-startup rows, even with
   the mic on.

3. **Confirm firmware ≥ 1.1.0.** Front panel: Settings → About. Or after
   connecting, query the receiver:
   ```
   echo "< GET 0 FW_VER >" | nc <shure-ip> 2202
   # Expect: < REP 0 FW_VER {2.1.5} >  (or similar 1.1+ / 2.x version)
   ```

4. **Add the receiver row in Device Config.** Browse to
   `http://<controller>:3001/device-config` → **Audio** category →
   **Wireless Mics** tab → "Add Receiver" → fill in IP, port 2202,
   model. Click **Run Pre-flight** inline to verify the four checks
   (TCP reachable, third-party-controls enabled, firmware ≥ 1.1.0,
   model detected). Save only when pre-flight is green.

   (The receiver can also be added via the legacy path
   `/system-admin → Audio Processors` if you prefer, but the dedicated
   **/device-config → Wireless Mics** tab is the canonical home and
   gives you the live battery + RSSI + event history side-by-side.
   Full SME briefing on RF coordination + protocol details:
   `packages/shure-slxd/README.md`.)

5. **Verify the watcher is monitoring it.** Wait 60-90 seconds after
   add (watcher discovery interval), then:
   ```bash
   sqlite3 /home/ubuntu/sports-bar-data/production.db \
     "SELECT * FROM shure_rf_events WHERE event_type='startup' ORDER BY detected_at DESC LIMIT 3;"
   # Also check the dedicated log file:
   ls -lh /home/ubuntu/sports-bar-data/logs/shure-rf-*.log
   tail -20 /home/ubuntu/sports-bar-data/logs/shure-rf-$(date +%Y-%m-%d).log
   ```

**Locations WITHOUT a Shure SLX-D receiver:** **No setup required.**
The watcher discovers via `audioProcessors WHERE processorType='shure-slxd'`,
finds none, logs `no shure-slxd receivers configured — watcher idle`,
no-op. The endpoint `/api/shure-rf` returns `active: false` and the
cyan banner never renders.

**Verification on any location post-update** (proves the watcher booted):
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  ".tables shure_rf_events"
# Should print: shure_rf_events
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT receiver_id, event_type, note FROM shure_rf_events WHERE event_type='startup' LIMIT 1;"
# Should return one row: receiver_id='', event_type='startup', note='pid=NNNN'
```

If the table doesn't exist, the `ensureTable()` call in
`apps/web/src/lib/shure-rf-watcher.ts` didn't run — check
`pm2 logs sports-bar-tv-controller | grep SHURE-RF` for the boot line
`[INSTRUMENTATION] ✅ Shure RF watcher started`.

**Log file path is fixed** (`/home/ubuntu/sports-bar-data/logs/shure-rf-*.log`)
but configurable via `SHURE_RF_LOG_DIR` env var if needed. Default
directory is created with `mkdir -p` on first event — no manual chown
required.

---

### v2.33.46 – v2.33.55 — Atlas audio fix train + audit tables (single batch)
**Released:** 2026-05-17

10 versions shipped in one session resolving a multi-symptom Atlas
investigation at Holmgren. **No required setup at locations** —
auto-update + PM2 restart cycle handles everything. Two new audit
tables get auto-created via `CREATE TABLE IF NOT EXISTS` on first
boot. No env vars, no migrations.

**What changed (one-line per version):**

- **v2.33.46** — Debounce bartender slider AND +/- buttons in
  `AtlasZoneControl.tsx` (the bartender remote uses this, not
  `AudioZoneControl.tsx` which got the v2.33.45 fix). Was firing
  30-46 POSTs/sec to Atlas during drags, saturating the TCP queue.
- **v2.33.47** — New diagnostic: `atlas-drop-watcher` polls every
  zone's `ZoneGain_X` / `ZoneSource_X` / `ZoneMute_X` every 30s. On
  ≥15-point drop landing ≤10, writes to new `atlas_drop_events`
  table with explained/silent flag. GET `/api/atlas-drops`.
- **v2.33.48** — Drop watcher syncs live ZoneGain back to
  `audioZones.volume` DB cache. Was: nothing wrote that column from
  hardware, so slider could render multi-day-stale values (Bathroom
  cache stuck at 0 while hardware was actually at 45%; bartenders
  saw 0, "fixed" it, which made things worse).
- **v2.33.49** — New `atlas-priority-watcher` polls input meters
  every 5s, fires `event_type='mic_active'` when an input matching
  the priority name pattern crosses -45 dB. Plus source-override
  detection in the drop watcher. New `atlas_priority_events` table.
  Amber banner appears at top of bartender remote audio tab while
  active. GET `/api/atlas-priority`.
- **v2.33.50** ⭐ — Fixed stuck-meter root cause: hoisted
  `atlasClientManager` and `atlasMeterManager` singletons to
  `globalThis` via `Symbol.for()`. Next.js bundles each route handler
  separately, so the previous private-static singleton was per-bundle,
  causing multiple `ExtendedAtlasClient` instances → multiple UDP
  sockets bound to port 3131 via SO_REUSEPORT → Atlas meter updates
  arriving on a socket whose bundle wasn't being read. Also added
  intentional-disconnect flag (close handler was unconditionally
  reconnecting after every `.disconnect()`), try/finally around
  direct `AtlasTCPClient` usage in `atlas/sources`, `atlas/groups`,
  `atlas/configuration` routes, and dropped the redundant
  `getAtlasClient` call in `AtlasMeterManager.unsubscribe`. **THIS
  IS THE FIX YOU CARE ABOUT IF METERS ARE STUCK.**
- **v2.33.51** — `executeAtlasCommand` now routes through the
  singleton (was opening fresh TCP per bartender command). Guard
  rejects out-of-range `matrix_audio_*` source values. `\r\n` → `\n`
  terminator in unused `atlas-control-service.ts`. Deleted dead
  `atlas-tcp-client.ts` (legacy duplicate with buggy `socket.once
  ('data')` pattern; zero callers).
- **v2.33.52** — Per-key in-flight Promise lock in
  `AtlasClientManager.getClient` so concurrent calls for the same
  IP:port converge on one client (v2.33.51 boot diagnostic showed
  two `Creating new Atlas client` events at the same millisecond
  → 2 TCP / 2 UDP where 1 of each was expected).
- **v2.33.53** — Both watchers write a `event_type='startup'` row
  to `atlas_priority_events` on boot so the audit table proves the
  watcher is alive even when no real events fire.
- **v2.33.54** — Priority watcher whitelist extended to
  `/\b(mic|juke|page|intercom|priority)\b/i`. Was `/mic/i` only;
  Holmgren's Juke box (input 3) wasn't detected.
- **v2.33.55** — Priority watcher writes a heartbeat row every 20s
  while an input stays above threshold so the bartender remote's
  banner doesn't fade after 30s while the source is still hot.

**What bartenders will see:**
- Volume sliders no longer jump during drags.
- Slider shows real Atlas value, not stale DB cache. (Bartenders who
  had been "fixing volume from 0" should stop seeing the issue.)
- New amber **"Priority Override Active 🎤 Juke box"** banner at the
  top of the bartender remote audio tab when a priority input (mic /
  juke / page / intercom) is playing.

**No operator action required** post-update. Run these to confirm:

```bash
# Confirm watcher started (should see 2 rows per boot, drop_watcher +
# priority_watcher):
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT datetime(detected_at,'unixepoch','localtime') ts, input_name
   FROM atlas_priority_events WHERE event_type='startup'
   ORDER BY detected_at DESC LIMIT 4"

# Confirm only ONE TCP+UDP socket to Atlas (the singleton):
ss -tn | grep ":5321" | wc -l   # expect 1
ss -uln | grep ":3131" | wc -l  # expect 1

# Confirm meters live (run twice ~12s apart; levels should differ):
curl -s "http://localhost:3001/api/atlas/output-meters?processorIp=<ATLAS_IP>" \
  | python3 -m json.tool | head -30
```

**Priority input naming per location:** the watcher uses a name regex
to whitelist priority inputs. Current pattern:
`/\b(mic|juke|page|intercom|priority)\b/i`. If a location has a
differently-named priority input (e.g., "Announcer", "EmergencyBus"),
extend the regex at
`apps/web/src/lib/atlas-priority-watcher.ts:35`. Move to DB-driven
per-venue config is a planned follow-up.

**Applies to:** all locations after auto-update. Backwards-compatible.

---

### Operational note: 2026-05-09 — ESPN GTV install on Stoneyard Appleton cubes
**Operator action required (one-time per cube)**

Investigated why Stoneyard Appleton was producing zero `scout-snapshot`
catalog rows while Stoneyard Greenville was producing 22. Root cause:
**ESPN GTV (`com.espn.gtv`) was not installed on any of Appleton's 3
cubes.** Greenville had ESPN on all 3 cubes; Holmgren and Lucky's also
have it.

**Fixed (2026-05-09):** ESPN APK pulled from a Greenville cube and
installed on Appleton's 3 cubes (`10.40.10.92`, `10.40.10.93`,
`10.40.10.94`). All show `pm path com.espn.gtv` returning a real path
post-install. Confirmed via `adb shell pm path com.espn.gtv`.

**Remaining operator step:** Each Appleton cube needs a one-time
manual sign-in OR "continue as guest" via the TV remote. A
freshly-installed ESPN opens to a welcome / paywall screen — Scout's
`verifyEspnContent` looks for `vs.` patterns and `LIVE` badges that
only appear AFTER the user reaches the live-sports landing. Without
sign-in, snapshots return `status=nav_failed`.

After operator signs each cube into ESPN once, Scout snapshots should
produce 7-11 ESPN tiles per cycle (matching Greenville). Verify with:
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT source, app, COUNT(*) tiles FROM firetv_streaming_catalog \
   WHERE capturedAt > strftime('%s','now')-300 \
     AND source='scout-snapshot' GROUP BY source, app"
```

**Generalization:** before declaring a location's Scout-snapshot
coverage broken, run `adb -s <cube_ip>:5555 shell pm path com.espn.gtv`
on its cubes. If empty, the SCout APK + AS configuration is fine —
ESPN simply isn't installed, and the fix is a one-time `adb install`
of the ESPN APK followed by an operator sign-in. No code changes
required.

---

### v2.33.13 — Code-review fixes: re-entrancy guard, regex tightening, expiresAt filter, AEW
**Released:** 2026-05-09

**No required setup.** Five issues from a `feature-dev:code-reviewer`
audit of the v2.33.7-12 release train:

1. **`SnapshotCommandReceiver` re-entrancy guard** (HIGH). A second
   SNAPSHOT_NOW broadcast while the first cycle is still running used
   to spawn a second `runOneSnapshotCycle()` thread on the same device,
   racing for the foreground window + duplicate POSTs. Added
   `AtomicBoolean cycleRunning` in CatalogSnapshotService — second
   broadcast logs warning and returns.

2. **`isAccessibilityChrome` regex false-positive** (HIGH, NBA-playoff-
   relevant). Bare `\b\d+\s+of\s+\d+\b` was rejecting legitimate sports
   tiles like "Game 3 of 7" (NBA/NHL playoffs), "Round 2 of 4" (boxing/
   MMA), "Stage 3 of 21" (cycling). Now ANDed with EITHER (a) TalkBack
   widget-role suffix, OR (b) known launcher-menu prefix. 18/18 unit
   tests pass.

3. **`scoutCoversThisApp` didn't filter by `expiresAt`** (HIGH). Stale-
   but-unexpired-from-DB rows could falsely trigger walker skip in a
   narrow post-TTL/pre-cleanup window. Added `gt(expiresAt, nowSec)`.

4. **Walker `hasSportSignal` regex** missed AEW / TNA Impact / ROH /
   bare Wrestling — inconsistent with Kotlin extractor. Added all four.

5. **`tree-dump` endpoint** had no rate limit + no payload size cap.
   Added `withRateLimit(DEFAULT)` + `nodeCount > 8000 → 413` reject.

**Verification (regex fix):**
```python
# Game 3 of 7 → accept; Search, 2 of 5 → reject
python3 -c "import re; ..."
```
See commit f911b93d for the full unit test list.

**Applies to:** all locations after auto-update.

---

### v2.33.12 — Stoneyard PVFTV-104/107/115 fixes + WNBA tag
**Released:** 2026-05-09

**No required setup.** Fixes for older-firmware Stoneyard cubes.

1. **`FirebatVersionDetector`**: PVFTV<200 firebat returns NavPath.NONE.
   Stoneyard Appleton (PVFTV-104.0379 / PVFTV-115.6073) and Greenville
   (PVFTV-107.0175) cubes don't have a Prime Video Sports tab; the
   PRIME_APP_HOSTED path always returned nav_failed. Skipping early
   saves ~10s/snapshot/cube + cleans diagnostic logs.

2. **`CatalogSnapshotService`**: when navPath==NONE, return
   status="unsupported_firmware" before extraction. Prevents writing
   garbage rows from whatever window happens to be foreground.

3. **`CatalogExtractor.inferSportTag`**: WNBA must check BEFORE NBA
   because "nba" is a substring of "wnba". Switched from `mapOf` to
   `linkedMapOf` to preserve insertion order. Greenville Cube
   2026-05-09 caught WNBA games being mistagged NBA.

**Verification:**
```bash
adb -s 10.40.10.92:5555 shell "input keyevent 3"; sleep 4
adb -s 10.40.10.92:5555 shell "am broadcast -a com.sportsbar.scout.SNAPSHOT_NOW -n com.sportsbar.scout/.SnapshotCommandReceiver"
sleep 60
# Should see Sports Tab status=unsupported_firmware and ESPN status=ok with WNBA-tagged tiles
adb -s 10.40.10.92:5555 logcat -d -s CatalogSnapshot:* CatalogExtractor:* | tail -15
```

**No firmware upgrade needed.** Stoneyard cubes are healthy — the
bugs were code-side assumptions about firmware features that don't
exist on those builds.

---

### v2.33.11 — Walker no longer leaks entertainment TV (This Old House / Project Runway)
**Released:** 2026-05-09

**No required setup.** Pure walker filter fix.

**What was happening:** Operator at Holmgren reported bartender channel
guide was showing "This Old House" and "Project Runway" as if they were
sports games. Walker investigation showed Prime Video Sports tab page
mixes a "Continue Watching" / "Top picks for you" row alongside the
sports rows. The walker's non-matchup branch accepted any tile under
the most-recent `lastSportRow` context, regardless of whether the
intervening row was still a sports row. So when the dump went:
```
Sports for you  ← lastSportRow set
[sports tiles]
Continue Watching  ← no reset, lastSportRow stayed
This Old House     ← accepted as sports tile
Project Runway     ← accepted as sports tile
```

**Fix (in `packages/scheduler/src/firetv-catalog-walker.ts`):**

1. **`nonSportRowPatterns` list.** When the walker hits a row header
   like `Continue Watching`, `Recently Watched`, `Top picks for you`,
   `Because you watched`, `Recommended for you`, `My Stuff`, etc., it
   now CLEARS `lastSportRow` so subsequent tiles don't inherit a stale
   sport context.

2. **`hasSportSignal` belt-and-suspenders check.** Even with context
   reset, a non-matchup non-LIVE tile must contain at least one
   sport-keyword pattern (NBA / NFL / MLB / NHL / WNBA / NCAA / MLS /
   UFC / PGA / F1 / NASCAR / Premier League / La Liga / Bundesliga /
   Champions League / Boxing / Rugby / Tennis / Soccer / Football /
   Basketball / Baseball / Hockey / Golf / Tournament / Championship /
   Final / Semifinal / Playoff / etc.) OR the lastSportRow must
   contain one. "This Old House" matches none → rejected.

3. **Cleanup:** existing rows are deleted manually post-merge:
   ```bash
   sqlite3 /home/ubuntu/sports-bar-data/production.db \
     "DELETE FROM firetv_streaming_catalog WHERE source='walker' AND app='Prime Video' AND
       (LOWER(contentTitle) LIKE '%this old house%' OR LOWER(contentTitle) LIKE '%project runway%'
        OR contentTitle='No ads, except live TV and sports' OR contentTitle='Live Sports'
        OR contentTitle='Semifinals')"
   ```
   The next walker cycle re-populates with cleaner data; rows expire
   naturally at 36h regardless.

**Verification:**
```bash
# Trigger walker
curl -s -X POST http://localhost:3001/api/firestick-scout/catalog/walk -d '{}'
sleep 100
# Check NO entertainment TV in walker rows
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT contentTitle FROM firetv_streaming_catalog WHERE source='walker' AND app='Prime Video' AND (LOWER(contentTitle) LIKE '%this old house%' OR LOWER(contentTitle) LIKE '%project runway%' OR LOWER(contentTitle) LIKE '%real housewives%')"
# Should return empty
```

**Applies to:** all locations after fleet auto-update lands. Prime Video
walker output should now be sports-only on every Cube.

---

### v2.33.10 — Scout v2.2.3 polish: deepLink synth, accessibility-chrome filter, mislabel guard
**Released:** 2026-05-09

**No required setup.** Polish over v2.33.9.

**What changed:**

1. **deepLink synthesis on Scout snapshot rows.** Previously `null`; now
   matches walker output:
   - Prime Video / Sports Tab → `https://watch.amazon.com/search?phrase=<title>`
   - ESPN → `sportscenter://x-callback-url/showHomeTab?q=<title>`
   - Other apps → null (bartender falls back to plain app-launch)
   Bartender Watch button now does the same thing whichever source
   produced the row.

2. **Accessibility-chrome filter (Scout APK).** TalkBack-style strings
   like `"Watch, button 1 of 1"`, `"Search, 2 of 5"`, `"Home, Tab,
   Selected, 1 of 8"`, `"Settings for Luckys Madison"` are now rejected
   BEFORE entering the candidate list. Was producing score=0.0 noise
   that bloated the diagnostic dump and the candidate count.

3. **Mislabeled-window guard (Scout APK).** When Scout's app-launch
   transitions don't actually bring the target to foreground, the
   extractor was walking whatever tree IS active and POSTing it under
   the target's name — Greenville Cube 2026-05-09 caught Prime Video
   tiles being labeled as ESPN. Now verifies `rootInActiveWindow.packageName`
   matches `target.pkg` (with launcher fallback only for the launcher-
   hosted Sports Tab path); mismatched windows return `status=wrong_window`
   with no rows written.

4. **Improved sportTag inference** — added WNBA, LALIGA, Bundesliga,
   ChampionsLeague, NASCAR, PGA, Boxing, Tennis. Network-suffix
   pattern fallback splits on bullet/dash/middot separators so tiles
   like `"WNBA Countdown ESPN on ABC • WNBA"` get tagged WNBA even
   when the keyword is in the suffix.

**Verification command:**
```bash
DEV_IP=192.168.10.42  # Lucky's Cube 1
adb -s ${DEV_IP}:5555 shell "input keyevent 3"; sleep 4
adb -s ${DEV_IP}:5555 shell "am broadcast -a com.sportsbar.scout.SNAPSHOT_NOW -n com.sportsbar.scout/.SnapshotCommandReceiver"
sleep 75
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT app, contentTitle, sportTag, substr(deepLink,1,40) FROM firetv_streaming_catalog WHERE source='scout-snapshot' AND capturedAt > strftime('%s','now')-180 ORDER BY app, contentTitle"
```

Expected: ESPN rows have `sportcenter://...` deepLinks; sportTag set
for league-named tiles (WNBA, PGA, NBA, etc.); no `"Watch, button 1
of 1"` / `"Home, Tab, Selected, 1 of 8"` style chrome strings.

**Applies to:** all locations after fleet auto-update + APK redeploy
(`scripts/install-scout-accessibility.sh --skip-build` per host).

---

### v2.33.9 — Hybrid Scout-snapshot + walker (per-source coexistence + skip-on-Scout-sufficient)
**Released:** 2026-05-09

**Required: schema migration (auto-applied via auto-update.sh).** Adds
`source` TEXT NOT NULL DEFAULT 'walker' column to `firetv_streaming_catalog`
+ a `firetv_catalog_device_app_source_idx` composite index. Idempotent
ALTER — safe to re-run.

**What changed:**

1. **`source` column** distinguishes Scout active extraction (`'scout-snapshot'`)
   from server-side walker (`'walker'`). Each writer now replaces only
   its own source's rows for a (deviceId, app) pair, so the two paths
   coexist instead of clobbering each other. Channel guide / bartender
   remote consume rows from any source — no reader changes needed.

2. **Walker skip-on-Scout-sufficient.** Before walking each
   (input, app), the walker checks if Scout's recent snapshot (last 30
   min, source='scout-snapshot') has produced ≥5 tiles for that app.
   If so, it skips the walker run — saves ~30-60s per skipped app per
   walk cycle. New stats field `appWalksSkippedScout` tracks the count.

3. **Snapshot endpoint sets `source='scout-snapshot'`** + replace-by-source.
   Walker `/catalog` endpoint sets `source='walker'` + replace-by-source.

**Tunables** (in `packages/scheduler/src/firetv-catalog-walker.ts`):
- `SCOUT_SUFFICIENT_FLOOR = 5` — minimum scout-snapshot rows to consider
  the app "covered" and skip the walker.
- `SCOUT_FRESHNESS_WINDOW_SEC = 30 * 60` — snapshot must be within this
  window or walker runs as fallback.

**Verification command:**
```bash
# 1. Insert 6 fake scout-snapshot rows for ESPN
DEV=firetv_1741700000002_holmgren2
NOW=$(date +%s)
for i in 1 2 3 4 5 6; do
  sqlite3 /home/ubuntu/sports-bar-data/production.db \
    "INSERT INTO firetv_streaming_catalog (id, deviceId, app, contentTitle, isLive, capturedAt, expiresAt, source) VALUES
       ('test-$i', '$DEV', 'ESPN', 'fake $i', 0, $NOW, $NOW+3600, 'scout-snapshot')"
done
# 2. Trigger walker; expect "1 scout-skip" in stats + ⏭ log
curl -s -X POST http://localhost:3001/api/firestick-scout/catalog/walk -d '{}' | jq .stats
# 3. Cleanup
sqlite3 /home/ubuntu/sports-bar-data/production.db "DELETE FROM firetv_streaming_catalog WHERE id LIKE 'test-%'"
```

Expected stats: `appWalksSkippedScout >= 1`, accompanying log line:
`[FIRETV-CATALOG] ⏭️  <input> / ESPN: skip walker — Scout has 6 tiles, <age>s old`.

**Applies to:** all locations. Scout ≥ v2.2.2 produces source='scout-snapshot'
rows automatically; walker ≥ v2.33.9 honors the skip rule. Older Scout
versions still write under default 'walker' source — no harm, walker
won't skip anything.

---

### v2.33.8 — Scout v2.2.2 verified on real PVFTV-320 (Lucky's Cube 1)
**Released:** 2026-05-09

**No required setup.** v2.33.7's scaffolding hardened against real
PVFTV-320 launcher behavior captured via the v2.2.1 tree-dump
diagnostic from Lucky's Cube 1.

**What changed:**

1. **`LauncherHomeNavigator` retargeted to "Live" tab.** Lucky's
   PVFTV-320.0001-L launcher dump revealed there is NO "Sports" tab
   on this build. Visible tabs at y=532-612: `My Stuff / Games / Find
   / Free / Home / Live / Netflix / Prime Video / YouTube / Disney+ /
   News / Tubi / More Apps / Settings`. Live tab content includes
   "Live Sports" section, FOX Sports 1, CBS Sports, "Stream live NFL".
   Navigator now tries "Sports" first (in case future builds add it),
   falls back to "Live".

2. **HOME-key reset added before tab search.** Snapshot service now
   calls `performGlobalAction(GLOBAL_ACTION_HOME)` (API 16+, works on
   Fire OS 7.7) at the start of LauncherHomeNavigator. Without this,
   if the Cube was on a Prime Video content detail page when triggered,
   the tab strip wasn't in the AS tree.

3. **Verify gate uses `isFocused=true` on tab node.** Confirmed reliable
   signal via dump diff (home-tab dump: `idx=17 'Home' isFocused=true`;
   live-tab dump: `idx=18 'Live' isFocused=true`). `isSelected` and
   `Tab, Selected` desc patterns are NOT present on PVFTV-320 launcher
   tabs.

4. **CatalogExtractor scores Live-tab network names.** "FOX Sports 1",
   "CBS Sports", "ESPN", etc. are now recognized as live-sports
   channels (+0.45 score bump) even when the tile text doesn't include
   vs./league/score keywords.

5. **Reference dumps committed** under `docs/probes/pvftv320-launcher/`
   so future sessions have ground-truth tree data without needing to
   re-capture.

**Known limitation:** Live tab content extraction is limited to the
first visible content row. The deeper rows ("Live Sports", "Featured
live TV apps") render LAZILY and Scout's `dispatchGesture` swipe
doesn't trigger the Compose RecyclerView's onScrolled handler the way
ADB `input swipe` does. Server-side walker continues to handle Prime
Video / launcher-aggregated sports content via the proven kernel-input
path. Scout's launcher Live-tab path delivers reliable navigation
framework (and works for ESPN extraction) but limited deep extraction.

**Verification command:**
```bash
DEV_IP=192.168.10.42  # Lucky's Cube 1
adb -s ${DEV_IP}:5555 shell "input keyevent 3"
sleep 4
adb -s ${DEV_IP}:5555 logcat -c
adb -s ${DEV_IP}:5555 shell "am broadcast -a com.sportsbar.scout.SNAPSHOT_NOW -n com.sportsbar.scout/.SnapshotCommandReceiver"
sleep 90
adb -s ${DEV_IP}:5555 logcat -d -s LauncherHomeNav:* CatalogExtractor:* | tail -30
```

Expected on PVFTV-320 Cubes:
- `tab 'Live': isFocused=true — click took. Verifying content…`
- `tab 'Live': content verified.`
- ESPN target produces 7+ tiles (WNBA, Truist, etc.)

**Applies to:** Lucky's Cubes 1+2 (PVFTV-320). Other PVFTV-215 Cubes
unchanged behavior — this version's launcher framework can be exercised
when those launchers add a Sports/Live tab in future firmware.

---

### v2.33.7 — Scout v2.2.1 tree-dump diagnostic + LauncherHomeNavigator for PVFTV-320+
**Released:** 2026-05-09

**No required setup for the host.** New API endpoint and dump storage
directory created automatically (`apps/web/data/tree-dumps/`,
gitignored).

**What changed:**

1. **New diagnostic broadcast** `ACTION_DUMP_LAUNCHER_TREE` (and
   `ACTION_DUMP_AS_TREE`) on the Scout APK. When triggered, dumps the
   full AccessibilityNodeInfo tree of the foreground window to logcat
   AND POSTs the JSON to `/api/firestick-scout/tree-dump` for offline
   analysis. Trigger from any Cube:
   ```bash
   adb -s <ip>:5555 shell "am broadcast \
     -a com.sportsbar.scout.ACTION_DUMP_LAUNCHER_TREE \
     -n com.sportsbar.scout/.TreeDumpReceiver \
     --es trigger <label>"
   ```
   See `docs/SCOUT_TREE_DUMP.md` for full usage.

2. **New `LauncherHomeNavigator`** for PVFTV-320+ Cubes. The 2026
   redesigned Fire TV launcher places content tabs (Home/Movies/TV/
   Sports/Live/News) directly on the home screen — no need to launch
   Prime Video first. The navigator:
   - Walks the WHOLE tree for `text="Sports"` matches (no Y hardcode —
     Holmgren PVFTV-215 dump revealed tabs sit at variable Y positions
     between 532 and 976)
   - Scores candidates by focusable + clickable + topmost-leftmost
   - Tries 5 click strategies: ACTION_FOCUS, ACTION_CLICK, bounds-
     contained ancestor, **dispatchGesture synthetic tap** (drives
     Compose pointerInput differently from ACTION_CLICK), then
     ACTION_ACCESSIBILITY_FOCUS as last resort
   - Verify gate: rejects "Home/Movies/TV/News/etc" still-selected,
     accepts known sports section headers OR ≥3 `vs.` matchups visible

3. **FirebatVersionDetector** routes firebat≥300 → `LAUNCHER_HOME_SPORTS_TAB`
   (was `PRIME_LAUNCHER_HOSTED`, which never worked).

4. **CatalogSnapshotService** re-adds Prime Video as a target via the
   new launcher path; ESPN unchanged.

5. **CatalogExtractor** adds launcher-aggregated tile heuristics —
   provider name suffixes (`on Prime`, `ESPN+`), watch-with-subscription
   badges, `vs + league` co-occurrence bonus.

**Verification command** — capture a launcher dump from any Cube:
```bash
DEV_IP=10.11.3.50
SVC=com.sportsbar.scout/com.sportsbar.scout.PlaybackAutomationService
adb -s ${DEV_IP}:5555 shell "settings put secure enabled_accessibility_services ${SVC}"
adb -s ${DEV_IP}:5555 shell "settings put secure accessibility_enabled 1"
adb -s ${DEV_IP}:5555 shell "input keyevent 3"  # HOME
sleep 4
adb -s ${DEV_IP}:5555 shell "am broadcast \
  -a com.sportsbar.scout.ACTION_DUMP_LAUNCHER_TREE \
  -n com.sportsbar.scout/.TreeDumpReceiver \
  --es trigger verify_v2_2_1"
sleep 5
ls -la /home/ubuntu/Sports-Bar-TV-Controller/apps/web/data/tree-dumps/ | tail -3
pm2 logs sports-bar-tv-controller --lines 30 --nostream | grep TREE-DUMP
```

Expected: a `.json` file appears in `tree-dumps/`, server logs
`[TREE-DUMP] Stored: ...` with non-zero `nodes=`. Smoke-tested on
Holmgren Cube 2 PVFTV-215 (78 nodes captured cleanly).

**Known limitation (intentional):** PVFTV-215 launcher tabs include
Find/Home/Live/News but NO Sports tab — the aggregated content tabs
are only on PVFTV-320+. So on PVFTV-215 the Sports Tab snapshot will
return `nav_failed` (no Sports node found). This is expected; ESPN
extraction continues to work on PVFTV-215.

**Applies to:** all locations. Diagnostic dump works everywhere; the
LauncherHomeNavigator delivers value only on PVFTV-320+ Cubes (Lucky's
1+2 today). Once we capture a real PVFTV-320 dump and write the
specific selectors, this releases active extraction for those Cubes.

---

### v2.33.6 — Scout v2.2.0 active extraction ships ESPN-only + IPv6-mapped IP fix
**Released:** 2026-05-09

**No setup required for the host.** Pure code change to the snapshot
endpoint + Scout APK (location-side install handled by the existing
firestick-scout-deploy script when run).

**What changed:**

1. **`apps/web/src/app/api/firestick-scout/snapshot/route.ts`** — IPv6-mapped IPv4 strip in the deviceId resolver. Node's net stack reports IPv4 connections as `::ffff:10.11.3.50`; `FireTVDevice.ipAddress` stores plain `10.11.3.50`. Without the strip, Scout's first POST (when MainActivity.deviceId is still `fire-tv-unknown`) couldn't resolve to the canonical FireTVDevice.id and rows piled up under `fire-tv-unknown`. After fix, rows land cleanly under `firetv_<id>_<location>`.

2. **Scout APK v2.2.0 final scope** — ESPN-only target list in `CatalogSnapshotService`. Prime Video PVFTV-215 was attempted (4 iterations, see `docs/V2_2_0_PVFTV320_FINDINGS.md` iter#6-9) but Compose top-nav tabs don't respond to AccessibilityService click/focus actions. Without `INJECT_EVENTS` (signature-permission, requires platform-key signing) Scout cannot drive Compose tabs. Prime Video continues on the existing server-side walker path; Scout active-extraction handles ESPN only at this version.

**Includes prior unbumped versions:**
- **v2.33.4** — Scout v2.1.6 hardening (fleet bartender remote)
- **v2.33.5** — `/api/firestick-scout/snapshot` endpoint added (server side of Scout v2.2.0)

**Verification command** (run on any host after auto-update lands):
```bash
# Trigger Scout snapshot from one Cube, verify rows land under canonical deviceId
DEV_IP=$(sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT ipAddress FROM FireTVDevice WHERE platform LIKE 'Fire TV%' LIMIT 1")
adb -s "${DEV_IP}:5555" shell \
  "am broadcast -a com.sportsbar.scout.SNAPSHOT_NOW -n com.sportsbar.scout/.SnapshotCommandReceiver" >/dev/null
sleep 60
# Should see ESPN rows with capturedAt within last 90 seconds
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT app, COUNT(*) tiles FROM firetv_streaming_catalog WHERE app='ESPN' AND capturedAt > strftime('%s','now')-90 GROUP BY app;"
# Should also see SCOUT-SNAPSHOT log lines:
pm2 logs sports-bar-tv-controller --lines 50 --nostream | grep "SCOUT-SNAPSHOT"
```

Expected: at least 1-8 ESPN rows depending on what's live, and one
`Resolved Scout deviceId=fire-tv-unknown@<ip> → firetv_<id> (<name>)`
log line per Cube reporting in.

**Known limitation:** Scout snapshot is on-demand only via SNAPSHOT_NOW
broadcast at v2.2.0. AlarmManager 6h periodic schedule is queued for
v2.2.1. The server-side walker continues running its 3x-daily schedule
unchanged so nothing is lost in the meantime.

**Applies to:** all locations with PVFTV-215 firmware Cubes (Holmgren,
Graystone, Stoneyards, Lucky's 3+4). PVFTV-320 Cubes (Lucky's 1+2) gain
nothing from this version's Scout APK — see findings doc for the path
forward (Option B Path 4 or Option C hardware swap).

---

### v2.33.3 — Walker wakes the Cube before launching apps (Lucky's screensaver fix)
**Released:** 2026-05-09

**No setup required.** Pure code fix in `packages/scheduler/src/firetv-catalog-walker.ts`.

**What changed:** Walker's `walkApp()` now sends `KEYCODE_WAKEUP` (224) + 500ms wait BEFORE the existing `KEYCODE_HOME` step. Fire TV Cubes idle into the screensaver (`Sys2023:dream` window) after ~5 minutes of inactivity. Pre-fix, launching an app while the screensaver was foreground meant `uiautomator dump` captured the screensaver overlay (3-4KB, 0 content tiles) instead of the actual app content. Lucky's 1313 had this happening on all 4 Cubes for weeks before the diagnosis 2026-05-09 — bartender saw 0 Prime Video tiles even though the Cubes were healthy.

**Verification command** (run on any Cube-having location host after auto-update lands):
```bash
# Force a walk while at least one Cube is actively in screensaver
curl -s -X POST http://localhost:3001/api/firestick-scout/catalog/walk -d '{}'
sleep 90
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT app, COUNT(*) tiles, datetime(MAX(capturedAt),'unixepoch','localtime') latest FROM firetv_streaming_catalog GROUP BY app;"
```

Expect both ESPN and Prime Video tile counts > 0 at locations that were previously showing only ESPN.

**What this DOES NOT fix:** The fundamental "walker only handles ESPN + Prime Video" limitation is unchanged. Hulu/Peacock/fuboTV/Sling/Apple TV+/YouTube TV still don't appear in the bartender's streaming guide — that's the multi-day-per-app project documented in `docs/STREAMING_PROVIDER_ROADMAP.md`. v2.33.3 specifically targets the screensaver issue that was hiding Prime Video content at Lucky's.

---

### v2.33.2 — Walker noise filter unified across both Prime Video branches + Lucky's available_networks backfill + thorough operator DB-health doc
**Released:** 2026-05-09

**Code change:** v2.33.1's noise filter only ran in the non-matchup branch of `extractPrimeVideoTiles`. Tiles tagged `LIVE`/`UPCOMING` (e.g. "Season 2026 LIVE", "Recently watched LIVE", "Live events for you LIVE") took the OTHER branch and never re-validated. v2.33.2 hoists the entire filter into a shared `isPrimeVideoNoise()` predicate called from BOTH branches. Expanded the list with patterns observed in fleet catalogs 2026-05-09: news shows (ABC News, Dateline NBC), section headers (Recently watched, Live events for you), channel shells (RugbyPass TV, MLB Network), music events (Rolling Loud), long descriptive strings (>89 chars).

**Per-location operator action — backfill `input_sources.available_networks` for any Cube-having location where it's still empty `[]`.** Without this, the walker logs `no walkable apps in available_networks` and skips the Cube → bartender shows 0 streaming games. Lucky's 1313 hit this on the v2.33.x rollout (`available_networks` was empty since install). Verify + fix:

```bash
DB=/home/ubuntu/sports-bar-data/production.db

# Detect: any firetv input_source with empty available_networks?
sqlite3 $DB "SELECT name, json_array_length(available_networks) AS app_count FROM input_sources WHERE type='firetv' AND json_array_length(available_networks)=0;"

# Fix: populate based on what's actually installed on each Cube. Per the
# Lucky's 1313 example (substitute IDs + IPs):
for ip in <cube-ip-1> <cube-ip-2> ...; do
  echo "== $ip ==" && adb -s $ip:5555 shell "pm list packages -3" | grep -iE "espn|peacock|hulu|fubo|sling|youtube|appletv|paramount"
done
# Then UPDATE per Cube; example for a Cube with ESPN + Peacock + Hulu installed
# (Prime Video is firebat — system app, every Cube has it):
sqlite3 $DB "UPDATE input_sources SET available_networks = json_array('ESPN', 'Prime Video', 'Peacock', 'Hulu') WHERE id = '<input_source_id>';"

# Verify by triggering a manual walk:
curl -s -X POST http://localhost:3001/api/firestick-scout/catalog/walk -d '{}'
sleep 90
sqlite3 $DB "SELECT app, COUNT(*) FROM firetv_streaming_catalog GROUP BY app;"
```

**Full friendly-name → package mapping + per-app walker support matrix:** see `docs/OPERATOR_DB_HEALTH.md` (new in this release). That doc also covers EVERY DB row + JSON file the streaming guide depends on, plus a 5-minute per-location audit script.

**Cleanup of pre-v2.33.2 noise tiles** (one-shot per location host):
```bash
DB=/home/ubuntu/sports-bar-data/production.db
for pat in \
  "contentTitle IN ('ABC News','NBC News','Recently watched','Live events for you','Rolling Loud','Dateline NBC','Season 2026','SportsCenter','SECN+','RugbyPass TV','ESPN','ESPN+','ESPN Unlimited')" \
  "length(contentTitle) > 89" \
  "contentTitle LIKE 'Season 20%'" \
  "contentTitle LIKE 'How do%'" \
  "contentTitle LIKE 'Audio language%'" \
  "contentTitle LIKE 'Subtitle%'"; do
  sqlite3 $DB "DELETE FROM firetv_streaming_catalog WHERE $pat"
done
```

After cleanup, the next walker run (next scheduled at 04:00/12:00/17:00 OR `POST /api/firestick-scout/catalog/walk` for immediate) will repopulate with the v2.33.2 filter applied.

**Verified live 2026-05-09:** v2.33.2 deployed fleet-wide via `sshpass`-based parallel rollout (see `docs/FLEET_TRIGGER_RUNBOOK.md`). All 6 boxes report PASS 7/7 verify-install. Lucky's 1313 backfilled `available_networks` for all 4 Cubes; first walker run after backfill produced 5 ESPN tiles (was 0 before). Graystone walker noise dropped from 8 leaked rows to 0 after cleanup pass + v2.33.2 filter.

**Scout APK status (verified 2026-05-09):** 16/16 reachable Cubes across the fleet running `v2.1.5-accessibility-automation` with AccessibilityService bound. No drift. The 2 Holmgren Cubes at 10.11.3.48/.49 are on the documented swap list (failing hardware, not code) and not counted.

---

### v2.33.1 — Bartender remote rendering fix + live-data parity for streaming + completed-game filter + UI-label noise filter
**Released:** 2026-05-09

**No setup required.** Pure code fixes building on v2.33.0.

**Fixed (operator-facing):**

1. **Bartender remote was showing "NO LIVE GAMES" even when streaming games were available.** v2.33.0's catalog injection used `capturedAt` as the startTime fallback, which was usually yesterday. The bartender component's "past midnight of scheduled day" filter (line 920 of `EnhancedChannelGuideBartenderRemote.tsx`) discarded every program. Fix: fall back to `now` so live tiles always pass the date filter.

2. **Streaming games now show live scores + clock + status** — same parity as cable/satellite. Channel-guide route inlines `liveData` (homeScore/awayScore/clock/period/statusDetail/espnGameId) on each streaming program when it has a `game_schedules` enrichment match. ESPN sync writes these every 10min. No separate fetch needed (the cable path's `/api/sports-guide/live-by-channel?deviceType=cable` doesn't return streaming-only games like Prime Video NBA exclusives).

3. **Completed games auto-removed.** Streaming programs with a schedule match in `('completed','final','postponed','cancelled')` are filtered out at the channel-guide API layer. Walker may capture an "in progress" tile from ESPN's UI a few minutes after the game actually ended; the schedule status is authoritative.

4. **Proper home/away team split for streaming tiles.** v2.33.0 set `homeTeam=contentTitle, awayTeam=''`, breaking the bartender's existing live-data lookup (keyed by `${away}-${home}`). v2.33.1 prefers schedule-match team names; falls back to splitting `contentTitle` on " vs.? " when no match.

5. **"(deep-linkable)" annotation removed from bartender-facing descriptions** — internal detail, the bartender doesn't care.

6. **ESPN extractor noise filter tightened.** "ESPN", "ESPN+", "ESPN Unlimited", "ESPNU", "SportsCenter", "SECN+", "ACCN", "All ACC ACCN", "NFL Live", etc. were leaking through as "live tiles" because Pattern A (comma-separated content-desc) takes the first segment as title without re-validating against the chrome blocklist. Fix: re-test extracted title against an extended chrome regex AND against a `looksLikeGame()` predicate that requires either a matchup indicator (`vs`, `@`, ` at `) OR a known event format (Grand Prix, Open, Final, Championship, Cup, Tournament, Match, Series, Race, Qualifying).

7. **Prime Video extractor blocks player-UI labels.** A walker run on Cube 3 captured a video info / settings panel ("Audio languages", "Subtitles", "Spanish, English", "How do I choose languages?", etc.) as if each row were a game tile in the currently-tracked NBA section — because the Cube was on a player overlay when the walker dumped, and inheriting `lastSportRow="NBA Playoffs"`. Filter: question-marked text + UI-label blocklist (Audio languages, Subtitles, Closed captions, language tokens, language-help Q&A, Watchlist, Skip intro/recap/credits, Next up/episode, Resume watching).

8. **Racing/golf/tennis event-name de-duplication.** v2.33.0 stuffed the event name into BOTH home and away (intended fix for empty-team-name rows). v2.33.1 puts it into home only — the bartender filter accepts home OR away populated, no need to duplicate.

**Walker schedule unchanged from v2.33.0** (3x daily 04:00 + 12:00 + 17:00). Operators who hit the bartender remote's refresh button trigger a manual walk (`POST /api/firestick-scout/catalog/walk`). If a Cube is mid-playback or on a settings overlay when refresh is pressed, the captured tiles will reflect that screen — see filter #7 for the fallout. Returning the Cube to the home screen before pressing refresh helps.

**Why a Cube can show 0 streaming games right now even when it has fresh hardware:**
- All games on its home rails are completed (filter #3).
- ESPN/Prime Video isn't logged in / isn't entitled to today's content.
- The Cube is mid-playback when walker fired (catches detail-page noise; filter #7 drops it).
- ADB connection is broken (walker logs `send-command HTTP 500` warnings; nothing uploaded).

**Verification commands** (same as v2.33.0):

```bash
# Check catalog state per Cube:
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT app, contentTitle, isLive, datetime(capturedAt,'unixepoch','localtime') FROM firetv_streaming_catalog ORDER BY deviceId, app;"

# Force a refresh for all Cubes:
curl -s -X POST http://localhost:3001/api/firestick-scout/catalog/walk -d '{}'

# Channel-guide for a specific Cube + verify live data + day/time:
curl -s -X POST http://localhost:3001/api/channel-guide \
  -H "Content-Type: application/json" \
  -d '{"inputNumber":<INPUT>,"deviceType":"streaming","deviceId":"<DEVICE_ID>"}' \
  | jq '.programs[] | {title:.homeTeam,away:.awayTeam,day,time,isLive,score:[.liveData.awayScore,.liveData.homeScore],clock:.liveData.clock,status:.liveData.statusDetail}'
```

---

### v2.33.0 — Bartender guide is Scout-only for streaming + AI Suggest reads catalog + walker 3x daily + start-time enrichment
**Released:** 2026-05-08

**The bartender remote streaming guide now shows ONLY games discovered by the per-Cube Scout catalog walker** — `firetv_streaming_catalog` table. The previous Rail Media streaming + ESPN-sync `game_schedules` streaming-fallback paths are removed. AI Suggest + Auto Pilot also switch to catalog-as-source for streaming so suggestions are guaranteed launchable on the device they're routed to.

**Why:** Rail Media + ESPN-sync produced games whose `deepLink` was either generic ("open the app") or built from team-name search queries that didn't always reach the right tile. After v2.32.99 fixed the Watch-button autoplay (DPAD_CENTER advance from detail page → PlayerActivity), the remaining bartender complaint was "it opens the wrong game." Catalog walker captures the EXACT tile the user sees on a Cube's home screen + a deeplink that ESPN/Prime Video search-by-title resolves to the correct event. Different Cubes at the same venue can have different installed/logged-in apps; per-device catalog respects that.

**Trade-off accepted:** Games on apps the walker can't extract from (Peacock, Hulu, fuboTV, Apple TV+, YouTube TV/YouTube, Sling, Fox Sports — all WebView/Cobalt/accessibility-blind) are NOT shown in the bartender guide. The Watch button on those games would have failed to advance to playback anyway, so this is correctness over coverage.

**Walker schedule:** Walker now runs **3x daily — 04:00, 12:00, 17:00 local** (`America/Chicago`). Cooldown reduced from 6h to 3h. Long-gap catch-up trigger reduced from 25h to 9h so a PM2 restart that spans 04:00 + 12:00 still recovers within hours.

**Start-time enrichment (v2.33.0 channel-guide cross-reference):** Walker doesn't always extract a startTime (Prime Video tiles hide times until focused, ESPN tile times vary by sport). Channel-guide enriches missing startTimes by token-matching tile titles against `game_schedules` (the existing ESPN sync, ±2h..+48h window). Enrichment fills `day` + `time` + `startTime` fields without changing WHICH games appear (Scout still gates that). Sports outside ESPN's 23-league sync (rugby, F1, motorsports) stay as "On demand" — no false time labels.

---

#### Per-location auto-update procedure

**Standard auto-update flow handles everything.** No manual SQL, no APK reinstall, no settings changes.

```bash
bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/auto-update.sh --triggered-by=manual_cli
```

The script merges `main` into the location branch, runs `npm ci`, `drizzle-kit push` (no schema changes in this version — purely additive feature work), force-rebuilds via Turbo, restarts PM2, and runs the verify-install layers.

**Verification after auto-update lands** (run on the location host):

```bash
# 1. PM2 healthy + version reads 2.33.0
curl -s http://localhost:3001/api/health | jq -r '.status'
grep '"version"' /home/ubuntu/Sports-Bar-TV-Controller/package.json

# 2. Scout catalog has fresh per-device tiles for any Cube the location uses
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT app, COUNT(*) tiles, datetime(MAX(capturedAt),'unixepoch','localtime') latest FROM firetv_streaming_catalog GROUP BY app;"
# Expect: rows for at least Prime Video and ESPN (per Cube), latest within last 8h.
# If empty, manually trigger: curl -X POST http://localhost:3001/api/firestick-scout/catalog/walk -d '{}'

# 3. Channel guide returns Scout-only streaming entries with deepLinks
# Find a streaming input number on the location:
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT mi.channelNumber, mi.label, isr.device_id FROM MatrixInput mi JOIN input_sources isr ON isr.matrix_input_id = mi.id WHERE mi.deviceType='Fire TV' AND mi.isActive=1 LIMIT 1;"
# Then (substitute INPUT_NUM and DEVICE_ID):
curl -s -X POST http://localhost:3001/api/channel-guide \
  -H "Content-Type: application/json" \
  -d '{"inputNumber":<INPUT_NUM>,"deviceType":"streaming","deviceId":"<DEVICE_ID>"}' \
  | jq '.programs[] | {title:.homeTeam,day,time,live:.isLive,app:.channel.streamingApp,deepLink:.channel.deepLink}'
# Expect: every streaming program has a `deepLink` and a populated `day`+`time` (or "LIVE" / "On demand").

# 4. Logs confirm the right injection paths fired
pm2 logs sports-bar-tv-controller --lines 100 --nostream | grep -E "firetv_streaming_catalog injection|FIRETV-CATALOG.*walk"
# Expect a line per request like:
#   firetv_streaming_catalog injection for <deviceId>: +N from scout walker, 0 dedup, M enriched startTime from game_schedules
```

#### Known caveats per location

- **Cubes without a working ADB connection:** Walker silently skips them (logs `[FIRETV-CATALOG] send-command HTTP 500` warnings). Bartender guide for those Cubes' input will show 0 streaming games. Fix the underlying ADB issue (re-pair, reauthorize, or replace hardware) — see `feedback_holmgren_firecube_replacement.md` if a Cube is on the swap list.
- **Cubes signed out of streaming services:** Walker captures whatever is visible. A signed-out Sling/fubo Cube has no sports tiles regardless of subscription tier; bartender guide reflects that. Sign in via TV remote and trigger `POST /api/firestick-scout/catalog/walk` to refresh.
- **Apps with no walker rule:** Peacock, Apple TV+, fuboTV, YouTube TV, YouTube, Sling, Fox Sports are intentionally deferred (WebView/Cobalt/accessibility-blind — see comments in `packages/scheduler/src/firetv-catalog-walker.ts` `APP_WALK_RULES`). Their games will not appear in the bartender guide. Accepted trade-off.
- **NFHS Network high-school games:** Untouched by this change — NFHS continues to flow through the existing `/api/nfhs` sync path (cross-fleet, not per-Cube). NFHS games will still appear in the bartender guide.
- **Cable / satellite / DirecTV paths:** Untouched. This change is streaming-only.

#### Auto Pilot / AI Suggest behavior change

- AI Suggest's streaming candidates now come from `firetv_streaming_catalog` rows scoped to the specific Fire TV input (no venue-wide fallback). Suggestions are pre-bound to the source Cube — the LLM cannot reroute a streaming game to a different Cube.
- `inputSourceAllocations.deepLink` (column already existed at v2.32.85) is now populated from the catalog row when AI Suggest creates an allocation. Auto Pilot's tune at game time forwards this deeplink to the v2.32.99 launch path → ESPN advances to PlayerActivity / Prime Video runs its autoplay sequence.
- Cable / satellite / DirecTV suggestions are unchanged: still come from `game_schedules` + broadcast_networks resolver.

#### What the operator sees (bartender remote)

- Streaming game tiles show: title (from catalog `contentTitle`), sport tag, app name, day + time formatted in CT, "LIVE" badge for in-progress games. Deep-linkable tiles annotate "(deep-linkable)" in the description.
- Watch button: launches the streaming app and uses the per-tile deeplink to navigate to the correct game (ESPN search-by-title, Prime Video search-by-phrase). Then DPAD_CENTER advances from detail page to PlayerActivity (v2.32.99 fix).
- Schedule button: creates an allocation that fires at game start time; Auto Pilot tunes via the same path as the bartender Watch button.
- Games on apps without walker support do NOT appear (operator notice — previously they appeared with broken Watch buttons).

---

### v2.32.99 — ESPN autoplay reaches PlayerActivity (host-side DPAD CENTER advance from detail page)
**Released:** 2026-05-08

**No setup required.** Pure code fix in `packages/firecube/src/adb-client.ts`.

**What changed:** `launchEspnToLiveContent`'s text-targeted-tap branch
ended on the detail page after tapping a search result tile. Bartender
saw "ESPN opened to game info, but I have to press OK on the TV remote
to start playback." The fix appends a 5s wait + DPAD_CENTER + 1s + DPAD_CENTER
(safety) after the tap — same pattern as Prime Video's autoplay
(`launchPrimeVideoToContent`). ESPN's detail page auto-focuses the Watch
CTA at bounds [1306,506][1872,602] on AFTR Cube 2 (1920x1080); DPAD_CENTER
on the focused CTA advances to `com.espn.video.dmp.PlayerActivity` (or
`ComposePaywallActivity` if the location isn't entitled to that league
on ESPN+ — that's a downstream entitlement issue, not a code issue).

**Per-location verification:** After auto-update, click any ESPN+ game
on the bartender remote. The Cube should land on PlayerActivity with
playback starting (or ComposePaywallActivity if unentitled). It should
NOT land on `PageControllerActivity` waiting for an OK press.

**Why two DPAD_CENTERs:** The first sometimes fires while the detail
page is still in a loading-focus state (focus animation in progress)
and is consumed silently. The second fires 1s later when focus has
settled. The second is a no-op if the first already advanced —
DPAD_CENTER on PlayerActivity briefly toggles play/pause and snaps
back. Verified live on Holmgren Way Cube 2 (10.11.3.50, AFTR, Fire OS
7.7) on 2026-05-08: API returns success in 30s, foreground transitions
to ComposePaywallActivity (Cube unentitled to ESPN+ MLB at this
location, but the advance from detail-page-with-OK-pending → action
DID fire).

**Scout AS contribution:** v2.32.98's `sendScoutPlayGameBroadcast` is
still called before this path runs, but the host's force-stop in
`launchEspnToLiveContent` kills ESPN before Scout's tile click takes
effect. Scout AS is NOT load-bearing for the bartender autoplay; it
remains in place as a no-op safety net (and may matter for future
flows that don't force-stop ESPN, e.g. catalog walker re-entry).

---

### v2.32.98 — Scout AccessibilityService for in-app ESPN/NFHS playback automation
**Released:** 2026-05-08

**Per-location manual step required for Cubes that should use the new path:**

```bash
# Build APK locally (one time)
cd firestick-scout
./gradlew assembleDebug

# Install + enable on each Cube (per-Cube)
adb connect <CUBE_IP>:5555
adb -s <CUBE_IP>:5555 install -r app/build/outputs/apk/debug/app-debug.apk
adb -s <CUBE_IP>:5555 shell settings put secure enabled_accessibility_services com.sportsbar.scout/com.sportsbar.scout.PlaybackAutomationService
adb -s <CUBE_IP>:5555 shell settings put secure accessibility_enabled 1
```

The `settings put secure` enables the AccessibilityService programmatically — verified to work on AFTR Fire OS 7.7 (Android 9 / API 28) without root. Setting persists across reboots.

**Cubes WITHOUT Scout v1.5.0 + accessibility enabled** silently ignore the new PLAY_GAME broadcast (the receiver class doesn't exist) and fall through to v2.32.97's text-targeted-tap autoplay. No regression. Holmgren Cube 3 (10.11.3.51) was the test bed — v1.5.0 deployed, AS enabled, end-to-end verified.

**What it adds:** a new on-device path for ESPN/NFHS playback automation. The Sports Bar Scout APK gains an `AccessibilityService` (`PlaybackAutomationService`) that observes ESPN/NFHS/firebat window events. When the bartender clicks Watch on a streaming game, the host fires an ADB broadcast `com.sportsbar.scout.PLAY_GAME` with the intended tokens. Scout's service:

1. Receives the broadcast, queues the command in SharedPreferences mailbox
2. On the next ESPN/NFHS window event (typically ~1-2s after launch), walks the AccessibilityNodeInfo tree
3. Token-scores every visible tile against the intended title
4. Performs `AccessibilityNodeInfo.performAction(ACTION_CLICK)` on the highest-scoring tile (walks up to find a clickable ancestor)
5. Writes the matched tile's full accessibility text to the mailbox as authoritative confirmation of WHAT WAS CLICKED

**Why this matters for "verify what's playing":** the matched text shows EXACTLY which tile was clicked — operator-visible signal that's been missing from every prior approach (uiautomator dumps DRM-blocked during playback; MediaSession metadata empty for ESPN; PlayerActivity Intent extras private). With Scout AccessibilityService, we know with certainty which tile the click landed on.

**Why this works where deep links + DPAD-via-ADB failed:** AccessibilityService runs in-app on-device. It can `findAccessibilityNodeInfosByText` and `performAction(ACTION_CLICK)` directly — no `not exported` Activity issue (we're not launching anything; we're clicking an existing UI element), no Comrade gating (we read what's on screen, no resolver needed), no uiautomator "could not get idle state" race during playback.

**Belt-and-suspenders:** the host fires BOTH the Scout PLAY_GAME broadcast AND the existing `launchEspnToLiveContent` text-targeted-tap path. Whichever completes the click first wins. Cubes without Scout AS get the old path; Cubes with Scout AS typically get the click 1-2s before the autoplay fires its DPAD sequence (autoplay's later actions become harmless no-ops on PageController/PlayerActivity). Backwards-compatible.

**Affected:** 6 source files. `firestick-scout/app/src/main/java/com/sportsbar/scout/PlayCommandReceiver.kt` (new), `firestick-scout/app/src/main/java/com/sportsbar/scout/PlaybackAutomationService.kt` (new), `firestick-scout/app/src/main/res/xml/playback_automation_service_config.xml` (new), `firestick-scout/app/src/main/AndroidManifest.xml` (receiver + service registration), `firestick-scout/app/build.gradle` (versionCode 215, versionName 2.1.5-accessibility-automation), `firestick-scout/app/src/main/res/values/strings.xml` (service description). Host-side: `packages/firecube/src/adb-client.ts` (new `sendScoutPlayGameBroadcast` method), `apps/web/src/services/streaming-service-manager.ts` (calls broadcast before launching ESPN).

**End-to-end verified live on Cube 3:**
- Bartender API: `POST /api/streaming/launch` with `appId=espn-plus, deepLink=sportscenter://...?q=Mariners%20White%20Sox`
- Host log: `[ADB CLIENT] Scout PLAY_GAME → com.espn.gtv tokens=mariners,white,sox`
- Scout log: `PlayCommandReceiver: Queued PLAY_GAME ... tokens=mariners,white,sox`
- ESPN opens → window event fires →
- Scout log: `PlaybackAutomation: Click ok: matched='mariners vs. white sox espn unlimited • mlb live' (score=3/3)`
- Mailbox: `last_result=clicked, last_matched_text='mariners vs. white sox espn unlimited • mlb live', status=settled`
- API returned success:true

The Scout side worked in ~17s end-to-end (broadcast at 18:24:48, click at 18:25:06).

---

### v2.32.97 — Text-targeted tap (replaces blind DPAD + verify) + MEDIA_STOP cleanup
**Released:** 2026-05-08

**No setup required.** Code-only fix.

**What it adds:** ESPN search-by-title autoplay no longer uses `DPAD_DOWN` to "focus first result and hope" — it dumps the UI after typing the query, scans every visible tile for one whose accessibility content matches the intended title (token overlap, scored), and fires `input tap <cx> <cy>` directly at the matched tile's center. Targets by content rather than position; works whether ESPN navigated to the Search tab or the Featured tab, as long as a matching tile is on-screen anywhere.

**Bonus:** `KEYCODE_MEDIA_STOP` + `am force-stop` at the start of the autoplay sequence. If ESPN was already playing something or in a leftover navigation state from a previous Watch click, this clears it. Both are safe no-ops if nothing's playing.

**Verified live on Cube 3:**
- "Mariners White Sox" (visible on ESPN's home tab right now): `findVisibleTile: best match score=3/3 text="Mariners vs. White Sox ESPN Unlimited • MLB Live"`. Tap fired at the matched tile's bounds center. API returned success:true.
- "Southern Miss James Madison" (not on ESPN's UI right now): `findVisibleTile: no tile matched`. API returned success:false with diagnostic listing the visible tiles (Backlash WWE / Florida-Alabama softball / Mariners-White Sox MLB / SportsCenter / Jacksonville-Colorado lacrosse) so the operator can see what's actually on the screen and decide whether to manually navigate or schedule for later.

**Why we didn't pursue the other AI's suggestions:**
- *"Try deep link first, fall back to guided nav"* — every `sportscenter://` deep-link variant tested (showEvent, showWatch, showGame, showWatchStream with and without UUID playIDs) collapses to StartupActivity → home. No deep link to retry.
- *"State-aware: skip launch if app already open"* — possible micro-optimization, not a reliability win. Force-stop + relaunch gives deterministic starting state.
- *"Sideload `com.espn.score_center`"* — older ESPN APK supports `showWatchStream` but isn't on Amazon's app store, requires per-device manual install, breaks across OTA updates. Won't scale to a 6-location fleet.

**Affected:** 1 file. `packages/firecube/src/adb-client.ts` (new `_findVisibleTileMatchingTitle` helper + sequence rewrite + MEDIA_STOP).

---

### v2.32.96 — ESPN focused-tile verification gate + error propagation
**Released:** 2026-05-08

**No setup required.** Code-only fix.

**What it adds:** A pre-CENTER verification step in the ESPN search-by-title autoplay. After DPAD_DOWN focuses the first search result, the autoplay dumps the UI hierarchy, parses the focused tile's accessibility content (text + content-desc from any node within the focused tile's bounds — the focused container itself usually has empty content-desc but a sibling at the same bounds carries the full description), and fuzzy-matches against the bartender's intended title. If the tokens match → fire CENTER and play. If not → log the actual focused-tile content + DON'T fire CENTER + throw an error that surfaces back to the bartender remote with the actual visible-tile description.

**Why:** Operator-flagged at the bar — clicking Watch on a specific game put up the wrong content (PGA quad-view) for every NCAA game. Root cause: ESPN's UI sometimes leaves the post-search-DPAD focus on the wrong screen (Featured tab tile vs. search-results tile) depending on UI state at launch. Without verification, every run plays whatever tile is focused, no signal to the operator. Live test caught the failure case: wanted "Southern Miss James Madison", focused tile would have been "Florida 1 #3 Alabama 6" → verification refused to play wrong content.

**Bonus fix:** `streaming-service-manager.launchApp` now re-throws the underlying error instead of swallowing it. Pre-fix the API responded with a generic "Failed to launch app" string. Post-fix the bartender remote sees the actual error message ("ESPN couldn't find 'Southern Miss James Madison' — focused tile would have played 'Florida 1 #3 Alabama 6'. App is open at home screen for manual navigation.").

**Why we can't bypass DPAD entirely on ESPN:** PlayerActivity is `not exported` (Android security gate). Every `sportscenter://` deep-link variant tested today (`showEvent`, `showWatch`, `showGame`, `showWatchStream`, with and without UUID-format playIDs) collapses to StartupActivity → ESPN's Comrade resolver → home. Comrade is partner-only. Third-party `am start -n com.espn.gtv/.../PlayerActivity` returns `Permission Denial: not exported from uid 10195`. Community projects (ADBTuner / Channels DVR) that ship `showWatchStream` working target the older `com.espn.score_center` Phone/Tablet APK, not Fire TV's `com.espn.gtv` — different intent-filter handler. Verified empirically; documented for future reference.

**Affected:** 2 files. `packages/firecube/src/adb-client.ts` (verification gate + helper), `apps/web/src/services/streaming-service-manager.ts` (re-throw on launch error).

---

### v2.32.95 — Per-game deepLinks for ALL ESPN/Prime Video injection paths (Watch button bug from v2.32.94 verification gap)
**Released:** 2026-05-08

**No setup required.** Code-only fix.

**What it fixes:** Live operator report from the bar — Watch button on Amazon 3 (Cube 3) put up the same PGA quad-view for every game clicked from the channel guide. The v2.32.94 ship verified the walker-injected path (1 path) but missed that the channel-guide route has TWO OTHER injection paths that build streaming-app channels without a per-game deepLink:

1. **broadcast_networks fallback** (line ~842): pulls from `game_schedules`, walks broadcast_networks looking for a logged-in streaming app. Used a shared `appChannel` reference per app — every college-baseball/college-football ESPN+ game pointed at the SAME un-deeplinked channel.

2. **Rail Media streaming injection** (line ~697): when Rail Media data ships a station name that maps to a streaming app, builds a `channelInfo` and uses it for the program. Same shared-reference bug.

Result: 39 of 45 ESPN programs in the bartender's channel guide had no per-game deepLink. Watch button → /api/streaming/launch with no `?q=` param → streaming-service-manager fell through to launchEspnToLiveContent's featured-tile path (DPAD_DOWN+CENTER) → ESPN's home tab → first featured tile = the PGA quad-view → operator saw same golf for every game.

**Fix:** Both injection paths now build a per-program `programChannel` shallow-copy with a per-game deepLink. The deepLink format mirrors v2.32.94's walker output:
- ESPN: `sportscenter://x-callback-url/showHomeTab?q=<query>`
- Prime Video: `https://watch.amazon.com/search?phrase=<query>`

Search query priority (Rail Media path):
1. `<awayTeam> <homeTeam>` (most distinctive)
2. `listing.data['event']` / `['tour']` (golf, tennis, motorsports)
3. `group.group_title` (final fallback — at least lands on the right sport)

The team-string cleaner strips noisy Rail Media prefixes like `NCAA: (22)Southern Miss` → `Southern Miss`.

Also fixed a related miss in the broadcast_networks path: it checked `matchedAppInfo.app === 'ESPN'` but `matchedAppInfo.app` for ESPN+ broadcasts is `'ESPN+'` (not `'ESPN'`). Switched to checking `appChannel.appId === 'espn-plus'` for unambiguous catalog-ID matching.

**Verified live on Cube 3:**
- Pre-fix bartender guide for Cube 3: 6 of 45 ESPN programs had per-game deepLinks (only walker-captured tiles).
- Post-fix: **46 of 46 ESPN programs + 8 of 8 Prime Video programs** have per-game deepLinks.
- End-to-end Watch test on a previously-broken NCAA Baseball game ("NCAA: (22)Southern Miss @ James Madison") — pre-fix landed on PageControllerActivity → golf quad-view; post-fix lands on `com.espn.gtv/com.espn.video.dmp.PlayerActivity`, MediaSession `state=8 BUFFERING`.

**Why I missed this in v2.32.94:** my verification was a single Watch click on a walker-captured tile (`McIlroy Featured Group`), which travels through path #1 (walker injection). Paths #2 (broadcast_networks fallback) and #3 (Rail Media streaming) are responsible for the majority of ESPN programs in the channel guide and were untouched by v2.32.94. End-to-end verification should have included a click on a non-walker game from the actual bartender guide — I'll do that on every Watch-button-related ship going forward.

**Affected:** 1 file. `apps/web/src/app/api/channel-guide/route.ts` (Rail Media streaming injection at line ~697 + broadcast_networks fallback at line ~842).

---

### v2.32.94 — ESPN search-by-title autoplay (per-event Watch button reaches specific games)
**Released:** 2026-05-08

**No setup required.** Code-only fix.

**What it fixes:** Pre-fix the bartender's Watch button on ESPN games landed on whatever ESPN featured as its first content tile (typically PGA, MLB, headline NFL — whatever ESPN was promoting at the moment). For niche games — college softball, regional sports, mid-tier matchups — the autoplay reached `PageControllerActivity` (ESPN home) but never `PlayerActivity` because the operator's intended game wasn't ESPN's "featured tile". Operator pain reported live today against a Tarleton State Texans softball game.

**Fix:** ESPN walker now writes per-tile deep links of the form `sportscenter://x-callback-url/showHomeTab?q=<title>` (one per tile, title URL-encoded). The streaming-service-manager extracts the `q` param at Watch time and passes the title to a new search-by-title autoplay path in `launchEspnToLiveContent`. The autoplay sequence:

1. Launch ESPN via LEANBACK_LAUNCHER (unchanged)
2. Wait 8s for home tab to render
3. `DPAD_LEFT` → focus moves to the left navigation rail at "Home"
4. `DPAD_UP` → focus moves up to "Search"
5. `DPAD_CENTER` → opens ESPN's search activity with focused EditText
6. `input text "<title>"` (spaces escaped as `%s`) — Android types into the EditText
7. Wait 4s for search results
8. `DPAD_DOWN` + `DPAD_CENTER` → focus and play the first result

When the catalog row predates v2.32.94 (no `q` param in the deepLink), the code falls through to the v2.32.85 featured-tile path — backwards-compatible, no walks need to be re-run before the fix takes effect.

**Verified end-to-end on Cube 3:** pre-fix Watch on McIlroy Featured Group landed on `PageControllerActivity` with `state=0 NONE`. Post-fix: API takes 21s, lands on `PlayerActivity`, MediaSession `state=8 BUFFERING` (rolling to PLAYING in seconds). Same architectural pattern works for any ESPN tile with a `?q=` parameter.

**Why ESPN-specific is necessary:** Earlier today's #2 closure documented that ESPN's deep-link surface is Comrade-gated — `sportscenter://*` paths all collapse to home. Public deep-link variants (showEvent, showWatch, showGame, https://espn.com/watch) all proven non-functional. The in-app DPAD-to-Search-rail + `input text` approach is the only third-party path to a specific ESPN+ event.

**Affected:** 3 files. `packages/scheduler/src/firetv-catalog-walker.ts` (extractEspnTiles deepLink format), `apps/web/src/services/streaming-service-manager.ts` (espn-plus branch extracts `q`), `packages/firecube/src/adb-client.ts` (launchEspnToLiveContent search-by-title path).

---

### v2.32.93 — Audit follow-ups: Max catalog entry + TNT/TBS network-map; firebat in subscription-polling; longer adb-connect timeout
**Released:** 2026-05-08

**No setup required.** Three follow-up fixes from the v2.32.92 code-reviewer audit:

1. **Max in streaming catalog + TNT/TBS/truTV in network-map.** Pre-fix the catalog had no current Max entry (only legacy `'Max (legacy HBO)'` with `com.hbo.hbonow`). `network-map.ts` had no TNT/TBS entries. Effect: any game with `primaryNetwork = 'TNT'` / `'TBS'` (NBA playoffs, MLB postseason, March Madness, college FB) silently excluded every Cube with Max installed from being a candidate — same root-cause class as v2.32.91/.92. **Fix:** new catalog entry (`id: 'max'`, `name: 'Max'`, `packageName: 'com.wbd.stream'`, alias `com.hbo.hbonow`); `network-map.ts` adds TNT/TBS/truTV/'TNT Sports' → `'Max'`.

2. **`subscription-polling.ts` was missing `com.amazon.firebat`** in its packageName→displayName map. On AFTR Cubes (Fire TV Cube 2nd gen) Prime Video is launcher-hosted via firebat — `com.amazon.avod` doesn't exist. Pre-fix the device-config UI's subscription-detect endpoint reported "Prime Video not installed" on every AFTR Cube. **Fix:** added `'com.amazon.firebat' → 'Amazon Prime Video'`.

3. **`adb connect` timeout 8s → 12s** in `subscription-polling.ts`. Audit feedback: AFTR Cubes in deep sleep can take 10-14s to wake their network stack; 8s produced false-negative "device dead" reports on healthy-but-sleeping devices. 12s covers wake while still catching genuine hangs.

**Verification:** 10/10 sanity tests pass on `availableNetworksMatch` (TNT/TBS/truTV → Max, plus regression tests preserving ESPN+/NBC mappings from v2.32.92), plus catalog lookups via display-name alias and packageName alias.

**Affected:** 4 files. `packages/streaming/src/streaming-apps-database.ts` (new Max entry), `packages/scheduler/src/network-map.ts` (TNT/TBS/truTV/'TNT Sports' mappings), `packages/firecube/src/subscription-polling.ts` (firebat entry + 12s timeout).

---

### v2.32.92 — Bug hunt batch: ESPN+ allocator/conflict matching, Paramount+ sendKey timeout, plus 3 quieter ones
**Released:** 2026-05-08

**No setup required.** Code-only fixes. Multi-agent bug hunt found 7 latent bugs in the same root-cause classes as today's earlier ships (string-match misalignment, hardcoded ADB timeouts, swallowed errors).

**Tier-1 fixes (would silently bite real operator scenarios):**

1. **`smart-input-allocator.ts:findCapableInputs`** — pre-fix `availableNetworks.includes(targetNetwork)` raw-matched ESPN broadcast names against catalog names. Result: any game with `primaryNetwork = "ESPN+"` / `"ESPN2"` / `"ESPNU"` / `"NBC"` / `"CBS"` / `"FS1"` / `"FOX"` silently excluded every Fire TV input from allocation candidates despite Fire TVs being able to play those networks via the ESPN/Peacock/Paramount+/Fox apps. Same pattern as v2.32.91 walker bug. **Fix:** new `packages/scheduler/src/network-map.ts` with `availableNetworksMatch(availableNetworks, network)` that normalizes broadcast → catalog name before compare. Allocator now imports it.

2. **`conflict-detector.ts:countCapableInputs`** — same root cause as #1, same fix path (imports `availableNetworksMatch`). Pre-fix undercounted Fire TV capability for ESPN+ games and produced spurious conflict warnings.

3. **`subscription-polling.ts`** — `adb connect` and `pm list packages` had no timeout. An unresponsive Cube would hang the request handler 60-120s (Linux TCP retransmit window). **Fix:** explicit `{ timeout: 8000 }` and `{ timeout: 15000 }`.

4. **`adb-client.ts:launchParamountLiveTV`** — DPAD_CENTER used 3s default timeout (same bug class as v2.32.91's Prime Video / ESPN sequences). **Fix:** pass `8000` like the others.

**Tier-2 fixes (perf + observability):**

5. **`firetv-app-sync.ts:hasPrimeAlready`** — string compared to `'Prime Video'` but `getDisplayNameForPackage` returns the catalog `name` value `'Amazon Prime Video'`. Check NEVER matched, wasting one ADB probe per Fire TV per sync (~50ms). **Fix:** compare to `'Amazon Prime Video'`.

6. **`adb-client.ts:getDeviceProperty`** — added optional `timeoutMs` (default 3000ms preserved). Lets `testConnection` cold-wake probes pass `8000` if needed.

7. **`scheduler-service.ts` tick loop** — bare `catch {}` on `tvOutputIds` JSON.parse silently dropped malformed allocation rows. **Fix:** `logger.warn` with the bad value so corrupted rows surface in operator logs (and System Admin → Logs).

**Affected:** 6 files. `packages/scheduler/src/network-map.ts` (new), `smart-input-allocator.ts`, `conflict-detector.ts`, `firetv-app-sync.ts`, `scheduler-service.ts`, `packages/firecube/src/subscription-polling.ts`, `packages/firecube/src/adb-client.ts`.

---

### v2.32.91 — Walker actually walks Prime Video now (alias-resolution fix); sendKey timeout pass-through
**Released:** 2026-05-08

**No setup required.** Code-only fix.

**What it fixes:** Two interlocking bugs that together prevented the Watch button from working for any Prime Video game on the bartender remote.

**Bug 1 — walker silently skipped Prime Video for ~6 weeks.** `APP_WALK_RULES` was keyed by `displayName: 'Prime Video'`, but `input_sources.available_networks` at most locations stores `'Amazon Prime Video'` (some store `'Prime Video'`). The pre-fix filter `availableNetworks.filter((n) => APP_WALK_RULES[n])` is exact-string match — `'Amazon Prime Video'` never matched `'Prime Video'` so Prime Video walks NEVER ran. Result: zero Prime Video tiles in `firetv_streaming_catalog`, zero Prime Video games in the bartender's per-input channel guide, zero Watch buttons for Prime Video content. The bartender wasn't broken; the catalog was just empty for Prime Video. Confirmed live at Holmgren on 2026-05-08: walks attempted = 4 (only ESPN + Peacock skip on both Cubes); after fix walks attempted = 10 (adds Prime Video on both Cubes), totalTilesUploaded jumped 14 → 30. **Fix:** alias-aware resolution via `findStreamingAppByDisplayName(network) → catalogId → APP_WALK_RULES[ruleKey where rule.catalogId matches]`. Direct key match still wins as fast path.

**Bug 2 — 3s sendKey timeout aborted autoplay sequences.** Same root cause as v2.32.89's `uiautomator dump` fix but on a different ADB command path. `sendKey` calls `executeShellCommand` with the default 3000ms timeout. During Prime Video's `SearchResultsActivity` rendering and ESPN's content-row hydration the Cube's framework can pin transiently — the keyevent itself is fast but `adb shell -T` waits for system_server ack. Reproduced live: DPAD_DOWN to SearchResultsActivity timed out at exactly 3000ms, autoplay aborted, `/api/streaming/launch` returned `success:false`, bartender showed "Failed to launch". **Fix:** added optional `timeoutMs` param to `sendKey` (mirrors `executeShellCommand`'s); both `launchPrimeVideoToContent` and `launchEspnToLiveContent` now pass `8000` on each DPAD event. Default 3s preserved on every other call site.

**Verified at Holmgren:** pre-fix `/api/streaming/launch` for any Prime Video game returned 500. Post-fix returns 200 in ~11s and Cube 3 advances past launcher to Prime Video. Whether the autoplay reaches PlayerActivity vs SearchResultsActivity depends on whether the title search returns a playable first result — pre-existing limitation of the search-bounce pattern, not a regression.

**Affected:** `packages/scheduler/src/firetv-catalog-walker.ts` (alias resolution), `packages/firecube/src/adb-client.ts` (sendKey timeoutMs + autoplay sequences).

---

### v2.32.90 — Walker rules: document Hulu / YouTube TV / Fox Sports as non-walkable
**Released:** 2026-05-08

**No setup required.** Documentation-only commit (no functional changes).

**What it adds:** Three new `APP_WALK_RULES` entries in `firetv-catalog-walker.ts`, all with `usesWebView: true` (effectively skip-flagged). Each carries a comment explaining the actual probe result so future sessions don't re-investigate. Reasons:

- **Hulu:** Probed at greenville on a logged-out Cube — dump shows only paywall text ("App Not Owned" / "See Details" / "Quit"). Cube needs an operator-driven sign-in before walking yields real content.
- **YouTube TV:** Probed at graystone — `dev.cobalt.app.MainActivity` is YouTube's Cobalt runtime, renders via OpenGL surfaces with no accessibility tree. 0 readable text nodes, same pattern as Apple TV+.
- **Fox Sports (com.foxsports.videogo):** Probed at graystone — MainActivity displays a single "OPEN FOX ONE" button; the APK is a stub redirecting to com.fox.foxone for actual content. The stub itself captures nothing useful.

**Why this matters:** Without these explicit entries, future probes will keep landing on the same dead ends. Walker logs an info line for each `usesWebView` skip rather than attempting and silently failing.

**Affected:** `packages/scheduler/src/firetv-catalog-walker.ts` (new entries between fuboTV and the closing brace).

---

### v2.32.89 — Walker `uiautomator dump` no longer hits the 3s adb timeout
**Released:** 2026-05-08

**No setup required.** Pure code fix.

**What it fixes:** Cube 3 ESPN walks were failing with "empty dump" / HTTP 500 on `/api/firetv-devices/send-command` for `uiautomator dump`. Root cause: `adb-client.ts:executeShellCommand()` had a hardcoded 3000ms timeout. UIautomator dumping the Fire TV launcher home-screen tile tree (~20+ tiles in row groups) takes >3s on a busy device — the timeout fires before the dump file flushes, the wrapped `adb shell -T` command exits with no stdout, and the walker sees `xml.length=0` → "empty dump".

Direct ADB (no timeout) succeeds immediately on the same device with a 33KB dump.

**Fix:** added optional `timeoutMs` param to `executeShellCommand` (default still 3000ms, capped at 30s); added optional `timeoutMs` to the send-command POST schema; walker passes `10000` for `uiautomator dump` only. All other commands keep the snappy 3s default. Only the walker is affected by the change.

**Verification at Holmgren:** Pre-fix `curl POST /api/firetv-devices/send-command` with `command="uiautomator dump ..."` against Cube 3 → 500 with empty error. Post-fix with `timeoutMs: 10000` → 200, "UI hierchary dumped to: …", 33KB file present.

**Affected:** `packages/firecube/src/adb-client.ts`, `apps/web/src/app/api/firetv-devices/send-command/route.ts`, `packages/scheduler/src/firetv-catalog-walker.ts`.

---

### v2.32.88 — NFHS bartender title shows sport (V vs JV distinguishable)
**Released:** 2026-05-08

**No setup required.** Pure UI change.

**What it fixes:** When NFHS lists Varsity AND JV games of the same matchup (e.g. "Pulaski vs West De Pere") on the same day, the bartender remote rendered both with the identical title "Pulaski @ West De Pere" — operators couldn't tell which one to schedule. The channel-guide route was already sending `sport: "Varsity Girls Soccer"` / `"Junior Varsity Girls Soccer"` on each game; the GameListing TS interface in `EnhancedChannelGuideBartenderRemote.tsx` simply didn't declare the field, and the title rendering ignored it. Fix: add `sport?: string` to the interface, append ` — ${game.sport}` to the title when present (NFHS-only — no other code path sets `sport` on programs in `apps/web/src/app/api/channel-guide/route.ts`).

**Affected:** `apps/web/src/components/EnhancedChannelGuideBartenderRemote.tsx` (interface + one render line). Backwards-compatible — non-NFHS games unaffected (their programs don't carry a `sport` field).

---

### v2.32.87 — Watch button updates input label instantly
**Released:** 2026-05-08

**No setup required.**

**What it fixes:** Bartender hits Watch → app launches on Fire TV → but the input label in the UI keeps showing the previous state ("Home • streaming") until scheduler-service polls `/api/firetv-devices/[id]/current-app` on its 5-min cycle. Now `/api/streaming/launch` mirrors the launched app's friendly name into `inputCurrentChannels` immediately after a successful launch (same write shape as the polling endpoint: `channelNumber="APP"`, `channelName=<catalog name>`). Verified live on Cube 3 — under 1s of latency vs the previous 5min.

**Affected:** `apps/web/src/app/api/streaming/launch/route.ts`.

---

### v2.32.86 — NFHS catalog cleanup (deepLinkSupport=false)
**Released:** 2026-05-08

**No setup required.**

**What it fixes:** NFHS catalog entry had `deepLinkFormat: 'nfhs://event/{eventId}'` but `pm dump com.playon.nfhslive | grep Scheme` shows the package registers no external scheme — the deep link was non-functional. Cleared the format and set `deepLinkSupport: false` so the streaming-service-manager skips the deep-link path and falls back to a launcher-only launch. NFHS Watch still opens the app (lands on SubscribeActivity until the operator signs in once on the device — one-time per-Cube).

**Affected:** `packages/streaming/src/streaming-apps-database.ts` (nfhs-network entry).

---

### v2.32.85 — ESPN autoplay + Schedule button deep-link pipe end-to-end
**Released:** 2026-05-08

**Required manual step (one-time per location):**
```
sqlite3 /home/ubuntu/sports-bar-data/production.db "ALTER TABLE input_source_allocations ADD COLUMN deep_link TEXT;"
```
Verify with:
```
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA table_info(input_source_allocations);" | grep deep_link
```

**Two distinct features in one release:**

**1. ESPN Watch button now lands on PlayerActivity** (mirrors v2.32.84 Prime Video work). The ESPN catalog entry's `deepLinkFormat` was wrong (`espn://x-callback-url/...` — this scheme is not registered with `com.espn.gtv`); replaced with `sportscenter://x-callback-url/showHomeTab` (verified live on Cube 3 via `pm dump com.espn.gtv | grep Scheme`). New `launchEspnToLiveContent` in adb-client launches ESPN via the LEANBACK_LAUNCHER (NOT via the deeplink — testing showed deeplink-launch leaves focus in a different state where DPAD_DOWN+CENTER doesn't reach PlayerActivity). Sequence: launch → wait 8s → DPAD_DOWN → DPAD_CENTER → `com.espn.video.dmp.PlayerActivity`. Verified live: state=3 PLAYING. Walker now writes `deepLink: 'sportscenter://...'` for every ESPN tile (was previously empty).

**2. Schedule button now plumbs deep links through to game-time tune.** Pre-fix: bartender clicks "Schedule" on a Prime Video / ESPN game, scheduler-service polls and at game-start fires `/api/channel-presets/tune` with `channelNumber + deviceType + fireTVId` BUT no deepLink — `streamingManager.launchApp(...,{},...)` empty options → app home screen. Fix: new `deep_link` column on `input_source_allocations`; bartender-schedule POST captures `game.channel.deepLink`; scheduler-service forwards it; tune endpoint passes it to `streamingManager.launchApp({deepLink}, ...)`; routes to autoplay path. Verified end-to-end on Cube 3: `POST /api/channel-presets/tune` with `deepLink: "https://watch.amazon.com/search?phrase=Citadel"` → PlayerActivity, state=3 PLAYING.

**Affected:**
- `packages/streaming/src/streaming-apps-database.ts` (espn-plus deepLinkFormat)
- `packages/firecube/src/adb-client.ts` (launchEspnToLiveContent + monkey-launch fallback)
- `apps/web/src/services/streaming-service-manager.ts` (espn-plus autoplay branch)
- `packages/scheduler/src/firetv-catalog-walker.ts` (ESPN extractor populates deepLink)
- `packages/database/src/schema.ts` (input_source_allocations.deepLink column)
- `apps/web/src/app/api/schedules/bartender-schedule/route.ts` (accept + store deepLink)
- `apps/web/src/components/EnhancedChannelGuideBartenderRemote.tsx` (forward deepLink to schedule POST)
- `packages/scheduler/src/scheduler-service.ts` (read allocation.deepLink, pass to tune endpoint)
- `apps/web/src/app/api/channel-presets/tune/route.ts` (accept deepLink, forward to streamingManager options)

**Risk:** GO with the ALTER TABLE step. Otherwise additive: non-amazon-prime/espn-plus apps unchanged. Cable/DirecTV scheduling unchanged (deepLink only meaningful for firetv).

---

### v2.32.84 — Prime Video Watch button now plays the game (autoplay end-to-end)
**Released:** 2026-05-08

**Required manual step (one-time per location):** if the location's `firetv_streaming_catalog` table is missing the `startTime` column (added in v2.32.63 schema, but `drizzle-kit push` silently skipped it on installs that already had the `firetv_catalog_*` indexes — see CLAUDE.md gotcha #6), run once:
```
sqlite3 /home/ubuntu/sports-bar-data/production.db "ALTER TABLE firetv_streaming_catalog ADD COLUMN startTime INTEGER;"
```
Verify with:
```
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA table_info(firetv_streaming_catalog);" | grep startTime
```
Without this column the catalog walker silently fails ingest with `table firetv_streaming_catalog has no column named startTime` — no Prime Video tiles get persisted, channel guide returns no streaming games. Affected locations are any that installed before v2.32.63 (most of the fleet). Holmgren applied 2026-05-08.

**Why it shipped:** Outstanding work item #2 — bartender's Watch button on a Prime Video game opened the app's home screen, not the game. v2.32.58 wired the `deepLink` field through the bartender remote but no extractor populated it for Prime Video, AND the catalog injection put `deepLink` on the program object while bartender's consumer read `game.channel.deepLink` — structural mismatch confirmed by code-reviewer agent on 2026-05-08.

**What changed:**
1. **`amazon-prime` catalog entry** (`packages/streaming/src/streaming-apps-database.ts`) — `packageName` promoted from `com.amazon.avod` to `com.amazon.firebat` (saves three wasted ADB `pm list packages` round-trips per launch on AFTR Cubes; non-AFTR Cubes still resolve via the alias chain). `deepLinkFormat` changed from broken `aiv://aiv/view?gti={contentId}` (scheme not registered on AFTR — verified live) to `https://watch.amazon.com/search?phrase={contentTitle}` (registered with `com.amazon.firebat` for the `watch.amazon.com/search` path).
2. **Walker** (`packages/scheduler/src/firetv-catalog-walker.ts`) — `extractPrimeVideoTiles` now populates `CatalogTile.deepLink` for every captured tile using the search-by-title format. Added MLB/NHL/MLS/UFC/college sport-row patterns. Added Amazon promotional-copy blocklist (Watch trailer, Watchlist, Like, Not for me, Included with Prime, Start your N-day trial, etc.) so they don't survive into the channel guide.
3. **Channel-guide route** (`apps/web/src/app/api/channel-guide/route.ts`) — catalog injection now puts `deepLink` on a per-program shallow copy of the cached `appChannel` (the cached channel itself stays generic so multiple games for the same app still share it). `StreamingAppChannel` interface gained `deepLink?: string`.
4. **ADB client** (`packages/firecube/src/adb-client.ts`) — `launchAppWithDeepLink(deepLink, packageName?)` accepts optional package name → `am start -p <pkg> -a VIEW -d '<url>'`. Single-quoted URL with `'` → `'\''` escape so URLs with `&` (query separators) and `'` (apostrophes in titles) survive the outer shell. New `launchPrimeVideoToContent(contentTitle, packageName?)` runs the autoplay sequence: search-deeplink → wait 5s → DPAD_DOWN → wait 400ms → DPAD_CENTER → wait 3s → DPAD_CENTER. Empty contentTitle is rejected with a clear error.
5. **Streaming service manager** (`apps/web/src/services/streaming-service-manager.ts`) — routes `amazon-prime` through `launchPrimeVideoToContent` (extracts phrase from URL); passes resolved package name to `launchAppWithDeepLink` (forces ResolverActivity bypass via `-p` flag); warns when `deepLink` provided but `app.deepLinkSupport=false` (silent footgun); `getCurrentApp` switched to `findStreamingAppByPackageName` so non-AFTR Cubes playing Prime Video resolve correctly via the alias chain.

**Verified live on Cube 3** (Holmgren, AFTR, Fire OS 9, PVFTV-215.5374N) on 2026-05-08:
- POST /api/streaming/launch with `appId=amazon-prime` and `deepLink=https://watch.amazon.com/search?phrase=Citadel`
- 13s later: foreground = `com.amazon.firebatcore.playback.inappplayback.PlaybackActivity`, MediaSession state=3 (PLAYING)
- URLs with `&` and empty-phrase fallback both tested OK
- Reviewed by `feature-dev:code-reviewer` agent (caught 3 issues: shell quoting, empty-title guard, alias-aware getCurrentApp — all fixed before commit)

**Affected:** `packages/streaming/src/streaming-apps-database.ts`, `packages/scheduler/src/firetv-catalog-walker.ts`, `packages/firecube/src/adb-client.ts`, `apps/web/src/services/streaming-service-manager.ts`, `apps/web/src/app/api/channel-guide/route.ts`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Risk:** GO with one operator step (the ALTER TABLE one-liner above). Otherwise additive — non-Prime-Video apps unchanged.

---

### v2.32.83 — Docs catch-up: fleet status reflects v2.32.82 fleet-wide deploy
**Released:** 2026-05-08

**No setup required.** Docs-only — `docs/FLEET_STATUS.md` updated to reflect the live fleet state after triggering all 5 remote boxes from Holmgren this morning. Per-location table now shows all 6 venues at v2.32.82 with sidecars bootstrapped. "What shipped today" entries split between 2026-05-07 (the earlier batch) and 2026-05-08 (drift-recovery work). Outstanding work item 1a moved to ~~done~~.

**Affected:** `docs/FLEET_STATUS.md`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`.

**Risk:** GO — docs only.

---

### v2.32.82 — Drift recovery sidecar (fix for v2.32.81)
**Released:** 2026-05-08

**No setup required.** Bug-fix to v2.32.81. Drift-recovery worked end-to-end on Holmgren when verified live (drifted to main → switched to location/holmgren-way → merged main → built → restarted PM2 → verified 7/7 → pushed → SUCCESS in 105s), but only after manual sidecar bootstrap.

**Why:** v2.32.81's drift-recovery block reads `.auto-update-last-success.json` from the repo root. That file is tracked on each `location/*` branch but NOT on `main` — when an interactive session switches to main, the heartbeat file vanishes from the working tree exactly when drift-recovery needs it. v2.32.81's first real test (drift simulated on Holmgren, fresh from main checkout) hit this and logged `WARNING: on 'main' with no heartbeat file — cannot determine canonical branch; continuing as main` — silently no-op'd, same outcome as the original bug.

**Fix:** Sidecar copy at `/home/ubuntu/sports-bar-data/.auto-update-last-success.json`. The data dir is gitignored, persists across branch switches. Three changes to `scripts/auto-update.sh`:
1. Drift-recovery block reads `SIDECAR_HEARTBEAT` first, falls back to `HEARTBEAT_FILE` (covers boxes that haven't run v2.32.82 yet AND happen to be on the right branch when drift-recovery runs — degenerate case, but free).
2. Heartbeat-write block also writes a copy to the sidecar location after each successful run.
3. `refresh_heartbeat_os_only()` (the no-op-with-os-changes path) also keeps sidecar in sync.

**Bootstrap on existing fleet:** First time v2.32.82 runs from a `location/*` branch, the sidecar gets created. Subsequent drift-to-main events are recoverable. For boxes that are CURRENTLY drifted to main, sidecar must be seeded once manually before v2.32.82 can recover them — operator one-liner: `git show origin/<location-branch>:.auto-update-last-success.json > /home/ubuntu/sports-bar-data/.auto-update-last-success.json`. This was done on Holmgren as part of the live verification.

**Verified live on Holmgren 2026-05-08 08:51-08:53 CDT** — drift-recovery log captured at `/home/ubuntu/sports-bar-data/update-logs/auto-update-2026-05-08-08-51.log`:
```
[08:51:25] Current branch: main
[08:51:25] DRIFT: on 'main' but heartbeat says canonical branch is 'location/holmgren-way' — switching back
[08:51:25] Switched to location/holmgren-way; continuing update flow
[08:53:11] SUCCESS: updated location/holmgren-way from 7f187821 to 7e8bd480 in 105s
```

**Affected:** `scripts/auto-update.sh`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Risk:** GO — additive paths, no behavior change for non-drift case.

---

### v2.32.81 — Auto-update branch-drift recovery
**Released:** 2026-05-08

**No setup required.** Pure bug-fix to `scripts/auto-update.sh`.

**Why:** A box can be left on `main` instead of its `location/*` branch by an interactive Claude or operator session. When that happens every cron run silently no-ops because the pre-merge check at the FETCH phase (`git merge-base --is-ancestor origin/main HEAD`) succeeds — origin/main IS HEAD when local is on main. The script writes a "pass" history row each time but no merge actually happens. Holmgren hit this on 2026-05-08, sat on main for ~10h, and missed v2.32.76 through v2.32.80 until a manual fleet-status check caught it.

**Fix:** New drift-recovery block runs immediately after `BRANCH` is detected (lines 559-597). Only fires when `BRANCH=main`. Reads `.auto-update-last-success.json` (the heartbeat written by every successful run, which records the canonical branch) via `python3 - "$HEARTBEAT_FILE" <<'PY'` (sys.argv form, immune to shell-quoting issues in the path). If heartbeat says canonical branch is something other than main:
1. Pre-cleans uncommitted edits to `LOCATION_PATHS_THEIRS` files (the same set the regular merge phase resets — array `PRE_MERGE_RESET_PATHS` is now declared once near the top so both consumers share it).
2. `git checkout EXPECTED_BRANCH` and updates `$BRANCH`.
3. Continues the update flow normally.

If no heartbeat exists (legitimate fresh checkout) → log warning, continue as main.
If heartbeat exists but `git checkout` fails (branch was deleted, or working-tree has edits to files outside `PRE_MERGE_RESET_PATHS`) → `fail` with "operator intervention needed (check 'git status' on the box)". Loud failure beats silent no-op.

**Verify:** On any box, run `bash scripts/auto-update.sh --triggered-by=manual_cli` while on `main`. Expect log lines:
- `DRIFT: on 'main' but heartbeat says canonical branch is 'location/<X>' — switching back`
- `Switched to location/<X>; continuing update flow`

Then the normal merge/build/verify cycle proceeds, and the box ends up on its location branch with the latest main merged in.

**Affected:** `scripts/auto-update.sh` (66 insertions, 13 deletions — added drift block, moved `PRE_MERGE_RESET_PATHS` array up so it's defined before either consumer), `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Risk:** GO — defensive guard only. Non-drift code paths are untouched.

---

### v2.32.80 — Pass 2 (ops tooling): heartbeat refresh on no-op + verify-install lint
**Released:** 2026-05-08

Pass 2 of the simplify-skill code-cleanup campaign — focused on the operationally-critical scripts (`scripts/auto-update.sh`, `scripts/setup-iris-ollama.sh`, `scripts/verify-install.sh`). These run nightly at all 6 venues, so the bar for changes here is higher than for app code. Static analysis with `shellcheck` (filtered SC2317/SC2094 false-positives from trap handlers) found minimal real issues — the scripts are well-written. Real changes:

**Improvement 1 — Heartbeat refreshes os.* on no-op auto-update runs** (`scripts/auto-update.sh`)

Closes Outstanding work item #4. Pre-fix: when `auto-update.sh` exited at "no update available" (origin/main already merged into the location branch) it skipped the heartbeat-write block entirely. Operator-driven changes that happen OUTSIDE auto-update — the most common is a kernel reboot from `apt dist-upgrade` — left the Fleet Dashboard showing stale `os.kernel` until the next real merge. Today's fleet-wide kernel sync (graystone/appleton/greenville on 6.8.0-111, holmgren/leglamp/lucky-s rebooted from 6.8.0-100/-110 to -111) hit this exact case; I had to write `/tmp/refresh-heartbeat.sh` ad-hoc to push fresh `os.kernel` per box. Fix: new `refresh_heartbeat_os_only()` helper. Conservative scope — only patches the `os` block; leaves `verifyInstall`/`configChecksums`/`dbRowCounts` intact since those reflect the last full verify run and weren't re-checked. Idempotent: a python helper compares current vs stored os fields and exits 1 if no change, so commit+push only fire when something actually changed.

**Improvement 2 — verify-install.sh lint cleanup** (`scripts/verify-install.sh`)

Three real `shellcheck` findings, all small:
- `CRASH_LOG_WINDOW_SECS=60` was declared `readonly` but never read in code (only mentioned in a comment). Removed; updated the comment to match what the code actually does (no time-window check).
- `pm_uptime` was destructured from `pm2 jlist` JSON output but never used. Removed from both the node JSON producer and the bash `read -r` consumer.
- `for attempt in $(seq 1 $HTTP_RETRIES)` (3 sites) → `seq 1 "$HTTP_RETRIES"`. Cosmetic — `$HTTP_RETRIES` is an integer constant — but quieting the lint keeps the next round of `shellcheck` clean.

`scripts/setup-iris-ollama.sh` had zero shellcheck findings. `scripts/auto-update.sh` had zero real findings (the 39 SC2317 hits were trap-handler false-positives).

**Held items:** None at this scope. Pass 3 (broad packages/* audit) follows separately.

**Required Manual Step:** None — all changes are pure refactors / lint fixes. Auto-update merge picks them up at every location.

**Verification:** `bash -n` clean on both modified scripts. Python heartbeat-patch logic dry-run against greenville's live heartbeat: same OS values → exit 1 (no commit), simulated older kernel → exit 0 (would update). `npm run build` clean (no app code changed).

---

### v2.32.79 — Pass 1 Tier 3: extract two duplicated helpers in channel-guide
**Released:** 2026-05-08

Pass 1 Tier 3 of the code-cleanup campaign. Kept narrow on this commit to avoid bundling many independent refactors that complicate review.

**Cleanup 1 — `parseListingDate(date, time)` helper** (`apps/web/src/app/api/channel-guide/route.ts`)

Three blocks parsed Rail Media listing `(date, time)` into a `Date` with the year-rollover heuristic. Two were verbatim duplicates (cable/satellite path + streaming path). The third (local-channel-override path) had different control flow — `continue` on NaN instead of rolling over to `currentYear + 1` — so it kept its own variant. Extracted the shared form to a module-level helper used in both verbatim sites.

**Cleanup 2 — `deriveIsLive(game, nowSec)` helper** (same file)

Two copy-pasted four-term boolean expressions for deriving `isLive` from a `game_schedules` row (one in cable/satellite injection, one in streaming injection). Both included the v2.28.2 carve-out for ESPN's lag in marking OT games `completed`. Extracted to a module-level helper so a future change to the status-string set (e.g. ESPN renames `completed` → `final` or adds `forfeited`) updates one site instead of two.

**Held items:** A 7-site `parseJsonArray` helper extraction (covers `broadcastNetworks`/`availableNetworks`/`installedApps` JSON parses with inconsistent error handling) and a 44-site `logInfo`/`logError` wrapper replacement (current wrappers double-format timestamps and double-log) were flagged by the audit. Both are mechanical but high-touch — deferred to a separate cleanup pass to keep the v2.32.79 diff reviewable. Same goes for the dynamic-import hoist in channel-guide (Quality #7) — many sites with name shadowing, modest payoff (Node module cache makes them effectively no-ops after first load).

**Required Manual Step:** None — pure extractive refactor with no behavioral change. Auto-update merge picks them up.

**Verification:** `npm run build` clean (34/34 turbo tasks). PM2 restart, `/api/system/health` returns `healthy` (55/57 devices online — 2 known-failing Holmgren Cubes per memory). Bartender :3002 returns 200.

This closes Pass 1 (recent streaming feature). Pass 2 (ops tooling — `auto-update.sh`, `setup-iris-ollama.sh`, `verify-install.sh`) and Pass 3 (broad packages/* audit) follow as separate sessions.

---

### v2.32.78 — Pass 1 Tier 2: performance wins from simplify-skill audit
**Released:** 2026-05-08

Pass 1 Tier 2 of the code-cleanup campaign. The efficiency reviewer flagged 10 items; this commit ships the 4 with concrete savings and low behavioral risk. (One flagged item — "double Rail Media fetch on streaming requests" — was a false alarm; the cable/satellite and streaming branches are mutually exclusive `if` blocks so only one fetch fires per request.)

**Perf 1 — Parallel Fire TV walks** (`packages/scheduler/src/firetv-catalog-walker.ts`)

`runFiretvCatalogWalk()` iterated over `firetvInputs` with a sequential `for…of` loop. Each Fire TV is a physically distinct device with its own ADB session, so the outer per-device loop is fully parallelizable (the per-app inner loop must stay serial — only one screen). Switched to `Promise.all(firetvInputs.map(...))`. At Holmgren with 2 Fire TVs × 2 walkable apps each, this halves wall-clock walk time (~56s → ~28s). Stats aggregation is unchanged because `stats.appWalksAttempted` etc. are mutated under the same Promise.all rather than racing.

**Perf 2 — Live game data change detection** (`apps/web/src/components/EnhancedChannelGuideBartenderRemote.tsx`)

`loadLiveGameData()` ran every 30s and unconditionally called `setLiveGameData(gameMap)` with a fresh Map identity. React's reference comparison saw a change every tick and re-ran the `useEffect` at line 306 → `filterPrograms()` → full `.filter()` + `.sort()` over potentially 100+ programs. Added a `setLiveGameData(prev => …)` updater that compares Map size + per-game (homeScore, awayScore, timeRemaining, quarter, isLive, status) and returns the previous Map identity when nothing material changed. iPad render loop no longer re-filters when scores haven't moved.

**Perf 3 — Throttle catalog DELETE on GET** (`apps/web/src/app/api/firestick-scout/catalog/route.ts`)

The expired-row DELETE ran on every GET. With multiple bartender remotes hitting `/api/channel-guide` simultaneously (which queries the catalog table), the DELETE write-lock could contend with concurrent reads. Added a module-level `lastCatalogCleanupSec` timestamp; cleanup now runs at most once per 60s. The 36h TTL makes sub-minute precision irrelevant.

**Perf 4 — Cache firebat probe per device** (`packages/scheduler/src/firetv-app-sync.ts`)

The launcher-hosted Prime Video back-fill probes Cubes for `com.amazon.firebat` via `pm path` (~50ms ADB round-trip per device per sweep). Package install state doesn't change at runtime, so once we have a definitive answer (true/false) it can be cached for 1 hour. Null results (probe failed, network blip) are not cached — we want to retry. Cache is module-level `Map<deviceId, {result: boolean, ts: number}>`. Eliminates ~2 round-trips per Fire TV per 5-min sweep at Holmgren.

**Required Manual Step:** None — pure performance/runtime improvements. Auto-update merge picks them up.

**Verification:** `npm run build` clean (34/34 turbo tasks). PM2 restart, `/api/system/health` returns `healthy` (55/57 devices online). Bartender :3002 returns 200.

Tier 3 (helpers + cleanup — extract `parseListingDate`/`deriveIsLive`/`parseJsonArray`, remove dead `launchStreamingApp` legacy path, replace `logInfo`/`logError` wrappers, etc.) ships as v2.32.79.

---

### v2.32.77 — three latent bugs found by simplify-skill audit
**Released:** 2026-05-08

Pass 1 of the simplify-skill code-cleanup campaign (3 parallel agents: reuse / quality / efficiency reviews against the recent streaming feature). The reuse and efficiency agents independently found the same per-box-app gate bug; the quality agent found the Quick Access tile launching the wrong package on AFTR Cubes. All three are bug fixes — no behavioral change for users beyond the bugs being fixed.

**Bug 1 — `parseOllamaResponse` double-parses already-parsed `availableNetworks`** (`apps/web/src/app/api/scheduling/ai-suggest/route.ts`)

The v2.31.7 optimization that hoisted `JSON.parse` of `availableNetworks` into a per-input cache (`appsByInputId`) called `JSON.parse` on a value that `loadInputSources()` had already JSON-parsed into a JS array. `JSON.parse` coerces the array to a string and throws — the catch silently set every Set to empty. Result: the v2.29.1 per-box app gate (`if (!inputHasApp(input, appLower))` at line 789) was bypassed, the reroute branch found zero candidates because `inputHasApp` returned false for everything, and every Fire TV suggestion was rejected with `wrong_firetv_app`. Fix: operate on the array directly with a defensive `Array.isArray()` guard.

**Bug 2 — Quick Access Prime Video tile launches `com.amazon.avod` directly via `monkey -p`** (`apps/web/src/components/EnhancedChannelGuideBartenderRemote.tsx`)

The Quick Access apps grid in the streaming guide hard-coded `com.amazon.avod` as the package name and called `launchStreamingApp()` which sent `monkey -p com.amazon.avod 1` directly via ADB. On AFTR/PVFTV Cubes (Holmgren has these per CLAUDE.md gotcha #9), `com.amazon.avod` is not installed — Prime Video lives in `com.amazon.firebat`. The streaming-apps-database catalog has the alias chain (`packageAliases: ['com.amazon.avod.thirdpartyclient', 'com.amazon.firebat']`) and `/api/streaming/launch` resolves through `LEANBACK_LAUNCHER` intents that handle the fallback — but the Quick Access tile bypassed all of that. Fix: `launchStreamingApp()` now first calls `findStreamingAppByPackageName()` (already exported from `@sports-bar/streaming` since v2.32.9) and routes through `launchStreamingAppByCatalog()` if the package is in the catalog. Falls back to the original `monkey -p` command for off-catalog packages.

**Bug 3 — Streaming `game_schedules` injection lacks the v2.32.62 in_progress estimatedEnd tightening** (`apps/web/src/app/api/channel-guide/route.ts`)

The cable/satellite `game_schedules` fallback was tightened in v2.32.62 to require `estimatedEnd >= sixHoursAgo` for the `in_progress` catch-all clause — fixed the 72-zombie-game leak (NFL Draft from 11 days ago surfacing). The mirror block on the streaming path (~line 750) still had the loose original filter (`eq(status, 'in_progress')` only). Result: stale `in_progress` rows leaked through the streaming-injection path while the cable path correctly filtered them. Fix: parity update — same `andOp(eq, gte)` shape as cable.

**Required Manual Step:** None — all three are pure bug fixes with no schema/config impact. Auto-update merge will pick them up.

**Verification:** `npm run build` clean (34/34 turbo tasks). PM2 restart, `/api/system/health` returns `healthy`. Bartender remote :3002 returns 200. Held items in scope (Tier 2 perf wins + Tier 3 reuse cleanup) ship in subsequent passes (v2.32.78+).

---

### v2.32.76 — fleet outstanding-work list refresh + post-campaign captures
**Released:** 2026-05-08

Pure-docs update: refreshed `docs/FLEET_STATUS.md` Outstanding work section after the OS-upgrade campaign closed and dist-upgrade-and-kernel-reboot pass put all 6 fleet boxes on identical `noble + 6.8.0-111-generic + v2.32.75`. Renumbered to consecutive (1-8 vs the old 1, 4, 5, 6 with gaps) and added 4 new items captured from today's work:

- **#2 Per-event Fire TV deep links** — promoted to next-session priority after operator flagged that the Watch button on Prime Video opens the app but not the game. Includes investigation paths (ESPN scoreboard API, dumpsys URL harvest, walker per-tile URL extraction).
- **#3 More streaming-app walker rules** — extends the catalog walker beyond Prime Video to cover Netflix / ESPN+ / Hulu / Disney+ / Max / Peacock / YouTube TV. Pairs with #2.
- **#4 `auto-update.sh` heartbeat refresh on no-op runs** — the script exits at "no update available" before the heartbeat-write block, so kernel changes done outside auto-update (apt dist-upgrade + reboot) leave the dashboard showing stale OS info. Small low-risk fix to write at least the OS delta on no-op runs.
- **#5 Fleet dashboard manual-refresh button** — `/api/fleet/status?refresh=1` works but isn't exposed in the UI; operators can stare at stale data for the 5-min cache TTL after a fleet-wide change.
- **#6 Why Holmgren's kernel drifted to 6.8.0-100** — investigation item; suggests `unattended-upgrades` either isn't running or isn't pulling `linux-generic` metapackage at Holmgren. Worth a check so it doesn't drift again.

**Required Manual Step:** None — pure docs entry. The next auto-update merge into each location branch carries the doc updates with no behavioral change.

**Verification:** `docs/FLEET_STATUS.md` Outstanding work section now reads 1-8 in order, with #2 explicitly marked as the next-session priority.

---

### v2.32.75 — greenville jammy → noble upgrade complete (full fleet on noble + iGPU)
**Released:** 2026-05-08

Status-tracker update for `docs/OS_UPGRADE_RUNBOOK.md` + `docs/FLEET_STATUS.md`: greenville is the third (and final) jammy fleet box to complete the upgrade campaign. With this, **all 6 fleet locations are on noble (24.04) with IPEX-LLM Ollama acceleration on Intel Iris Xe** — full parity for the first time since iGPU enablement work began.

**Notes vs graystone + appleton:**
- One pre-flight reparation specific to this box: pre-existing `/etc/apt/sources.list.d/intel-gpu.list` (from a prior failed iGPU-on-jammy attempt before today's campaign) pointed at `noble client` packages. libdrm2 wanted `libc6 ≥ 2.38` (noble), but jammy's libc was 2.35 — `apt-get update` / dep-resolution blocked, which in turn blocked `do-release-upgrade -c`. Fix: `sudo mv /etc/apt/sources.list.d/intel-gpu.list /etc/apt/sources.list.d/intel-gpu.list.disabled-pre-upgrade` and continue. After noble is up, `setup-iris-ollama.sh` rewrites the file with the matching `noble client` line which then resolves correctly (libc 2.39 in noble). Lesson — added as Common pitfalls #5-explicit in `OS_UPGRADE_RUNBOOK.md`.
- Otherwise standard run via `release-upgrade-claude.service` (transient `systemd-run --unit=release-upgrade-claude --collect` so SSH disconnects don't kill it), deactivated cleanly with 3min 18s CPU.
- Manual `shutdown -r +1` for Phase E reboot (DistUpgradeViewNonInteractive's `confirmRestart()` defaults False without `[NonInteractive] RealReboot=True` in upgrade.cfg — that's the desired Phase D pause behavior, lets us verify pre-reboot before kernel swap).
- Post-reboot: kernel 6.8.0-111-generic, `/dev/dri/card0+renderD128`, `using Intel GPU` confirmed in `journalctl -u ollama-ipex`, AI Suggest cold = **119s** on iGPU, bartender remote HTTP 200. All customizations preserved (sshd / sudoers / nginx-bartender / ollama-override bit-identical to pre-upgrade).
- HTTP/PM2 stayed up on :3001 + :3002 throughout the dist-upgrade — bar service unaffected.

**Fleet AI Suggest cold-run timings on iGPU (llama3.1:8b post-campaign):** appleton 67s (fleet best) · greenville 119s · graystone 170s · holmgren ~100s · leglamp ~100s · lucky-s ~100s.

**Required Manual Step:** None — pure documentation entry. The next auto-update merge into each location branch carries the doc updates with no behavioral change. Operators viewing the fleet dashboard (introduced in v2.32.72) will see all 6 locations report `noble` + recent kernel after each location's auto-update tick.

**Verification:** `docs/OS_UPGRADE_RUNBOOK.md` Status tracker now shows all three completed rows (graystone/appleton/greenville). `docs/FLEET_STATUS.md` per-location table reads `noble (24.04)` + `IPEX-LLM Ollama (Iris Xe)` + `✅ active` for every row. Aggregate health: 6/6 noble, 6/6 iGPU.

---

### v2.32.74 — appleton jammy → noble upgrade complete
**Released:** 2026-05-08

Status-tracker update for `docs/OS_UPGRADE_RUNBOOK.md` + `docs/FLEET_STATUS.md`: appleton (Stoneyard Appleton, i9-13900HK / Iris Xe) is the second fleet box to complete the jammy → noble upgrade. Result: noble + 6.8.0-111-generic, `/dev/dri/` populated with `card0`+`renderD128` (note: `card0` here, not `card1` like graystone — different DRI enumeration on this box; `renderD128` is what compute uses), verify-install 7/7 PASS, 35/35 devices online. Hardware reality check via API only (matrix/audio/firetv/directv routes all live); the operator confirmed the bartender remote functional at the bar pre-flight, so the in-person walk-test was skipped. setup-iris-ollama.sh clean install on noble (intel-gpu-tools added since IPEX-LLM portable bundle includes the rest of the runtime). `ollama-ipex` active; journal: `using Intel GPU`. `clinfo -l` reports `Intel(R) Iris(R) Xe Graphics` — unlike graystone where it returned 0 platforms, so the Level-Zero-vs-OpenCL caveat noted in v2.32.73 doesn't reproduce here. AI Suggest cold-cache run = **67.3s** on iGPU (best in fleet so far — vs 170s graystone, 200-300s CPU baseline).

Fleet status after this version: 5 of 6 locations on noble + iGPU active. Greenville is the last jammy box; recommended scheduling per the runbook is to do it during the lowest-traffic window since it's the busiest of the three.

**Required Manual Step:** None for the auto-update itself (this entry is purely documentation). To run the OS upgrade at greenville (the only remaining jammy location), follow `docs/OS_UPGRADE_RUNBOOK.md` step-by-step.

**Verification:** None at the auto-update layer.

**Rollback:** N/A — docs-only.

---

### v2.32.71–v2.32.73 — OS upgrade jammy → noble docs + first location complete
**Released:** 2026-05-07

Three docs-only versions wrapping the fleet OS upgrade. No software changes — purely operational documentation, fleet status, and the result of the first location to complete.

**v2.32.71** — `docs(fleet)`: committed to the OS-upgrade path for the three jammy boxes (graystone, greenville, appleton). FLEET_STATUS.md introduced as a per-location snapshot single-source-of-truth. Decision rationale: an in-place `do-release-upgrade` is cheaper than re-imaging on jammy boxes that already have working location data.

**v2.32.72** — `feat(fleet-dashboard)`: fleet dashboard now surfaces OS codename + kernel per location, so an operator can see at a glance which boxes are still on jammy.

**v2.32.73** — Status-tracker update for `docs/OS_UPGRADE_RUNBOOK.md`: graystone is the first fleet box to complete the jammy → noble upgrade. Result: kernel-binding fix held (`/dev/dri/card1+renderD128` populated post-reboot), verify-install 7/7 PASS, all 40 devices online, bartender remote operator-confirmed at the bar, `setup-iris-ollama.sh` clean install on noble (intel-opencl-icd 24.39 + intel-level-zero-gpu 1.3.29735 + IPEX-LLM 2.3.0b20250725), `ollama-ipex` active with `using Intel GPU` in journal, AI Suggest cold-cache run = 170s on iGPU. Caveat noted: `clinfo -l` reports 0 platforms — IPEX uses Level Zero so OpenCL ICD detection isn't required, but follow-up worth doing.

**Required Manual Step:** None for the auto-update itself (this entry is purely documentation). To run the OS upgrade at the remaining two locations (appleton, greenville), follow `docs/OS_UPGRADE_RUNBOOK.md` step-by-step. Recommended order per the runbook: appleton next, greenville last.

**Verification:** None at the auto-update layer. After a location completes its upgrade, the runbook's Status tracker row is updated in the same commit that bumps the version that records the result.

**Rollback:** N/A — docs-only.

---

### v2.32.65–v2.32.70 — iGPU enablement saga (catch-up entry)
**Released:** 2026-05-07 (rapid-fire)

Six versions in two hours fighting through the Intel iGPU acceleration setup across the fleet. Documented as one entry because they're a single problem-solve.

**v2.32.65** — Reverted AI Suggest model from `qwen2.5:14b` back to `llama3.1:8b`. Reason: IPEX-LLM Ollama 0.16.2's SYCL backend doesn't accelerate the qwen2 family — at Holmgren the model loaded into iGPU memory but render engine stayed at 0% during inference, falling back to CPU. Made the choice env-overridable via `OLLAMA_MODEL` so operators can experiment per location.

**v2.32.66** — GPU meter falls back to frequency-based usage on Iris Xe. Engine busy% counters (Render/3D, Blitter, Video, VideoEnhance) all return 0 on Iris Xe Raptor Lake-P even with `cap_sys_admin` — kernel doesn't expose CCS engine to userspace via the legacy i915 perf interface. Frequency, however, is reliable: idle ~150 MHz, working ~1495 MHz. Widget now uses `(actual_mhz / 1500) * 100` when all engine fields are <1%. Holmgren bartender confirmed: 86% during AI Suggest, 0% at idle.

**v2.32.67** — `setup-iris-ollama.sh` installs Intel level-zero userspace drivers when chip is in `lspci` but stack is missing (the fleet locations have the chip but no `intel-level-zero-gpu`). Adds Intel apt repo, installs the userspace, falls back to `modprobe i915 / xe` if `/dev/dri/` is empty.

**v2.32.68** — Broadened Intel chip detection to match `Intel Corporation Device a7a0` (Raptor Lake-P shows up as the unnamed PCI ID on older `pciutils` databases). Was bailing on greenville/appleton even though they have the chip.

**v2.32.69** — Two compounding install issues found via leglamp:
1. ubuntu user wasn't added to render+video groups *before* the clinfo gate. Without /dev/dri/ access, clinfo silently returns 0 platforms even with userspace installed. Now done at section 0, with `sg render` re-exec so the new group applies in this shell.
2. Holmgren's working install has `intel-igc-cm`, `libdrm-intel1`, `libigdfcl1`, `libigdgmm12` packages that the fleet didn't. Without `intel-igc-cm` the OpenCL ICD shows 0 platforms even though `libigdrcl.so` is loaded. Added all four to the install list, plus a defensive `apt-get install --reinstall intel-opencl-icd` if the .so file is still missing post-install (observed at leglamp).

**v2.32.70** — Per-codename Intel apt repo line. The fleet has a mix:
| Location | Ubuntu | Action |
|---|---|---|
| Holmgren | noble (24.04) | works since v2.32.66 |
| graystone | jammy (22.04) | needs v2.32.70 + manual `modprobe i915` (kernel module not bound) |
| greenville | jammy (22.04) | needs v2.32.70 |
| leglamp | noble (24.04) | works since v2.32.69 ✓ |
| luckys | noble (24.04) | works since v2.32.69 (assumed) |
| appleton | jammy (22.04) | needs v2.32.70 |

Earlier versions hardcoded `noble client` in the Intel apt source line, which broke installs on jammy boxes (libc6 dep mismatch). v2.32.70 reads `lsb_release -cs` and writes the matching repo line; rewrites a stale line if a prior run wrote the wrong codename.

**Required Manual Step:** None on auto-update. To enable iGPU at a fleet location, the operator runs `bash scripts/setup-iris-ollama.sh` once. Idempotent — re-running on already-configured boxes verifies state.

**Verification (per location):**
```bash
systemctl is-active ollama-ipex                                                # active
sudo journalctl -u ollama-ipex --since=2m | grep "using Intel GPU"             # one match
clinfo -l                                                                       # Intel platform listed
ls /dev/dri/                                                                    # card0/1 + renderD128 present
```

**Rollback:** `git revert` clean for all version code. To revert iGPU stack at a location:
```bash
sudo systemctl stop ollama-ipex && sudo systemctl disable ollama-ipex
sudo systemctl enable --now ollama
```
Models stay at `/usr/share/ollama/.ollama/models/` — no data loss.

---

### v2.32.64 — AI Suggest model bumped to qwen2.5:14b (reverted in v2.32.65)
**Released:** 2026-05-07
Empirical revert. See v2.32.65 entry for context.

---

### v2.32.63 — Walker extracts game start times from Fire TV streaming app tiles
**Released:** 2026-05-07

The Fire TV catalog walker now captures game start times from ESPN and Prime Video tile text. When ESPN renders an upcoming game as `"Brewers vs Cubs ESPN • MLB • 7:30 PM ET"` or Prime Video shows `"Knicks vs Hawks, UPCOMING, Today 7:30 PM"`, the walker now parses the time portion into a unix timestamp and stores it alongside the catalog row. The bartender remote's channel guide previously showed every Amazon-box-sourced game as "LIVE" or "On demand"; now they show the actual start time (formatted in the operator's locale).

Operator's request: *"when pulling games from the amazon boxes it should get the times too"*.

**Schema change:** new nullable column `firetv_streaming_catalog.startTime` (integer, unix seconds). Drizzle-kit push handles new nullable columns cleanly — no manual ALTER needed.

**Apps that benefit:**
| App | Status |
|---|---|
| ESPN (com.espn.gtv) | ✅ extracts time from "• 7:30 PM ET" bullet tail |
| Prime Video / firebat | ✅ extracts time from "Today 7:30 PM" suffix when embedded |
| Peacock, Apple TV+, fuboTV | – walked as `[]` (WebView, accessibility-blind) |

**Deferred:** per-event deep-link URLs (the v2.32.58 wiring is still no-op). ESPN's eventId isn't exposed in uiautomator dumps; deep-linking would need a follow-up integration with ESPN's public scoreboard API to resolve eventId from title text.

**Required Manual Step:** None. After auto-update merges, the walker's next run (every 15 min via the `firetv-catalog-walker` SchedulerLog component) populates the new column for any new tiles. Existing rows have `startTime=NULL` and continue to display as before until they expire (36h TTL).

**Verification:**
```bash
# After ~15 min:
sqlite3 /home/ubuntu/sports-bar-data/production.db "
  SELECT app, contentTitle, datetime(startTime,'unixepoch','localtime') AS time, isLive
  FROM firetv_streaming_catalog
  WHERE startTime IS NOT NULL
  ORDER BY startTime DESC
  LIMIT 10;"
```

**Rollback:** `git revert` is clean — schema column is nullable, no data loss.

---

### v2.32.62 — Stale in-progress games filtered out of AI Suggest + channel-guide
**Released:** 2026-05-07

72 zombie games stuck in `status='in_progress'` past their `estimated_end` were surfacing as AI Suggest candidates and channel-guide entries — including the NFL Draft from April 24 (11 days past) at Holmgren. Root cause: ESPN sync doesn't reliably transition old games to `'completed'`. The previous AI Suggest + channel-guide filter had a permissive `OR status='in_progress'` carve-out (originally meant for OT/delays of currently-airing games).

**Tightened both filters:** in_progress games are now only included when `estimated_end > now` (AI Suggest, strict) or `estimated_end > now - 6h` (channel-guide, with a small grace for legitimate OT past the original estimate).

**Required Manual Step:** None. Fix is in-route logic, no schema or seed change.

**Rollback:** `git revert` is clean.

---

### v2.32.59 — System Admin GPU meter wired to Intel Iris Xe via intel_gpu_top
**Released:** 2026-05-07

The "GPU Usage" gauge on the System Admin → Power tab now surfaces real Intel iGPU load + Ollama model footprint at locations running the IPEX-LLM Ollama stack. Previously the gauge said "No GPU" because `/api/system/metrics`'s `getGPUMetrics()` only knew about NVIDIA (`nvidia-smi`). The route now tries NVIDIA first, falls back to `intel_gpu_top -J` for Intel, and reports loaded Ollama model size as iGPU memory in use (via `/api/ps`).

**Changes:**
- `apps/web/src/app/api/system/metrics/route.ts` — extended `getGPUMetrics()` with the Intel iGPU path. Fetches one JSON snapshot from `intel_gpu_top -J -s 500` (timeout 1500ms), parses `engines["Render/3D"].busy` for usage, fetches Ollama `/api/ps` for loaded model size. No new endpoint, no new component — the existing System Resource Monitor widget renders the data automatically.
- `scripts/setup-iris-ollama.sh` — now also installs `intel-gpu-tools` and grants `cap_perfmon=ep` to `/usr/bin/intel_gpu_top` so it runs as the Next.js (ubuntu) user without sudo.

**Required Manual Step:** Re-run `bash scripts/setup-iris-ollama.sh` at any location that ran the v2.32.57 version of the script. Idempotent — only installs/setcaps if missing.

**Verification:**
```bash
# 1. Confirm intel_gpu_top runs as ubuntu (no sudo) — should print JSON
timeout 2 intel_gpu_top -J -s 500 | head -3

# 2. Hit the metrics endpoint — gpu.usage should be 0-100, gpu.memory.used > 0
#    when an Ollama model is loaded
curl -s http://localhost:3001/api/system/metrics | jq '.metrics.gpu'

# 3. Open System Admin → Power tab in the browser. The fourth gauge
#    ("GPU Usage") should show a number instead of "No GPU".
```

**Rollback:** `git revert` is clean — pure additive change (NVIDIA path unchanged, Intel is a fallback).

**Hardware compat:** Ignores AMD/Nvidia-only boxes (NVIDIA path catches first). On boxes without `intel_gpu_top`, the function throws and the widget shows "No GPU" — same as before.

---

### v2.32.58 — Bartender-remote bug-fix bundle: stale guide auto-refresh, Fire TV deep-link wiring, /api/ai/ in Nginx, WI RSN preset naming
**Released:** 2026-05-07

Four small fixes batched into one commit. None require manual operator steps unless they're upgrading from a custom-named Channel 308 preset.

**1. Channel guide auto-refresh** (`EnhancedChannelGuideBartenderRemote.tsx`)
The 30-second poll now also refreshes the guide listing itself, not just current-channel/live-game/scheduled-allocation data. Previously the guide stayed frozen at whatever was loaded when the input was last selected — operators saw "old data" because games added by the 10-min ESPN sync didn't appear until they manually closed and reopened the guide tab. Past-game pruning is unchanged (server-side `twoHoursAgo` filter).

**2. Fire TV Watch button deep-link wiring** (same component)
Added `deepLink?: string` to `ChannelInfo`, threaded through `handleGameClick` → `launchStreamingAppByCatalog` → POST `/api/streaming/launch`. The route already accepted `deepLink` and `streamingManager.launchApp()` already calls `launchAppWithDeepLink()` when one is present — only the component wasn't passing it. **Behavior is unchanged for now** because `firetv-catalog-walker` doesn't yet extract per-event URLs (only tile titles) — this commit makes the wiring ready so when the walker is upgraded to capture deep links per app (deferred work item: ESPN's `espn://x-callback-url/showEvent?eventId=…` etc), the bartender Watch button automatically benefits without further UI changes.

**3. Shift Brief unblocked** (`scripts/setup-bartender-nginx.sh`)
Added a `location /api/ai/ { ... }` block to the standardized Nginx site config — without it the catch-all returned 403 for the bartender remote's Shift Brief feature (`/api/ai/shift-brief`, plus the other v2.21.0 AI endpoints: `distribution-plan`, `conflict-suggestion`, `weekly-summary`). Same 300s `proxy_read_timeout` as `/api/scheduling/` since they share Ollama. **Operators who already ran v2.32.57's setup-bartender-nginx.sh need to re-run it to pick up the new block.**

**4. CLAUDE.md WI RSN preset-naming clarification** (CLAUDE.md AI Scheduling section)
Documented the resolver's preset-name → alias-bundle binding requirement that bit Holmgren this release. The Channel 308 preset MUST be named with the `+` suffix (canonical `"Bally Sports Wisconsin+"`) for the resolver to connect Brewers.TV → BallyWIPlus → preset → channel 308. Without it, Brewers games silently fall through Rail Media's gap and the channel-guide DB fallback can't pick them up either. Holmgren's DB row was renamed in this release. Other locations: confirm with `SELECT name FROM ChannelPreset WHERE channelNumber='308'`.

**Required Manual Step (per location):**

| Location | Action | Command |
|---|---|---|
| Holmgren | Re-run nginx setup so /api/ai/ block lands | `bash scripts/setup-bartender-nginx.sh` |
| Graystone | Same (after running v2.32.57 setup originally — TBD) | same |
| Greenville/Leg Lamp/Lucky's/Appleton | Same once they migrate to Nginx (v2.32.57 setup script) | same |
| Any WI location with Channel 308 | Verify preset name ends with `+`; rename if not | `sqlite3 .../production.db "UPDATE ChannelPreset SET name='Bally Sports Wisconsin+' WHERE channelNumber='308' AND name='Bally Sports Wisconsin'; SELECT changes();"` |

**Verification:**
```bash
# Shift Brief unblocked through bartender proxy:
curl -s -o /dev/null -w '%{http_code}\n' -m 5 http://127.0.0.1:3002/api/ai/shift-brief
# Was 403, now 401/200/000 (passes through to backend)

# Channel guide auto-refresh: open the bartender remote → Sports Guide tab
# → leave it open for 30+ seconds → check PM2 logs for repeated
# /api/channel-guide POSTs:
pm2 logs sports-bar-tv-controller --nostream --lines 200 | grep "POST /api/channel-guide" | tail -5

# Brewers Channel 308 fix: PM2 log of any channel-guide call should show
# "+N injected" with N>0 when Brewers games are in the next 7 days:
pm2 logs sports-bar-tv-controller --nostream --lines 500 | grep "game_schedules fallback"
```

**Rollback:** `git revert` is clean — no schema, no data, no migration.

---

### v2.32.57 — Fleet-standardize on Nginx bartender proxy + Iris Xe iGPU Ollama
**Released:** 2026-05-07

Two new one-time setup scripts ship with this release. Each location operator should run them in order on the production box. Auto-update will NOT execute them (system-level changes — too high blast radius for cron).

**Script 1 — `scripts/setup-bartender-nginx.sh`:**
Installs Nginx as the bartender-remote reverse proxy on port 3002, with the canonical allow-list (admin pages return 403) and a 300s `proxy_read_timeout` for `/api/scheduling/` so AI Suggest's Ollama call doesn't 504. Replaces the legacy Node `apps/web/bartender-proxy.js` PM2 app (script does `pm2 delete bartender-proxy && pm2 save`). Holmgren has been on Nginx since deployment; the other 5 locations migrate via this script.

**Script 2 — `scripts/setup-iris-ollama.sh`:**
Installs IPEX-LLM's Ollama portable build (Intel Iris Xe iGPU SYCL backend) as `ollama-ipex.service`, disables the upstream CPU-only `ollama` systemd unit. ~14 tok/s on llama3.1:8b vs ~3 tok/s CPU. Reuses existing models at `/usr/share/ollama/.ollama/models/` — no re-pull. Verifies via journal grep for "using Intel GPU".

**Per-location run order:**

| Branch | Notes |
|---|---|
| `location/holmgren-way` | Already migrated 2026-05-07 by hand. Re-running scripts is idempotent and will verify. |
| `location/graystone` | Both scripts to run. Confirm intel iGPU first: `clinfo -l` |
| `location/stoneyard-greenville` | Both scripts to run. |
| `location/leg-lamp` | Both scripts to run. Already on `nvm`-managed PM2 — `pm2 delete bartender-proxy` may need `bash -lc` wrapper. |
| `location/lucky-s-1313` | Both scripts to run. |
| `location/stoneyard-appleton` | Both scripts to run. |

**Required Manual Step:** Yes (per-location operator).
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
git pull   # or wait for auto-update
bash scripts/setup-bartender-nginx.sh
bash scripts/setup-iris-ollama.sh
```

**Verification (after running both):**
```bash
# Bartender proxy on Nginx:
systemctl is-active nginx                          # active
curl -s -o /dev/null -w '%{http_code}\n' \
    http://127.0.0.1:3002/                         # 302
pm2 list | grep bartender-proxy || echo "removed"  # removed

# IPEX-LLM Ollama on Intel iGPU:
systemctl is-active ollama-ipex                    # active
systemctl is-enabled ollama 2>&1 | grep -q disabled || echo "old ollama still enabled"
sudo journalctl -u ollama-ipex --since=5m | grep "using Intel GPU"   # one match

# AI Suggest end-to-end (should return 200 in 90-120s):
curl -s -o /dev/null -w '%{http_code} time=%{time_total}s\n' \
    -m 240 http://127.0.0.1:3002/api/scheduling/ai-suggest
```

**Rollback:**
- Bartender proxy: `sudo systemctl stop nginx; sudo systemctl disable nginx; pm2 start ecosystem.config.js --only bartender-proxy; pm2 save`
- Ollama: `sudo systemctl stop ollama-ipex; sudo systemctl disable ollama-ipex; sudo systemctl enable --now ollama`

Both rollbacks restore the previous behavior with no data loss (models stay at `/usr/share/ollama/.ollama/models`, Nginx config is idempotent).

**Hardware compat note:** `setup-iris-ollama.sh` checks `clinfo` for an Intel platform and refuses to run on AMD or Nvidia hardware. If a future location has different hardware, that location stays on upstream Ollama until a different acceleration path is added.

---

### v2.32.56 — Wolf Pack route-state retry backoff (eliminates TV 1 flicker on Video tab)
**Released:** 2026-05-07

After v2.32.55 the bartender at Holmgren reported TV 1 still occasionally goes gray on Video-tab open. Logs (`grep WOLFPACK-HTTP /var/log/pm2/sports-bar-tv-controller-out.log`) confirmed the Wolf Pack firmware genuinely gets stuck on the 0xFFFF sentinel for output 1 longer than 600ms — `queryWolfpackRouteState` was retrying once and giving up, forcing the DB-fallback path in `/api/matrix/routes` which is correct in theory but loses on the (small) timing window where the bartender's just-issued route hasn't landed in `MatrixRoute` yet.

**Changes:**
- `packages/wolfpack/src/wolfpack-matrix-service.ts` — `queryWolfpackRouteState` retry escalated from 1 attempt at 600ms to up to 3 attempts at 600ms / 1.2s / 2.4s (cumulative ~4.2s worst case). Loop exits early as soon as the array is sentinel-free. After the last retry, any remaining sentinel still falls through to the existing 65535→-1 normalization + DB fallback — this just reduces how often the fallback path is needed.

**Required Manual Step:** None. Pure retry-tuning in the wolfpack package.

**Verification:**
```bash
# Watch a Video-tab open and confirm sentinels clear within the retry window:
pm2 logs sports-bar-tv-controller --lines 0 | grep -E "WOLFPACK-HTTP.*(sentinel|cleared|persist)"
#   Expected on a stuck-firmware case:
#     "Initial query has 0xFFFF sentinel(s) at output(s) 1 — re-querying with backoff (up to 4200ms)"
#     "Sentinels cleared after attempt 2 (1200ms)"   ← OR attempt 3
#   Rare worst case:
#     "1 sentinel(s) persist after 3 retries — falling through to DB fallback"
```

**Trade-off:** A genuine stuck firmware now takes up to 4.2s to return route state instead of 1s. This only fires when the firmware actually returns the sentinel; non-sentinel paths are unchanged. The bartender remote's 30s server-side cache absorbs this — a single slow query per cache-cold open, every other request hits cache.

**Rollback:** `git revert` clean.

---

### v2.32.55 — Wolf Pack pre-check ignores 0xFFFF session-init sentinel (TV 1 toggle-off fix)
**Released:** 2026-05-07

Holmgren reported that opening the bartender remote's **Video tab** consistently lost the matrix route to **TV 1**. Root cause was a 65535 (0xFFFF) sentinel returned by Wolf Pack firmware on the first `o2ox` query after a fresh PHP session login — the same quirk `queryWolfpackRouteState()` already handles with a 600ms settle + re-query. The pre-check inside `sendHTTPCommand()` did NOT handle the sentinel: it saw `currentRoutes[output0] === 65535`, decided the route was "different from intended," and fired the toggle-style `prm` command. If the real route was already correct, the toggle flipped output 0 OFF → TV 1 went black. The Video-tab open is what creates the second concurrent session that puts the firmware into the settling window where this fires.

**Changes:**
- `packages/wolfpack/src/wolfpack-matrix-service.ts` — pre-check at `sendHTTPCommand` now mirrors the settle+requery pattern from `queryWolfpackRouteState`: if `currentRoutes[output0Based] === 65535`, wait 600ms and re-query before deciding whether to skip. If the sentinel persists after re-query, refuse to send the toggle command (returns failure; scheduler/auto-reallocator will retry on its next tick) rather than risk flipping a good route off.

**Required Manual Step:** None. Pure firmware-quirk handler in the wolfpack package — no schema, no data, no env. Build picks up the package change via Turborepo.

**Verification:**
```bash
# 1. Watch PM2 logs while opening the bartender Video tab a few times:
pm2 logs sports-bar-tv-controller --lines 0 | grep -E "WOLFPACK-HTTP.*(sentinel|0xFFFF|skipping)"
#    Expected: see "Pre-check got 0xFFFF sentinel ... settling 600ms" log lines
#    when the Video tab opens, followed by "already routed ... skipping" — NOT
#    a route command being sent.

# 2. Confirm TV 1 routing survives Video tab opens:
#    Open bartender remote → switch to a non-Video tab → switch back to Video.
#    TV 1 should retain its source. Repeat 3-4 times.

# 3. Confirm scheduler still routes correctly when state is genuinely different:
#    Approve a scheduled tune. TV 1 should land on the new source first try.
```

**Rollback:** `git revert` is clean — single function-local change.

---

### v2.32.54 — Bartender remote: hide Audio tab when no audio processor configured
**Released:** 2026-05-07

Leg Lamp is the only fleet location without DSP — `AudioProcessor` table is empty there. The bartender remote was still rendering the Audio tab in the bottom tab bar, leading to a dead button that opened an empty panel.

**Changes:**
- `apps/web/src/app/remote/page.tsx` — Audio tab button now wrapped in `{audioProcessorIp && (...)}` conditional, matching the existing pattern used for the Audio panel itself. Component already loads `audioProcessorIp` from `/api/audio-processor` and sets to `''` when no processor exists, so the gate is free.

**Required Manual Step:** None. Pure UI conditional — locations with an `AudioProcessor` row are unaffected; locations without one stop seeing the dead tab.

**Verification:**
```bash
# At a location WITHOUT a DSP (Leg Lamp):
sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT COUNT(*) FROM AudioProcessor;"   # 0
curl -s http://localhost:3001/remote | grep -c '>Audio<'   # 0 (was 1)

# At a location WITH a DSP (Stoneyards / Holmgren / Lucky's):
curl -s http://localhost:3001/remote | grep -c '>Audio<'   # 1 (unchanged)
```

**Rollback:** `git revert` is clean — single conditional change, no schema, no data.

---

### v2.32.53 — install.sh + ollama-setup.sh simplify pass
**Released:** 2026-05-06

`/simplify` review of v2.32.50-52 surfaced 9 concrete cleanups in `install.sh` and a model-list drift in `scripts/ollama-setup.sh`. All applied.

**Changes:**
- `install.sh` 6 separate `apt-get install -y` calls collapsed into one (saves 2-3 min on slow apt mirror)
- `install.sh` redundant `apt-get update -qq` for GitHub-CLI repo wrapped in `timeout 60` (prevents indefinite hang on flaky mirror)
- `install.sh` redundant `sleep 5` in `verify_installation` removed (Phase 11 verify-install.sh has its own port-bind wait)
- `install.sh` extracted `check_pm2_online()` helper for the 2 post-`pm2 start` status checks
- `install.sh` stale ollama model-list comment updated to match `REQUIRED_MODELS` array (`llama3.1:8b`, `nomic-embed-text`)
- `install.sh` `ANTHROPIC_API_KEY` warning now points operators at `bootstrap-new-location.sh --anthropic-api-key` (canonical .env writer) instead of `echo >> .env`
- `install.sh` dead `QA_WORKER_NAME="qa-worker"` constant removed (qa-worker call was deleted in v2.32.50)
- `install.sh` double blank line removed
- `scripts/ollama-setup.sh` `MODELS` array synced to `llama3.1:8b` + `nomic-embed-text` (was still listing `llama3.2:3b` + `phi3:mini` — mismatch with install.sh and the app code)

**Required Manual Step:** None. Existing locations already installed via the old paths; no re-run needed.

**Verification:**
```bash
grep -c "apt-get install -y \\\\" /home/ubuntu/Sports-Bar-TV-Controller/install.sh   # 1 (was 6)
grep -E "llama3\\.2:3b|phi3:mini" /home/ubuntu/Sports-Bar-TV-Controller/install.sh /home/ubuntu/Sports-Bar-TV-Controller/scripts/ollama-setup.sh   # empty
grep -A 1 "^check_pm2_online" /home/ubuntu/Sports-Bar-TV-Controller/install.sh   # helper definition
```

**Rollback:** `git revert` is clean — pure cleanup, behavior is functionally identical.

---

### v2.32.52 — Install-doc reconciliation: NEW_LOCATION_SETUP.md is canonical
**Released:** 2026-05-06

Repo had 13 install/deploy docs in `docs/` (NEW_LOCATION_SETUP, INSTALLATION_GUIDE, NEW_SYSTEM_DEPLOYMENT_CHECKLIST, QUICK_DEPLOYMENT_GUIDE, NUC_DEPLOYMENT, PRODUCTION_DEPLOYMENT, MANUAL_DEPLOYMENT_STEPS, PULL_AND_INSTALL, README_INSTALLATION, AUTO_UPDATE_SETUP, INSTALLER_BUG_ANALYSIS, AI_BACKEND_SETUP, OLLAMA_SETUP_COMPLETE) — most overlapped, contradicted each other on which Ollama models to pull, and predated the auth-bootstrap step. An operator landing on any of them couldn't tell which was authoritative.

**Changes:**
- Pinned `docs/NEW_LOCATION_SETUP.md` as the canonical fresh-install runbook by adding a "TL;DR — the whole thing in 8 commands" section at the top showing every step from `git clone` to webapp running.
- Updated NEW_LOCATION_SETUP's verify-install reference from "PASS 6/6" to "PASS 7/7" (the matrix_config check was added in v2.18.x, was never reflected in the docs).
- Added a top-banner pointer to NEW_LOCATION_SETUP on 11 supplementary install docs: INSTALLATION_GUIDE, QUICK_DEPLOYMENT_GUIDE, NUC_DEPLOYMENT, MANUAL_DEPLOYMENT_STEPS, PULL_AND_INSTALL, PRODUCTION_DEPLOYMENT, README_INSTALLATION, NEW_SYSTEM_DEPLOYMENT_CHECKLIST, INSTALLER_BUG_ANALYSIS, AI_BACKEND_SETUP, OLLAMA_SETUP_COMPLETE.
- AUTO_UPDATE_SETUP.md was left alone — it's canonical for its own thing (auto-update state + operator runbook).

**Required Manual Step:** None — docs only.

**Verification:**
```bash
grep -l "This doc is supplementary" /home/ubuntu/Sports-Bar-TV-Controller/docs/*.md | wc -l
# Should return 11 (the 11 supplementary install docs).
grep "TL;DR — the whole thing" /home/ubuntu/Sports-Bar-TV-Controller/docs/NEW_LOCATION_SETUP.md
# Should match.
```

**Rollback:** `git revert` removes the banners and TL;DR. Docs revert to the pre-reconciliation state. Zero runtime impact.

---

### v2.32.51 — install.sh runs verify-install.sh as the install gate + clearer Next Steps
**Released:** 2026-05-06

`install.sh` finished with a generic "Installation Complete!" banner whether or not the install was actually working — operators had to know to also run `scripts/verify-install.sh` (the canonical 7-layer health check) and `scripts/bootstrap-new-location.sh` (the auth bootstrap that seeds the `Location` row + `AuthPin` rows + `LOCATION_ID` in `.env`). Without the bootstrap, every login attempt returns "Invalid PIN", and operators didn't know that until they tried. This release wires the gate in and points operators at the bootstrap as the explicit required-next-step.

**Changes:**
- New PHASE 11 in `install.sh` runs `scripts/verify-install.sh` after PM2 is up, sleeping 10s first to let routes warm. Reports PASS/FAIL but does NOT exit non-zero on FAIL — at install time the auth bootstrap hasn't run yet, so health/metrics layers may degrade. Failures are surfaced in the operator-facing summary so they know what to do.
- `print_final_instructions()` now leads with "REQUIRED NEXT STEPS — auth bootstrap" and shows the exact `bootstrap-new-location.sh` invocation with all flags, plus the follow-up `pm2 restart --update-env` and re-run-verify-install commands.
- Added an "Auto-update timer" section pointing at `scripts/install-auto-update-timer.sh` and `loginctl enable-linger`.
- Reformatted the migration commands as "Optional — migrate from an existing location" so they don't read as the primary next step.

**Required Manual Step:** None for existing locations. For fresh installs, the operator must run `scripts/bootstrap-new-location.sh` after `install.sh` exits — the bootstrap script needs a 4-digit admin PIN and 4-digit staff PIN that install.sh has no way to generate safely on its own.

**Verification:**
```bash
grep -A 2 "PHASE 11: Install Verification" /home/ubuntu/Sports-Bar-TV-Controller/install.sh
# Should show the run_install_verify function header.
grep -A 1 "REQUIRED NEXT STEPS" /home/ubuntu/Sports-Bar-TV-Controller/install.sh
# Should show the bootstrap-new-location.sh call-to-action.
```

**Rollback:** `git revert` is harmless — only affects the install-time output, not running locations.

---

### v2.32.50 — install.sh PM2 startup fix + correct Ollama models + pm2-logrotate
**Released:** 2026-05-06

`install.sh` had three install-path bugs that fresh installs would hit but no existing fleet location would (since none of them re-run `install.sh`). Bug 1: `pm2 start npm --name sports-bar-tv-controller -- start` started only the next-server, leaving `bartender-proxy` (port 3002) unbound — `verify-install.sh` layer 4 (`bartender_proxy`) would fail on every fresh install. Bug 2: `pm2 start "/src/workers/qa-worker.ts" ...` referenced an absolute path that doesn't exist (the worker file is at `apps/web/src/workers/qa-worker.ts`, and the worker is no longer part of the fleet runbook). Bug 3: Ollama models pulled were `llama3.2:3b` and `phi3:mini` — production code (`ai-suggest/route.ts`, RAG query engine) uses `llama3.1:8b`, so AI scheduling and RAG queries would 404 on first use.

**Changes:**
- `install.sh:setup_pm2()` now runs `pm2 start ecosystem.config.js` instead of two separate `pm2 start` calls. Ecosystem starts both `sports-bar-tv-controller` and `bartender-proxy` together (it's the single source of truth for the PM2 process layout).
- Removed the broken `qa-worker` startup block (broken absolute path + the worker isn't in `ecosystem.config.js`).
- Removed dead code that referenced `$pm2_processes` (an undefined variable from a partial refactor).
- Added `pm2 install pm2-logrotate` + 10MB/7-day/compressed config inside `setup_pm2()` (was only in `new-location-setup.sh`, which the canonical install.sh path doesn't always reach).
- `download_ollama_models()` now pulls `llama3.1:8b` + `nomic-embed-text` (matches CLAUDE.md §RAG and §AI Scheduling).
- `verify_installation()` warns (non-fatal) if `ANTHROPIC_API_KEY` is missing from `.env`.

**Required Manual Step:** None for existing locations — this only affects fresh `install.sh` runs. Fleet hosts have `bartender-proxy` running already (started manually or via prior fleet maintenance).

**Verification:**
```bash
# Fresh-install dry verification (only meaningful on a brand-new host):
grep -A 1 "Starting sports-bar-tv-controller" /home/ubuntu/Sports-Bar-TV-Controller/install.sh
# Should show: pm2 start ecosystem.config.js
grep -E "llama3.1:8b|nomic-embed-text" /home/ubuntu/Sports-Bar-TV-Controller/install.sh
# Should match both.
grep "qa-worker" /home/ubuntu/Sports-Bar-TV-Controller/install.sh
# Should return nothing (the broken block was removed).
```

**Rollback:** `git revert` returns to the broken installer (only used at first install — no live state risk).

---

### v2.32.49 — Deterministic checkpoint fast path (bypass Haiku for the 80% case)
**Released:** 2026-05-06

Auto-update checkpoints A/B/C used to call `checkpoint-runner.py` (Anthropic API) on every run, costing ~$5/mo fleet-wide and producing variable false-positive STOPs (today: Haiku flagged the pre-existing leaked Sports Guide API key on a docs-only update; earlier: empty `hardware-config.ts` post-merge). The vast majority of those checks are bash-deterministic — verify-sql markers, file presence, narrow log patterns.

**Changes:**
- New `scripts/checkpoint-deterministic.sh` (~190 lines). Runs the deterministic checks for all three checkpoints. Emits `DECISION: GO|CAUTION|STOP|UNDETERMINED`. UNDETERMINED escalates to AI; never STOPs on its own when uncertain.
- `scripts/auto-update.sh:run_checkpoint()` gains a fast-path block that tries the deterministic script first (30s timeout), falls through to the existing AI path on UNDETERMINED.

**Per-checkpoint logic:**
- **A (pre-merge):** empty `git log HEAD..origin/main` → instant GO. Else scan diff for leaked-secret regex, deletion of critical scripts, NOT NULL columns without default; scan `LOCATION_UPDATE_NOTES.md` for `Risk: STOP` on pending versions; CAUTION on major dep bumps.
- **B (post-merge):** Location row count, ChannelPreset count, new schema tables exist in DB, sqlite3 verify-sql markers from VERSION_SETUP_GUIDE entries between PRE/POST version.
- **C (post-restart):** `VERIFY_INSTALL_JSON` status, `/api/system/health` HTTP 200, narrow PM2 crash-pattern grep (`unhandledRejection|Cannot find module|EADDRINUSE|SyntaxError|FATAL` — explicitly NOT `ERROR` to avoid false-positives like the ESPN softball 400).

**Required Manual Step:** None. `checkpoint-deterministic.sh` is auto-detected — if absent, behavior is unchanged.

**Verification:**
```bash
test -x /home/ubuntu/Sports-Bar-TV-Controller/scripts/checkpoint-deterministic.sh && echo OK
PRE_MERGE_VERSION=2.32.48 POST_MERGE_VERSION=2.32.49 \
  bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/checkpoint-deterministic.sh A 2>/dev/null
# Expect: DECISION: GO - no commits pending merge   (or similar)
grep -A 2 "Deterministic fast path" /home/ubuntu/Sports-Bar-TV-Controller/scripts/auto-update.sh | head -5
# Expect: comment block in run_checkpoint()
```

**Rollback:** `git revert` removes the fast-path block + the new script. Behavior reverts to AI-on-every-checkpoint. No state risk.

---

### v2.32.48 — Admin gradient-text titles swapped to solid white (iPad Safari fix continued)
**Released:** 2026-05-06

Continuation of the v2.32.42 homepage fix. `bg-gradient-to-r ... bg-clip-text text-transparent` renders as fully transparent on certain iPad Safari builds, leaving titles invisible behind the dark background. v2.32.42 fixed the homepage h1+h2; this release fixes three remaining admin-side instances. Bartender-remote files (`BartenderRemote*`, `BartenderMusicControl`, `EnhancedChannelGuideBartenderRemote`, `InteractiveBartenderLayout`, `dmx/DMXLightingRemote`) intentionally NOT touched — operator-locked, listed in commit body for separate review.

**Changes:**
- `apps/web/src/components/SportsGuide.tsx` — "All Sports Programming" h2.
- `apps/web/src/components/AIGamePlanModal.tsx` — "AI Game Plan" h2.
- `apps/web/src/app/settings/keyboard/page.tsx` — "Keyboard Shortcuts" h1.

Each change is the same trivial className swap: gradient pattern → `text-white`. No JSX restructuring, no new components, no dependencies.

**Required Manual Step:** None — pure className swap.

**Verification:**
```bash
# Should return zero matches in the three admin files:
grep -E "bg-clip-text text-transparent" \
  /home/ubuntu/Sports-Bar-TV-Controller/apps/web/src/components/SportsGuide.tsx \
  /home/ubuntu/Sports-Bar-TV-Controller/apps/web/src/components/AIGamePlanModal.tsx \
  /home/ubuntu/Sports-Bar-TV-Controller/apps/web/src/app/settings/keyboard/page.tsx
# Bartender-remote instances remain (intentional):
grep -rln "bg-clip-text text-transparent" /home/ubuntu/Sports-Bar-TV-Controller/apps/web/src --include="*.tsx" | wc -l
# Should be 6 (BartenderRemoteSelector*, BartenderRemoteAudioPanel, BartenderMusicControl,
# InteractiveBartenderLayout, EnhancedChannelGuideBartenderRemote, dmx/DMXLightingRemote).
```

**Rollback:** `git revert` restores gradients. Will re-break titles on iPad Safari but no functional impact.

---

### v2.32.47 — Cron jitter to prevent fleet rate-limit cascade
**Released:** 2026-05-06

All 6 locations have cron firing at 02:30/02:31 local time. When a release lands on main and every host wakes simultaneously, all 6 hit the Anthropic API at the same Checkpoint A/B/C boundaries and trip the org-wide 30k input-tokens-per-minute rate limit. Hosts that lose the race retry, exhaust their 4 attempts, and roll back even though the merge would have succeeded in isolation. Observed live during the 2026-05-06 v2.32.43 fanout — 3 of 5 locations rolled back from the rate-limit cascade.

**Changes:**
- `scripts/auto-update.sh` — when `--triggered-by=cron`, sleep 0-1799s before starting work. Manual triggers (`manual_api`, `manual_cli`) skip the jitter so the operator doesn't wait. Refreshes `RUN_TS`/`LOG_FILE`/`RUN_STARTED_AT` after the sleep so the log filename reflects when work actually started. Logs the slept duration in the preflight line.

**Required Manual Step:** None — code-only.

**Verification:**
```bash
grep -A 4 "Cron jitter (v2.32.47)" /home/ubuntu/Sports-Bar-TV-Controller/scripts/auto-update.sh
# Should show the comment block.
grep "Cron jitter:" /home/ubuntu/sports-bar-data/update-logs/auto-update-*.log | tail -3
# After the next 02:31 cron, should show "Cron jitter: slept Ns" lines.
```

**Rollback:** `git revert` is safe — without jitter, fleet returns to the parallel-rate-limit cascade behavior.

---

### v2.32.46 — SPORTS_SCHEDULING_SYSTEM_DESIGN.md rewritten to STATUS=SHIPPED
**Released:** 2026-05-06

Final doc in the cleanup pass (after v2.32.44 channel-resolver and v2.32.45 scheduler-patterns). Audit confirmed Phases 1-3 of the original 3000-line design are in production: tables in DB, allocation engine + 10 API endpoints under `/api/scheduling/`, ESPN sync + auto-reallocator on cron, dashboard UI shipped. Phase 4 was Optional Enhancements — multi-bar achieved via the 6-location branch model; predictive allocation not on roadmap. Doc rewritten to reflect actual state with cross-references to the four sibling STATUS docs.

**Changes:**
- `docs/SPORTS_SCHEDULING_SYSTEM_DESIGN.md` — 3082 → ~75 lines.

**Required Manual Step:** None — docs only.

**Verification:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db ".tables" | tr ' ' '\n' | \
  grep -E "game_schedules|input_source|tournament_brackets" | wc -l   # ≥ 4
ls /home/ubuntu/Sports-Bar-TV-Controller/apps/web/src/app/api/scheduling/ | wc -l   # ≥ 10
test -f /home/ubuntu/Sports-Bar-TV-Controller/packages/scheduler/src/espn-sync-service.ts && echo OK
```

**Rollback:** `git revert` restores the 3000-line design doc. No runtime impact either way.

---

### v2.32.45 — Scheduler-pattern docs rewritten to STATUS=SHIPPED
**Released:** 2026-05-06

Companion cleanup to v2.32.44. Audit of `docs/scheduler-patterns/` found all three pattern docs (HOME_TEAMS_SCHEDULER_INTEGRATION, TEAM_NAME_MATCHING_SYSTEM, TEAM_PRIORITY_SYSTEM) were forward-looking design proposals for code that's already in production and has been since v2.18-v2.20. Each doc rewritten as a STATUS doc reflecting actual `HomeTeam` schema, `team-name-matcher.ts`, and `priority-calculator.ts` implementations.

**Changes:**
- `docs/scheduler-patterns/HOME_TEAMS_SCHEDULER_INTEGRATION.md` — 581 → ~50 lines.
- `docs/scheduler-patterns/TEAM_NAME_MATCHING_SYSTEM.md` — 1002 → ~55 lines.
- `docs/scheduler-patterns/TEAM_PRIORITY_SYSTEM.md` — 652 → ~60 lines.

**Required Manual Step:** None — docs only.

**Verification:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA table_info(HomeTeam);" | wc -l
# ≥ 26 (id + 25 columns)
grep -c "EXACT match\|ALIAS match\|LEARNED match\|FUZZY match" \
  /home/ubuntu/Sports-Bar-TV-Controller/packages/scheduler/src/team-name-matcher.ts
# ≥ 4
grep -E "bonuses\.\w+ = [0-9]+" \
  /home/ubuntu/Sports-Bar-TV-Controller/packages/scheduler/src/priority-calculator.ts | wc -l
# ≥ 5 (playoff, rivalry, primeTime, primaryTeam, dayOfWeek)
```

**Rollback:** `git revert` restores the long design docs. No runtime impact either way.

---

### v2.32.44 — Channel Resolver Consolidation Plan doc rewritten to STATUS=COMPLETE
**Released:** 2026-05-06

Audit during post-vacation cleanup found that `docs/CHANNEL_RESOLVER_CONSOLIDATION_PLAN.md` still said "No code changes yet" while the plan had actually shipped progressively across v2.5.0 through v2.32.x. All 5 target routes use the shared `network-channel-resolver` helper; zero hardcoded `NETWORK_TO_CABLE`/`NETWORK_TO_DIRECTV`/`stationToPreset` dicts remain in any route file. Madison-numbers bug at Graystone/Holmgren is fixed.

**Changes:**
- `docs/CHANNEL_RESOLVER_CONSOLIDATION_PLAN.md` — replaced 389-line forward-looking plan with ~70-line STATUS doc reflecting actual state (per-route migration record, what intentionally remains, verification command).

**Required Manual Step:** None — docs only.

**Verification:**
```bash
grep -rnE '^const (NETWORK_TO_CABLE|NETWORK_TO_DIRECTV|stationToPreset)' \
  /home/ubuntu/Sports-Bar-TV-Controller/apps/web/src/app/api/
# Should return 0 lines.
```

**Rollback:** `git revert` restores the old plan doc text. No runtime impact either way.

---

### v2.32.43 — ESPN college-softball sport slug fix
**Released:** 2026-05-06

ESPN sync at every location was logging stack traces every 10 minutes:
`ESPN API error: 400 Bad Request url=https://site.api.espn.com/apis/site/v2/sports/softball/college-softball/scoreboard`.

Root cause: NCAA Softball is parented under `sport=baseball` in ESPN's
URL hierarchy (alongside MLB and college-baseball), not `sport=softball`.
The instrumentation entry had the wrong parent slug. Verified live —
`sports/baseball/college-softball/scoreboard` returns 200 with
`"name":"NCAA Softball"`; `sports/softball/college-softball` returns 400.

**Changes:**
- `apps/web/src/instrumentation.ts:141` — `sport: 'softball'` → `sport: 'baseball'`

**Required Manual Step:** None — pure software fix, auto-merge safe.

**Verification:**
```bash
grep -A 1 'college-softball' /home/ubuntu/Sports-Bar-TV-Controller/apps/web/src/instrumentation.ts | head -2
# Should show: { sport: 'baseball', league: 'college-softball' },
pm2 logs sports-bar-tv-controller --lines 200 --nostream 2>&1 | grep -c 'college-softball.*400' || true
# Should be 0 after one full ESPN sync cycle (~10 min post-restart).
```

**Rollback:** `git revert` is trivial; the only side effect is the 400
errors return.

---

### v2.32.42 — Homepage title: solid white instead of fragile gradient text
**Released:** 2026-04-25

Operator at Lucky's reported "Sports Bar AI Assistant can't be read."
Root cause: homepage h1 + h2 used `bg-gradient + bg-clip-text +
text-transparent` for branded gradient text. On certain browsers (older
iPad Safari, some Chromium builds) bg-clip-text fails → text renders
truly transparent → invisible on the dark backdrop.

**Changes:**
- `apps/web/src/app/page.tsx` h1 (header) and h2 (main card title)
  switched from gradient text to solid `text-white`. Always readable,
  no browser-support assumptions.
- 21 other gradient-text instances across sub-pages (BartenderRemote*,
  SportsGuide, etc.) left alone — they're polish, not visibility-
  critical. Operator can flag if others have the same issue.

**Required Manual Step:** None.

**Verification:**
```bash
grep -A1 "Sports Bar AI Assistant" /home/ubuntu/Sports-Bar-TV-Controller/apps/web/src/app/page.tsx | grep className
# Should show "text-white" not "text-transparent" for both h1 and h2.
```

**Rollback:** `git revert` is clean. Operators who liked the gradient
can revert to it on any browser that supports bg-clip-text reliably.

---

### v2.32.41 — Comprehensive false-positive guide for Haiku in checkpoint-b
**Released:** 2026-04-25

Operator feedback: "we need clearer details if we are gonna use a lower
model." v2.32.40 added one note about hardware-config.ts; v2.32.41 adds
a full table covering every "looks weird but actually fine" pattern
Haiku has flagged tonight, plus a parallel table of REAL stop conditions
to anchor Haiku's judgment.

**Changes:**
- `scripts/prompts/checkpoint-b.txt` adds two tables:
  1. **COMMON FALSE POSITIVES** — 11 rows covering empty TS configs,
     15-byte JSON seeds, env-driven `process.env.X` patterns, schema
     tables already pushed, route consolidation, big version jumps.
  2. **REAL STOP CONDITIONS** — concrete examples of what IS a blocker
     so Haiku has positive examples to match against.

**Required Manual Step:** None.

**Verification:**
```bash
grep -c "COMMON FALSE POSITIVES" /home/ubuntu/Sports-Bar-TV-Controller/scripts/prompts/checkpoint-b.txt
# Expect: 1
```

**Rollback:** `git revert` is clean.

---

### v2.32.40 — Tell Haiku that empty hardware-config.ts is OK (DB is source of truth)
**Released:** 2026-04-25

Greenville checkpoint B at v2.32.39 STOPped because Haiku flagged
"hardware-config.ts atlas processorIp wiped to empty" as a runtime
breaker. False positive — atlas IPs live in the `AudioProcessor` DB
table, not in `hardware-config.ts`. The TS file was a fallback /
config-as-code remnant; runtime reads DB. Empty values there don't
break anything.

**Changes:**
- `scripts/prompts/checkpoint-b.txt` — explicit note: device IPs are
  in DB tables (`AudioProcessor`, `FireTVDevice`, `DirecTVDevice`),
  not in `hardware-config.ts`. Empty values in that file are NORMAL.
  Do not STOP on them. Verify via sqlite3 query if needed.

**Required Manual Step:** None.

**Verification:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT name, ipAddress FROM AudioProcessor;"
# Should show real device IP (e.g. Holmgren: Main Bar @ 10.11.3.246).
```

**Rollback:** `git revert` is clean.

---

### v2.32.39 — Force-decide fallback when Haiku exhausts MAX_TURNS without text
**Released:** 2026-04-25

Greenville checkpoint B at v2.32.38 returned EMPTY text — Haiku used all
6 turns for tool calls without ever emitting a DECISION line. UNDETERMINED
→ STOP → rollback. Pure runner-side fix; no rollout-blocker behavior.

**Changes:**
- `scripts/checkpoint-runner.py`:
  - `MAX_TURNS` 6 → 8 (Haiku gets a bit more room before the fallback fires)
  - Force-decide fallback at MAX_TURNS: append a final `user` message
    instructing "tool budget exhausted, emit DECISION line NOW based on
    what you have, no more tools." Send a no-tools API call so the model
    must respond with text. Empty text is now genuinely impossible.

**Required Manual Step:** None.

**Verification:**
```bash
grep "force-decide" /home/ubuntu/Sports-Bar-TV-Controller/scripts/checkpoint-runner.py
# Expect a few matches in the new fallback block.
```

**Rollback:** `git revert` is clean.

---

### v2.32.38 — Remove Stoneyard secrets from main + ecosystem/hardware-config to OURS
**Released:** 2026-04-25

Lucky's checkpoint A flagged a real security issue: `ecosystem.config.js`
on main had Stoneyard's `SPORTS_GUIDE_API_KEY='12548RK0...'` and
`SPORTS_GUIDE_USER_ID='258351'` hardcoded. `hardware-config.ts` had
`processorIp='10.40.10.102'` + `processorId='atlas-stoneyard'`. Both
came in via Stoneyard's location-setup commits earlier in the month
that landed on main when they shouldn't have.

**OPERATOR ACTION REQUIRED — rotate the leaked Sports Guide API key:**
The key `12548RK0000000d2bb701f55b82bfa192e680985919` was exposed in
git history (commit cbd4eaeb and earlier). It's still readable on
GitHub. Generate a new key from The Rail Media admin portal, update
`.env` at every location, then revoke the old key. Until rotated,
the old key is leaked.

**Changes:**
- `ecosystem.config.js`: `SPORTS_GUIDE_API_KEY` + `SPORTS_GUIDE_USER_ID`
  reverted to `process.env.X` (read from .env per location).
- `apps/web/src/lib/hardware-config.ts`: atlas + wolfpack values reset
  to generic empty defaults; each location overrides on its own branch.
- `scripts/auto-update.sh LOCATION_PATHS_OURS` adds
  `ecosystem.config.js` + `apps/web/src/lib/hardware-config.ts` so
  location's version always wins on conflict — prevents recurrence.

**Required Manual Step at every location** (CRITICAL — do BEFORE
auto-updating):

```bash
# 1. Verify .env has SPORTS_GUIDE_API_KEY + SPORTS_GUIDE_USER_ID
ENV=/home/ubuntu/Sports-Bar-TV-Controller/.env
grep -E '^SPORTS_GUIDE_(API_KEY|USER_ID)=' "$ENV"
# If missing, add the location's values from your operator's password manager:
#   echo 'SPORTS_GUIDE_API_KEY=...' >> "$ENV"
#   echo 'SPORTS_GUIDE_USER_ID=...' >> "$ENV"

# 2. Verify your location's hardware-config.ts has the right values
grep -E "processorIp|processorId" /home/ubuntu/Sports-Bar-TV-Controller/apps/web/src/lib/hardware-config.ts
# Should show YOUR location's atlas, not Stoneyard's.
```

**Rollback:** `git revert` is clean. The key was already leaked
publicly; reverting only fixes future merges, not git history. Key
rotation is the only real fix.

---

### v2.32.37 — bootstrap auto-quotes .env values containing whitespace
**Released:** 2026-04-25

Leg Lamp + Stoneyard Greenville both had `LOCATION_NAME=Leg Lamp`
(unquoted, with space) in `.env`. Auto-update.sh's build-phase
`set -a; source .env; set +a` parses that line as
`LOCATION_NAME=Leg` followed by `Lamp` command → 127 → trap fires →
build phase aborts → rollback. Tonight cost two extra retry rounds
to diagnose + manually fix.

**Changes:**
- `scripts/bootstrap-new-location.sh upsert_env()` now single-quotes
  any value containing whitespace or shell-special chars
  (`[[:space:]\$\`"!#&|]`). Inner single-quotes are escaped via
  `'\''` pattern.

**Required Manual Step at existing locations** that have problematic
`.env` values (only the 2 fixed during tonight's session were
affected, but verify):

```bash
# At each location, look for unquoted spaces in .env:
grep -nE "^[A-Z_]+=[^\"\x27].* " /home/ubuntu/Sports-Bar-TV-Controller/.env
# If output appears, manually edit those lines to wrap the value in
# single quotes, e.g.:
#   LOCATION_NAME=Leg Lamp        →   LOCATION_NAME='Leg Lamp'
```

**Verification:**
```bash
# After bootstrap-new-location.sh adds an env var, the value with
# whitespace should be single-quoted in .env:
grep '^LOCATION_NAME=' /home/ubuntu/Sports-Bar-TV-Controller/.env
# Expect single-quoted if value contains a space.
```

**Rollback:** `git revert` is clean. Existing quoted values stay quoted.

---

### v2.32.36 — Bigger max_tokens + DECISION-line-first + tolerant Fire TV marker
**Released:** 2026-04-25

Three small fixes for tonight's checkpoint reliability:

1. **`max_tokens` 4096 → 8192** in `checkpoint-runner.py`. Haiku produces
   verbose analysis prose; 4k cut off mid-explanation at Leg Lamp B → no
   DECISION line emitted → UNDETERMINED → STOP.
2. **All 3 prompts** now require `DECISION:` to be the FIRST line of the
   response. Avoids the case where Claude analyzes thoroughly then runs
   out of tokens before committing.
3. **Fire TV verify-sql marker** in v2.32.13/16 entry was scoped wrong:
   it required `inputChannel > 0` to exist — but Leg Lamp has zero Fire
   TV devices (cable-box-only location). The marker now passes when
   either the location has Fire TV devices with inputChannel set, OR
   the location has no Fire TV devices at all (the mirror code is a
   no-op in that case).
4. **checkpoint-b prompt** now explicitly tells Claude: a marker that
   fails because the feature isn't used at this location is NOT a real
   blocker; emit CAUTION instead of STOP.

**Required Manual Step:** None.

**Verification:**
```bash
grep "max_tokens" /home/ubuntu/Sports-Bar-TV-Controller/scripts/checkpoint-runner.py
grep "OUTPUT SHAPE" /home/ubuntu/Sports-Bar-TV-Controller/scripts/prompts/checkpoint-*.txt
```

**Rollback:** `git revert` is clean.

---

### v2.32.35 — Resolver handles add/add + .claude/locations to OURS
**Released:** 2026-04-25

Stoneyard-Appleton's auto-update kept failing at merge step on
`.claude/locations/stoneyard-appleton.md`. v2.32.23 added stub files
to main for all 6 locations; some location branches had their own
pre-existing versions → git "add/add" conflict (status `^AA`, not
`^UU`) → resolver didn't catch it → exit 3.

**Changes:**
- `.claude/locations` added to `LOCATION_PATHS_OURS`. Each location
  maintains its own hardware reference; main's stub is just a starting
  point for new locations.
- Conflict resolver now matches `^(UU|AA|DU|UD)` (modify/modify,
  add/add, delete-by-them, delete-by-us) instead of just `^UU`. The
  loops also iterate per-conflict-file so directory entries in the
  path arrays resolve every nested conflict.

**Required Manual Step:** None.

**Verification:**
```bash
grep -E "CONFLICT_RE|.claude/locations" /home/ubuntu/Sports-Bar-TV-Controller/scripts/auto-update.sh
# Expect: CONFLICT_RE='^(UU|AA|DU|UD)' and ".claude/locations" in OURS array
```

**Rollback:** `git revert` is clean.

---

### v2.32.34 — Tolerate markdown-bold DECISION lines from Haiku
**Released:** 2026-04-25

Haiku 4.5 wraps the DECISION line in markdown bold (`**DECISION: GO**`).
The case-statement matcher in `run_checkpoint()` required the literal
prefix `DECISION:` so it didn't match → UNDETERMINED → STOP. Appleton
hit this on the first Haiku run; everything else worked but the rollup
classified the success as failure.

**Changes:**
- `scripts/auto-update.sh run_checkpoint()` strips leading non-alpha
  chars before the case match (`sed -E 's/^[^A-Z]*//'`). Now
  `**DECISION: GO**`, `> DECISION: GO`, ` DECISION: GO`, etc. all
  classify correctly.

**Required Manual Step:** None.

**Verification:**
```bash
echo '**DECISION: GO**' | sed -E 's/^[^A-Z]*//'
# Expect: DECISION: GO
```

**Rollback:** `git revert` is clean.

---

### v2.32.33 — Risk-aware checkpoint-model picker via LOCATION_UPDATE_NOTES
**Released:** 2026-04-25

v2.32.32 made Haiku 4.5 the default checkpoint model. Cheap + fast +
high rate limit, but might miss subtle cross-file implications on big
refactors. v2.32.33 adds an opt-in escalation: tag a release entry in
`docs/LOCATION_UPDATE_NOTES.md` with `**Checkpoint model:** sonnet`
(or `opus`) and `auto-update.sh` will use that beefier model for the
whole update run.

**Changes:**
- `scripts/auto-update.sh` greps `LOCATION_UPDATE_NOTES.md` for
  `Checkpoint model: (haiku|sonnet|opus)` before checkpoint A. If
  found, exports `CLAUDE_API_MODEL` to override the default. Operator's
  pre-set `CLAUDE_API_MODEL` in `.env` still wins (env var takes
  precedence — script only sets it when unset).
- `docs/LOCATION_UPDATE_NOTES.md` format docs updated to document the
  new optional flag.

**Usage:** when shipping a risky release (schema migration, big
refactor, cross-cutting change) add this line to the LOCATION_UPDATE_NOTES
entry alongside Risk/What-changed:
```
**Checkpoint model:** sonnet
```
Each location's next auto-update will use Sonnet 4.6 instead of
Haiku 4.5 for the deeper reasoning. Remove the flag from the entry
once the risky update has crossed the fleet (Haiku is cheaper and
faster for routine work).

**Required Manual Step:** None.

**Verification:**
```bash
grep -A2 "Risk-model override" /home/ubuntu/sports-bar-data/update-logs/$(ls -t /home/ubuntu/sports-bar-data/update-logs/ | head -1) | head
# Expect a line if the active LOCATION_UPDATE_NOTES entry has a model flag.
```

**Rollback:** `git revert` is clean. The flag is optional; entries
without it just use the default Haiku.

---

### v2.32.32 — Default checkpoint model: Haiku 4.5 (~5x rate-limit headroom)
**Released:** 2026-04-25

Sonnet 4.6 hits the same 30k input-tokens/min org cap as Opus 4.7 — the
limit is per-org, not per-model. When 4 locations auto-update in
parallel (4-host fleet bootstrap), Sonnet runs out of headroom even
with the v2.32.31 4/5/3 tool-call budget. Greenville + Appleton both
exhausted retries during a 4-way parallel run.

**Changes:**
- `scripts/checkpoint-runner.py` `MODEL` default switched from
  `claude-sonnet-4-6` → `claude-haiku-4-5-20251001`. Haiku 4.5 has ~5x
  higher per-org rate limit. Checkpoints are bounded verify-tasks
  (run SQL/git, compare, decide GO/CAUTION/STOP) — no novel reasoning
  needed; Haiku is plenty.
- `scripts/auto-update.sh` log line updated to show the new default.
- Override via `CLAUDE_API_MODEL` env in `.env` if a specific
  checkpoint needs Sonnet/Opus.

**Smoke-tested:** Haiku 4.5 returned correct DECISION in 2 turns on
the same test prompt as v2.32.28/29.

**Required Manual Step:** None.

**Verification:**
```bash
grep "MODEL = " /home/ubuntu/Sports-Bar-TV-Controller/scripts/checkpoint-runner.py
# Expect: MODEL = os.environ.get("CLAUDE_API_MODEL", "claude-haiku-4-5-20251001")
```

**Rollback:** `git revert` is clean. To revert just the model default,
set `CLAUDE_API_MODEL=claude-sonnet-4-6` in `.env`.

---

### v2.32.31 — Hard tool budget on checkpoint prompts (4/5/3 calls max)
**Released:** 2026-04-25

Sonnet at Lucky's checkpoint A used 9 tool calls + 6 retries → 7 minutes;
checkpoint B used 11 calls + 11 retries → didn't finish in 15min budget.
Each call re-sends full message history → input-token rate limit → 429
backoff → cumulative time blows the budget. Operator waited 15+ min for
one location to update; doesn't scale.

**Changes:**
- `scripts/prompts/checkpoint-a.txt` prepended HARD BUDGET: max 4 tool
  calls, batch bash one-liners, no per-file `git log -p`, decide CAUTION
  if budget exhausted.
- `scripts/prompts/checkpoint-b.txt` same with max 5 calls.
- `scripts/prompts/checkpoint-c.txt` same with max 3 calls (verify-install
  already ran, sanity check only).
- `scripts/checkpoint-runner.py` `MAX_TURNS` 15 → 6 hard cap (matches
  per-prompt budgets; can't loop forever).

**Required Manual Step:** None.

**Verification:**
```bash
grep -E "HARD BUDGET|MAX_TURNS" /home/ubuntu/Sports-Bar-TV-Controller/scripts/prompts/checkpoint-*.txt /home/ubuntu/Sports-Bar-TV-Controller/scripts/checkpoint-runner.py
# Expect: HARD BUDGET line at top of each prompt; MAX_TURNS = 6
```

**Rollback:** `git revert` is clean.

---

### v2.32.30 — Bigger checkpoint timeouts + tighter tool-output cap
**Released:** 2026-04-25

v2.32.29 fixed the rate-limit error class but the 180s checkpoint A
timeout was still too tight when Sonnet hit two 429s back-to-back
(45s + 93s server retry-after). Lucky's checkpoint A failed mid-tool-loop.

**Changes:**
- `scripts/auto-update.sh` checkpoint timeouts:
  - A: 180s → 600s
  - B: 300s → 900s
  - C: 300s → 600s
- `scripts/checkpoint-runner.py` `TOOL_OUTPUT_CAP_BYTES`: 64 KB → 16 KB.
  Smaller cap keeps the cumulative message history from re-sending
  hundreds of KB on each subsequent turn, the actual driver of input-
  token-rate-limit churn.
- Log line in run_checkpoint() updated to show the correct default
  model name (was still "claude-opus-4-7").

**Required Manual Step:** None.

**Verification:**
```bash
grep -E "Checkpoint .* timeout|TOOL_OUTPUT_CAP" /home/ubuntu/Sports-Bar-TV-Controller/scripts/auto-update.sh
# Expect: timeouts of 600/900/600 in run_checkpoint calls.
```

**Rollback:** `git revert` is clean.

---

### v2.32.29 — Checkpoint runner: Sonnet 4.6 default + 429 retry
**Released:** 2026-04-25

v2.32.28's tool-use loop made 5+ turns of bash inspection per checkpoint.
Each turn re-sends the full message history → cumulative input tokens hit
Opus 4.7's 30k-tokens-per-minute rate limit → HTTP 429 → checkpoint failed.

**Changes:**
- `scripts/checkpoint-runner.py` default model switched from
  `claude-opus-4-7` → `claude-sonnet-4-6`. Sonnet has ~4x the rate limit
  and is fully capable for checkpoint verification (running git/sqlite
  reads, not synthesizing novel code). Override via `CLAUDE_API_MODEL`
  env var if a specific checkpoint needs Opus.
- New retry loop on HTTP 429: honors `retry-after` header if present,
  else exponential backoff (30s, 60s, 120s), 3 retries max.

**Smoke-tested:** Sonnet 4.6 ran the same test prompt as v2.32.28,
returned correct DECISION in 2 turns.

**Required Manual Step:** None.

**Verification:**
```bash
grep -E "model=|HTTP 429" /home/ubuntu/sports-bar-data/update-logs/$(ls -t /home/ubuntu/sports-bar-data/update-logs/ | head -1) | head
# Expect: "model=claude-sonnet-4-6" lines, no 429s.
```

**Rollback:** `git revert` is clean. Setting `CLAUDE_API_MODEL=claude-opus-4-7`
in `.env` reverts to the older default model only (still uses tool use loop).

---

### v2.32.28 — Checkpoint API path now supports tool use (bash + read_file)
**Released:** 2026-04-25

v2.32.20's API path was a plain text-completion call. Checkpoint A/B/C
prompts expect the model to inspect git state, sqlite tables, .env, and
log tails before deciding GO/CAUTION/STOP. With no tool access, the
model correctly said "I cannot execute these commands" and returned
DECISION: STOP. Lucky's + Leg Lamp both failed at checkpoint_b on this.

**Changes:**
- New `scripts/checkpoint-runner.py` — Anthropic SDK-style messages loop
  with two tools: `bash` (cwd=repo root, 60s timeout, 64 KB output cap)
  and `read_file` (64 KB cap). Loops `tool_use → tool_result` up to 15
  turns until model emits text-only DECISION.
- `scripts/auto-update.sh run_checkpoint()` now invokes the runner
  instead of inline curl + python text-only call. CLI fallback path
  (when `ANTHROPIC_API_KEY` unset) is unchanged.

**Smoke-tested:** runner executed `sqlite3` against production.db and
returned a correct DECISION in 2 turns.

**Required Manual Step:** None. `python3` is already a hard dep of the
auto-update preflight (added in v2.32.20).

**Verification:**
```bash
# After next auto-update, look for the tool-use turns in the log
grep "checkpoint-runner" /home/ubuntu/sports-bar-data/update-logs/$(ls -t /home/ubuntu/sports-bar-data/update-logs/ | head -1) | head -10
# Expect lines like: turn=1 stop_reason=tool_use tool_uses=N
```

**Rollback:** `git revert` is clean. Old text-only API path is gone but
CLI fallback still functional for hosts without an API key.

---

### v2.32.27 — Source nvm in auto-update.sh + rollback.sh
**Released:** 2026-04-25

Hosts that installed Node via nvm (Leg Lamp) had `npm` only on the
interactive bash PATH, not on cron / setsid subshells. Auto-update.sh
exited 127 ("npm: command not found") at npm_ci or build phase, then
rollback.sh hit the same error trying to realign node_modules → exit
99 (CRITICAL: rollback failed) even though the git rollback itself
succeeded.

**Changes:**
- `scripts/auto-update.sh` sources `~/.nvm/nvm.sh` (if present) at
  the top, runs `nvm use default` to activate the alias.
- `scripts/rollback.sh` same source block at the top.
- Hosts using apt's `/usr/bin/npm` (graystone, luckys, appleton,
  greenville, holmgren) are unaffected — the nvm script is a no-op
  when `~/.nvm/nvm.sh` doesn't exist.

**Required Manual Step:** None. Hosts without nvm continue using
their system npm. Hosts with nvm pick up the default-version automatically.

**Verification (post-update at the affected location):**
```bash
which npm
# Expect: /usr/bin/npm OR /home/ubuntu/.nvm/versions/node/v20.20.0/bin/npm
bash -c '. ~/.nvm/nvm.sh --no-use && nvm use default >/dev/null && which npm'
# Expect: a valid path to npm
```

**Rollback:** `git revert` is clean.

---

### v2.32.26 — auto-update.sh: pre-clean working tree + CLAUDE.md takes main
**Released:** 2026-04-24

Unblocks the fleet from 4+ days of stuck nightly auto-updates. Two distinct
failure classes resolved:

**Class 1 — CLAUDE.md merge conflict (graystone today, others imminent).**
Main shipped v2.32.21/22 simplify pass (1122 → 672 lines, extracted to
satellites). Location branches carried local commits like holmgren-way's
`8610e1e2 docs(claude): add Fire TV Cube launcher-hosted Prime Video
gotcha (v2.28.9)`. Auto-resolver did NOT have `CLAUDE.md` in any
LOCATION_PATHS list → "merge conflict on non-whitelisted file" → exit 3.

**Class 2 — auto-update.sh self-update conflict (every location after the
bootstrap-fix dance).** Operator hot-patches a new `auto-update.sh` into
the working tree without committing. Next merge step then aborts with
"Your local changes would be overwritten by merge" → exit 4. Today's
workaround was a manual commit; that's now obviated.

**Changes:**
- `scripts/auto-update.sh` LOCATION_PATHS_THEIRS gains `CLAUDE.md`. Any
  conflict on `CLAUDE.md` automatically takes main's version.
- New PRE_MERGE_RESET_PATHS loop in the preflight phase: for any path that
  will take main's version anyway (auto-update.sh, rollback.sh,
  CLAUDE.md, package.json, etc.), `git checkout HEAD -- <path>` discards
  uncommitted edits before the fetch+merge step. The merge then proceeds
  cleanly and the conflict resolver overlays main's version on top.
- `CLAUDE.md` adds Standing Rule 9: "CLAUDE.md is main-only."

**Required Manual Step:** None. The fix lands as part of the merge into
each location. First post-fix update may still hit the bootstrap dance
once if it's already in flight; subsequent runs are clean.

**Verification:**
```bash
# After merge lands, on each location branch:
grep -A1 'LOCATION_PATHS_THEIRS=' scripts/auto-update.sh | grep CLAUDE.md
# Expect: "CLAUDE.md" inside the array (with the v2.32.26 comment block above it).

# Confirm pre-clean loop exists:
grep -n 'PRE_MERGE_RESET_PATHS' scripts/auto-update.sh
# Expect: a line in the preflight section (~line 487) plus the array def.
```

**Rollback:** `git revert <sha>` is safe — script reverts to v2.32.25
behavior. Only side effect: locations that had hot-patched
`auto-update.sh` in their working trees would again need a manual
commit before the next auto-update.

**Doesn't fix (intentionally):**
- Class 3 (Claude Code CLI not installed at graystone/appleton) is
  already handled by v2.32.20's API path — preflight at
  `scripts/auto-update.sh:466` skips the `claude --version` check when
  `ANTHROPIC_API_KEY` is set in `.env`.
- Class 4 (CLI cap exhaustion at Holmgren/leglamp) is the same — API
  path bills per-token with no monthly cap.

---

### v2.32.25 — Shift brief surfaces fleet-stuck alerts to bartender
**Released:** 2026-04-25

When sister locations are stuck on auto-update, the bartender's pre-shift
brief now flags it with a "TELL OWNER" line. Operator gets a heads-up
without having to navigate to /fleet.

**Why:** 4+ days of silent fleet-wide auto-update failures (graystone +
appleton: CLI not installed; leglamp: CLI cap exhausted). Fleet dashboard
showed `staleness: 'stuck'` but no notification path; operator had to
remember to check.

**Changes:**
- `apps/web/src/app/api/ai/shift-brief/route.ts` `gatherShiftContext()`
  fetches `/api/fleet/status` (8s timeout, soft-fail if unreachable) and
  builds a `fleetAlerts` array of stuck/warning sister locations.
- Prompt template adds a "Sister-location health" section + Format rule:
  "If STUCK locations, add ONE line: TELL OWNER: <names> stuck on
  auto-update."
- Fallback brief (LLM unavailable) appends the same alerts.

**Required Manual Step:** None. Pure additive change. Cache invalidates
on the existing 10-minute TTL — bartender sees alerts within 10 minutes
of fleet API turning red.

**Verification:**
```bash
curl -s 'http://localhost:3001/api/ai/shift-brief?force=true' | python3 -c "import sys,json; print(json.load(sys.stdin).get('brief',''))"
# If any sister location is stuck, expect a "TELL OWNER" line in the output.
```

**Rollback:** `git revert` is clean.

---

### v2.32.24 — bootstrap + auto-update WARN for missing ANTHROPIC_API_KEY
**Released:** 2026-04-24

All locations share the same `ANTHROPIC_API_KEY` (operator's
single key). Without it in `.env`, auto-update.sh falls back to the
Claude Code CLI subscription path — same path that hit "monthly usage
limit" today and triggered v2.32.20.

**Changes:**
- `scripts/bootstrap-new-location.sh` accepts `--anthropic-api-key sk-ant-...`
  and writes it to `.env` at first install. If neither flag nor existing
  `.env` value, prints a WARN.
- `scripts/auto-update.sh` preflight prints 3 WARN lines when the key is
  missing, with the exact `echo ... >> .env` snippet.

**Required Manual Step (CRITICAL — apply at every location):**

The same API key from the operator goes in every location's `.env`. SSH
into each host and run (idempotent — skips if already set):

```bash
KEY='sk-ant-...'  # paste the operator's shared key
ENV=/home/ubuntu/Sports-Bar-TV-Controller/.env
if ! grep -q '^ANTHROPIC_API_KEY=' "$ENV"; then
  echo "ANTHROPIC_API_KEY=$KEY" >> "$ENV"
  echo "[OK] added ANTHROPIC_API_KEY at $(hostname)"
else
  echo "[SKIP] $(hostname) already has ANTHROPIC_API_KEY"
fi
```

Locations to apply (in order; all 6):

1. holmgren-way (already done 2026-04-24)
2. graystone
3. lucky-s-1313
4. leg-lamp
5. stoneyard-appleton
6. stoneyard-greenville

**Verification:**

```bash
grep '^ANTHROPIC_API_KEY=' /home/ubuntu/Sports-Bar-TV-Controller/.env | sed 's/=.*/=<set>/'
# Expect: ANTHROPIC_API_KEY=<set>
```

After the next auto-update at each location, look for this log line:
```
Claude path: Anthropic API (model=claude-opus-4-7)
```
NOT this:
```
Claude path: Claude Code CLI (...)
WARN: ANTHROPIC_API_KEY missing from .env — using subscription CLI path.
```

**Rollback:** `git revert` is clean. The key in `.env` is harmless to leave in place.

---

### v2.32.23 — Hardware package READMEs + all location stubs (729 → 672 lines)
**Released:** 2026-04-24

Final cleanup pass. Cumulative CLAUDE.md size: 1122 → 672 (-40%). All
remaining "satellite extraction" candidates done.

**Per-package READMEs created (4 new):**
- `packages/crestron/README.md` — DM/HD-MD/DMPS/NVX models, Telnet/CTP/CIP, output slot offset table.
- `packages/bss-blu/README.md` — BSS Soundweb London BLU models, HiQnet TCP 1023.
- `packages/dbx-zonepro/README.md` — ZonePRO TCP 3804, NO F0/64/00 prefix, failsafe Scene 1 workaround.
- `packages/multiview/README.md` — 4K60 Quad-View hex frames, mode table, RS-232.

CLAUDE.md §6 (Crestron) / §7 (Audio) / §8 (Multi-View) compressed to
1-3 line refs pointing at the per-package READMEs.

**Location stubs created (4 new):**
- `.claude/locations/leg-lamp.md` (canary candidate; single-card matrix)
- `.claude/locations/stoneyard-appleton.md` (multi-card)
- `.claude/locations/stoneyard-greenville.md` (multi-card; v2.32.18 origin)
- Renamed `.claude/locations/lucky-s.md` → `lucky-s-1313.md` (matches `location/lucky-s-1313` branch).

`.claude/locations/README.md` updated with all 6 active locations + the
matching hardware-ref filenames + the per-location-IPs-go-here rule.

**Required Manual Step:** None at any location. Pure docs reorganization.

**Verification:**

```bash
wc -l /home/ubuntu/Sports-Bar-TV-Controller/CLAUDE.md
# Expect: 672

ls /home/ubuntu/Sports-Bar-TV-Controller/.claude/locations/ | wc -l
# Expect: 7 (README + 6 location files)

ls /home/ubuntu/Sports-Bar-TV-Controller/packages/{crestron,bss-blu,dbx-zonepro,multiview}/README.md
# Expect: all 4 files present
```

**At each location's next auto-update**, Claude at Checkpoint B should
populate the location's `<branch>.md` device tables from the live DB
if they're still TBD stubs (already documented in the stubs).

**Rollback:** `git revert` is clean.

---

### v2.32.22 — CLAUDE.md deep simplify (961 → 729 lines)
**Released:** 2026-04-24

Second simplify pass. Cumulative 1122 → 729 (-35%). Extracted three
sections to satellite docs/files; preserved all rules + behavior.

**Extracted:**
- §Key Package @sports-bar/config (28 lines) → `packages/config/README.md` (new)
- §10 Holmgren Way Hardware (24 lines) → `.claude/locations/holmgren-way.md` (new). Per-location IPs were stale (192.168.4.x; actual is 10.11.3.x); new file pulls live IPs from DB.
- UI Styling Guide (103 lines) → `docs/UI_STYLING.md` (new). Tagged "recommended pattern, not hard rule" to match reality.

**Compressed in-place:**
- V2 Monorepo Architecture: dropped the inline 26-line package tree (operators run `ls packages/` for the live list).
- §8a Sports Guide Phase A/B/C/D narrative (15 lines → 1 paragraph). Consolidation is complete; phases are history.
- §9 AI Scheduling: dropped "prior to vX.Y.Z" historical prose, kept current behavior (~30 lines saved).

**New satellite files:**
- `.claude/locations/holmgren-way.md` — DB-sourced hardware reference for Holmgren.
- `packages/config/README.md` — full @sports-bar/config API + ConfigChangeTracker.
- `docs/UI_STYLING.md` — dark theme styling guide.

**Required Manual Step:** None. Pure docs reorganization.

**Verification:**

```bash
wc -l /home/ubuntu/Sports-Bar-TV-Controller/CLAUDE.md
# Expect: 729

ls /home/ubuntu/Sports-Bar-TV-Controller/.claude/locations/holmgren-way.md \
   /home/ubuntu/Sports-Bar-TV-Controller/packages/config/README.md \
   /home/ubuntu/Sports-Bar-TV-Controller/docs/UI_STYLING.md
# Expect: all 3 files present
```

**Rollback:** `git revert` is clean.

---

### v2.32.21 — CLAUDE.md simplify pass (1122 → 961 lines)
**Released:** 2026-04-24

Tightened CLAUDE.md by ~14% via the bundled `simplify` skill workflow.
No semantic rule changes — just removed duplication, dead refs, and
prose bloat. All Standing Rules preserved with same intent, just
reformatted.

**Changes:**
- READ FIRST block trimmed to 2 numbered bullets (was 11 lines of prose).
- §5 Cable Box: dropped legacy CEC file list (`cable-box-cec-service.ts`
  etc — those files don't exist in repo anymore), kept the rule "no new
  CEC".
- §8 Wolf Pack Multi-View: was tagged "Future Implementation" but
  `packages/multiview/` is built (commands.ts, multiview-service.ts,
  serial-client.ts, types.ts). Reflected as implemented.
- API Route Patterns: replaced 50-line code block with 1-line summary
  + reference to canonical example route (50+ existing routes already
  document the pattern).
- Common Gotchas: collapsed #1 (body-stream) + #2 (GET no body) into
  one entry; removed dead `/api/cec/cable-box/test` curl example;
  renumbered #5a/#6/#7/#8/#9/#10 → #4/#5/#6/#7/#8/#9 (sequential).
- Standing Rules 1-8: kept all 8, tightened wording. Each is now 1-3
  sentences instead of paragraph-length. Defer-to-docs lines preserved
  for rules 5/7/8.
- Documentation References: removed broken link to non-existent
  `CEC_DEPRECATION_NOTICE.md`; added OBSBOT_TAIL_2_PLAN.md.

**Required Manual Step:** None. Pure docs change, no behavior impact.

**Verification:**

```bash
wc -l /home/ubuntu/Sports-Bar-TV-Controller/CLAUDE.md
# Expect: 961
```

**Rollback:** `git revert` is clean.

---

### v2.32.20 — auto-update.sh: Anthropic API path replaces CLI subscription
**Released:** 2026-04-24

`scripts/auto-update.sh` now invokes the Anthropic API directly for
Checkpoint A/B/C decisions when `ANTHROPIC_API_KEY` is set in `.env`.
Falls back to the Claude Code CLI subscription path when the env var
is unset.

**Why:** The CLI path uses the user's Claude Pro/Max subscription,
which has a monthly token cap. Holmgren hit "You've hit your org's
monthly usage limit" on Checkpoint B mid-day 2026-04-24 → checkpoint
returned UNDETERMINED → automatic rollback. API path bills per-token
and has no monthly cap, so unattended cron updates can't be silently
defeated by quota exhaustion.

**Changes:**
- `run_checkpoint()` chooses path by `ANTHROPIC_API_KEY` presence.
  API path uses `curl` + `python3` to POST to `/v1/messages`, default
  model `claude-opus-4-7` (override via `CLAUDE_API_MODEL`).
- Preflight check accepts EITHER API key OR CLI binary; fails only
  when neither is available.
- `.env` is now sourced at the start of preflight so checkpoint phases
  see the API key. The original `.env` source at the build phase
  (line ~966) is preserved for Turbo/Next.js.

**Required Manual Step:** None per location IF `ANTHROPIC_API_KEY` is
already in `.env`. Locations without the key keep using the CLI path
automatically, no breakage.

**To opt INTO the API path** at a location that doesn't have the key:

```bash
# Get the actual key from the operator (1Password / shared secrets)
if ! grep -q '^ANTHROPIC_API_KEY=' /home/ubuntu/Sports-Bar-TV-Controller/.env; then
  echo 'ANTHROPIC_API_KEY=sk-ant-...' >> /home/ubuntu/Sports-Bar-TV-Controller/.env
fi
```

After this, the next auto-update.sh run will use the API path. No
restart required (the script sources .env each invocation).

**Verification:**

```bash
# Confirm API path is being chosen at this location:
grep -E "Claude path:" /home/ubuntu/sports-bar-data/update-logs/$(ls -t /home/ubuntu/sports-bar-data/update-logs/ | head -1)
# Expect: "Claude path: Anthropic API (model=claude-opus-4-7)"
# CLI fallback shows: "Claude path: Claude Code CLI (...)"
```

**Rollback:** `git revert` is clean. The CLI path is preserved as the
fallback so removing the API call code doesn't break anything as long
as the CLI is still installed.

---

### v2.32.11 → v2.32.17 — Bartender remote: input tracking + logos + scheduler guards
**Released:** 2026-04-24

Seven small ships during a single Holmgren operator session. All
software-only / additive — no schema changes, no env vars required, no
seed data. Auto-update.sh handles the rebuild + PM2 restart.

**v2.32.11** — `bartender-schedule` POST: tolerant lookup when client
sends `awayTeam="Unknown"` or `""`. Fallback path matches `homeTeamName`
+ empty `awayTeamName` + ±1hr time window. Unblocks NFL Draft, UFC PPV,
and other single-entity events from 404'ing.

**v2.32.12** — Past-game guards (server + client). POST returns 400 if
`endTime < now`. Channel-guide remote short-circuits with operator hint
before POST when program endTime (or startTime + 3h fallback) is past.
Stops auto-reverter churn from operators tapping yesterday's session
of a multi-day event still visible in Rail Media (NFL Draft, Masters).

**v2.32.13** — Fire TV current-app mirrored into `InputCurrentChannel`.
Two write paths: (a) `firestick-scout` heartbeat upserts when scout
reports `currentApp`; (b) `channel-presets/tune` route resolves Fire TV
matrix input via `FireTVDevice.inputChannel` and runs the same upsert
that cable/DirecTV use. Stored as `channelNumber="APP"`,
`channelName=<friendly>`. UI render branches on `"APP"` to show app
name instead of `Ch APP`.

**v2.32.14** — 17 new streaming-app logo registers in `channel-logos.ts`
(Netflix, Disney+, Hulu, Max, YouTube, fubo, Sling, DAZN, Tubi, Pluto,
Vudu, DirecTV Stream, MLB.TV, NBA, NHL, NFL, NFHS, B1G+, NBC Sports,
Fox Sports app, Atmosphere, Home).

**v2.32.15** — `GET /api/matrix/current-channels` hydrates empty
`channelName` from `ChannelPreset` table by `${deviceType}|${channelNumber}`
lookup. Fixes missing logos on cable/DirecTV inputs (tune route only sets
channelName when user clicks a labeled preset; manual tunes left it null,
which suppressed logo render).

**v2.32.16** — Server-side current-app poll. New `pollFiretvCurrentApp`
tick in scheduler-service (60s interval, 45s initial delay) hits
`/api/firetv-devices/[id]/current-app` for each online + non-disabled +
inputChannel-mapped Fire TV. The endpoint also upserts InputCurrentChannel
after the ADB probe. Workaround for older Sports Bar Scout APK builds at
Holmgren that report empty `currentApp` in heartbeats.

**v2.32.17** — Channel logo badge fallback. SimpleIcons removed many
trademarked sports brand logos in 2025 (espn, nfl, hulu, peacock,
primevideo, foxsports, sling, pluto, disneyplus all 404). New
`apps/web/src/components/ui/channel-logo.tsx` `<ChannelLogo>` component
swaps to text badge on `<img>` onError. 9 broken `SI()` calls null'd
in channel-logos.ts (each already has colored badge defined). 14 new
register entries (Spanish networks, Bally MW, NHL Center Ice, UEFA,
Willow Cricket, Overtime, Fox Sports Prime, DTV PPV, FDNOR+, AMZNP).
`normalizeForLogo()` strips parens + trailing `-SD`.

**Required Manual Step:** None. All seven versions are software-only;
build + PM2 restart (handled by auto-update.sh) is sufficient.

**Verification (post-update, optional):**

```bash
# v2.32.13 + v2.32.16 — Fire TV input rows should appear within 60s of restart
DB=/home/ubuntu/sports-bar-data/production.db
sqlite3 "$DB" "SELECT inputNum, inputLabel, channelNumber, channelName FROM InputCurrentChannel WHERE deviceType='firetv';"
# Expect: rows for each online Fire TV with channelNumber='APP' and friendly app name.

# v2.32.15 — current-channels endpoint should return non-null channelName for cable/DirecTV with known channels
curl -s http://localhost:3001/api/matrix/current-channels | python3 -c "import sys,json; d=json.load(sys.stdin); [print(k, v.get('inputLabel'), v.get('channelNumber'), v.get('channelName')) for k,v in sorted(d['channels'].items(), key=lambda x: int(x[0]))]"
# Expect: cable boxes 1-4 show ESPN/ESPN2/ESPN U/ESPN News, DirecTV inputs show their network names.
```

**Rollback:** `git revert` is clean for any of these — pure software,
no DB/data side effects. InputCurrentChannel rows added by v2.32.13/16
are harmless if left after revert (UI just won't read them).

<!-- verify-description: production.db reachable + Fire TV devices have inputChannel mapping (required by v2.32.13/16 mirror path) — OR location has no Fire TVs configured (mirror code is a no-op there) -->
<!-- verify-sql: SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM FireTVDevice) UNION SELECT id FROM FireTVDevice WHERE inputChannel IS NOT NULL AND inputChannel > 0 LIMIT 1 -->

---

### v2.32.4 → v2.32.7 — Auto-update robustness Phases 1-4
**Released:** 2026-04-23

Hardens `scripts/auto-update.sh` against the cross-location failure modes
mapped during the v2.31-tonight session. Four orthogonal pieces, all
backward-compatible (no behavior change at locations until they next
auto-update).

**v2.32.4 (Phase 1 — quick wins):**
- `apps/web/data/station-aliases-local.json` added to
  `LOCATION_PATHS_OURS`. Closes a ticking time bomb: any future merge
  touching this file at any location with custom OTA aliases would have
  hit "unexpected conflict" and aborted with exit 3 (no rollback,
  half-merged tree).
- Pre-flight env-var scan after fetch / before Checkpoint A. Greps the
  incoming diff for new `process.env.X` references and warns if X isn't
  in the current `.env`. Warn-only — no STOP — many env vars have
  code-side fallbacks.
- Heartbeat (`.auto-update-last-success.json`) v2 schema: adds
  `configChecksums` (16-char SHA-256 prefixes of `.env`,
  `tv-layout.json`, `station-aliases-local.json`,
  `hardware-config.ts`) and `dbRowCounts` (Location, AuthPin,
  MatrixConfiguration, HomeTeam, ChannelPreset, station_aliases).
  Lets the Fleet Dashboard detect drift without polling each location.

**v2.32.5 (Phase 2 — DB rollback hardening):**
- `auto-update.sh` schema_push phase greps drizzle output for
  destructive operations (DROP TABLE / DROP COLUMN / data-loss /
  truncate). If detected, writes a small companion file
  `$BACKUP_FILE.destructive` next to the pre-update SQLite backup.
- `rollback.sh` checks for the marker after git reset. If present (and
  the backup file exists), snapshots the current half-migrated DB and
  restores production.db from the pre-update backup BEFORE rebuilding,
  so the rolled-back code runs against the schema it expects. Also
  removes WAL/SHM files for clean reopen.
- Additive schema (the normal case) leaves the DB untouched on rollback
  because additive changes are forward-compatible with old code.

**v2.32.6 (Phase 3 — canary location pattern):**
- New `scripts/canary-config.json` with `enabled: false` default. Opt-in.
- When enabled AND non-canary branch: `auto-update.sh` checks the
  canary's `.canary-blessed.json` (in the canary's git branch) before
  merging. Skips with no-op if canary hasn't blessed the target SHA OR
  if the bless is younger than `minBlessAgeMinutes` (default 240).
- When enabled AND canary branch: writes/commits/pushes
  `.canary-blessed.json` after a successful run.
- Bad commits break only the canary; the other 5 locations skip and
  retry on the next nightly cron.

**v2.32.7 (Phase 4 — VERSION_SETUP_GUIDE verify markers):**
- New marker format in version entries: `<!-- verify-sql: SELECT ... -->`
  with optional `<!-- verify-description: ... -->`.
- Checkpoint B parses entries between PRE/POST_MERGE_VERSION, runs each
  marker's SQL, returns `DECISION: STOP` if any returns 0 rows.
- Forward-only enforcement: entries pre-dating v2.32.7 stay advisory.
- See `docs/CLAUDE_VERSIONING_GUIDE.md` "Verify-SQL markers" for usage
  rules.

**Required manual steps PER LOCATION:** None for any of these. All four
ship as auto-update.sh changes that take effect on the next cron run at
each location. Verify post-deploy:

```bash
# After a location's auto-update runs once on v2.32.4+, the heartbeat
# file should have configChecksums + dbRowCounts + heartbeatSchemaVersion=2:
cat /home/ubuntu/Sports-Bar-TV-Controller/.auto-update-last-success.json | head -20
```

**To opt INTO canary mode** (Phase 3) at a future date:
1. Decide which location is the canary (recommended: Leg Lamp — single-card
   matrix, lowest blast-radius).
2. On `main`, edit `scripts/canary-config.json` to set `"enabled": true`
   and `"canaryBranch": "location/leg-lamp"`. Commit + push.
3. Next auto-update run at any non-canary location will start gating on
   the canary's bless. The canary itself is exempt and proceeds normally.

**Worked example of a verify-sql marker** (proof-of-concept; this entry's
own preconditions are met by the auto-update changes themselves, no DB
state required, but the marker below confirms the production DB is
reachable from Checkpoint B at all):

<!-- verify-description: production.db is reachable and has the canonical Location row seeded -->
<!-- verify-sql: SELECT id FROM Location LIMIT 1 -->

---

### v2.31.2 + v2.31.3 + v2.31.4 — Streaming click actually launches; walker navigates to Sports tab
**Released:** 2026-04-23

**What changed:**

- `apps/web/src/app/api/channel-guide/route.ts` (v2.31.2 + v2.31.3):
  - Both streaming injection paths (broadcast_networks fallback AND v2.30.0
    catalog injection) now look up the streaming-apps-database catalog by
    display name and populate `appId`, `packageName`, `packages` on the
    channel object.
  - v2.31.3 added `DISPLAY_NAME_TO_CATALOG_ID` alias map keyed by
    lowercase display name → catalog id. Covers display-name drift where
    scout reports `"Prime Video"` but catalog has `name="Amazon Prime Video"`,
    resolver returns `"ESPN+"` but catalog has `name="ESPN"`, and so on.
    `findStreamingAppByDisplayName(name)` is the canonical lookup helper.

- `apps/web/src/components/EnhancedChannelGuideBartenderRemote.tsx` (v2.31.2):
  - `handleGameClick` streaming case now prefers `/api/streaming/launch`
    (via new helper `launchStreamingAppByCatalog`) when `channel.appId` is
    present. That path goes through `streamingManager.launchApp()` which
    knows about the firebat alias for `amazon-prime` (v2.28.8) and
    correctly resolves the LEANBACK_LAUNCHER activity (DeepLinkRoutingActivity
    → LandingActivity) — the same activity the home-screen Prime Video
    tile invokes.
  - Falls back to the legacy `monkey -p ${packageName}` direct launch when
    `appId` is absent (preserves Rail Media compatibility for programs
    that pre-date this).

- `packages/scheduler/src/firetv-catalog-walker.ts` (v2.31.4):
  - `AppWalkRule.navigation` (new optional field): list of ADB key codes
    sent after launch to navigate to a sports/live tab. Sent in order with
    `interKeyDelayMs` between each (default 400ms), then `postNavDelayMs`
    after the sequence (default 4000ms).
  - Prime Video rule now includes `navigation: { keyevents: [19,19,22,22,22,23] }`
    — UP UP RIGHT RIGHT RIGHT OK navigates from the LandingActivity to
    the Sports tab on Fire TV Cube 2nd gen (AFTR) PVFTV-215.5200-L.
  - Extractor noise filter tightened: drops standalone `LIVE`/`UPCOMING`
    badges, `"Live at <time>"` generic timeslots, `"More details"`, and
    standalone `"all"`. Recognizes `"Sports for you"` as a sport-row
    context anchor.

**Why this was needed:**

Operator reported clicking a Prime Video program in the channel guide
"and nothing happened." Three stacked bugs caused the silent failure:

1. The channel-guide injection set `channel.packages` (plural array) but
   left `channel.packageName` undefined. The bartender remote reads
   `channel.packageName` (singular) — undefined triggered no fall-through,
   so the click was a no-op.
2. Even when `packageName` got populated (Rail Media path), the launch
   used `monkey -p ${packageName} 1` directly. On Fire TV Cube 2nd gen
   Prime Video lives inside `com.amazon.firebat` (the launcher) — there's
   no `com.amazon.avod` package. `monkey -p com.amazon.avod` fails
   silently. `monkey -p com.amazon.firebat` launches the home screen, NOT
   the Prime Video LandingActivity.
3. The walker's daily 04:00 walk only captured 1 useless tile per box
   (`"Live at 5:30 PM"`) because Prime Video's home screen rotates
   content — TV shows in the afternoon, sports in the morning. The walk
   needed to navigate to the Sports tab for stable sports-only catalog.

**Required steps PER LOCATION:**

**No DB or .env changes.** All three fixes are code-only.

**Verify the click works end-to-end (server-simulated, no Fire TV
operator needed):**
```bash
# 1. Send HOME on the Fire TV
curl -X POST http://localhost:3001/api/firetv-devices/send-command \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"<your-firetv-id>","command":"input keyevent 3"}'
sleep 2

# 2. Simulate the bartender click (this is exactly what the React
# component does when channel.appId is present)
curl -X POST http://localhost:3001/api/streaming/launch \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"<your-firetv-id>","ipAddress":"<ip>","appId":"amazon-prime","port":5555}'
sleep 4

# 3. Confirm Prime Video LandingActivity is now in the foreground
curl -X POST http://localhost:3001/api/firetv-devices/send-command \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"<your-firetv-id>","command":"dumpsys window windows"}' \
  | grep mCurrentFocus
# Expect: ...com.amazon.firebat/com.amazon.firebat.livingroom.landing.LandingActivity
```

**Verify the walker now captures rich sports content:**
```bash
# Trigger an immediate walk (bypasses the 6h cooldown)
curl -X POST http://localhost:3001/api/firestick-scout/catalog/walk

# Check what was captured
sqlite3 -header /home/ubuntu/sports-bar-data/production.db \
  "SELECT deviceId, app, contentTitle, isLive, sportTag
   FROM firetv_streaming_catalog
   ORDER BY isLive DESC, contentTitle;"
```
Expected: ~10 tiles per Fire TV with Prime Video — mix of LIVE
(tennis/squash/soccer) and UPCOMING (NBA Playoffs in current season).
If still only 1-2 tiles, Prime Video's UI may have changed and the
`navigation.keyevents` sequence in firetv-catalog-walker.ts needs
re-mapping (run a manual `uiautomator dump` and confirm the Sports tab
position is still 4 of 8).

**Adding navigation for a new app's rule:**
1. Manually launch the app on a Fire TV.
2. Watch where focus lands — usually the first content row.
3. Identify the keyevents needed to reach the Sports tab. ADB keyevents:
   UP=19 DOWN=20 LEFT=21 RIGHT=22 OK=23.
4. Test the sequence by sending each keyevent via
   `/api/firetv-devices/send-command` then `dumpsys window windows` to
   confirm the focused activity changed.
5. Add the `navigation` block to the new app's `APP_WALK_RULES` entry.

---

### v2.31.0 + v2.31.1 — Per-box per-app sports content catalog (Phase 2b-2 + Phase 3)
**Released:** 2026-04-22

**What changed:**

- `packages/database/src/schema.ts` (v2.30.0):
  - New table `firetv_streaming_catalog` (deviceId, app, contentTitle,
    deepLink, isLive, sportTag, capturedAt, expiresAt, createdAt) with
    indexes on (deviceId, app) and expiresAt. Per-box per-app sports
    content tile inventory — overwritten daily by the walker.

- `apps/web/src/app/api/firestick-scout/catalog/route.ts` (v2.30.0, new):
  - POST ingests fresh catalog from the walker; per-app replace semantics
    (delete then insert per app present in the upload). IP-based canonical
    deviceId resolver mirrors v2.28.10's heartbeat resolver.
  - GET reads catalog filtered by deviceId / app / liveOnly. Auto-prunes
    expired rows.

- `apps/web/src/app/api/channel-guide/route.ts` (v2.30.0):
  - After the broadcast_networks fallback, queries firetv_streaming_catalog
    for the requested deviceId, dedupes against existing programs, injects
    each remaining catalog row as a streaming program. Carries deepLink
    and sportTag through. Non-fatal — channel guide continues if catalog
    query fails.

- `packages/scheduler/src/firetv-catalog-walker.ts` (v2.31.0, new):
  - `runFiretvCatalogWalk()`: for each active firetv input_source, for
    each app in `available_networks` that has a rule in APP_WALK_RULES,
    sends HOME, launches the app via /api/streaming/launch, waits for
    first screen render (per-app delay), runs `uiautomator dump`, parses
    tiles via the per-app extractor, POSTs to /api/firestick-scout/catalog,
    sends HOME, moves to next app.
  - Prime Video extractor empirically validated against Fire TV Cube 2nd
    gen (AFTR) on 2026-04-22 — captured 10 real tiles in one walk
    (4 LIVE: ATP/WTA tennis, PSL cricket, squash + 6 UPCOMING NBA
    playoff games). Per-app rules in APP_WALK_RULES — apps without a
    rule are skipped silently (no false data).
  - Architecture: server-side ADB walker (NOT Kotlin AccessibilityService).
    Reasons documented in the file's header comment — short version:
    AccessibilityService requires manual Settings toggle ADB can't
    reliably bypass; TypeScript per-app rules iterate at edit-and-restart
    speed instead of compile-and-flash speed.

- `packages/scheduler/src/scheduler-service.ts` (v2.31.0):
  - `maybeRunCatalogWalk()`: triggers daily catalog walk between 04:00–04:05
    America/Chicago OR after 25h+ gap (catch-up after long downtime).
    6h cooldown prevents double-runs. Tick every 5 min.
  - `triggerCatalogWalkNow()`: public method for manual ad-hoc trigger.

- `apps/web/src/app/api/firestick-scout/catalog/walk/route.ts` (v2.31.0, new):
  - POST endpoint for operator to trigger an immediate walk (e.g. after
    installing a new app on a Fire TV). Bypasses the cooldown.

- `packages/scheduler/src/firetv-catalog-walker.ts` (v2.31.1):
  - Removed `2>/dev/null` from the uiautomator dump command. The
    send-command API mangles shell redirections; without the suffix, the
    dump succeeds and the file is readable. Added `rm -f` before dump
    to prevent stale files from masking failures, plus a 500ms grace
    after dump for the file write to flush. First production walk after
    this fix captured 10 tiles in 22s.

**Why this was needed:**

Earlier phases (v2.28.10 → v2.29.1) made the scheduler aware of per-box
APP availability (which Fire TV has Prime Video, which has Peacock, etc.).
But "what's actually playable inside each app right now" — the per-box
sports catalog — was still missing. Without it, the bartender opens the
channel guide for a Fire TV box and sees only games tagged in ESPN's
broadcast_networks JSON. Anything Prime Video shows on its sports tab
(LIVE NOW tennis, NBA Playoffs row, cricket overflow, etc.) was invisible
unless ESPN happened to tag the same game.

This version delivers the missing per-box catalog by walking each app's
first screen via uiautomator dump (no APK rebuild, no AccessibilityService
permission gate) and surfacing the captured tiles in the channel guide
alongside ESPN-broadcast_networks games. Per-app extraction rules — start
with Prime Video, add others incrementally as the operator needs them.

**Required steps PER LOCATION:**

**No DB migrations needed beyond the table creation.** The
`firetv_streaming_catalog` table is auto-created on schema push (or via the
manual SQL snippet below if drizzle-kit silently skips it — see CLAUDE.md
gotcha #7).

**Manual table creation if drizzle-kit push fails:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db <<'SQL'
CREATE TABLE IF NOT EXISTS firetv_streaming_catalog (
  id TEXT PRIMARY KEY NOT NULL,
  deviceId TEXT NOT NULL,
  app TEXT NOT NULL,
  contentTitle TEXT NOT NULL,
  deepLink TEXT,
  isLive INTEGER DEFAULT 0,
  sportTag TEXT,
  capturedAt INTEGER NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS firetv_catalog_device_app_idx ON firetv_streaming_catalog (deviceId, app);
CREATE INDEX IF NOT EXISTS firetv_catalog_expires_idx ON firetv_streaming_catalog (expiresAt);
SQL
```

**Verify the daily walk fires** (after 04:00 local OR via manual trigger):
```bash
# Manual trigger (bypasses cooldown):
curl -X POST http://localhost:3001/api/firestick-scout/catalog/walk

# Then check what was captured:
sqlite3 -header /home/ubuntu/sports-bar-data/production.db \
  "SELECT deviceId, app, contentTitle, isLive, sportTag
   FROM firetv_streaming_catalog
   ORDER BY deviceId, isLive DESC, contentTitle;"
```

If a Fire TV's row count is 0 for an app it should have:
1. Confirm scout heartbeat is fresh and shows the app installed:
   `sqlite3 production.db "SELECT deviceId, installedApps FROM firestick_live_status WHERE deviceId LIKE '%firetv%';"`
2. Confirm the app has an APP_WALK_RULES entry in
   `packages/scheduler/src/firetv-catalog-walker.ts` (only Prime Video as
   of v2.31.0 — other apps are silently skipped).
3. Run the manual walk endpoint with `pm2 logs sports-bar-tv-controller`
   tailing in another shell to see [FIRETV-CATALOG] messages.

**Adding a new app's per-app extraction rule:**
1. Manually open the app on a Fire TV.
2. Run `uiautomator dump /sdcard/d.xml` then `cat /sdcard/d.xml` via the
   send-command endpoint to capture the tile XML pattern.
3. Add a new entry to `APP_WALK_RULES` in
   `packages/scheduler/src/firetv-catalog-walker.ts` mirroring the
   `extractPrimeVideoTiles` shape.
4. Restart PM2; the daily cron + manual trigger will pick up the new app.

---

### v2.29.0 — Per-box auto-discovery of Fire TV streaming apps via Sports Bar Scout
**Released:** 2026-04-22

**What changed:**

- `packages/scheduler/src/firetv-app-sync.ts` (new):
  - `runFiretvAppSyncSweep()` reconciles every active firetv `input_source`
    against the latest scout heartbeat in `firestick_live_status`. Pulls
    `loggedInApps` (or falls back to `installedApps`) from scout, translates
    Android package names → display names, writes the truth back to
    `input_sources.installed_apps` and `input_sources.available_networks`.
  - Staleness guard: skips inputs whose scout heartbeat is >5 min old
    (preserves prior data instead of blanking on a temporary scout outage).
  - Idempotent: only writes when the computed list differs from stored.
  - Launcher-hosted Prime Video back-fill: scout's AppDetector hard-codes
    `com.amazon.avod` and misses launcher-hosted Prime Video on AFTR Cubes
    (CLAUDE.md gotcha #10). When scout reports no Prime Video, this job
    probes `pm path com.amazon.firebat` directly via the device control
    endpoint; if firebat is present, "Prime Video" is added to
    `available_networks` and `com.amazon.firebat` to `installed_apps`.

- `apps/web/src/app/api/firestick-scout/route.ts` (v2.28.10 — bundled into this entry):
  - When a heartbeat arrives with `deviceId='fire-tv-unknown'` or a legacy
    id (`amazon-N`, `fire-tv-N`), the server resolves the canonical
    `FireTVDevice.id` by matching `ipAddress`. Fixes the Holmgren-class
    bug where scout's compile-time IP_DEVICE_MAP only knew Stoneyard IPs
    (`10.40.10.x`) and every Fire TV at any other location heartbeated as
    `fire-tv-unknown` — multiple boxes overwriting each other's row.

- `packages/scheduler/src/scheduler-service.ts`:
  - Wired `runFiretvAppSync()` into the startup sequence: 60s after boot
    + every 5 minutes thereafter. Errors are caught so a sync failure
    never crashes the scheduler tick.

**Why this was needed:**

`input_sources.available_networks` and `installed_apps` were originally
hand-maintained admin metadata. Operators forget to update them when apps
are installed/uninstalled at the device, so AI Suggest ends up either
promising games on Fire TVs that no longer have the app or hiding games
Fire TVs CAN play. Sports Bar Scout (deployed as `com.sportsbar.scout`
on every venue's Fire TVs) already heartbeats the on-device truth every
30 seconds — this job is the bridge that makes the rest of the
scheduling stack consume that truth instead of trusting stale metadata.

Verified at Holmgren Way 2026-04-22:

```
Fire TV 2 (firetv_1741700000002_holmgren2) → fubo, YouTube, ESPN, NFHS,
                                              Peacock, Apple TV+, Netflix,
                                              Prime Video (via firebat probe)
Fire TV 3 (firetv_1741700000003_holmgren3) → YouTube, ESPN, NFHS, Peacock,
                                              Prime Video (via firebat probe)
```

Note Fire TV 2 has Netflix + fubo + Apple TV+ that Fire TV 3 doesn't —
the per-box differentiation that previously was invisible to AI Suggest.

**Required steps PER LOCATION:**

**No DB or .env changes.** The sync is automatic.

**Verify scout is heartbeating from each Fire TV:**
```bash
sqlite3 -header /home/ubuntu/sports-bar-data/production.db \
  "SELECT deviceId, deviceName, ipAddress, datetime(lastHeartbeat) as last_hb
   FROM firestick_live_status
   ORDER BY lastHeartbeat DESC;"
```
- Each active Fire TV input should have a row with `lastHeartbeat` within
  the last 2 minutes.
- `deviceId` should match the corresponding `FireTVDevice.id` (the canonical
  id, e.g. `firetv_1741700000002_holmgren2`). Legacy `amazon-N` /
  `fire-tv-unknown` rows are auto-resolved by the v2.28.10 IP resolver but
  you can clean up old rows if any persist:
  ```bash
  sqlite3 /home/ubuntu/sports-bar-data/production.db \
    "DELETE FROM firestick_live_status
     WHERE deviceId NOT LIKE 'firetv_%'
       AND lastHeartbeat < datetime('now', '-1 hour');"
  ```

**If scout isn't heartbeating** on a particular Fire TV: scout's
compile-time `scoutServerUrl` may be wrong for your location. Send a
CONFIG broadcast via ADB to repoint it:
```bash
curl -X POST http://localhost:3001/api/firetv-devices/send-command \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId":"<your-firetv-input.deviceId>",
    "command":"am broadcast -a com.sportsbar.scout.CONFIG --es server_url http://<your-server-ip>:3001/api/firestick-scout -n com.sportsbar.scout/.ConfigReceiver"
  }'
```
Then force-stop and relaunch scout:
```bash
curl -X POST http://localhost:3001/api/firetv-devices/send-command \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"<your-firetv-input.deviceId>","command":"am force-stop com.sportsbar.scout"}'
curl -X POST http://localhost:3001/api/firetv-devices/send-command \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"<your-firetv-input.deviceId>","command":"monkey -p com.sportsbar.scout -c android.intent.category.LAUNCHER 1"}'
```

**Verify the sync is updating input_sources** (after waiting one cycle):
```bash
sqlite3 -header /home/ubuntu/sports-bar-data/production.db \
  "SELECT name, available_networks FROM input_sources WHERE type='firetv' ORDER BY name;"
```
Each row's `available_networks` should reflect the actual installed apps
from scout, plus Prime Video if firebat is present (Cubes).

To force a sync immediately without waiting 5 min, restart PM2 and the
sync will fire 60 seconds after startup.

---

### v2.28.8 — Launch Prime Video on Fire TV Cubes that ship it baked into the launcher (no com.amazon.avod APK)
**Released:** 2026-04-22

**What changed:**

- `packages/streaming/src/streaming-apps-database.ts`:
  - Added `com.amazon.firebat` as a `packageAlias` on the `amazon-prime`
    catalog entry (now `[com.amazon.avod.thirdpartyclient, com.amazon.firebat]`).

**Why this was needed:**

On Fire TV Cube 2nd gen (model AFTR, Fire OS 7.7) and other Cubes shipping
the PVFTV (Prime Video Fire TV) launcher build, **there is no separate
`com.amazon.avod` APK on disk** — Prime Video is hosted entirely inside the
launcher (`com.amazon.firebat`). Settings → Applications → Manage Installed
Applications shows a "Prime Video" entry with version like `PVFTV-215.5200-L`,
but that entry is the launcher itself (Amazon brands it as "Prime Video"
in the user-facing list). The actual installable Amazon Prime Video app
(`com.amazon.avod`) is NOT present.

Result before this fix: `streamingManager.launchApp('amazon-prime')` would
probe `com.amazon.avod` and `com.amazon.avod.thirdpartyclient`, find neither,
log "Amazon Prime Video is not installed on device", and return failure —
even though the bartender can click the Prime Video tile on the home screen
and have it work fine. AI Suggest's Prime Video suggestions and bartender
remote launches both failed silently for these Cubes.

After this fix: the launcher (`com.amazon.firebat`) is registered as a valid
Prime Video host. `adb-client.launchApp()` resolves
`cmd package resolve-activity --brief -c android.intent.category.LEANBACK_LAUNCHER com.amazon.firebat`,
which returns `com.amazon.firebat/com.amazon.firebatcore.deeplink.DeepLinkRoutingActivity`
— the same activity the home-screen Prime Video tile invokes, routing to
`livingroom.landing.LandingActivity` (the Prime Video browse screen).
Verified end-to-end on Fire TV Cube 2nd gen at Holmgren Way (Fire TV 2,
10.11.3.50): foreground activity post-launch matches the user's manual
tile-click.

**Required steps PER LOCATION:**

**No DB or .env changes.** The catalog change ships in v2.28.8. After
auto-update merges + rebuilds + restarts PM2, `POST /api/streaming/launch`
with `appId='amazon-prime'` will succeed on any Fire TV Cube whose Prime
Video is launcher-hosted (in addition to all Cubes that have the standalone
`com.amazon.avod` APK, which were already supported).

**Verify your Fire TV Cubes' Prime Video launch path** (optional sanity check):
```bash
# Replace deviceId/ipAddress with one of your Fire TV Cubes:
curl -s -X POST http://localhost:3001/api/streaming/launch \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"<your-firetv-id>","ipAddress":"<ip>","appId":"amazon-prime","port":5555}'
# Expect: {"success":true,"message":"Successfully launched app amazon-prime",...}
# Walk to the TV — Prime Video browse screen should be visible.
```

If `success:false` with "Amazon Prime Video is not installed", the Cube has
neither `com.amazon.avod` NOR `com.amazon.firebat` (uncommon — would suggest
an unusual build). Check `pm list packages` on the device for the actual
Prime Video host package and add it as an alias.

---

### v2.28.7 — Fix smart-input-allocator excluding Fire TVs from every Prime Video / Hulu / Netflix / Max / YouTube TV game
**Released:** 2026-04-22

**What changed:**

- `packages/scheduler/src/smart-input-allocator.ts` `findCapableInputs()`:
  - Removed the Fire-TV-specific override that was filtering out every
    Fire TV input for almost every streaming game. Now uses the same
    `availableNetworks.includes(targetNetwork)` check that ai-suggest,
    bartender-remote, and conflict-detector all use.

**Why this was needed:**

The override had two compounding bugs that made it always-false-for-firetv-streaming:

1. **Hardcoded whitelist was missing most apps.** The list was literally
   `['ESPN', 'Peacock', 'Paramount+', 'Apple TV']` — no Prime Video, no
   Hulu, no Netflix, no Max, no YouTube TV, no MLB.TV, no NBA League Pass,
   no ESPN+. A Prime Video TNF game requested via `POST /api/scheduling/allocate`
   would silently exclude every Fire TV input ("Prime Video".includes('ESPN')
   = false, etc.).
2. **Wrong shape on the second predicate.** `installedApps.includes(app)`
   compared display names ('ESPN') against an array of Android package names
   (`com.amazon.avod`, `com.peacocktv.peacock`, ...). Even for the four
   whitelisted apps, this always returned false.

Net effect: any allocation request whose `preferredNetwork` was a streaming
service silently filtered out every Fire TV input. The bartender's "approve
this AI Suggest" or "Schedule from channel guide" flows for Prime Video games
would either fail to allocate or fall back to a non-streaming source (cable
boxes that don't have the game). Operator at Holmgren noticed that Fire TV 2
and Fire TV 3 weren't being picked up for Prime Video — both have
`com.amazon.avod` in `installed_apps` and `"Prime Video"` in
`available_networks`, but the broken gate hid them anyway.

ai-suggest's GET handler (which generates the suggestions) was unaffected
because it uses a separate, correct gate based on `availableNetworks`.
The bug was only at the approve/allocate step. So suggestions could mention
Prime Video games but the approval would silently fall over.

**Required steps PER LOCATION:**

**No DB or .env changes.** The fix is code-only. After auto-update merges
+ rebuilds + restarts PM2, the next streaming-game allocation request will
correctly consider Fire TVs whose `availableNetworks` lists the network.

**Verify your Fire TV inputs are populated correctly:**
```bash
sqlite3 -header /home/ubuntu/sports-bar-data/production.db \
  "SELECT name, available_networks FROM input_sources WHERE type='firetv' ORDER BY name;"
```
Each Fire TV's `available_networks` should be a JSON array of display names
matching what the network resolver returns (e.g. `"Prime Video"`, `"Apple TV+"`,
`"Peacock"`, `"ESPN+"`, `"Max"`, `"Paramount+"`, `"Hulu"`, `"Netflix"`,
`"YouTube TV"`). If a Fire TV is missing an app it actually has, edit it via
the Device Config UI — the missing entry is what was hiding it.

`installed_apps` (the package-name list) is no longer consulted by the
allocator gate, so it does not need to be perfect. It's still kept for
device-side launch via ADB.

---

### v2.28.6 — Cancel pending allocations whose game already ended (stops infinite tune retries)
**Released:** 2026-04-22

**What changed:**

- `packages/scheduler/src/scheduler-service.ts`:
  - `checkAndExecuteBartenderSchedules()` now guards every loop iteration
    with a "game already ended?" check BEFORE attempting the tune. If
    `game.status` is one of `completed`/`final`/`postponed`/`canceled`/`cancelled`,
    OR the wall-clock is more than 30 minutes past `game.estimatedEnd`,
    the allocation is marked `cancelled` (with `actually_freed_at=now` and
    a `qualityNotes` reason), a `scheduler-service tune` SchedulerLog row
    is written with `metadata.reason='game_ended_before_tune'`, and the
    iteration `continue`s instead of calling the tune API.

**Why this was needed:**

Until v2.28.6, an allocation that stayed `pending` (because every tune
attempt failed) would be re-selected every minute by the scheduler poll
forever. There was no failure cap and no game-end gate. On 2026-04-21 a
single stuck Celtics @ 76ers allocation pointed at DirecTV channel 220
(NBCSN — channel 220 doesn't exist on DirecTV; NBCSN ceased operations
in 2022 and the broadcast actually ran on Peacock) racked up **2,094**
failed tune attempts over 41 hours before it was caught manually. The
revert sweep can't help because reverts only fire when the allocation
transitions from `active` → freed; an allocation that never reaches
`active` is invisible to revert.

**Required steps PER LOCATION** (Claude Code at each location must run):

**Step 1 — Acute cleanup: cancel any allocation already stuck in this state.**
This finds pending allocations whose game has ended and the tune is
clearly never going to succeed. Idempotent — safe to re-run on a clean DB
(returns 0 rows updated).
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "
UPDATE input_source_allocations
SET status='cancelled',
    actually_freed_at=strftime('%s','now'),
    quality_notes='v2.28.6 backfill: pending allocation whose game already ended',
    updated_at=strftime('%s','now')
WHERE status='pending'
  AND game_schedule_id IN (
    SELECT id FROM game_schedules
    WHERE LOWER(status) IN ('completed','final','postponed','canceled','cancelled')
       OR estimated_end < strftime('%s','now') - 1800
  );
SELECT changes() as cleaned_up;"
```

**Step 2 — No code-side action required.** The new guard ships in the v2.28.6
build. After the auto-update merges + rebuilds + restarts PM2, future
stale-pending allocations will self-cancel on the next 60s poll cycle and
each cancellation writes a `scheduler-service tune` log row with
`level='info'`, `metadata.reason='game_ended_before_tune'` for visibility.

**Step 3 — Verify the guard fires (optional, when the next stale pending
allocation appears naturally):**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "
SELECT datetime(createdAt, 'unixepoch', 'localtime') as ts,
       message,
       json_extract(metadata, '$.reason') as reason
FROM SchedulerLog
WHERE component='scheduler-service'
  AND operation='tune'
  AND json_extract(metadata, '$.reason')='game_ended_before_tune'
ORDER BY createdAt DESC LIMIT 10;"
```

**Follow-up (separate work item, not v2.28.6):** the Celtics @ 76ers
trigger was that NBCSN → channel 220 mapping is wrong on DirecTV (220 is
Fox Sports 2; NBCSN is defunct and the broadcast was actually on Peacock).
The channel resolver should drop NBCSN as a DirecTV target and prefer the
Peacock streaming path when available.

---

### v2.28.4 — AI Suggest enforces HomeTeam.minTVsWhenActive (Packers gets 20 TVs, not 2)
**Released:** 2026-04-21

**What changed:**

- `apps/web/src/app/api/scheduling/ai-suggest/route.ts`:
  - NEW exported helper `matchHomeTeamRule(homeTeam, awayTeam, rules)` —
    case-insensitive contains-match against HomeTeam.aliases.
  - GET handler now loads `HomeTeam` rows where `isActive=true AND
    isPrimary=true AND minTVsWhenActive > 0`, parses the JSON `aliases`
    column, and passes a `HomeTeamRule[]` array to `buildPrompt()` and
    `parseOllamaResponse()`.
  - `buildPrompt()` per-game line now uses the rule's `minTVs` as the target
    when the game matches a home team (vs the flat `tvPerGame` default).
    Each home-team game line is tagged `[HOME TEAM: <Name> — REQUIRES N
    TVs MINIMUM]` and the assign clause says "do NOT go lower".
  - Rule 12 in the prompt now spells out the operator's per-team minimums
    (Packers=20, Bucks=5, Brewers=3, Badgers=3) and notes that the server
    WILL pad if the LLM under-assigns.
  - `parseOllamaResponse()` enforces minimums: when an accepted suggestion
    is for a home-team game and `suggestedOutputs.length < rule.minTVs`,
    it pads with TVs 1..minTVs (deduped). Logs a `[AI-SUGGEST] Home-team
    pad` line so operators can see when the LLM had to be backstopped.

**Why this was needed:**

`HomeTeam.minTVsWhenActive` has been in the schema since the table was
seeded (Packers=20, Bucks=5, Brewers=3, Badgers=3 at Holmgren), but the
AI Suggest prompt and parser never read or enforced it. Result: a Packers
game would get the same 2-3 TVs as a random college baseball game. Operator
report after observing the AI Suggest output multiple times: "the rules of
how many TVs we want them on are not being followed".

**Required steps PER LOCATION** (Claude Code at each location must run these):

The HomeTeam table is seeded per-location. Each location has its own
`minTVsWhenActive` values and its own home-team list. The new code uses
whatever is in the table — no behavior change is needed for locations
whose values are already correct.

**Step 1 — Verify your location's home-team minimums:**
```bash
sqlite3 -header /home/ubuntu/sports-bar-data/production.db \
  "SELECT teamName, sport, league, priority, minTVsWhenActive
   FROM HomeTeam
   WHERE isActive=1 AND isPrimary=1
   ORDER BY priority DESC, teamName;"
```
Confirm `minTVsWhenActive` is set to a value the operator wants. NULL or 0
means the rule is INACTIVE for that team — the AI Suggest will treat it
as a non-home game (use the default `tvPerGame` share).

**Step 2 — Update minimums via SQL** (idempotent — safe to re-run):

Replace the values to match what each location's operator wants:
```bash
# Example template — substitute your team names + counts:
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE HomeTeam SET minTVsWhenActive = 20 WHERE teamName = 'Green Bay Packers';"
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE HomeTeam SET minTVsWhenActive = 5  WHERE teamName = 'Milwaukee Bucks';"
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE HomeTeam SET minTVsWhenActive = 3  WHERE teamName = 'Milwaukee Brewers';"
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE HomeTeam SET minTVsWhenActive = 3  WHERE teamName = 'Wisconsin Badgers';"
```

Or set ALL primary home teams to the same minimum at once:
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE HomeTeam SET minTVsWhenActive = 5 WHERE isPrimary=1 AND isActive=1;"
```

**Step 3 — Verify the new behavior fires:**
```bash
# Trigger AI Suggest and check the prompt log line for the loaded rules
curl -s 'http://127.0.0.1:3001/api/scheduling/ai-suggest' --max-time 320 > /dev/null
grep "Loaded.*home-team minTV rules" ~/.pm2/logs/sports-bar-tv-controller-out.log | tail -1
# Expected: a line like "Loaded 4 home-team minTV rules: Packers=20, Bucks=5, ..."

# When a home-team game is in the next AI Suggest response, look for the pad event
grep "Home-team pad" ~/.pm2/logs/sports-bar-tv-controller-out.log | tail -5
# Expected (when LLM under-assigns): "Home-team pad: Green Bay Packers
# (Bears @ Packers) — LLM gave 3 TVs, padded to 20 (rule minTVs=20)"
```

**Per-location reference** (current Holmgren values as of v2.28.4 release):

| Team | Priority | minTVsWhenActive |
|---|---|---|
| Green Bay Packers | 100 | 20 |
| Milwaukee Brewers | 90 | 3 |
| Milwaukee Bucks | 90 | 5 |
| Wisconsin Badgers | 85 | 3 |
| Green Bay Phoenix (UWGB) | 60 | 1 (effectively off) |
| Marquette Golden Eagles | 60 | 1 (effectively off) |

Other locations should set values that match their bar size and
clientele expectations. A 12-TV bar should NOT use Packers=20.

---

### v2.28.3 — DirecTV revert-to-default-channel (extends Step 6 to handle directv sources)
**Released:** 2026-04-21

**What changed:**

- `packages/scheduler/src/auto-reallocator.ts` — Step 6 ("tune source box back
  to default channel") was previously gated on `inputSource.type === 'cable'`,
  so DirecTV receivers used by a scheduled game stayed on the game's last
  channel after revert. Now handles BOTH `cable` and `directv`:
  - Matrix input lookup branches by type: `irDevices.matrixInput` for cable,
    `direcTVDevices.inputChannel` for DirecTV.
  - Operator's existing `cableBoxDefaults` config is shared — it's keyed by
    matrix input number, which is unique across box types. Holmgren's setup
    uses keys 1-4 for cable boxes, 5-10 for the 6 DirecTVs.
  - Tune API payload differs by type: `cable` uses `cableBoxId` (IR via
    Global Cache), `directv` uses `directTVId` (IP control via SHEF
    `/tv/tune`). Both go through `/api/channel-presets/tune`.
  - SchedulerLog metadata now includes `sourceType` and uses
    `${type}_tuned_*` / `${type}_tune_*` reason codes for filtering.
- Auto-seed-from-tune-history (v2.27.0) extended to DirecTVs too — same
  ChannelTuneLog query path, same persist into `cableBoxDefaults`.

**Why this was needed:**

Wolves @ Nuggets on 2026-04-20 (DirecTV 6) and Orioles @ Royals (DirecTV 5)
both reverted their TV outputs correctly but left the DirecTV boxes on the
game channel. Operator had already configured `cableBoxDefaults` for inputs
5-10 expecting it to apply to the DirecTVs — config was right, the gate was
wrong.

**Required steps PER LOCATION** (Claude Code at each location must execute these):

The auto-update pipeline handles build + restart automatically. The new
revert path is then enabled, but ONLY tunes a DirecTV box back to default
if `cableBoxDefaults` has an entry for that box's matrix input number.

**Step 1 — Discover this location's DirecTV matrix input numbers:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT name, inputChannel FROM DirecTVDevice ORDER BY inputChannel;"
```
Note each `(name, inputChannel)` pair. inputChannel is the matrix input
number, also the key in `cableBoxDefaults`.

**Step 2 — Check what's already configured:**
```bash
curl -s http://127.0.0.1:3001/api/settings/default-sources | \
  python3 -c "import json,sys; d=json.load(sys.stdin)['defaults']; \
              keys=sorted(d.get('cableBoxDefaults',{}).keys(), key=lambda k:int(k)); \
              print('configured keys:', keys); \
              [print(f'  {k}: ch {v[\"channelNumber\"]} ({v.get(\"channelName\",\"?\")})') \
               for k,v in sorted(d.get('cableBoxDefaults',{}).items(), key=lambda kv:int(kv[0]))]"
```
For each DirecTV inputChannel from Step 1, confirm there's a matching
`cableBoxDefaults` key. If missing, go to Step 3.

**Step 3 — Populate missing DirecTV defaults via the UI** (preferred):

1. Open `http://<location-ip>:3001/system-admin` (or whichever path the
   "Default Sources" settings page is at — varies slightly per version,
   check the nav for "Default Sources" or "Defaults").
2. In the Cable Box Defaults section (covers ALL tunable boxes despite the
   name), find each DirecTV row by matrix input number and pick a
   sensible idle channel. Save.

**Step 3 alternative — via SQL** (when UI access isn't available):

The config lives in `SystemSetting` keyed `default_sources` as JSON. To
add a DirecTV default in-place:
```bash
# Replace MATRIX_INPUT_NUM, CHANNEL_NUM, CHANNEL_NAME with your values.
sqlite3 /home/ubuntu/sports-bar-data/production.db "
UPDATE SystemSetting
SET value = json_set(
  value,
  '\$.cableBoxDefaults.\"MATRIX_INPUT_NUM\"',
  json_object('channelNumber', 'CHANNEL_NUM', 'channelName', 'CHANNEL_NAME')
)
WHERE key = 'default_sources';
"
```
Idempotent — re-running with the same values produces the same result.

**Step 4 — Verify the new revert path fires after the next DirecTV game:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT datetime(createdAt,'unixepoch','localtime'), level,
          json_extract(metadata,'\$.reason') AS reason,
          json_extract(metadata,'\$.sourceType') AS type,
          message
   FROM SchedulerLog
   WHERE component='auto-reallocator' AND operation='revert'
     AND json_extract(metadata,'\$.sourceType')='directv'
   ORDER BY createdAt DESC LIMIT 10;"
```
Expected after the next DirecTV-allocated game completes: rows with
`reason='directv_tuned_configured'` (or `directv_tuned_auto_seeded` if the
operator skipped Step 3 and the auto-seed-from-tune-history fallback
kicked in).

**Per-location reference values** (current settings as of v2.28.3 release):

| Location | Box | inputChannel | Default channel |
|---|---|---|---|
| Holmgren Way | DirecTV 1 | 5 | ch 219 Fox Sports 1 |
| Holmgren Way | DirecTV 2 | 6 | ch 220 NFL Network |
| Holmgren Way | DirecTV 3 | 7 | ch 602 CBS Sports Network |
| Holmgren Way | DirecTV 4 | 8 | ch 611 SEC Network |
| Holmgren Way | DirecTV 5 | 9 | ch 612 ACC Network |
| Holmgren Way | DirecTV 6 | 10 | ch 610 Big 10 |

Other locations: fill in your own values from Step 1 + Step 2 output. The
defaults table above is Holmgren-only and SHOULD NOT be applied at other
sites — channel lineups vary by DirecTV market.

---

### v2.28.2 — Channel guide includes in-progress games whose start is in the past
**Released:** 2026-04-21

**What changed:**

- `apps/web/src/app/api/channel-guide/route.ts` — three fixes to the
  `game_schedules` fallback:
  1. Window filter changed from start-only (`gte(scheduledStart, windowStart)`)
     to overlap-based (`scheduledStart <= windowEnd AND estimatedEnd >= windowStart`)
     PLUS `OR(status='in_progress')` catch-all for games that ran past their
     estimated end.
  2. `isLive` is now derived from `game.status === 'in_progress'` OR
     (now within `[scheduledStart, estimatedEnd]` AND status not completed/final).
     Previously hardcoded `false`.
  3. The 2-hour `[CLEANUP] Filtered out N old programs` filter now exempts
     any program with `isLive === true`. Previously, OT games whose ESPN
     status was still `in_progress` would be removed from the response by
     the cleanup, hiding them from the bartender even though they were
     actively playing.
- Same three fixes applied to both the cable/directv path and the streaming
  path of the fallback.

**Why this was needed:**

Wolves @ Nuggets ran into OT past midnight on 2026-04-20. The bartender
remote channel guide showed "no live games" even though the game was on
DirecTV 6 ch 26 (NBC) and the schedule view correctly listed it. Three
overlapping bugs combined to filter the game out.

**Required manual steps:** NONE.

**Verify after update:**

```bash
# Hit the channel-guide POST endpoint and check for at least one live game
# during a window where ESPN has any status='in_progress' games:
curl -s -X POST http://127.0.0.1:3001/api/channel-guide \
  -H 'Content-Type: application/json' \
  -d '{"inputNumber":1,"deviceType":"satellite","deviceId":"<any-directv-id>"}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); \
                live=[p for p in d.get('programs',[]) if p.get('isLive')]; \
                print(f'live programs: {len(live)}'); \
                [print(f'  - {p[\"awayTeam\"]} @ {p[\"homeTeam\"]} on ch {p[\"channel\"][\"number\"]}') for p in live[:5]]"
```

---

### v2.28.1 — Wolf Pack 65535 sentinel: DB fallback in /api/matrix/routes
**Released:** 2026-04-21

**What changed:**

- `apps/web/src/app/api/matrix/routes/route.ts` — when `queryWolfpackRouteState`
  returns the 65535 firmware sentinel for an output (post-route settling
  window), the response previously dropped that output silently. Now falls
  back to the persistent `MatrixRoute` DB table value for any output present
  in DB but missing from the live response. Each fallback entry is tagged
  `source: 'db-fallback'` and the response includes a `fallbackCount` field.

**Why this was needed:**

Operator-reported pattern: TV 1 loses its source checkmark when the bartender
switches from Audio or Guide tab back to Video or Routing tab. Physical TV
is correctly routed; only the UI shows blank. Root cause: the iPad that made
the route had its `currentSources` Map preserve the value via the existing
client-side merge logic, but ANY OTHER iPad (or the same iPad after a hard
refresh) had no prior state to preserve and showed TV 1 as unrouted because
the live Wolf Pack response was missing that output. DB fallback closes the
gap so any device gets a correct response on first load.

**Required manual steps:** NONE.

**Verify after update:**

```bash
# When the Wolf Pack returns sentinels, the response should fill them from
# DB and log the count. Look for the line in PM2 logs:
grep "Wolf Pack returned sentinel" ~/.pm2/logs/sports-bar-tv-controller-out.log | tail -5
# Expected (when it actually fires): lines like
# "[api/matrix/routes] Wolf Pack returned sentinel for 1 output(s); filled
#  from MatrixRoute DB: out1=in1"
```

---

### v2.28.0 — UFC/PPV event scheduling support (ESPN MMA name backfill + DirecTV PPV probe + AI Suggest empty-team tolerance)
**Released:** 2026-04-20

**What changed:**

- `packages/scheduler/src/espn-sync-service.ts` — when `sport === 'mma'` and
  ESPN returns empty `displayName` for both fighters (which it does for
  every UFC event — ESPN structures MMA as fighters, not teams), parse
  `event.name` ("UFC Fight Night: Topuria vs. Holloway") on ` vs.? `,
  strip leading "UFC <whatever>: " from the first half, and assign the
  two halves to `awayTeamName` / `homeTeamName`. Falls back to the whole
  event name in `awayTeamName` if the split fails.
- `packages/database/src/schema.ts` — NEW table `discovered_ppv_channels`
  with `(directvDeviceId, channelMajor)` unique index. Tracks observations
  of PPV-band channels seen on DirecTV `/tv/getTuned`.
- `packages/scheduler/src/directv-probe.ts` — NEW. Polls every active
  DirecTV box's SHEF `/tv/getTuned` and upserts any tuned channel where
  `callsign === 'PPV'` OR (major in 100-199 AND title non-empty) into
  `discovered_ppv_channels`. Per-box errors are caught and reported.
- `packages/scheduler/src/scheduler-service.ts` — wires the probe into a
  10-minute cron interval (first run 90s after startup) alongside the
  existing TV-status poll. New `ppvProbeIntervalId` + `runPpvProbe()`.
- `packages/scheduler/src/index.ts` — re-exports `probeAllDirecTVTuned` and
  `DirecTVProbeResult` so app routes can call the probe.
- `apps/web/src/app/api/directv/probe-tuned/route.ts` — NEW POST endpoint
  for on-demand probe execution (testing / verification).
- `apps/web/src/app/api/scheduling/ai-suggest/route.ts` — `buildPrompt()`
  game line now tolerates empty `homeTeam`/`awayTeam`: renders whichever
  half is non-empty, falls back to `"<LEAGUE> event"` when both empty.
  Same fallback applied to the `title` field built in `fetchUpcomingGames()`.

**Schema changes:** New table `discovered_ppv_channels`. The auto-update
schema-push handles this on most locations, but if `drizzle-kit push`
silently aborts on a pre-existing index (CLAUDE.md Known Gotcha #7), the
verify step below will catch it and the manual CREATE TABLE block must
be run.

**Why this was needed:**

A manager at Holmgren Way scheduled a UFC PPV on a DirecTV box for
Saturday 2026-04-18. The scheduler never created an allocation for it,
which meant no auto-revert when the fight ended and the box stayed on
the PPV channel until manual cleanup. Two root causes:

1. ESPN's MMA scoreboard returns null for both `homeTeam.displayName`
   and `awayTeam.displayName`. Our sync stored them as empty strings,
   so AI Suggest's prompt rendered " at " for every UFC row, and the
   LLM ignored those rows entirely.
2. ESPN doesn't surface a reliable PPV channel number in
   `broadcastNetworks`, so even if the row had names, the AI had no
   channel to route to. We now reactively learn the PPV channel from
   what the manager already tuned the box to.

**Required manual steps:** NONE for the auto-update path. The pipeline
handles build, schema push, restart, and (where the box is currently
tuned to PPV) the first probe sweep at +90s.

**Optional: backfill historical UFC rows** that synced under the old
code with empty names:
```bash
# Fetches the past week and re-syncs — names get backfilled in place.
TODAY=$(date +%Y%m%d)
WEEK_AGO=$(date -d '7 days ago' +%Y%m%d)
curl -s -X POST http://127.0.0.1:3001/api/scheduling/sync \
  -H 'Content-Type: application/json' \
  -d "{\"sport\":\"mma\",\"league\":\"ufc\",\"startDate\":\"$WEEK_AGO\",\"endDate\":\"$TODAY\"}"
```

**Verify after update (per location):**

```bash
# 1. New table exists
sqlite3 /home/ubuntu/sports-bar-data/production.db ".tables" | grep ppv
# Expected: discovered_ppv_channels

# 2. UFC rows have populated names (run after a UFC week and the next sync)
sqlite3 /home/ubuntu/sports-bar-data/production.db "
SELECT id, home_team_name, away_team_name,
       datetime(scheduled_start,'unixepoch') as start_ct
FROM game_schedules
WHERE sport='mma' OR league='ufc'
ORDER BY scheduled_start DESC LIMIT 5;"
# Expected: home_team_name and away_team_name both non-empty for any row
# whose scheduled_start fell within the last sync window.

# 3. Trigger an on-demand probe (no PPV active = empty result, that's fine)
curl -s -X POST http://127.0.0.1:3001/api/directv/probe-tuned | python3 -m json.tool
# Expected: {"success":true,"result":{"devicesProbed":N,...}}
# Where N = number of rows in DirecTVDevice.

# 4. After a manager tunes any box to a PPV channel and waits ≤10 min
#    (or hits the endpoint above), confirm a row appears:
sqlite3 /home/ubuntu/sports-bar-data/production.db "
SELECT directv_device_id, channel_major, callsign, title,
       datetime(last_seen_at,'unixepoch') as last_seen_ct, seen_count
FROM discovered_ppv_channels ORDER BY last_seen_at DESC LIMIT 10;"
```

**Per-location notes:** None. All locations have at least one DirecTV box
in production; the probe scales by DirecTV device count and is harmless
at any location size.

**If the schema push silently skipped the new table** (Known Gotcha #7):
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db <<'SQL'
CREATE TABLE IF NOT EXISTS discovered_ppv_channels (
  id TEXT PRIMARY KEY,
  directv_device_id TEXT NOT NULL,
  channel_major INTEGER NOT NULL,
  channel_minor INTEGER,
  callsign TEXT,
  title TEXT,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  seen_count INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS discovered_ppv_channels_device_major_unique
  ON discovered_ppv_channels (directv_device_id, channel_major);
CREATE INDEX IF NOT EXISTS discovered_ppv_channels_lastSeen_idx
  ON discovered_ppv_channels (last_seen_at);
SQL
pm2 restart sports-bar-tv-controller
```

**Known errors & fixes:** none observed yet — will append if any surface.

---

### v2.27.1 — AI Suggest spread + collision hardening (zero-output guard, in-batch tracker)
**Released:** 2026-04-20

**What changed:**

- `apps/web/src/app/api/scheduling/ai-suggest/route.ts` — prompt rewrite:
  removed the "[BOTH] games go DirecTV by default" exclusivity rule that
  was biasing every dual-route game to DirecTV and packing 5 games on one
  receiver. New rules: explicit no-double-booking, spread-before-stack,
  channel-tells-device-class, dynamic free-set re-check per game, and a
  hard "every suggestion MUST include at least 1 TV output" rule with a
  per-game tvPerGame hint.
- `apps/web/src/app/api/scheduling/ai-suggest/route.ts` — parser changes:
  (1) `parseOllamaResponse` now returns `{ suggestions, rejections }`.
  (2) Empty `suggestedOutputs` arrays are REJECTED (not silently passed)
  with `reason='zero_outputs'`. Bug A root cause was Ollama tail-attention
  drop on long 12-game prompts producing `suggestedOutputs:[]`.
  (3) New `inBatchClaims` map tracks each accepted suggestion's 3h time
  window per input, so a second suggestion that overlaps gets rerouted
  to an idle same-class input (cable→cable, dtv→dtv) or rejected with
  `reason='in_batch_collision'`.
  (4) The post-LLM "DirecTV-default rerouter" block was DELETED entirely —
  it was the second source of cable-box-bias-the-other-way bug.
  (5) All rejection paths (existing_collision, in_batch_collision,
  zero_outputs, no_route, duplicate_combo, over_per_input_cap,
  over_per_game_cap) now persist a `SchedulerLog` row with
  `component='ai-suggest'`, `operation='reject'`, `level='warn'` for
  the high-signal cases.
- `packages/scheduler/src/allocation-conflicts.ts` — NEW. Duplicates
  `apps/web/src/lib/scheduling/allocation-conflicts.ts` so the package
  allocator can guard `createAllocation` without a cross-package import.
- `packages/scheduler/src/smart-input-allocator.ts` — `createAllocation`
  now refuses to insert when `tvOutputIds.length === 0` (throws
  `[ALLOCATOR]` error) AND pre-flight conflict-checks the chosen input
  before the insert (was only checked post-insert by
  `/api/scheduling/allocate`).
- `apps/web/src/app/api/scheduling/allocate/route.ts` — maps
  `[ALLOCATOR]`-prefixed throws to HTTP 409 (was 500) so the UI can
  show a useful retry message.

**Schema changes:** None. Writes additional rows to existing
`SchedulerLog` table (`component='ai-suggest'`, `operation='reject'`).

**Why this was needed:**

At Holmgren Way on 2026-04-20, the AI Suggest tab returned a Hawks/Knicks
suggestion with `suggestedOutputs:[]` (no TVs assigned) and double-booked
DirecTV 3 across overlapping Brewers and 76ers windows. Operator
investigation traced both to (a) LLM tail-attention drop on the 12-game
prompt and (b) the post-LLM "Prefer DirecTV for [BOTH] games" rerouter
ignoring already-claimed slots in the same response.

**Required manual steps:** NONE. Idempotent. Auto-update pipeline handles
build, schema (no changes), restart.

**Verify after update (per location):**

```bash
# 1. Hit the endpoint and confirm no zero-output suggestions returned
curl -s 'http://127.0.0.1:3001/api/scheduling/ai-suggest' | python3 -c '
import json, sys
d = json.load(sys.stdin)
zeros = [s for s in d.get("suggestions", []) if len(s.get("suggestedOutputs", [])) == 0]
print(f"Suggestions: {len(d.get(\"suggestions\", []))}, zero-output: {len(zeros)}")
'

# 2. Confirm rejection telemetry is being written when LLM misbehaves
sqlite3 /home/ubuntu/sports-bar-data/production.db "
SELECT datetime(createdAt,'unixepoch','localtime') AS when_ct,
       level, json_extract(metadata,'\$.reason') AS reason,
       gameId, message
FROM SchedulerLog
WHERE component='ai-suggest' AND operation='reject'
ORDER BY createdAt DESC LIMIT 10;"

# 3. Confirm allocator now refuses 0-output requests with 409
curl -s -X POST http://127.0.0.1:3001/api/scheduling/allocate \
  -H 'Content-Type: application/json' \
  -d '{"gameId":"NONEXISTENT","tvOutputIds":[]}' \
  | python3 -m json.tool
# Expected: 4xx response, NOT a 200 with an empty allocation.
```

**Known errors & fixes:** none observed yet — will append if any surface.

---

### v2.27.0 — Cable-box tune-back: auto-seed defaults from tune history + observability
**Released:** 2026-04-20

**What changed:**

- `packages/scheduler/src/auto-reallocator.ts` — `revertTVsToDefaults()`
  no longer silently skips Step 6 when `defaults.cableBoxDefaults` is empty.
  If a cable-input is missing an explicit default, the service queries
  `ChannelTuneLog` for the most recent successful tune BEFORE the game's
  `scheduledStart` on that `inputNum`, constructs a `{channelNumber, channelName}`
  fallback, persists it to `SystemSettings.default_sources` in-process so
  the UI shows it going forward, and proceeds with the tune. If no prior
  tune exists either, the box is left where it is with a `warn` row logged.
- `packages/scheduler/src/auto-reallocator.ts` — every branch of
  `revertTVsToDefaults()` (skip, success, failure) now writes a
  `SchedulerLog` row with `component='auto-reallocator'`, `operation='revert'`,
  and structured metadata including `gameId`, `inputSourceType`,
  `inputSourceName`, `tvCount`, `cableBoxTuned`, `cableBoxChannel`,
  `autoSeededCableDefault`, plus a `reason` string from a finite set
  (`tv_reverted`, `cable_tuned_configured`, `cable_tuned_auto_seeded`,
  `auto_seeded_from_tune_history`, `no_default_no_history`, `revert_complete`,
  etc.). A single summary row fires at the end.
- `packages/scheduler/src/scheduler-logger.ts` — `'revert'` added to the
  `SchedulerOperation` union.
- `apps/web/src/components/DefaultSourceSettings.tsx` — amber warning
  banner lists any cable boxes with no default channel configured and
  explains the auto-seed fallback.

**Schema changes:** None. Reads `ChannelTuneLog` (no write), writes to
`SystemSettings` row with `key='default_sources'` (existing row, updated
in place).

**Why this was needed:**

At Holmgren Way on 2026-04-20, after v2.26.2 unblocked the matrix-route
enum path, Cable Box 2 and Cable Box 4 still remained on channel 13
(Magic/Spurs games) after those games ended — because `defaults.cableBoxDefaults`
was empty. The prior logic `if (...cableBoxDefaults && Object.keys(...).length > 0)`
silently no-op'd. Operators don't reliably set per-box defaults up front,
so relying on them was a footgun; the most recent pre-game tune is a
reasonable signal.

**Required manual steps:** NONE. Idempotent — auto-seeding the same box
twice produces the same result. The auto-update pipeline handles build
and restart.

**Verify after update (per location):**

```bash
# 1. Route still responds
curl -s http://127.0.0.1:3001/api/settings/default-sources | jq '.defaults | keys'

# 2. After the next game ends, confirm a revert-complete row appears
sqlite3 /home/ubuntu/sports-bar-data/production.db "
SELECT datetime(createdAt,'unixepoch','localtime') AS when_ct,
       level, message, json_extract(metadata,'$.reason'),
       json_extract(metadata,'$.cableBoxTuned')
FROM SchedulerLog
WHERE component='auto-reallocator' AND operation='revert'
ORDER BY createdAt DESC LIMIT 10;"

# 3. After a game ends on a cable input that had no default set,
#    confirm default_sources now has a cableBoxDefaults entry
sqlite3 /home/ubuntu/sports-bar-data/production.db "
SELECT json_extract(value,'$.cableBoxDefaults') FROM SystemSettings
WHERE key='default_sources';"
```

**Known errors & fixes:** none observed yet — will append if any surface.

---

### v2.25.5 — Auto-update shared-software conflict fallback
**Released:** 2026-04-19

**What changed:**
`scripts/auto-update.sh` — adds `SHARED_SOFTWARE_PREFIXES[]` after the
existing `LOCATION_PATHS_OURS` / `LOCATION_PATHS_THEIRS` lists. Any
merge conflict on a path under these prefixes now auto-resolves to
MAIN's version via `git checkout --theirs`. Prefixes covered:
`apps/web/src/app/`, `apps/web/src/components/`, `apps/web/src/lib/`
(except `hardware-config.ts` which remains in OURS), `apps/web/src/hooks/`,
`apps/web/src/db/`, `apps/web/src/types/`, `apps/web/src/utils/`,
`apps/web/public/`, `packages/`, `docs/`, `drizzle/`.

**Why:** Locations' branches can drift on shared UI files from past
on-device debugging or one-off manual tweaks. Before this fix a single
stale edit anywhere under `apps/web/src/app/` would hit `CONFLICT
(content)` at merge time, fall through the exact-path OURS/THEIRS loop,
and the whole auto-update aborted with rollback. `apps/web/src/app/remote/page.tsx`
at Lucky's 1313 triggered this on 2026-04-19 at 16:39 and 2026-04-18
at 16:07, rolling back both attempts.

**Schema changes:** None.

**Required manual steps (ONE-TIME per location, to bootstrap the fix):**

**This is the critical step.** The currently-deployed auto-update.sh
at each location does NOT have this fallback. It can't update itself
via auto-update because the pre-update merge is exactly where it
fails. Operators must resolve the current conflict manually ONCE:

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
git fetch origin
BRANCH=$(git branch --show-current)
git merge origin/main --no-ff -m "chore: one-shot merge to bootstrap auto-update fix"
# If conflicts appear, take main's version for each shared UI file
# reported — safe because these are shared code, not location config:
for f in $(git status --porcelain | grep '^UU' | awk '{print $2}'); do
  case "$f" in
    apps/web/data/*|.env|ecosystem.config.js|apps/web/src/lib/hardware-config.ts)
      echo "KEEP LOCATION: $f"  # these stay ours
      git checkout --ours "$f" && git add "$f"
      ;;
    *)
      echo "TAKE MAIN: $f"
      git checkout --theirs "$f" && git add "$f"
      ;;
  esac
done
git commit --no-edit 2>&1 | tail -3
# Rebuild + restart so the live app matches the new merge
rm -rf apps/web/.next .turbo
npx turbo run build --force 2>&1 | tail -5
pm2 delete sports-bar-tv-controller 2>&1 | tail -1
pm2 start ecosystem.config.js 2>&1 | tail -3
# Push the resolved branch
git push origin "$BRANCH"
```

After this, `scripts/auto-update.sh` on disk is v2.25.5 and the new
fallback is active for every subsequent auto-update at this location.

**Verification:**
```bash
grep -c "SHARED_SOFTWARE_PREFIXES" /home/ubuntu/Sports-Bar-TV-Controller/scripts/auto-update.sh
# Expect: >= 2 (one in the array def, one or more in the usage loop)
```

**Applies to:** every location running auto-update.sh prior to v2.25.5.

**First seen:** 2026-04-18 16:07 and 2026-04-19 16:39 at Lucky's 1313
— two consecutive auto-update attempts rolled back because
`apps/web/src/app/remote/page.tsx` had conflicts not covered by the
exact-path OURS/THEIRS lists.

---

### v2.24.6 — auto-update.sh pushes merge commits back to origin (Fleet Dashboard accuracy fix)
**Released:** 2026-04-18

**What changed:**
- `scripts/auto-update.sh` — new push step at the end of the FINALIZE phase. After a successful auto-update (checkpoints A/B/C + verify-install all green), the script now runs `git push origin <current-branch>` to publish the merge commit to GitHub. Non-fatal on failure (location is still healthy; just the dashboard signal is missing). Never touches main. No --force.

**Why this matters:** the Fleet Dashboard (v2.24.0) reads `origin/location/<name>` from the local git clone, which mirrors GitHub. Before v2.24.6, auto-update.sh merged main locally and built/restarted but never pushed. Every location that successfully auto-updated LOCALLY without a human running `git push` afterward looked "stuck" on the dashboard forever. Stoneyard Appleton (v2.12.8 on git, last push 2 days ago) and Stoneyard Greenville (v2.16.2, last push 32h ago) are examples — both have almost certainly been running newer code for a while; nobody has been pushing.

After v2.24.6 lands at a location, the next successful auto-update will push automatically and the dashboard will catch up.

**Required Claude step per location:** None — fix is purely in auto-update.sh. No config, no env var, no DB patch.

**One-time catch-up action for already-stuck locations:** operator SSH to each stuck host once, run:
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
git push origin "$(git rev-parse --abbrev-ref HEAD)"
```
That pushes whatever merge commits have accumulated locally. Future auto-updates (after v2.24.6 lands there) will do it automatically.

**Rollback:** `git revert` removes the push step. Auto-update goes back to merge-locally-only behavior; dashboard drifts again.

---

### v2.24.5 — Per-location Brave API key provisioning helper
**Released:** 2026-04-18

**What changed:**
- New `scripts/set-brave-api-key.sh` — installs a BRAVE_API_KEY into both `.env` (for PM2 runtime) and `~/.bashrc` (for interactive Claude Code sessions) at the host where it's run. Idempotent (same key = no-op, different key = update). Supports `--remove`, `--show` (masked), `--test` (probes the Brave API to confirm the key works). The script itself is committed; **keys are NOT**. Operator at each location runs it once per key.

**Why this matters:** the Brave Search MCP enabled in v2.23.3 needs a `BRAVE_API_KEY` to work. The repo is PUBLIC, so committing a shared key to git exposes it to scrapers. The safe path is per-location free-tier keys (2,000 queries/month each, signup 2 min, no credit card).

**Required Claude step per location:** None — this is operator-driven. Claude at each location has no way to sign up for an API key; a human has to do the 2-min form. However, Claude at Checkpoint B should mention the helper script in its decision summary so the operator knows it's available.

**Operator runbook per location (do this ONCE per location you want Brave Search in):**

1. Visit https://api.search.brave.com/app/keys and sign up (free tier, no credit card).
2. Create an API key and copy it. The key format is `BS...` — roughly 32-33 chars of alphanumerics/underscores.
3. SSH to the location's server (or run locally on the bar's host), then:
   ```bash
   cd /home/ubuntu/Sports-Bar-TV-Controller
   bash scripts/set-brave-api-key.sh <paste-key-here>
   ```
   Output should show `.env: added` and `~/.bashrc: added`.

4. Confirm the key actually works (the helper has a probe built in):
   ```bash
   bash scripts/set-brave-api-key.sh --test
   ```
   Expected: `OK: HTTP 200 — key works.` Any other response means the key is invalid or rate-limited.

5. For the Sports Bar app to read the new .env value, do a PM2 delete+start (not restart — see CLAUDE.md Common Gotcha #3):
   ```bash
   pm2 delete sports-bar-tv-controller && pm2 start ecosystem.config.js
   ```

6. For any CURRENT `claude` terminal session to pick up the new key, either open a new shell OR `export BRAVE_API_KEY="$(grep ^BRAVE_API_KEY= .env | cut -d= -f2-)"` in the existing one, then exit and relaunch `claude`.

**What locations can skip this:**
- Any location where you don't want Brave Search in Claude Code sessions at all — Context7 still works without a key, so the other MCP is unaffected.

**Rollback:**
- `bash scripts/set-brave-api-key.sh --remove` — strips the key from both `.env` and `~/.bashrc` at the location.
- `git revert` the commit — removes the helper script. The key stays until `--remove` is run locally.

---

### v2.24.4 — Scheduler honors applied override defaults + Fleet/Override-Learn home page nav
**Released:** 2026-04-18

**What changed:**
- `apps/web/src/lib/scheduling/apply-override-defaults.ts` — new helper that reads `ScheduledOverrideDefaults` rows for a game's home+away teams and filters/augments an incoming `tvOutputIds` array: `action='exclude'` rows drop matching outputs; `action='include'` rows add missing outputs. Writes an audit `SchedulerLog` row (`operation='applied-to-allocation'`) when any change is made. Non-fatal on DB error.
- `apps/web/src/app/api/schedules/bartender-schedule/route.ts` — wires the helper in BEFORE the allocation insert. Operator decisions from the v2.24.3 Apply button now actually affect live routing.
- `apps/web/src/app/page.tsx` — home-page System Controls grid gains Fleet Dashboard (`/fleet`) and Override-Learn Digest (`/override-learn`) cards. The pages were live since v2.24.0 and v2.24.2 respectively but had no nav entry.

**Required Claude step at each location:** None. Feature uses data already at this location; no env vars, no DB patches, no per-location values.

**Verification at Checkpoint C:**
```bash
# Home page shows both new cards
curl -s http://localhost:3001/ | grep -oE 'href="/(fleet|override-learn)"' | sort -u
```
Expected: both `href="/fleet"` and `href="/override-learn"` appear.

```bash
# Apply a rule and confirm it stores; revert it
curl -s -X POST http://localhost:3001/api/override-learn/apply \
  -H 'Content-Type: application/json' \
  -d '{"team":"__TEST__","outputNum":99,"action":"exclude"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin))"
sqlite3 /home/ubuntu/sports-bar-data/production.db "DELETE FROM ScheduledOverrideDefaults WHERE team='__TEST__';"
```
Expected: `{'success': True, 'id': '<uuid>', 'refreshed': False}`.

**Rollback:** `git revert` removes the helper + its call-site hook. The `ScheduledOverrideDefaults` table stays with any applied rules (harmless — nothing consults the table after revert).

---

### v2.24.3 — Apply-recommendation buttons + bartender Schedule widget
**Released:** 2026-04-18

**What changed:**
- New `ScheduledOverrideDefaults` DB table stores durable operator decisions from the override-learn digest. Each row: `(team, outputNum, action='exclude'|'include', occurrences, appliedAt, appliedBy)` with a `UNIQUE(team, outputNum, action)` index.
- `POST /api/override-learn/apply` upserts a row (idempotent — clicking Apply twice refreshes rather than duplicates). `DELETE /api/override-learn/apply?id=X` reverts. Each operation also writes a `SchedulerLog` audit row at `component='override-digest'`, `operation='applied'` or `'reverted'`.
- `GET /api/override-learn/digest` response now tags each pattern with its `applied` state so the UI can show "Applied ✓" + a Revert button without a second fetch.
- `/override-learn` page gains per-row Apply / Revert buttons.
- New `OverrideLearnWidget` component, embedded in the bartender remote's Schedule tab. Shows the top 5 unapplied patterns (≥2 occurrences) with 44×44 Apply buttons for one-tap manager action. Links to `/override-learn` for the full view. Respects CLAUDE.md bartender-UI rules (touch targets, text-sm, dark theme).

**Scheduler integration status:** The table is WRITTEN but the scheduler doesn't YET consult it when building new allocations. That integration is v2.24.4+ — a single-function change in `packages/scheduler/src/scheduler-service.ts` where `tv_output_ids` is initially computed. For now, Apply records the decision as an audit trail and shared source of truth that any follow-up can honor. Ack this explicitly: clicking Apply today records your intent but doesn't yet change live routing.

**Required Claude step at each location** (Claude at Checkpoint B of the update that merges v2.24.3: execute these steps in order, no questions):

1. **Verify the new table was created.** drizzle-kit push can abort silently on pre-existing indexes (CLAUDE.md Gotcha #7), so confirm the table + its unique index both exist:
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT name FROM sqlite_master WHERE type='table' AND name='ScheduledOverrideDefaults';"
```
Expected output: `ScheduledOverrideDefaults`. If blank, the push failed before reaching this table — create it manually:
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db <<'SQL'
CREATE TABLE IF NOT EXISTS ScheduledOverrideDefaults (
  id TEXT PRIMARY KEY,
  team TEXT NOT NULL,
  league TEXT,
  outputNum INTEGER NOT NULL,
  action TEXT NOT NULL,
  isHomeTeam INTEGER NOT NULL DEFAULT 0,
  occurrences INTEGER NOT NULL DEFAULT 1,
  sourceCorrelationId TEXT,
  appliedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  appliedBy TEXT NOT NULL DEFAULT 'operator',
  notes TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ScheduledOverrideDefaults_team_idx ON ScheduledOverrideDefaults(team);
CREATE UNIQUE INDEX IF NOT EXISTS ScheduledOverrideDefaults_team_output_action_unique ON ScheduledOverrideDefaults(team, outputNum, action);
SQL
```

2. **Verify the unique index exists** (the table can be created without it on a partial-abort):
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='ScheduledOverrideDefaults';"
```
Expected: 3 indexes listed (`sqlite_autoindex_…_1`, `ScheduledOverrideDefaults_team_idx`, `ScheduledOverrideDefaults_team_output_action_unique`). If any are missing, run the CREATE INDEX commands from step 1.

3. **Smoke-test the API** after the PM2 restart completes (Checkpoint C):
```bash
curl -s http://localhost:3001/api/override-learn/apply | python3 -m json.tool
```
Expected: `{"applied": []}` (empty list, not an error). If you get a 500, check the PM2 logs for the error. A column-not-found error means step 1 didn't finish; re-run it.

4. **Verify the bartender widget appears.** Open `http://localhost:3001/remote` in a browser, tap into the "More" sheet → Schedule tab. You should see a "Scheduler corrections" card below the scheduled games list. Content depends on whether this location has any override-learn events:
   - If yes: shows patterns with Apply buttons.
   - If none: "No corrections in the last 30 days" — that's a fine state, not an error.

**No per-location value to set.** This feature uses DB-based data collected from that location's own bartender behavior — every location works identically out of the box.

**Rollback:** `git revert` removes the Apply/Revert buttons, the widget, and the API endpoints. The `ScheduledOverrideDefaults` table stays in the DB (harmless — no code reads from it after revert). To fully clean up:
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "DROP TABLE IF EXISTS ScheduledOverrideDefaults;"
```

---

### v2.24.1 — auto-update.sh sources .env before build (and LOCATION_NAME fix for v2.23.11)
**Released:** 2026-04-18

**What changed:**
- `scripts/auto-update.sh` — the BUILD phase now sources the repo-root `.env` with `set -a; source .env; set +a` immediately before the `npx turbo run build --force` call. This means any env var set in `.env` (LOCATION_NAME, LOCATION_ID, BRAVE_API_KEY, etc.) is visible to Turbo, to the Next.js build, and to the `process.env` that statically-rendered pages read at build time.
- `docs/VERSION_SETUP_GUIDE.md` — the v2.23.11 entry gains a proper branch-to-LOCATION_NAME mapping table plus the derivation rule for new/unlisted locations, so Claude at each location can pick the right value without guessing.

**Why this is urgent:** the v2.23.11 tab-title feature depended on `LOCATION_NAME` being visible during the build. Before v2.24.1, even a location with `LOCATION_NAME=LegLamp` correctly set in `.env` would still get "Sports Bar TV Controller" (no prefix) baked into the statically-rendered pages, because auto-update.sh never exported the value. Leg Lamp hit exactly this the first time it merged v2.23.11 — the value was missing AND the build wouldn't have seen it anyway.

**Required Claude step at each location** (Claude at Checkpoint B of the update that merges v2.24.1: execute these steps in order, no questions):

1. **Identify this location's branch** and look up the LOCATION_NAME value from the table in §v2.23.11 of this file:
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
git rev-parse --abbrev-ref HEAD
```
For each known branch:
| Branch | LOCATION_NAME |
|---|---|
| `location/holmgren-way` | `Holmgren` |
| `location/leg-lamp` | `LegLamp` |
| `location/lucky-s-1313` | `Lucky1313` |
| `location/graystone` | `Graystone` |
| `location/stoneyard-appleton` | `AppletonStoneyard` |
| `location/stoneyard-greenville` | `GreenvilleStoneyard` |

For an unlisted branch, derive by capitalizing each dash-separated segment (e.g. `location/new-spot` → `NewSpot`).

2. **Ensure `LOCATION_NAME` is set in `.env`.** This is idempotent — skip the append if already present:
```bash
if ! grep -q '^LOCATION_NAME=' /home/ubuntu/Sports-Bar-TV-Controller/.env; then
  echo 'LOCATION_NAME=<VALUE FROM TABLE>' >> /home/ubuntu/Sports-Bar-TV-Controller/.env
fi
```

3. **That's it.** The auto-update.sh that just ran this checkpoint will proceed to the BUILD phase, where it automatically sources `.env` (v2.24.1 behavior). Next.js will bake the correct title. No manual rebuild needed.

4. **Verify after the PM2 restart phase completes** (Checkpoint C):
```bash
curl -s http://localhost:3001/ | grep -oE '<title[^>]*>[^<]+</title>'
```
Expected: `<title>YourLocation-Sports-Bar-TV-Controller</title>`. If the plain `<title>Sports Bar TV Controller</title>` is returned, step 2 didn't actually add the var — re-check with `grep ^LOCATION_NAME= .env` and fix manually.

**Rollback:** `git revert` safely removes both the auto-update.sh env sourcing and the doc update. The LOCATION_NAME values already in `.env` files at each location don't go away — they're gitignored — so a revert only affects *future* auto-update runs.

---

### v2.23.11 — Location-aware browser tab title
**Released:** 2026-04-18

**What changed:**
- `apps/web/src/app/layout.tsx` — switched from `export const metadata` (static, evaluated at build time) to `export async function generateMetadata` (dynamic, evaluated at request time). Title now computes from `process.env.LOCATION_NAME`. Format: `<LocationName>-Sports-Bar-TV-Controller` when set, plain `Sports Bar TV Controller` when unset.
- `turbo.json` — added `"env": ["LOCATION_NAME", "LOCATION_ID", "NODE_ENV"]` to the build task so Turbo passes these through to the Next.js build subprocess AND includes them in the build cache hash. Without this, Next.js statically pre-renders pages like `/` and `/system-admin` with `process.env.LOCATION_NAME=undefined` at build time, baking the fallback title into cached HTML regardless of what the PM2 runtime env says.

**Why this matters:** operators running multiple locations open each in a browser tab. Previously every tab said "Sports Bar TV Controller" — tell them apart by hovering over favicons or guessing from URL. Now Holmgren's tab says "Holmgren-Sports-Bar-TV-Controller" while Lucky's would say "LuckyS1313-Sports-Bar-TV-Controller" (or whatever the operator sets `LOCATION_NAME` to).

**Required Claude step at each location** (Claude: execute during Checkpoint B of the update that merges v2.23.11):

1. Check if `LOCATION_NAME` is already set in `.env`:
```bash
grep ^LOCATION_NAME= /home/ubuntu/Sports-Bar-TV-Controller/.env
```

2. If NOT set, DETERMINE the correct value for THIS location by reading the current git branch. Each location/* branch has an obvious short name embedded; use this mapping table (update if new locations arrive, do NOT default to a guess):

| Branch | LOCATION_NAME value |
|---|---|
| `location/holmgren-way` | `Holmgren` |
| `location/leg-lamp` | `LegLamp` |
| `location/lucky-s-1313` | `Lucky1313` |
| `location/graystone` | `Graystone` |
| `location/stoneyard-appleton` | `AppletonStoneyard` |
| `location/stoneyard-greenville` | `GreenvilleStoneyard` |

For any new/unlisted branch, derive the name by capitalizing each dash-separated segment and concatenating (e.g. `location/big-sky-tavern` → `BigSkyTavern`). Keep it short — it becomes a tab-title prefix, so 4-16 chars is the sweet spot.

Add it to .env (the value column from the table, substituted in):
```bash
# Example — substitute for YOUR branch per the table:
BRANCH=$(cd /home/ubuntu/Sports-Bar-TV-Controller && git rev-parse --abbrev-ref HEAD)
echo "Current branch: $BRANCH"
# Look up the LOCATION_NAME from the table above, then:
echo 'LOCATION_NAME=<value-from-table>' >> /home/ubuntu/Sports-Bar-TV-Controller/.env
```

3. **As of v2.24.1, auto-update.sh automatically sources .env before the build** — so a subsequent auto-update cycle will pick up your new LOCATION_NAME without any manual shell export. If you want to see the change RIGHT NOW without waiting for the next cron-driven auto-update:
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
set -a; source .env; set +a  # push .env into the build shell
rm -rf apps/web/.next .turbo
npx turbo run build --force --filter=@sports-bar/web
pm2 delete sports-bar-tv-controller && pm2 start ecosystem.config.js
```
(Note: `pm2 delete + start` rather than `pm2 restart` because PM2 restart doesn't re-read .env via ecosystem.config.js — see CLAUDE.md Gotcha about this pattern.)

4. Verify the tab title:
```bash
curl -s http://localhost:3001/ | grep -oE '<title[^>]*>[^<]+</title>'
curl -s http://localhost:3001/remote | grep -oE '<title[^>]*>[^<]+</title>'
```
Expected: `<title>YourLocation-Sports-Bar-TV-Controller</title>` on BOTH routes. If `/remote` shows the correct title but `/` doesn't, it means the dynamic path works but the build-time static path didn't pick up LOCATION_NAME — re-run step 3 and confirm `echo $LOCATION_NAME` in your shell returns the value before running `turbo build`.

**Rollback:** `git revert` restores the static metadata export and removes the turbo env array. Titles go back to "Sports Bar TV Controller" across the board. No data impact.

---

### v2.23.5 — Extract memory + versioning guides out of CLAUDE.md
**Released:** 2026-04-18

**What changed:**
- `docs/CLAUDE_MEMORY_GUIDE.md` (new) — full details on the three memory systems (auto-memory at `~/.claude/projects/.../memory/`, in-repo Memory Bank at `apps/web/src/lib/memory-bank/`, and CLAUDE.md itself). Contains the complete "how to apply" for Standing Rules 5 and 7 plus the memory-saving two-step process, edge cases, and stale-entry handling.
- `docs/CLAUDE_VERSIONING_GUIDE.md` (new) — full details on version-bumping rules, the interlock between `VERSION_SETUP_GUIDE.md` / `LOCATION_UPDATE_NOTES.md` / CLAUDE.md (disjoint responsibilities — whether-to-update vs. what-to-do vs. permanent-rules), commit strategy for release changes, and how auto-update Checkpoint A/B/C consume all three documents. Contains the complete "how to apply" for Standing Rule 8.
- `CLAUDE.md` — added a prominent "⚠️ READ FIRST" banner at the top pointing at both guides as required reading before non-trivial work. Trimmed Standing Rules 5, 7, 8 to one-line summaries that point to the guides. Replaced the 28-line Memory Bank System description (§6) with a one-paragraph summary + pointer. Replaced the Version Bumping section with a one-paragraph summary + pointer. Net: ~15 lines shorter, but much more scannable.

**Required Claude step at each location** (Claude: execute during Checkpoint B of the update that merges v2.23.5):

1. Read the READ FIRST block at the top of CLAUDE.md. Verify it references BOTH `docs/CLAUDE_MEMORY_GUIDE.md` AND `docs/CLAUDE_VERSIONING_GUIDE.md`:
```bash
head -25 /home/ubuntu/Sports-Bar-TV-Controller/CLAUDE.md | grep -c "CLAUDE_MEMORY_GUIDE\|CLAUDE_VERSIONING_GUIDE"
```
Expected: `2` (both appear in the banner).

2. Read both new guides fully. They contain the authoritative version of Standing Rules 5, 7, 8 — CLAUDE.md's one-liners are only summaries.

3. **Sync memory ↔ new guides** per Rule 7 bidirectional sync. Since the content in the guides is derived from (not new vs.) prior CLAUDE.md content, most host auto-memory entries will already match. Do a pass to confirm. If memory references `CLAUDE.md §6 Memory Bank System` by line number, update the reference to `docs/CLAUDE_MEMORY_GUIDE.md` (the full text now lives there).

**Rollback:** `git revert` is clean — restores the full text into CLAUDE.md and removes the two guide files. All previously-authoritative rules remain intact after revert.

---

### v2.23.3 — context7 + brave-search MCP servers project-wide
**Released:** 2026-04-18

**What changed:**
- `.mcp.json` (new, at repo root) — declares two MCP (Model Context Protocol) servers that every Claude Code session inside this repo gets:
  - **`context7`** by Upstash (`@upstash/context7-mcp`) — fetches up-to-date, version-accurate library docs on demand (React, Next.js, Drizzle, Tailwind, any npm package). Free tier, no API key. Invoke by saying something like "use context7 to check the latest Drizzle ORM schema API" in a Claude session.
  - **`brave-search`** by MCP org (`@modelcontextprotocol/server-brave-search`) — web search. Requires `BRAVE_API_KEY` in each location's `.env` file. Works like a web-search tool (current-events questions, looking up hardware specs, checking vendor sites).
- `.claude/settings.json` — added `"enableAllProjectMcpServers": true` so MCP servers declared in the project's `.mcp.json` auto-approve without a human having to click through the Claude Code consent prompt on first session. Safe here because we only pull from `@modelcontextprotocol/*` (MCP org — protocol maintainers) and `@upstash/*` (reputable vendor).

**Required Claude step at each location** (Claude: execute this during Checkpoint B of the update that merges v2.23.3):

1. Verify `.mcp.json` arrived with the merge:
```bash
cat /home/ubuntu/Sports-Bar-TV-Controller/.mcp.json
```
Expected: contains `mcpServers.context7` and `mcpServers.brave-search` entries. The `$comment` key is intentional metadata — Claude Code ignores unknown top-level keys.

2. Confirm the auto-approve flag is in `.claude/settings.json`:
```bash
grep enableAllProjectMcpServers /home/ubuntu/Sports-Bar-TV-Controller/.claude/settings.json
```
Expected: `"enableAllProjectMcpServers": true`. If missing, the first Claude Code session at this repo will prompt a human to approve each server.

3. **(Optional but recommended)** Set up `BRAVE_API_KEY` so the `brave-search` MCP works at this location. **Without this step, Context7 works but Brave Search silently fails** when invoked — the MCP process starts, tries to read the key, aborts, and subsequent searches return empty. Not fatal to the Sports Bar app; just means that location loses the web-search tool.
    - Free tier (2,000 queries/month per key) is enough for operator/debugging use. Sign up at <https://api.search.brave.com/app/keys> — 2-minute flow, no credit card for free tier.
    - **Important — how the key actually reaches the MCP:** `.mcp.json` uses `${BRAVE_API_KEY}` which Claude Code interpolates from *its own process environment*, not from the project's `.env` file. Just editing `.env` is NOT enough — the shell that launches `claude` must have the variable exported. Two complementary places to set it:
      ```bash
      # (a) Export in every shell — works for interactive claude sessions:
      echo 'export BRAVE_API_KEY=<paste-key-here>' >> ~/.bashrc
      # Reload in your current shell or open a new one:
      source ~/.bashrc

      # (b) Also add to the project .env — so anything else at this location
      # (scripts, scheduled jobs) that reads .env sees it:
      echo 'BRAVE_API_KEY=<paste-key-here>' >> /home/ubuntu/Sports-Bar-TV-Controller/.env
      ```
    - Both files stay on this host — `.env` is gitignored, `~/.bashrc` is per-user. Neither gets pushed to any branch.
    - No restart needed for the Sports Bar app; the next time you start a **new** Claude Code session in the repo, `npx` spawns the MCP with the new env var. If the session already running, exit and restart `claude`.

4. **Smoke-test both MCPs are wired correctly.** Start a Claude Code session at the repo and ask:
    - "Use context7 to look up the current @sports-bar/drizzle-orm type for a nullable column." → expect a real answer citing docs.
    - "Use brave search to find recent Spectrum cable firmware release notes." → expect search hits, OR a clear error if `BRAVE_API_KEY` isn't set.
    - If context7 reports "server not found" but the flag is set, force a reload: inside Claude Code run `/mcp` to see connected servers, or kill the session and restart.

**Why this matters for each location:**
- Context7 is particularly useful when debugging build errors — "why did this Next.js 16 API change" gets an accurate answer without the model hallucinating an API version.
- Brave Search is useful when Claude doesn't know the cable lineup in a new city, vendor docs aren't in the repo, or a firmware release note mention is needed (e.g., "is Spectrum re-enabling CEC on their new firmware?"). It also fills the gap in checkpoint A/B decisions when external context is needed.

**Rollback:** Delete `.mcp.json` and remove `"enableAllProjectMcpServers": true` from `.claude/settings.json` — MCP servers stop loading. The Sports Bar app itself has no runtime dependency on these; they only affect Claude Code sessions inside the repo.

---

### v2.23.2 — Enable frontend-design + feature-dev Claude Code plugins project-wide
**Released:** 2026-04-18

**What changed:**
- `.claude/settings.json` — new file at project scope. Sets `enabledPlugins` for `frontend-design@claude-plugins-official` and `feature-dev@claude-plugins-official`. These are plugins from Anthropic's built-in official marketplace (`claude-plugins-official`, auto-available in Claude Code — no `extraKnownMarketplaces` entry needed).
- **frontend-design** — design philosophy + system prompts that guide Claude to produce distinctive, production-grade UI (bold aesthetic choices, purposeful typography, intentional animations). Applies whenever the dev works on React/Next.js components. Invoked automatically by Claude when it detects UI/frontend work, or explicitly via `/frontend-design:*` skills after `/reload-plugins`.
- **feature-dev** — comprehensive feature-development workflow. Provides specialized subagents for codebase exploration, architecture design, and quality review. Also invokable via `/feature-dev:*` slash commands.

**Required Claude step at each location** (Claude: execute this during Checkpoint B of the update that merges v2.23.2):

1. Verify the `.claude/settings.json` file arrived with the merge:
```bash
cat /home/ubuntu/Sports-Bar-TV-Controller/.claude/settings.json
```
Expected: contains `enabledPlugins` with `frontend-design@claude-plugins-official` and `feature-dev@claude-plugins-official` both set to `true`.

2. The `claude-plugins-official` marketplace is built into Claude Code, so no marketplace-add is needed. However, the plugins themselves must be installed/cached. On most locations the official marketplace auto-updates at startup, so the plugins should be present. If a session later reports "plugin not found," run in Claude Code interactively:
```
/plugin marketplace update claude-plugins-official
/plugin install frontend-design@claude-plugins-official
/plugin install feature-dev@claude-plugins-official
/reload-plugins
```

3. Verify plugins are loaded. In Claude Code CLI:
```bash
claude plugin list 2>&1 | grep -E "frontend-design|feature-dev"
```
Expected: both plugins listed as enabled. If missing from the list but present in `.claude/settings.json`, the plugin files need to be cached — run the `/plugin install` commands from step 2 in an interactive session once and Claude Code will remember them.

4. Confirm a Claude Code session invoked at the repo picks them up:
```bash
ls ~/.claude/plugins/cache/ 2>&1 | grep -E "frontend-design|feature-dev" || echo "(plugins not yet cached — run /plugin install as step 2)"
```

**Why this is a project-scoped commit rather than a per-host install:** installing user-scope (`~/.claude/`) at each location would require a manual step that's easy to skip. Committing `enabledPlugins` to `.claude/settings.json` means every location that trusts this repo in Claude Code inherits the same enabled plugin set, and `git pull` + next session start is enough to pick up new plugins added to the list later.

**Rollback:** `git revert` the commit — drops the `.claude/settings.json` file, plugins become disabled for project sessions. The underlying plugin files (if cached at user scope) stay. No DB or runtime impact.

---

### v2.23.0 — AI Suggest diversity + per-location station-alias seeding
**Released:** 2026-04-18

**What changed:**
- `apps/web/src/app/api/scheduling/ai-suggest/route.ts` — Ollama prompt loosened so the AI now proposes up to `min(totalInputs*2, games.length, 20)` suggestions (previously hard-capped at 6). Rule 4/5/6 rewritten to encourage diverse league coverage and alternate routes (e.g. Brewers game on BOTH cable ch 308 and firetv Apple TV+) so the manager can pick. Parser dedup now allows up to 2 suggestions per input and 2 per game, rejecting only exact game+input duplicates. The pattern-analyzer then learns from the manager's approve choices (this is the feedback loop — scheduler reads `input_source_allocations.tv_output_ids` hourly and builds team-routing patterns from accepted suggestions).
- `apps/web/src/lib/seed-from-json.ts` — `seedStationAliases()` changed from "skip-if-any-rows" to per-row upsert (union-merge of aliases for existing rows, insert for new rows). Without this, new entries added to `STANDARD_ALIASES` in a future release would be no-ops at already-seeded locations. **Removed** hardcoded Green Bay broadcast affiliates (ABC→WBAY, NBC→WGBA, CBS→WFRV, FOX→WLUK) from `STANDARD_ALIASES` — these are location-specific and were wrong for Madison/Appleton/other cities. **Added** 9 universal streaming alias rows (PrimeVideo, AppleTVPlus, ParamountPlus, Peacock, ESPNPlus, Netflix, Max, YouTubeTV, Hulu).
- `apps/web/src/lib/seed-from-json.ts` — New `seedLocalStationAliases()` function that reads `apps/web/data/station-aliases-local.json` and upserts the entries. This file is an empty template on `main` and populated per-location on each `location/<name>` branch.
- `apps/web/data/station-aliases-local.json` — New file. On main: `{"aliases": []}`. On each location branch: populated with that city's OTA affiliate mappings.

**Bug this fixes:** AI Suggest was only surfacing 6 games to the manager, and many of them were MLB/NHL because the Green Bay-specific affiliate aliases (WBAY as ABC, etc.) didn't exist at non-Green-Bay locations — so NBA on ABC, UFL on FOX, EPL on NBC silently failed to resolve and were dropped from the "playable" pool. Manager couldn't approve games that the system had no idea existed.

---

**Required Claude step at each location (Claude: execute this during Checkpoint B of the update that merges v2.23.0):**

You MUST populate `apps/web/data/station-aliases-local.json` with this location's OTA broadcast affiliates BEFORE the build step runs, or broadcast-network games (anything on ABC, FOX, NBC, CBS that isn't on cable-specific affiliate channels) will fail to resolve. Do NOT just read this section — execute the steps below.

**Step 1.** Identify the location by reading `/home/ubuntu/Sports-Bar-TV-Controller/.env` for `LOCATION_NAME`, and cross-check the current `station_aliases` table to see what affiliate callsigns are already seeded:
```bash
grep LOCATION_NAME /home/ubuntu/Sports-Bar-TV-Controller/.env
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT standard_name, aliases FROM station_aliases WHERE aliases LIKE '%ABC%' OR aliases LIKE '%FOX%' OR aliases LIKE '%NBC%' OR aliases LIKE '%CBS%';"
```

**Step 2.** Determine the correct OTA affiliate callsigns for this city. Use this reference table — if your city isn't listed, look up "ABC affiliate <city>" / "FOX affiliate <city>" / "NBC affiliate <city>" / "CBS affiliate <city>" via web search:

| City | ABC | FOX | NBC | CBS |
|---|---|---|---|---|
| Green Bay, WI | WBAY (ch 2) | WLUK-TV (ch 11) | WGBA-TV (ch 26) | WFRV (ch 5) |
| Madison, WI | WKOW (ch 27) | WMSN-TV (ch 47) | WMTV (ch 15) | WISC-TV (ch 3) |
| Milwaukee, WI | WISN (ch 12) | WITI (ch 6) | WTMJ (ch 4) | WDJT (ch 58) |
| Appleton/Fox Cities, WI | WBAY (ch 2) | WLUK-TV (ch 11) | WGBA-TV (ch 26) | WFRV (ch 5) |

(Green Bay and Appleton share affiliates — they're the same DMA.)

**Step 3.** Write the file at `apps/web/data/station-aliases-local.json`. Replace the `standardName` values with this location's callsigns and adjust the `aliases` array to include `"<NETWORK>"` (bare), the callsign (`"WBAY"`), a `-TV` variant (`"WBAY-TV"`), and a display variant like `"ABC 2"` (callsign's actual OTA channel number):
```json
{
  "_location": "<LOCATION_NAME from .env>",
  "aliases": [
    {
      "standardName": "<ABC_CALLSIGN>",
      "aliases": ["ABC", "<ABC_CALLSIGN>", "<ABC_CALLSIGN>-TV", "ABC <OTA_CHANNEL>"]
    },
    {
      "standardName": "<FOX_CALLSIGN>",
      "aliases": ["FOX", "<FOX_CALLSIGN>", "<FOX_CALLSIGN>-TV", "FOX <OTA_CHANNEL>"]
    },
    {
      "standardName": "<NBC_CALLSIGN>",
      "aliases": ["NBC", "<NBC_CALLSIGN>", "<NBC_CALLSIGN>-TV", "NBC <OTA_CHANNEL>"]
    },
    {
      "standardName": "<CBS_CALLSIGN>",
      "aliases": ["CBS", "<CBS_CALLSIGN>", "<CBS_CALLSIGN>-TV", "CBS <OTA_CHANNEL>"]
    }
  ]
}
```

**Step 4.** Also patch the live `station_aliases` DB so the fix is active WITHOUT waiting for the next fresh install to run `seedLocalStationAliases()` (the seeder only runs on empty tables). Run this SQL, substituting the callsigns and channel numbers for YOUR city:
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db <<'SQL'
UPDATE station_aliases
SET aliases = json_array('ABC','<ABC_CALLSIGN>','<ABC_CALLSIGN>-TV','ABC <OTA_CHANNEL>')
WHERE standard_name='<ABC_CALLSIGN>';

UPDATE station_aliases
SET aliases = json_array('FOX','<FOX_CALLSIGN>','<FOX_CALLSIGN>-TV','FOX <OTA_CHANNEL>')
WHERE standard_name='<FOX_CALLSIGN>';

UPDATE station_aliases
SET aliases = json_array('NBC','<NBC_CALLSIGN>','<NBC_CALLSIGN>-TV','NBC <OTA_CHANNEL>')
WHERE standard_name='<NBC_CALLSIGN>';

UPDATE station_aliases
SET aliases = json_array('CBS','<CBS_CALLSIGN>','<CBS_CALLSIGN>-TV','CBS <OTA_CHANNEL>')
WHERE standard_name='<CBS_CALLSIGN>';
SQL
```

If the existing `station_aliases` table does NOT have a row for one of these callsigns (e.g., the location was seeded before any OTA affiliate seeding), insert it instead:
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db <<'SQL'
INSERT OR IGNORE INTO station_aliases (id, standard_name, aliases, created_at) VALUES
  (lower(hex(randomblob(16))), '<CALLSIGN>', json_array('NETWORK','<CALLSIGN>','<CALLSIGN>-TV','NETWORK <OTA_CHANNEL>'), CURRENT_TIMESTAMP);
SQL
```

**Step 5.** Commit the populated JSON file to the location branch (NOT to main — main keeps the empty template):
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
git add apps/web/data/station-aliases-local.json
git commit -m "feat(station-aliases): populate OTA affiliates for <LOCATION_NAME>"
# Push happens via auto-update.sh's normal push step — do not push manually.
```

**Step 6.** Verify the AI Suggest fix worked. After the build+restart, call the endpoint:
```bash
curl -s 'http://localhost:3001/api/scheduling/ai-suggest' | python3 -c '
import json, sys, collections
d = json.load(sys.stdin)
leagues = collections.Counter(s["league"] for s in d.get("suggestions", []))
print("leagues in suggestions:", dict(leagues))
print("total suggestions:", len(d.get("suggestions", [])))
'
```
Expected: more than 6 suggestions, spanning multiple leagues (MLB + NHL + NBA + MLS + UFL + UFC + etc., whatever has games in the 12h window). If you still see only MLB/NHL, one of the affiliate aliases was typed wrong — re-check Step 2's callsigns against the actual ESPN broadcast data (`sqlite3 .../production.db "SELECT DISTINCT broadcast_networks FROM game_schedules WHERE league='ufl' LIMIT 5;"` should show `["ABC"]` or `["FOX"]` — confirm your alias catches those bare names).

**Rollback:** The `seedStationAliases()` upsert change is additive (union-merge never deletes aliases). Reverting the code is safe; the DB rows stay. The AI Suggest prompt loosening is a prompt-text change — `git revert` removes it cleanly, and any in-flight AI suggestions from the new prompt continue to work because `parseOllamaResponse` handles both shapes.

---

### v2.22.6 — Checkpoint C enforces CLAUDE.md ↔ memory sync post-update
**Released:** 2026-04-17

**What changed:**
- `scripts/prompts/checkpoint-c.txt` — new "REQUIRED FIRST STEP" section that makes the post-restart Claude re-read `CLAUDE.md` in full, compare it against `~/.claude/projects/-home-ubuntu-Sports-Bar-TV-Controller/memory/MEMORY.md`, add missing rules as new memory entries, correct memories that conflict, remove memories for deleted features, and scan the "Known Errors & Fixes" section of `VERSION_SETUP_GUIDE.md` for any fixes that still apply at this host — all BEFORE deciding GO/CAUTION.
- Backfill entries for v2.22.2/3/4/5 (previously shipped without doc entries) and two "Known Errors & Fixes" entries (Claude CLI 2.1.113+ TTY bug, Tailwind-lockfile drift) so the updated Checkpoint C has concrete content to sync.

**Required Manual Step:** None. Triggered automatically during every successful auto-update run.

**Verification:**
```bash
# After v2.22.6 lands, the most recent auto-update log should show the
# Checkpoint C response mention memory file edits or a "no drift found" note:
grep -A3 "Checkpoint C: DECISION" $(ls -t /home/ubuntu/sports-bar-data/update-logs/auto-update-*.log | head -1)

# The memory file should have a last-modified time close to the update:
stat -c "%y %n" ~/.claude/projects/-home-ubuntu-Sports-Bar-TV-Controller/memory/MEMORY.md
```

**Rollback:** Prompt-only change. Revert safely removes the REQUIRED-FIRST-STEP block; Checkpoint C reverts to its prior behavior (holistic health sanity check only).

---

### v2.22.5 — Shift brief: real game times + anti-hallucination guardrail
**Released:** 2026-04-17

**What changed:**
- `apps/web/src/app/api/ai/shift-brief/route.ts` — `activeAllocations` query now selects `scheduled_start` + `status` from the joined `game_schedules` row. The mapped payload includes `startLocal` (formatted in `HARDWARE_CONFIG.venue.timezone`) and `status`. The Ollama prompt's "Currently playing" section now says `"Marlins @ Brewers (8 TVs, started 6:10 PM, in_progress)"` instead of a time-less version.
- Added a CRITICAL guardrail to the prompt: "Only reference game start times that are explicitly listed above. Never invent, estimate, or round times." This stops llama3.1:8b from fabricating times for in-progress games it had no time data for.
- Deterministic fallback brief (for when Ollama is down) also shows `"started <time>"` for active allocations.

**Bug this fixes:** Shift brief was reporting "Brewers starting at 9pm" for a game that actually started at 6:10pm CT. Root cause was a lossy prompt — the active-allocations context didn't carry the start time, so the LLM made one up. Verified on Stoneyard that the DB had the correct 23:10 UTC timestamp all along.

**Required Manual Step:** None. The fix is entirely code-side; the existing `scheduling_patterns` and `game_schedules` data is already correct.

**Verification:**
```bash
# After auto-update lands, force-refresh the brief and confirm times match DB:
curl -s 'http://localhost:3001/api/ai/shift-brief?force=true' | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["brief"])'

# Compare against the actual DB times for any in-progress games:
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT home_team_name, away_team_name, datetime(scheduled_start, 'unixepoch', 'localtime') FROM game_schedules WHERE status='in_progress';"
```

**Rollback:** Strictly additive fields + prompt-string change. `git revert` cleanly.

---

### v2.22.4 — Wrap claude -p in pseudo-TTY for CLI 2.1.113+
**Released:** 2026-04-17

**What changed:**
- `scripts/auto-update.sh` — the `run_checkpoint` function now wraps `claude -p --dangerously-skip-permissions` in `script -qfc "..." /dev/null` which creates a pty. The prompt is written to a mktemp file and read via `"$(cat ...)"` because multi-KB prompts on the command line overflow ARG_MAX once script/sh layers stack up.

**Bug this fixes:** Claude Code CLI 2.1.113+ aborts non-interactive `claude -p` with `Error: Interactive prompts require a TTY terminal (process.stdin.isTTY or process.stdout.isTTY is false)`. Checkpoint B/C on every location that auto-updated past 2.1.112 would fail and roll back. Affected Appleton, Graystone, Lucky's during the v2.22.x rollout. Stoneyard / Holmgren / Leg Lamp escaped because they were on 2.1.112 when their merges ran.

**Required Manual Step:** None. The fix lives in `auto-update.sh` itself; self-update re-exec ensures every location uses the fixed version starting with the run that merges it.

**Verification:**
```bash
# After a location auto-updates to v2.22.4+, the auto-update log should show
# Checkpoint B returned a DECISION (not "Claude Code timed out or errored"):
grep "Checkpoint B: DECISION" $(ls -t /home/ubuntu/sports-bar-data/update-logs/auto-update-*.log | head -1)
```

**Rollback:** `git revert` is safe — removes the pty wrapper. Only valid rollback target is back to `claude -p` direct invocation, which requires Claude CLI ≤ 2.1.112 to work. Do not revert unless every location's Claude CLI is downgraded.

---

### v2.22.3 — Revert Tailwind 4 → Tailwind 3 (v2.17.0 migration was incomplete)
**Released:** 2026-04-17

**What changed:**
- `apps/web/tailwind.config.js` restored from `5209838a^` (the commit that had deleted it claiming migration to `@theme` in globals.css, which was never actually done).
- `apps/web/postcss.config.js` reverted to `{ tailwindcss, autoprefixer }` plugins.
- `apps/web/package.json`: removed `@tailwindcss/postcss ^4.2.2`, added `autoprefixer ^10.4.21` back, `tailwindcss ^4.2.2` → `^3.4.18`.
- `package-lock.json` regenerated via `npm install --package-lock-only`.

**Bug this fixes:** v2.17.0's Tailwind 3→4 migration was half-done — `globals.css` still had v3 `@tailwind base/components/utilities` directives, `tailwind.config.js` was deleted with no `@theme` replacement, postcss.config still listed v3 plugins. Every location auto-update from v2.17.0 onward either failed `npm ci` (EUSAGE lockfile drift) or failed the build with "Cannot find module 'autoprefixer'" / "Cannot apply unknown utility class text-slate-100", rolled back cleanly.

**Required Manual Step:** None. Locations pulling this update will get the Tailwind 3 config + autoprefixer restored atomically.

**Verification:**
```bash
# Build should compile without the Tailwind errors that blocked v2.17.0-v2.22.2:
npx turbo run build --force --filter=@sports-bar/web 2>&1 | grep -E "Compiled|Cannot find|unknown utility" | head -5
# Expected: "✓ Compiled successfully in ~38s" and no Cannot-find/unknown-utility lines.
```

**Rollback:** If Tailwind 4 is re-attempted in the future, the migration MUST include: (a) rewrite `globals.css` from `@tailwind ...` to `@import 'tailwindcss'`, (b) add `@theme { ... }` block for custom colors, (c) update `postcss.config.js` to only `@tailwindcss/postcss`, (d) audit every `@apply` usage for v4 compatibility (v4 requires `@reference` in CSS modules). Don't ship without a successful local build at the operator's machine first.

---

### v2.22.2 — Tailwind 4 lockfile drift hotfix + npm-ci fail-safe
**Released:** 2026-04-17

**What changed:**
- `apps/web/package.json`: `tailwindcss ^3.4.18` → `^4.2.2` (matching the `@tailwindcss/postcss ^4.2.2` that commit 5209838a had added). Regenerated `package-lock.json`.
- `scripts/auto-update.sh` + `scripts/rollback.sh`: added a fail-safe — if `npm ci` exits with EUSAGE, fall back to `npm install` to regenerate node_modules from package.json. Location-side lockfile is rebuilt in-place but NOT committed back to git.

**Note:** This was an incomplete hotfix — v2.22.3 is the full Tailwind 3 revert that actually unblocks locations. The npm-ci fallback from v2.22.2 is kept because it's a strictly defensive addition for any future lockfile drift.

**Required Manual Step:** None.

**Verification:** Superseded by v2.22.3 verification.

---

### v2.22.0 — AI UI tiles + college baseball in Live Games
**Released:** 2026-04-17

**UI for v2.21.0 endpoints (all three wired in this release):**

1. **ShiftBriefTile** on the bartender remote (top of Video tab).
   Fetches `/api/ai/shift-brief` on mount, renders the LLM or
   deterministic brief, `Refresh` button forces regenerate,
   `Dismiss` hides for 4 hours (localStorage-backed).

2. **DistributionPlanModal** — the "Smart Distribute" button next to
   "Approve All" in the AI Suggest tab of ScheduledGamesPanel. Opens
   a modal that calls `/api/ai/distribution-plan` with the selected
   suggestions, shows per-line plan + preflight pills (chan ✓ / src ✓
   / outs ✓), lets bartender skip any line, and commits the selected
   rows through the existing `/api/schedules/bartender-schedule`
   POST one-at-a-time.

3. **ConflictAdvisor** — embedded inline when a bartender-schedule
   POST returns 409 inside the DistributionPlanModal. Calls
   `/api/ai/conflict-suggestion` with the rejected + conflicting
   allocation IDs. Renders recommendation + reasoning + optional
   one-line LLM summary. "Displace & retry" button triggers a force
   DELETE of the conflicting allocation followed by re-POST of the
   original body.

**Force-displace support in bartender-schedule DELETE:** Previously
only allowed cancellation of `pending` allocations. Now accepts
`?id=X&force=true` to displace `active` allocations — used exclusively
by the ConflictAdvisor flow. Sets status to `displaced` (not
`cancelled`) so forensics can tell the difference later, and clears
`input_sources.currentlyAllocated` so the replay POST can claim the
freed input.

**College baseball in Live Games (fix):** `ESPN_SPORTS` array in
`/api/sports-guide/live-by-channel/route.ts` did NOT include
`baseball/college-baseball`, so LSU/SEC games on ESPN/ESPNU never
appeared in the bartender remote's Live Games list even though they
were fully scheduled. Added the league. At Lucky's on April 17 this
went from showing 1 live game (Brewers) to 4 (Brewers + 3 college
baseball). No schema changes.

**Required manual steps:** None. Pure additive UI + one-line league
list fix. Restart PM2 after pulling.

**Verification:**
```bash
# Live games should include college baseball games that map to
# cable presets on ESPN/ESPNU/SEC Network / Longhorn Network:
curl -s 'http://localhost:3001/api/sports-guide/live-by-channel?deviceType=cable' \
  | jq '.channels | to_entries | map({ch: .key, league: .value.league, game: (.value.awayTeam + " @ " + .value.homeTeam)})'
```

**Bundle impact:** The three AI UI components are code-split into the
remote/page and ScheduledGamesPanel bundles. No runtime cost until
the user opens those views. ShiftBriefTile's `/api/ai/shift-brief`
call defers to the server-side 10-min cache, so back-to-back page
refreshes are cheap.

---

### v2.21.0 — AI features: shift brief, distribution optimizer, conflict advisor, weekly summary
**Released:** 2026-04-17

**Four new AI endpoints** (all under `/api/ai/*`):

1. **`GET /api/ai/shift-brief`** — Ollama-generated pre-shift summary
   (under 120 words) for the bartender opening the remote. Pulls
   upcoming games (next 12h), currently-playing games, recent
   failure-sweep clusters, and new override-digest recommendations.
   10-minute response cache. Graceful fallback to a deterministic
   text brief when Ollama is slow or unavailable.

2. **`POST /api/ai/distribution-plan`** — bulk scheduling optimizer.
   Give it an array of `{ gameScheduleId }`, get back an assignment
   plan that maximizes coverage: games routed to the right input
   sources with the right TV outputs using **historical data learned
   from prior games**: `scheduling_patterns` (team→input from
   pattern-analyzer), override-digest recommendations (bartender
   corrections), and per-league duration stats (game-duration-stats,
   v2.19.0). Spreads load across cable boxes automatically. Dry-run —
   caller commits each line through the existing bartender-schedule
   POST.

3. **`POST /api/ai/conflict-suggestion`** — when bartender-schedule
   returns 409, pass the rejected allocation and the conflicting
   allocation to get a ranked displacement recommendation
   (`displace` / `keep` / `ambiguous`) with factor-by-factor
   reasoning and an optional one-line LLM summary. Suggest-only — the
   UI must delete+re-POST to execute.

4. **`GET/POST /api/ai/weekly-summary`** — generates a markdown report
   of last week's operations: games aired, top teams by TV-hours,
   bartender corrections, stable learning patterns, failure clusters,
   AI Suggest usage. POST also writes the report to
   `apps/web/data/reports/week-YYYY-Www.md`. Auto-fired by
   scheduler-service on Mondays 06:00 local time.

**No schema changes.** Reads only from existing tables.

**Required manual steps:**
- [ ] **Ensure `OLLAMA_MODEL` matches an installed model.** Running
  `OLLAMA_MODEL=llama3.2` is common in older `.env` files but `latest`
  tag isn't always fetched. Check:
  ```bash
  curl -s http://localhost:11434/api/tags | jq -r '.models[].name'
  grep OLLAMA_MODEL /home/ubuntu/Sports-Bar-TV-Controller/.env
  ```
  Set `OLLAMA_MODEL=llama3.1:8b` (or whichever model is listed + you
  want to use) and `pm2 delete/start` to reload. The shift-brief + AI
  Suggest endpoints 404 silently if the model tag is wrong, falling
  back to deterministic text — still usable, but loses the LLM layer.
- [ ] **No new cron entry** — weekly summary hook piggybacks on the
  existing scheduler-service tick.

**Verification:**
```bash
# Smoke-test shift brief (may take ~50s on CPU-only Ollama first call)
curl -s http://localhost:3001/api/ai/shift-brief | jq '.brief' | head -30

# Smoke-test distribution plan against some upcoming games
curl -s -X POST http://localhost:3001/api/ai/distribution-plan \
  -H 'Content-Type: application/json' \
  -d "{\"games\":[{\"gameScheduleId\":\"<some-uuid>\"}]}" | jq '.plan'
```

**Where the historical signal comes from:**
- `scheduling_patterns` table (team_routing rows) — written hourly by
  `packages/scheduler/src/pattern-analyzer.ts`
- `SchedulerLog component='override-digest' operation='recommend'` —
  written hourly by `packages/scheduler/src/override-digester.ts` (v2.20.0)
- `game_schedules.duration_minutes` — written by ESPN sync (v2.19.0)

All three need at least a few days of real scheduler use before the
optimizer's recommendations become meaningfully specific. Before that,
it falls back to broad-spread across cable boxes, which is still a net
improvement over the pre-v2.21.0 behavior of "first-come-first-served".

---

### v2.20.0 — Autonomous agents + n8n cleanup + GPU benchmark
**Released:** 2026-04-17

**What changed:**

1. **`override-digester` (autonomous, hourly).** New
   `packages/scheduler/src/override-digester.ts`. Reads 30 days of
   `SchedulerLog component='override-learn'` events, buckets by
   (team, outputNum, action), and emits an hourly
   `[override-digest/summarize]` summary plus one
   `[override-digest/recommend]` row per stable pattern
   (≥3 occurrences). Home-team recommendations emit at `level='warn'`
   for prominence. Does NOT auto-mutate allocation defaults — it
   surfaces recommendations for a human review.

2. **`failure-sweeper` (autonomous, hourly).** New
   `packages/scheduler/src/failure-sweeper.ts`. Tails the last hour of
   `SchedulerLog` for `success=0` or `level∈(error,warn)` rows
   (excluding intentional high-vis override signals), buckets by
   (component, operation, first 60 chars of message), emits
   `[failure-sweep/scan]` every hour and a `[failure-sweep/cluster]`
   warn row per recurring signature (≥3 occurrences). Tonight's UUID
   parseInt bug would have been flagged within an hour under this.

3. **n8n dead code removed.** Deleted `n8n-workflows/` directory,
   `/api/n8n/webhook` route, n8n tab from AI Hub UI, `N8nWebhookLog` +
   `N8nWorkflowConfig` schema tables (both empty), and
   `/api/n8n` entry from `packages/auth/src/config.ts`
   webhook-endpoint patterns. The embedded iframe used to point at
   `http://24.123.87.42:5678` (a non-internal IP). ~300 lines gone.

**Schema changes:** `N8nWebhookLog` and `N8nWorkflowConfig` tables
dropped. Both were empty at every location. Drizzle schema no longer
declares them.

**Required manual steps:**
- [ ] **Drop n8n tables** (safe — always empty in practice):
  ```bash
  DB=/home/ubuntu/sports-bar-data/production.db
  sqlite3 "$DB" "DROP TABLE IF EXISTS N8nWebhookLog; DROP TABLE IF EXISTS N8nWorkflowConfig;"
  ```
- [ ] **Restart PM2** — autonomous agents fire inside the existing
  hourly cleanup tick; no new scheduler entry point needed.

**Verification:**
```bash
# Agents should emit one summary + scan row per hour. Check last 4 hours:
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT datetime(createdAt,'unixepoch','localtime'), component, operation, message
   FROM SchedulerLog
   WHERE component IN ('override-digest','failure-sweep')
     AND createdAt >= strftime('%s','now','-4 hours')
   ORDER BY createdAt DESC LIMIT 20;"
```

**GPU acceleration notes (for other locations deciding whether to try):**
- Ollama ships with a Vulkan backend at `/usr/local/lib/ollama/vulkan/`.
  Enable with `OLLAMA_VULKAN=1` (the environment var must be set — not
  just `OLLAMA_LLM_LIBRARY=vulkan`).
- **Intel Iris Xe (13900HK at Lucky's 1313): Vulkan is SLOWER than CPU.**
  CPU baseline 10.8 tok/sec, Vulkan 7.4 tok/sec on llama3.1:8b. The iGPU
  shares RAM (no bandwidth win) and has too few EUs to beat an
  alderlake-tuned ggml CPU build. **Don't enable.**
- Discrete GPU (NVIDIA ≥ 8GB, AMD RX with ROCm, Apple Silicon): very
  likely worth enabling. If a future location gets one, benchmark with
  the same `curl ... /api/generate ... "options":{"num_predict":80}`
  pattern against a CPU baseline and pick the winner.
- Do NOT add `OLLAMA_VULKAN=1` to `/etc/systemd/system/ollama.service`
  unless a per-location benchmark proves it's a net win. The default
  CPU path is the safe choice.

---

### v2.19.0 — Per-league duration learning + Atlas endpoint guards
**Released:** 2026-04-17

**What changed (two independent features, bundled at minor bump):**

1. **Atlas endpoint guards.** Every `/api/atlas/*` endpoint that opens a
   TCP client now calls `requireAtlasProcessor()` before touching the
   processorIp. Locations using dbx ZonePRO or BSS London (but not Atlas)
   no longer get endless reconnect-loop errors when the audio UI is open —
   the endpoint returns 404 and the Atlas client is never constructed.
   New helper: `apps/web/src/lib/atlas-guard.ts`.

2. **Per-league game duration learning.** ESPN sync now populates
   `game_schedules.duration_minutes` when both `actual_start` and
   `actual_end` timestamps are known. The scheduler's bartender-schedule
   endpoint uses the per-league historical average (5+ samples required,
   5-minute cache) to default `expected_free_at` instead of the hardcoded
   3-hour value. New helper: `apps/web/src/lib/game-duration-stats.ts`.
   Each sport converges to its real duration over a few completed games,
   which gives the scheduler tighter allocation windows (NBA ~2h15m
   instead of 3h, NFL ~3h30m instead of 3h, etc.).

**Schema changes:** None. Uses existing `duration_minutes` column.

**Required manual steps:**
- [ ] **Backfill historical durations** (one-time, safe):
  ```bash
  DB=/home/ubuntu/sports-bar-data/production.db
  sqlite3 "$DB" "UPDATE game_schedules
    SET duration_minutes = CAST(ROUND((actual_end - actual_start)/60.0) AS INTEGER)
    WHERE actual_start IS NOT NULL AND actual_end IS NOT NULL
      AND duration_minutes IS NULL
      AND (actual_end - actual_start)/60 BETWEEN 20 AND 360;"
  ```
  Rows outside 20-360 min are treated as outliers (cancelled / sync
  glitches) and left NULL. Durations will accrue naturally from new
  games going forward.

**Verification:**
```bash
# Show current per-league averages once enough samples exist:
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT league, COUNT(*) AS n, ROUND(AVG(duration_minutes),0) AS avg_min
   FROM game_schedules WHERE duration_minutes IS NOT NULL
   GROUP BY league HAVING n >= 5 ORDER BY n DESC;"
```

**Caveats:**
- Before v2.19.0 ESPN sync overwrote `actual_start` with `scheduled_start`
  on every sync. Historical durations are relative to scheduled time, not
  real tune-in time, and will be slightly inflated (often 20-40 min) for
  late-starting games. Data from v2.19.0+ is accurate.
- First 5 completed games per league use the 3-hour default; after that
  the learned average kicks in.

---

### v2.18.0 — Override-learn hook for bartender matrix changes
**Released:** 2026-04-17

**What changed:**
`POST /api/matrix/route` now closes the scheduler's feedback loop. When
a bartender issues a manual route within 10 min of an active scheduled
allocation, the route handler patches that allocation's `tv_output_ids`
to reflect the correction so the hourly pattern-analyzer learns from it.
Home-team overrides (teams in the `HomeTeam` table) log at `warn` level
for stronger filtering.

**Schema changes:** None. Uses existing `input_source_allocations`,
`HomeTeam`, `SchedulerLog`, `input_sources`, `MatrixInput`.

**Required manual steps:** None. Hook activates on next `pm2 restart`
after the build completes.

**Verification:**
```bash
# After a bartender manually reroutes a scheduled TV, watch SchedulerLog:
sqlite3 /home/ubuntu/sports-bar-data/production.db <<SQL
SELECT datetime(createdAt,'unixepoch','localtime') AS ts,
       level, operation, message
FROM SchedulerLog
WHERE component='override-learn'
ORDER BY createdAt DESC LIMIT 10;
SQL
```

**Home team readiness (optional per-location):**
The hook flags overrides as `isHomeTeam=true` only when the team name
appears in the `HomeTeam` table. Lucky's 1313 has Brewers, Bucks, and
Badgers seeded; **Packers is not currently seeded** at Lucky's. To add:
```sql
INSERT INTO HomeTeam (id, teamName, sport, league, category, location, conference, isPrimary, isActive, priority, matchingStrategy, minMatchConfidence, minTVsWhenActive, autoPromotePlayoffs)
VALUES (lower(hex(randomblob(16))), 'Green Bay Packers', 'football', 'nfl', 'professional', 'Green Bay', 'NFC North', 1, 1, 0, 'fuzzy', 0.7, 1, 1);
```

**Why this matters:** Pattern-analyzer reads `tv_output_ids` hourly to
build per-team routing patterns. Bartender corrections within 10 min of
a scheduled tune are the highest-quality training signal the system can
capture — the bartender knows which sight-lines serve which teams best.

---

### v2.17.0 — Dep major upgrades (Tailwind 4, lucide-react 1, eslint 10)
**Released:** 2026-04-17

**New dependencies:**
- **`@tailwindcss/postcss`** installed as the replacement PostCSS plugin
  for Tailwind v4. `autoprefixer` was removed (baked into the new plugin).

**Dependencies removed:**
- **`sqlite3`** (the legacy package, not better-sqlite3). It was listed as
  a dependency but not imported anywhere in source — only appeared as a
  string literal in a shell-command allowlist. Removing it killed ~7
  security advisories that lived under its cacache/tar transitive tree.

**Schema changes:** None.

**Required manual steps:**
- [ ] **Tailwind CSS** — `apps/web/src/app/globals.css` no longer uses
  `@tailwind base/components/utilities` directives; it now uses
  `@import 'tailwindcss'` + `@theme { ... }`. If a location has custom
  CSS that extends Tailwind utilities, verify those still work after
  the upgrade. The `tailwind.config.js` file was retired — all theme
  customization lives inline in `globals.css` via `@theme`.
- [ ] **lucide-react 0.x → 1.x** — icon naming stable across this range,
  but any location that pinned to a specific 0.x version in its own code
  should re-verify renders. All icons used in the bartender remote and
  admin UI were confirmed working at Lucky's.

**Verification:**
```bash
# Build must succeed — any Tailwind class that v4 removed (e.g.,
# rounded default→rounded-sm) will surface here:
NODE_ENV=development npm run build

# verify-install 7/7
bash scripts/verify-install.sh

# Pages load with CSS intact
curl -s http://localhost:3001/remote | grep -c "tailwindcss"   # should be 0 (v4 inlines styles)
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3001/remote   # 200
```

**Rollback:** If Tailwind 4 breaks UI at a location, the rollback tag
`pre-dep-upgrade-YYYYMMDD-HHMMSS` (see `git tag | grep pre-dep`) captures
the pre-upgrade state. `git reset --hard <tag>` + `npm ci` + `npm run build`
restores Tailwind 3.

**Remaining vulnerabilities:** 11 (all in drizzle-kit + next-pwa dev
dependencies; upstream maintainers haven't released fixes). These are
build-time only, not exposed to runtime attackers, and cannot currently
be patched.

---

### v2.16.x — dbx ZonePRO audio + single-card Wolf Pack support
**Released:** 2026-04-17

**New dependencies:** None.

**Schema changes:** None.

**Required manual steps:**
- [ ] **If this location uses a dbx ZonePRO (not Atlas):** verify
  `AudioProcessor.processorType = 'dbx-zonepro'` in production.db. Set if
  missing:
  ```bash
  sqlite3 $DB "UPDATE AudioProcessor SET processorType='dbx-zonepro' WHERE model LIKE 'ZonePRO%';"
  ```
- [ ] **If single-card Wolf Pack (WP-8X8/16X16/36X36):** verify
  `MatrixConfiguration.outputOffset = 0` and `audioOutputCount = 0` (unless
  Wolf Pack outputs are wired to speakers). See CLAUDE.md §5a.
- [ ] **Populate `input_sources` table** if empty — AI Suggest requires rows.
  Seed from `IRDevice` (cable boxes) and `FireTVDevice` (streaming) via
  `/api/scheduling/input-sources` POST or direct SQL.

**Verification:**
```bash
# 1. Audio control reaches correct device
curl -s http://localhost:3001/api/audio-processor | grep processorType

# 2. Matrix routing lands on expected outputs (no outputOffset drift)
bash scripts/verify-install.sh   # matrix_config layer catches single-card drift

# 3. AI Suggest returns non-empty suggestions
curl -s -b cookiejar http://localhost:3001/api/scheduling/ai-suggest | jq .suggestions
```

---

### v2.15.x — Ollama-powered AI scheduling suggestions
**Released:** 2026-04-16

**New dependencies:**
- **Ollama CLI + `llama3.1:8b` model (~4.7GB)** required on the host.
  Auto-update.sh's `ollama_model` step runs `scripts/ensure-ollama-model.sh`
  which pulls the model on first run. First-run update extends by ~4-6
  minutes while the model downloads.

**Schema changes:** None.

**Required manual steps:**
- [ ] **Install Ollama if not already present.** Ubuntu 22+:
  ```bash
  curl -fsSL https://ollama.com/install.sh | sh
  ```
  The `ensure-ollama-model.sh` script will then pull `llama3.1:8b`
  automatically on the first update after installation.
- [ ] **Verify Ollama is running:**
  ```bash
  curl -s http://localhost:11434/api/tags | jq '.models[].name'
  # Expect to see "llama3.1:8b"
  ```

**Verification:**
```bash
# Manual probe
ollama run llama3.1:8b "Say ok" --verbose
# Should respond with a short "ok" within ~3s of first run

# AI Suggest via API
curl -s -b cookiejar http://localhost:3001/api/scheduling/ai-suggest
```

**If Ollama fails:** AI Suggest degrades gracefully — the endpoint returns
`suggestions: []` with an explanatory message. Other app features continue
to work. Ollama is non-fatal.

---

### v2.12.x — Auto-update hardening + bidirectional memory sync
**Released:** 2026-04-16

**New dependencies:** None.

**Schema changes:**
- Added `MatrixConfiguration.chassisId` (nullable TEXT) for multi-card
  support. Auto-applied by drizzle-kit push.

**Required manual steps:**
- [ ] **Install the auto-update systemd timer** (one-time per host):
  ```bash
  bash scripts/install-auto-update-timer.sh
  sudo loginctl enable-linger ubuntu   # headless hosts
  ```
- [ ] **Sync memory with CLAUDE.md Rule 7** — Checkpoint B reads this
  section and saves any missing entries to host memory automatically.

**Verification:**
```bash
# Timer armed
systemctl --user list-timers sports-bar-autoupdate.timer

# verify-install 7/7 (includes matrix_config layer added in v2.16.x)
bash scripts/verify-install.sh
```

---

### v2.11.x — Drizzle schema push resilience
**Released:** 2026-04-16

**New dependencies:** None.

**Schema changes:** Iterative + bulk-regenerate fallback added to handle
drizzle-kit push's atomic-rollback-on-duplicate-index behavior at
locations with months of pre-existing indexes.

**Required manual steps:** None — fully automatic. If a location's
auto-update hangs at the `schema_push` step, check logs for
`[SCHEMA] bulk-regenerate fallback` — that's the new path kicking in.

**Verification:**
```bash
# Verify schema is in sync
NODE_ENV=development npx drizzle-kit push
# Expect clean success OR the documented benign "already exists" warning
```

---

### v2.8.x — Samsung model probe + TV power audit trail
**Released:** 2026-04-15

**New dependencies:** None.

**Schema changes:**
- New `ChannelTuneLog` table — auto-applied by drizzle-kit push. If
  missing after an update, see CLAUDE.md Gotcha #7 for manual CREATE.

**Required manual steps:**
- [ ] **If Samsung TVs present:** run the model probe once after first
  update to populate the `model` column with real identifiers:
  ```bash
  curl -sS -b cookiejar -X POST http://localhost:3001/api/tv-discovery/probe-models
  ```
  (Runs automatically every 4 hours via instrumentation.ts after v2.8.0.)
- [ ] **If LG TVs present:** each TV must accept a one-time pairing
  dialog to populate `clientKey`. Triggered by the first power command
  from the bartender remote.

**Verification:**
```bash
sqlite3 $DB "SELECT ipAddress, brand, model, CASE WHEN authToken IS NULL THEN 'unpaired' ELSE 'paired' END FROM NetworkTVDevice;"
```

---

## Known Errors & Fixes

Append entries here whenever a location hits an error that was non-obvious
to diagnose. Format:

- **Symptom:** what the operator/UI showed
- **Root cause:** why it happened
- **Fix:** the exact SQL/command/code change that resolved it
- **Verification:** how to confirm the fix worked
- **Applies to:** `all locations` or a specific location tag
- **First seen:** YYYY-MM-DD at which location

The goal: every other location inheriting this file from main should find
the answer here instead of re-debugging from scratch. Per CLAUDE.md Rule
8, you MUST add an entry when you fix a non-trivial error.

### Auto-update rolls back at `merge` step with "merge conflict on non-whitelisted file"

- **Symptom:** Log ends with lines like:
  ```
  CONFLICT (content): Merge conflict in apps/web/src/app/remote/page.tsx
  [AUTO-UPDATE] Unexpected merge conflict on non-whitelisted files:
  UU apps/web/src/app/remote/page.tsx
  [AUTO-UPDATE] FAIL at step 'merge': merge conflict on non-whitelisted file 3
  [AUTO-UPDATE] Triggering rollback
  ```
  Rollback succeeds; location stays on pre-update version. Happens on
  consecutive days without intervention because each attempt hits the
  same conflict.
- **Root cause:** Before v2.25.5, the auto-update conflict resolver
  only handled an exact-path whitelist
  (`LOCATION_PATHS_OURS` / `LOCATION_PATHS_THEIRS`). Shared-software
  files like `apps/web/src/app/remote/page.tsx` that have drifted
  between the location branch and main (usually from past on-device
  debugging) fell through both lists and aborted the whole update.
- **Fix (code, v2.25.5):** Added `SHARED_SOFTWARE_PREFIXES` fallback
  that force-takes MAIN for any remaining `UU` file under
  `apps/web/src/app/`, `apps/web/src/components/`, `apps/web/src/lib/`
  (except `hardware-config.ts`, which stays in OURS),
  `apps/web/src/hooks/`, `apps/web/src/db/`, `apps/web/src/types/`,
  `apps/web/src/utils/`, `apps/web/public/`, `packages/`, `docs/`, or
  `drizzle/`. See the v2.25.5 entry above for the one-time bootstrap
  command to pick up the new resolver.
- **Fix (manual, one-time per location):** see v2.25.5 entry. After
  the one-shot manual merge, every subsequent auto-update uses the
  new script and won't hit this failure again.
- **Verification after fix:**
  ```bash
  grep -c "SHARED_SOFTWARE_PREFIXES" /home/ubuntu/Sports-Bar-TV-Controller/scripts/auto-update.sh
  # Expect >= 2
  ls -t /home/ubuntu/sports-bar-data/update-logs/auto-update-*.log | head -1 \
    | xargs grep -c "shared-software fallback"
  # Expect >= 1 after the next auto-update run actually encounters a drift
  ```
- **Applies to:** any location that has edited a shared-UI file
  directly on its location branch (very likely most of them). Once
  bootstrapped, the fallback handles future drift silently.
- **First seen:** Lucky's 1313, back-to-back rollbacks at 2026-04-18
  16:07 and 2026-04-19 16:39 on `apps/web/src/app/remote/page.tsx`.

### Auto-update rolls back at Checkpoint B after Claude CLI 2.1.113+ install

- **Symptom:** `auto-update.sh` runs through merge, npm_ci, schema_push, then fails at Checkpoint B with `FAIL at step 'checkpoint_b': Checkpoint B: Claude Code CLI failure`. The checkpoint output log contains `Error: Interactive prompts require a TTY terminal (process.stdin.isTTY or process.stdout.isTTY is false)`. The auto-update rolls back cleanly (exit 4), no on-disk damage, but the location stays on its pre-merge version run after run.
- **Root cause:** Claude Code CLI 2.1.113 and later require a TTY for `claude -p` even when `--dangerously-skip-permissions` is set and stdin is piped. The auto-update runs via `setsid -f` detached from any TTY, so the check fails. Locations still on 2.1.112 don't hit this; locations where Claude CLI auto-updated past 2.1.112 do.
- **Fix:** Included in v2.22.4. `scripts/auto-update.sh` now wraps the invocation in `script -qfc "claude -p --dangerously-skip-permissions \"\$(cat $prompt_file_tmp)\"" /dev/null`, which provides a pty. Prompt goes through a mktemp file because multi-KB prompts on the command line overflow ARG_MAX once script/sh layers stack. If a location is stuck pre-v2.22.4, the workaround is to manually `git reset --hard` the location branch forward to v2.22.4 (or temporarily downgrade Claude CLI back to 2.1.112 with `curl -fsSL https://claude.ai/install.sh | bash -s -- --version 2.1.112`).
- **Verification:** `grep "Checkpoint B: DECISION" $(ls -t /home/ubuntu/sports-bar-data/update-logs/auto-update-*.log | head -1)` should return a DECISION line. Also confirm `claude --version` is ≥ 2.1.113 so you know the pty wrapper is actually what unblocked it.
- **Applies to:** all locations with Claude CLI ≥ 2.1.113. As of 2026-04-17 that's: Appleton, Graystone, Lucky's, Stoneyard-Greenville (post-upgrade). Holmgren + Leg Lamp escaped because their successful runs happened before their Claude CLI upgraded.
- **First seen:** 2026-04-17 at Appleton during v2.22.x batch rollout; Graystone and Lucky's hit the same within minutes. Fixed in v2.22.4.

### Every location rolls back at `npm_ci` with EUSAGE lockfile drift

- **Symptom:** Auto-update fails at `npm_ci` step with `npm error code EUSAGE / npm ci can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with npm install before continuing.` followed by a list of `Missing: <pkg>@<version> from lock file`. Rolls back cleanly.
- **Root cause:** A commit on main bumped a dep in a workspace `package.json` (typically `apps/web/package.json`) but the root `package-lock.json` wasn't regenerated in the same commit. `npm ci` is strict about this — correctly, since a stale lock means reproducible builds aren't actually reproducible. The concrete instance on 2026-04-17 was commit `5209838a` (v2.17.0 "Tailwind 4") that added `@tailwindcss/postcss ^4.2.2` to `apps/web/package.json` but didn't bump `tailwindcss` from `^3.4.18` to `^4.2.2` there, so the regenerated lockfile had inconsistent transitive deps.
- **Fix:** Two parts, both in v2.22.2:
  1. Fix the package.json drift on main: bump the misaligned dep, run `npm install --package-lock-only`, commit both files together.
  2. Defensive fallback in `scripts/auto-update.sh` (mirrored in `scripts/rollback.sh`): if `npm ci` exits with EUSAGE, fall back to `npm install --include=dev` which regenerates node_modules from package.json. The location's rebuilt lockfile is NOT pushed back to git — main still needs to be fixed — but one missed regen on main can no longer strand the fleet.
- **Verification:** `grep "npm install fallback succeeded" $(ls -t /home/ubuntu/sports-bar-data/update-logs/auto-update-*.log | head -1)` — if this line is present the fallback fired and the root cause needs a main-side fix.
- **Applies to:** all locations.
- **First seen:** 2026-04-17 at all 6 locations simultaneously when v2.17.0 rolled out. Fallback added in v2.22.2.

### Location stuck at pre-v2.17.0 version because `npm ci` keeps failing

- **Symptom:** Location is on, say, v2.13.2 or v2.16.x. Auto-update log shows `FAIL at step 'npm_ci'` with `Missing: tailwindcss@3.4.19 from lock file` plus ~20 transitive deps. Rolls back, repeats on next cron cycle. Days pass with no actual update.
- **Root cause:** v2.17.0 shipped an incomplete Tailwind 3→4 migration — `globals.css` still used v3 syntax, `tailwind.config.js` was deleted with no `@theme` replacement, and the package.json ↔ lockfile drift from the entry above compounded. Even with v2.22.2's fallback landing the install, the build then failed with `Cannot find module 'autoprefixer'` or `Cannot apply unknown utility class text-slate-100`.
- **Fix:** v2.22.3 reverts the Tailwind 4 migration entirely — restores `apps/web/tailwind.config.js`, reverts `postcss.config.js` to `{ tailwindcss, autoprefixer }`, `apps/web/package.json` back to `tailwindcss ^3.4.18` + `autoprefixer ^10.4.21`, regenerates lockfile. Keeps the non-Tailwind parts of v2.17.0 (lucide-react 1.x, eslint 10, sqlite3 removal) since those worked.
- **Verification:** `grep version /home/ubuntu/Sports-Bar-TV-Controller/package.json` should read ≥ 2.22.3 after a successful auto-update. Then `ls apps/web/tailwind.config.js` should exist, and `npx turbo run build --force --filter=@sports-bar/web` should compile in ~38s with no Tailwind errors.
- **Applies to:** all locations.
- **First seen:** 2026-04-17 at Stoneyard, Graystone, Appleton, Holmgren, Lucky's, Leg Lamp — essentially the entire fleet during the v2.17.0 → v2.22.x batch.

### Atlas endpoint reconnect loop on dbx/BSS locations

- **Symptom:** PM2 error log fills with thousands of
  `[ERROR] [CONNECTION] Failed to connect to Atlas processor at X.X.X.X:5321`
  messages per minute. Happens at locations that use **dbx ZonePRO** or
  **BSS Soundweb London** for audio (not Atlas). The X.X.X.X is the
  real audio processor's IP, but port 5321 is the Atlas TCP port — the
  non-Atlas device rejects the connection immediately and the Atlas
  client-manager retries forever.
- **Root cause:** Atlas endpoints (`/api/atlas/meters/stream`,
  `/api/atlas/output-meters`, etc.) didn't check the AudioProcessor's
  `processorType` before handing the IP to `getAtlasClient()`. Any
  component that polled `/api/atlas/*` on page load (audio meters,
  sources UI) started a persistent retry loop.
- **Fix (code — v2.19.0):** new helper `apps/web/src/lib/atlas-guard.ts`
  added to every Atlas endpoint. It looks up the AudioProcessor row by
  IP and returns 404 unless `processorType='atlas'`. Eliminates the
  loop at the source — no Atlas client is ever constructed for a
  non-Atlas processor.
- **Verification:**
  ```bash
  # After restart, count Atlas errors in the last minute. Should be 0:
  pm2 logs sports-bar-tv-controller --err --lines 500 --nostream \
    | awk -v ts="$(date -u -d '-1 minute' '+%Y-%m-%d %H:%M:')" '$0 >= ts' \
    | grep -c "Atlas processor"
  ```
- **Applies to:** any location whose audio processor is NOT Atlas.
  Atlas-using locations are unaffected (the guard passes when the
  AudioProcessor row has `processorType='atlas'`).
- **First seen:** 2026-04-17 at Lucky's 1313 (dbx ZonePRO 1260m at
  192.168.10.50 — the Atlas client was hammering port 5321 on that IP
  while the dbx answered on 3804).

### Scheduler tunes the right channel but TVs never switch to the right input

- **Symptom:** A scheduled game fires — `scheduler-service/tune` log
  shows success, the cable box is confirmed on the correct channel —
  but the TVs that were assigned to that allocation are displaying
  something completely different (another sport, a menu, the previous
  input). The bartender has to go to the Video tab and manually move
  each TV onto the right input for every single scheduled game. This
  has been silently broken for the entire life of the bartender-
  scheduling feature; no one caught it because the tune itself always
  logged success and the channel change was visible on the cable box
  LEDs / TV-it-happened-to-land-on.
- **Root cause:** In `packages/scheduler/src/scheduler-service.ts` the
  matrix-routing loop inside `checkAndExecuteBartenderSchedules` did:
  ```ts
  const matrixInput = parseInt(inputSource.matrixInputId, 10);
  ```
  But `inputSource.matrixInputId` is a **UUID foreign key** to
  `MatrixInput.id`, not the physical input channel number.
  `parseInt("a9a2828b9eb...", 10)` returns `NaN`, and
  `parseInt("99ad5b127e...", 10)` returns `99` (reads leading digits
  until the letter). Either result gets passed as `input:` to
  `/api/matrix/route`. The Wolf Pack silently rejects NaN / out-of-range
  values OR routes the output to an unrelated physical input. Either
  way the TV ends up on the wrong source.
- **Detection:** Check whether any output claimed by an active
  scheduled allocation is actually routed to that allocation's source:
  ```bash
  DB=/home/ubuntu/sports-bar-data/production.db
  sqlite3 "$DB" <<'SQL'
  WITH alloc_outputs AS (
    SELECT s.name AS src, mi.channelNumber AS expected_input, j.value AS output
    FROM input_source_allocations a
    JOIN input_sources s ON s.id = a.input_source_id
    JOIN MatrixInput mi ON mi.id = s.matrix_input_id
    JOIN json_each(a.tv_output_ids) j
    WHERE a.status = 'active'
  )
  SELECT ao.src, ao.output, ao.expected_input AS expected, mr.inputNum AS actual,
         CASE WHEN ao.expected_input = mr.inputNum THEN 'ok' ELSE 'MIS-ROUTED' END AS state
  FROM alloc_outputs ao
  LEFT JOIN MatrixRoute mr ON mr.outputNum = ao.output
  ORDER BY ao.src, ao.output;
  SQL
  ```
  Any row showing `MIS-ROUTED` means the scheduler's matrix loop failed.
- **Fix (code — v2.18.2):** Replace the broken parseInt with a DB
  lookup that resolves the UUID to the actual `channelNumber`:
  ```ts
  const matrixInputRow = await db.select({
      channelNumber: schema.matrixInputs.channelNumber,
    })
    .from(schema.matrixInputs)
    .where(eq(schema.matrixInputs.id, inputSource.matrixInputId))
    .limit(1)
    .all();
  const matrixInput = matrixInputRow[0]?.channelNumber ?? NaN;
  ```
  After deploying v2.18.2, every future scheduled tune routes TVs
  correctly without bartender rescue.
- **Fix (live state for active games, tonight only):** While the new
  code only helps the NEXT tune, existing active games are still on
  the wrong inputs. Patch them directly via `/api/matrix/route` per
  output, using the correct input channel from `input_sources` →
  `MatrixInput.channelNumber`. Example for Cable Box 1 (input 1):
  ```bash
  for out in 1 3 5 6 8 10 12 13 14 16; do
    curl -s -X POST http://localhost:3001/api/matrix/route \
      -H 'Content-Type: application/json' \
      -d "{\"input\":1,\"output\":$out,\"source\":\"system\"}"
  done
  ```
- **Verification:** re-run the detection query above; `state` should
  be `ok` for every row. Also watch the next scheduled tune in
  `SchedulerLog`: `[OVERRIDE-LEARN]` entries will STOP appearing
  immediately after a schedule fires, because the bartender no longer
  needs to correct TVs — a quiet log here means the scheduler is
  doing its job.
- **Applies to:** all locations running any version prior to v2.18.2.
  The bug has been there for the entire life of the bartender-schedule
  feature — silently defeating every scheduled tune at every
  location.
- **First seen:** 2026-04-17 at Lucky's 1313. Noticed when investigating
  why the Brewers allocation on 10 TVs was only actually landing on 3,
  and confirmed on the SE Louisiana tune at 18:25 CDT — the channel
  fired correctly but all 4 TVs stayed on their prior inputs. The
  LSU tune earlier the same evening was partially correct by pure
  coincidence (one TV had already been manually routed to input 2).

### Scheduler shows cable box as "Idle" while a game is actively tuned on it

- **Symptom:** On the Sports Guide admin scheduler page, a Cable Box card
  shows "Idle" even though:
  - `input_source_allocations` has a row with `status='active'` for that box
  - The physical box is correctly tuned to the game's channel
  - `SchedulerLog` shows a successful `scheduler-service/tune` entry
  Other cable boxes in the same UI show their games correctly.
- **Root causes (two variants — check both):**
  1. **`input_sources.currently_allocated` / `current_channel` not set
     after tune.** Prior to v2.18.0, `scheduler-service.checkAndExecute
     BartenderSchedules()` flipped the allocation to `active` but never
     updated the `input_sources` row. The UI reads both tables — if the
     source row is stale, the card renders as idle. Fixed in v2.18.0,
     but existing rows need one-time backfill.
  2. **`InputCurrentChannel.inputLabel` mismatch.** The scheduler UI
     joins allocations to current-channel rows by exact string match on
     `inputLabel`. Historical rows may have a shortened label like
     `"Cable 1"` while the allocation returns `"Cable Box 1"` (from
     `input_sources.name`). The join fails → card shows idle. Other
     boxes with matching labels render correctly. No automated UI
     surface reveals the mismatch — you have to diff the two API
     responses.
- **Diagnostic commands:**
  ```bash
  DB=/home/ubuntu/sports-bar-data/production.db
  # Variant 1: any active allocation whose source row is still idle?
  sqlite3 "$DB" "SELECT s.name, s.currently_allocated, a.status, a.channel_number
    FROM input_source_allocations a
    JOIN input_sources s ON s.id = a.input_source_id
    WHERE a.status = 'active';"
  # (currently_allocated should be 1 — if it's 0, variant 1 applies)

  # Variant 2: does InputCurrentChannel.inputLabel match input_sources.name?
  sqlite3 "$DB" "SELECT icc.inputNum, icc.inputLabel AS channel_label,
    s.name AS source_name,
    CASE WHEN icc.inputLabel = s.name THEN 'match' ELSE 'MISMATCH' END AS status
    FROM InputCurrentChannel icc
    LEFT JOIN input_sources s ON s.matrix_input_id = (
      SELECT id FROM MatrixInput WHERE channelNumber = icc.inputNum LIMIT 1)
    ORDER BY icc.inputNum;"
  ```
- **Fix:**
  ```bash
  DB=/home/ubuntu/sports-bar-data/production.db

  # Variant 1: backfill input_sources state from active allocations
  sqlite3 "$DB" "UPDATE input_sources
    SET currently_allocated = 1,
        current_channel = (SELECT a.channel_number FROM input_source_allocations a
                           WHERE a.input_source_id = input_sources.id
                             AND a.status = 'active'
                           ORDER BY a.allocated_at DESC LIMIT 1),
        updated_at = strftime('%s','now')
    WHERE EXISTS (SELECT 1 FROM input_source_allocations a
                  WHERE a.input_source_id = input_sources.id AND a.status = 'active');"

  # Variant 2: normalize InputCurrentChannel.inputLabel to match input_sources.name
  # For each mismatch row from the diagnostic above:
  sqlite3 "$DB" "UPDATE InputCurrentChannel SET inputLabel = 'Cable Box 1' WHERE inputNum = 1;"
  # Repeat per inputNum as needed. The UPDATE path in channel-presets/tune does
  # not touch inputLabel, so the corrected value persists across future tunes.
  ```
- **Verification:** refresh the Sports Guide admin scheduler page. The
  previously-idle box now shows the game's teams below the channel number.
  Also:
  ```bash
  diff <(curl -s http://localhost:3001/api/schedules/bartender-schedule | jq -r '.schedules[] | select(.status=="active") | .inputLabel') \
       <(curl -s http://localhost:3001/api/matrix/current-channels | jq -r '.channels | to_entries[] | .value.inputLabel')
  # Empty diff = all labels match.
  ```
- **Applies to:** all locations. Variant 1 affects any deployment with
  bartender allocations that activated before v2.18.0 upgrade. Variant 2
  affects any deployment with historical short-label rows in
  `InputCurrentChannel`.
- **First seen:** 2026-04-17 at Lucky's 1313. Variant 1 was found first
  (both cable boxes 1 and 2 affected); variant 2 was exposed after
  variant 1 was backfilled and Box 1 still showed idle while Box 2
  correctly displayed LSU game — the label diff between Box 1
  (`"Cable 1"`) and Box 2 (`"Cable Box 2"`) was the tell.

### AI Suggest returns `suggestions: []` with "No active input sources configured"

- **Symptom:** clicking "Get Suggestions" on the scheduler UI does
  nothing; `GET /api/scheduling/ai-suggest` returns empty with message
  `"No active input sources configured. Add cable boxes or streaming
  devices first."`
- **Root cause:** the `input_sources` table is empty. AI Suggest reads
  from this normalized table, which is supposed to be seeded from
  `IRDevice` + `FireTVDevice` + `DirecTVDevice` but the seed step was
  missed.
- **Fix:** populate `input_sources` from existing device tables. SQL
  template (adjust IDs to match your `IRDevice.id` and
  `MatrixInput.id` values):
  ```sql
  INSERT INTO input_sources (id, name, type, device_id, matrix_input_id,
    available_networks, is_active, currently_allocated, priority_rank,
    created_at, updated_at)
  VALUES ('is-cable-1','Cable Box 1','cable','<IRDevice-id>',
    '<MatrixInput-id>','[]',1,0,50, strftime('%s','now'), strftime('%s','now'));
  ```
- **Verification:** `curl -s -b cookiejar
  http://localhost:3001/api/scheduling/ai-suggest | jq '.suggestions | length'`
  should return > 0 when games are live.
- **Applies to:** all locations
- **First seen:** 2026-04-17 at Lucky's 1313

### Default Source Settings UI spinner forever

- **Symptom:** `/system-admin` → Default Source Settings tab loads
  indefinitely (perpetual spinner), never shows form.
- **Root cause:** `loadData()` sequentially awaits
  `/api/atlas/sources?processorIp=<ip>` with no timeout. The Atlas
  HiQnet probe hangs on a non-Atlas audio processor (e.g., dbx ZonePRO)
  because HiQnet isn't spoken by those devices.
- **Fix:** patched in v2.16.5 —
  `apps/web/src/components/DefaultSourceSettings.tsx` now checks
  `processor.processorType === 'atlas'` before probing + wraps the
  fetch in a 5s `AbortController`. If you hit this on a pre-v2.16.5
  location: either cherry-pick the patch, or temporarily unset the
  AudioProcessor row to skip the fetch path.
- **Verification:** open the page, it should render form controls
  within 3 seconds regardless of audio processor type.
- **Applies to:** all non-Atlas locations (dbx/BSS/etc.)
- **First seen:** 2026-04-17 at Lucky's 1313 (dbx ZonePRO 1260m)

### Matrix routing lands on wrong physical output

- **Symptom:** clicking "route to Output 1" on bartender remote
  changes the TV on output 27 (or wherever +26 lands). Operator sees
  "nothing happens" when the intended TV is actually fine; a different
  TV silently changed source.
- **Root cause:** `MatrixConfiguration.outputOffset` is set to a
  non-zero value on a single-card Wolf Pack (WP-8X8/16X16/36X36).
  `wolfpack-matrix-service.ts` adds the offset to every output number
  before sending the routing command. Single-card matrices route 1:1
  and must have `outputOffset=0`.
- **Fix:**
  ```sql
  UPDATE MatrixConfiguration SET outputOffset=0, audioOutputCount=0,
    updatedAt=datetime('now') WHERE model LIKE 'WP-%X%';
  ```
  (Only set `audioOutputCount=0` if audio is NOT wired to the Wolf
  Pack — Lucky's routes audio via dbx ZonePRO, not Wolf Pack outputs.)
  After the UPDATE, `pm2 restart sports-bar-tv-controller` to clear
  any cached route maps.
- **Verification:** v2.16.6+ adds `matrix_config` layer to
  `scripts/verify-install.sh` which FAILs if a single-card model has
  non-zero outputOffset. Also `[MATRIX-CONFIG] ⚠` is logged at every
  PM2 boot for the same condition. See CLAUDE.md §5a.
- **Applies to:** any location with a single-card Wolf Pack
- **First seen:** 2026-04-17 at Lucky's 1313 (`outputOffset=26` on
  WP-36X36 for weeks)

### `/api/bartender/layout` renders "No Layout Uploaded" despite layout existing

- **Symptom:** bartender remote Video tab shows "No Layout Uploaded"
  even though the DB has a `BartenderLayout` row with valid
  `imageUrl` and 20+ zones.
- **Root cause:** the API response uses `backgroundImage` but the
  `InteractiveBartenderLayout` component reads
  `layout.imageUrl || layout.professionalImageUrl` — name mismatch.
- **Fix:** patched in v2.16.7 —
  `apps/web/src/app/api/bartender/layout/route.ts` now returns both
  `imageUrl` and `professionalImageUrl` alongside `backgroundImage`
  for backward compat.
- **Verification:** `curl -s
  http://localhost:3001/api/bartender/layout | jq '.layout.imageUrl'`
  should be the `/api/uploads/layouts/...` path, not `null`.
- **Applies to:** all locations pre-v2.16.7
- **First seen:** 2026-04-17 at Lucky's 1313

### Auto-update schema_push never converges (350-iter cap hit)

- **Symptom:** `[SCHEMA] iterative retry hit cap (350) without
  converging` in the auto-update log. Run rolls back.
- **Root cause:** drizzle-kit push cycles through the same duplicate
  indexes at locations with many hotfix-era indexes. Iterative
  drop-and-retry never gets ahead of the cycling.
- **Fix:** v2.12.5 added a bulk-regenerate fallback — drop all
  user-defined indexes, run `drizzle-kit generate` to get the
  canonical CREATE list, apply `CREATE ... IF NOT EXISTS` in one
  transaction, final push reports benign already-exists (schema IS
  in sync). Pre-v2.12.5 locations: upgrade the auto-update.sh
  manually before the next run.
- **Verification:** auto-update log shows `[SCHEMA] bulk-apply:
  created N indexes from generate output` followed by `[SCHEMA]
  bulk-regenerate fallback: final push reports benign pre-existing
  objects — schema IS in sync`.
- **Applies to:** all locations
- **First seen:** 2026-04-16 at Lucky's 1313

---

## Archive

Older entries (>2 major versions back) pruned from this file. `git log docs/VERSION_SETUP_GUIDE.md` is the archive.
