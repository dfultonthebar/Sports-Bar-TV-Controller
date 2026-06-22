# Hermes Fleet-Monitoring Build Roadmap

> **STATUS: AI-generated (13-agent workflow), VERIFIED + CORRECTED by Claude 2026-06-22.**
> Research + adversarial-audit + synthesis, grounded in the live repo / CT212 / CT211.
>
> ## ⚠ VERIFICATION CORRECTIONS — read before acting (the synthesis got the keystone wrong)
> - **C1 "keystone bug" is a FALSE POSITIVE.** The workflow claimed `checkpoint-hermes.sh:48` defaults to a model not installed (`llama3.1:8b`). **`llama3.1:8b` IS installed on CT212** — the agents were anchored by an incomplete model list I gave them in the ground-truth prompt. **`checkpoint-hermes.sh:48` is correct — do NOT change it. Phase-0's model-default "fix" is invalid.**
> - **The checkpoint shadow-review ALREADY works** (`hermes_shadow_review()` @ auto-update.sh:543 → `checkpoint-hermes.sh` → `llama3.1:8b` via Ollama, independent of `hermes -z`).
> - **The REAL keystone:** `~/.hermes/config.yaml` has `active_provider: xai-oauth` (grok-4, OUT OF CREDITS). That's why `hermes -z` / the gateway can't run skills. FIX = interactively run `hermes model` on CT212 and switch `active_provider` to a LOCAL Ollama provider (`http://localhost:11434/v1`, model `llama3.1:8b`). OPERATOR action (interactive + gated). This unblocks autonomous SKILL execution (#2/#3/#5/#6) — NOT the checkpoint path (already works).
> - **Verified-CORRECT, keep:** trigger path `/api/system/auto-update/run-now`; real MCP tools `create_maintenance_todo` / `propose_action` / `ask_claude_code` (`bot_message_claude` does NOT exist); gateway is a SYSTEM systemd unit; T4 thermal/off-hours gates (see memory/feedback_t4_gpu_sharing_rules.md); `/api/diagnostics/watcher-events` + remediation columns must be built; `sports-bar-self-healing` skill must be authored (not in repo).
> - **T4 GPU-sharing rules are now enforced** by a PreToolUse guard hook (.claude/hooks/t4-sharing-guard.sh) — every T4-touching command surfaces the rules + the current market-hours window.

---

All critical claims now verified. Final confirmations:
- HTTP trigger for auto-update is `/api/system/auto-update/run-now` (NOT `/api/auto-update/run-now` as both the self-healing and event-ingest specs wrote).
- `checkpoint-hermes.sh` default model is `llama3.1:8b` (NOT `hermes3:8b` as spec #1 claimed) — but llama3.1:8b is NOT in CT212's confirmed model list (ground truth lists llama3.2:3b, qwen2.5:14b, nomic-embed-text, mistral-nemo). This is the real keystone bug.
- MCP tools confirmed: `get_system_health`, `list_open_todos`, `create_maintenance_todo` (guarded write), `propose_action` (no-exec), `ask_claude_code`. `bot_message_claude` does NOT exist (confirms audit of spec #3).
- `sports-bar-iso-audit` skill is the only one in-repo; `sports-bar-self-healing` is NOT in repo (must be authored).

I have enough ground truth. Producing the roadmap.

---

# Hermes Fleet-Monitoring Build Roadmap
## From "Observes" → "Monitors and Acts"

**Author:** Lead architect synthesis of 6 specs + adversarial audits, verified against the live Holmgren repo + ground-truth constraints (2026-06-22).

---

## 0. Executive Summary — The Keystone and the Ordering Logic

Every one of the 6 specs is `feasibleAsWritten: false`, and **5 of 6 audits name the same root blocker**: Hermes has no working LLM provider (`hermes -z` → "No LLM provider configured"; grok-4 OOC; fleet `ANTHROPIC_API_KEY` OOC). Until that is fixed, nothing else can run autonomously.

But the keystone is **subtler than "configure a provider"** — and verifying the repo exposed the real bug:

> `scripts/checkpoint-hermes.sh:48` defaults to **`llama3.1:8b`**. The ground-truth model inventory on CT212's T4 is **`qwen2.5:14b`, `llama3.2:3b`, `nomic-embed-text`, `mistral-nemo`** — **`llama3.1:8b` is NOT present.** Spec #1 separately claimed the default was `hermes3:8b`. **Both are wrong.** The single most leverage-positive first move is to make `checkpoint-hermes.sh` default to a model that actually exists on the box (`llama3.2:3b`), and to make Hermes' own provider point at local Ollama.

This is not a "config" task — it is a one-line correctness fix in a committed repo file plus an operator-run config write on CT212. It unblocks the shadow-review loop that already exists (`hermes_shadow_review()` at `auto-update.sh:543`), which in turn is the substrate for Phases 3–6.

**Dependency spine (each phase gates the next where noted):**

```
P0  Provider Keystone  ──► unblocks ALL autonomous execution
P1  Detection plumbing ──► (schema 0006, verify-install JSON, watcher-events API, run-now path fix)
        │  (independent of P0 — can run in parallel; needed by P3/P5)
P2  Scheduled read-only monitoring (fleet-health, heartbeat, iso-audit crons)  ◄── needs P0
P3  Agent-bus responder (passive→active triage)  ◄── needs P0; needs MCP-tool reality fix
P4  Closed-loop self-healing (bounded remediation)  ◄── needs P0 + P1 + P2
P5  Event-driven push transport (replace poll)  ◄── needs P1; Hermes ingest endpoint is the gate
P6  Shadow→primary checkpoint cutover  ◄── needs P0 + weeks of P2/P4 agreement data
```

**Highest-leverage first move (do this before anything else):** fix the model default in `checkpoint-hermes.sh` + run the operator provider-config script on CT212, then prove `hermes -z 'test' ` returns within 10s. See **Phase 0, Step 1**.

---

## Cross-Cutting Corrections Folded In From the Audits

These apply to every phase; called out once here to avoid repetition.

| # | Correction | Source audit | Verified |
|---|---|---|---|
| C1 | **Model default bug.** `checkpoint-hermes.sh:48` = `llama3.1:8b`, not present on T4. Use `llama3.2:3b`. | Spec1 audit C8 + my repo read | ✅ confirmed live |
| C2 | **HTTP trigger path is `/api/system/auto-update/run-now`**, NOT `/api/auto-update/run-now`. Two specs wrote it wrong. | my repo read | ✅ confirmed |
| C3 | **New Drizzle migration is `0006`**, not `0004` (0004=`allocation_verify_columns`, latest=`0005_agent_tool_invocations`). | Self-heal audit + my read | ✅ confirmed |
| C4 | **`bot_message_claude` does not exist.** Real MCP tools: `get_system_health`, `list_open_todos`, `get_firetv_status`, `search_system_docs`, `create_maintenance_todo` (guarded write), `propose_action` (no-exec), `ask_claude_code`. DELEGATE/ESCALATE must use `create_maintenance_todo` / `propose_action`. | Bus-responder audit | ✅ confirmed |
| C5 | **Hermes gateway is a SYSTEM systemd unit** (`sudo systemctl restart hermes-gateway`), NOT `systemctl --user`. Any responder timer must be SYSTEM-scoped or explicitly document passwordless-sudo reload. | Bus-responder audit + ground truth | ✅ ground truth |
| C6 | **Thermal gate is real and unmitigated.** T4 fan unpowered (PSU on order), idles ~69C. Any sustained inference (qwen2.5:14b shadow, ask_claude_code bursts) must be off-hours-gated AND have a `nvidia-smi` temp pre-check that aborts ≥ a tunable threshold. phi4-trader must NEVER be evicted during market hours. | All audits | ground truth |
| C7 | **Off-hours window logic must be written, not described.** Canonical snippet: `ET_HOUR=$(TZ=America/New_York date +%H); if [ "$ET_HOUR" -ge 21 ] || [ "$ET_HOUR" -lt 8 ]; then OFFHOURS=1; fi`. Reuse everywhere. | Spec1 audit C4 | — |
| C8 | **Permission model is real and gated.** The orchestrating agent CANNOT write CT212/CT211/credentials. Every write step below is tagged **[OPERATOR]** (human runs an idempotent `/tmp/deploy-*.sh`) or **[AGENT]** (committed to repo, ships via auto-update). Config/credential writes on CT212/CT211 are always **[OPERATOR]**. | ground truth | — |
| C9 | **`ask_claude_code` (Claude OAuth) is the only working cloud fallback, and it can expire.** No metered `ANTHROPIC_API_KEY` backstop on CT212. Treat OAuth-fail as a real failure mode: degrade to deterministic-only + `create_maintenance_todo` escalation, never silently hang. | Spec1 audit C1 | ground truth |
| C10 | **`/api/diagnostics/watcher-events` does not exist** and `error_watch_events` has no `remediation_status`/`severity` columns. Both must be built in P1 before P4 can run. | Self-heal audit + my read | ✅ confirmed |

---

## Phase 0 — Provider Keystone (THE unblock) · effort: S · **DO FIRST**

**Goal:** `hermes -z` works; `checkpoint-hermes.sh` targets a model that exists; both have a sane off-hours + thermal gate. This single phase unblocks P2, P3, P4, P6.

### Steps

**Step 1 [AGENT] — Fix the model default + add gates in `scripts/checkpoint-hermes.sh` (repo, ships via auto-update):**
- Line 48: `MODEL="${HERMES_CHECKPOINT_MODEL:-llama3.2:3b}"` (was `llama3.1:8b`, which is not on T4 — **C1**).
- Add, before the curl call (~line 142), a thermal pre-check (**C6**) and off-hours gate for the heavy model (**C7**):
  ```bash
  # off-hours gate: qwen2.5:14b only 21:00–08:00 ET (never evict phi4-trader)
  if [ "$MODEL" = "qwen2.5:14b" ]; then
    ET_HOUR=$(TZ=America/New_York date +%H)
    if ! { [ "$ET_HOUR" -ge 21 ] || [ "$ET_HOUR" -lt 8 ]; }; then
      emit "UNAVAILABLE off-hours gate: qwen2.5:14b allowed 21:00-08:00 ET only (now ${ET_HOUR}:00 ET)"; exit 0
    fi
  fi
  # thermal gate: abort if T4 sustained hot (fan unpowered)
  THRESH="${HERMES_THERMAL_THRESHOLD:-82}"
  TEMP=$(nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits 2>/dev/null | head -1)
  if [ -n "$TEMP" ] && [ "$TEMP" -ge "$THRESH" ]; then
    emit "UNAVAILABLE thermal gate: T4 ${TEMP}C >= ${THRESH}C (fan unpowered)"; exit 0
  fi
  ```
- Drop the unimplemented `model-routing.yaml` (spec #1) entirely — **C** Spec1-audit-C2: it is cargo-cult config with no parser. Model selection stays in-script via `HERMES_CHECKPOINT_MODEL` env, which is the mechanism that already exists.
- Bump `package.json` (Standing Rule + CLAUDE.md versioning rule).

**Step 2 [OPERATOR] — `/tmp/deploy-hermes-llm.sh` on CT212 (idempotent, credential-gated):**
The operator runs this; the agent cannot write `~/.hermes/config.yaml` or `.env` (**C8**). Script must (folding in Spec1-audit C7/C8):
1. `curl --max-time 5 http://localhost:11434/api/version || { echo "ERROR: Ollama unreachable"; exit 1; }`
2. `curl -s http://localhost:11434/api/tags | grep -q 'llama3.2:3b' || ollama pull llama3.2:3b`
3. Re-verify the pull landed; exit 1 with a clear message if not.
4. Set Hermes provider → local Ollama. **Verify the exact provider keyword first** (`hermes model list` — Spec1-audit C8 flagged that `ollama` may not be a valid provider name; it may be `custom` with `base_url`). Operator confirms the keyword interactively via `hermes setup`, then the script writes it.
5. `sudo systemctl restart hermes-gateway` (SYSTEM unit — **C5**; confirm passwordless sudo for `ubuntu` on this unit, or operator enters password).
6. Smoke test: `hermes -z 'reply OK' ` returns non-error within 10s. Append a JSON line to `~/.hermes/llm-provider-audit.log`.

**Step 3 [OPERATOR] — confirm `ask_claude_code` OAuth health (C9):**
`ssh ubuntu@100.70.56.34 'hermes -z "use ask_claude_code to echo hello"'` — if OAuth expired, re-auth before relying on it as fallback. Document the expiry as a known recurring maintenance item in a `create_maintenance_todo`.

### Risks & constraints
- **Thermal (C6):** Phase 0 itself triggers no heavy inference — `llama3.2:3b` is ~2GB and fast. Safe even with fan unpowered. qwen2.5:14b stays gated.
- **Provider keyword unknown (Spec1-audit C8):** mitigated by operator running `hermes setup` interactively rather than the script blind-writing a guessed keyword.
- **OAuth expiry (C9):** the only cloud fallback; treat as fragile, log expiries.

### Verification (how we KNOW it works)
1. `hermes -z 'test'` returns a response < 10s (not "No LLM provider configured").
2. On the next real auto-update run on Holmgren, grep the update log for the shadow line: `grep 'hermes=' /home/ubuntu/sports-bar-data/update-logs/*.log | tail` — should show `hermes=GO|CAUTION|STOP`, not `hermes=UNAVAILABLE`.
3. Force a daytime run with `HERMES_CHECKPOINT_MODEL=qwen2.5:14b` → confirm it emits `UNAVAILABLE off-hours gate` and does **not** touch the GPU (`nvidia-smi` shows phi4-trader undisturbed).

---

## Phase 1 — Detection Plumbing (data substrate) · effort: M · parallel with P0

**Goal:** build the missing detection surface every acting-phase depends on. **Independent of the provider keystone** — pure repo/DB/API work that ships via auto-update — so it runs in parallel with P0.

### Steps (all [AGENT], ship via auto-update)

1. **`drizzle/0006_remediation_status.sql`** (**C3** — NOT 0004): add `remediation_status TEXT` (`unremediable|pending_action|action_taken|requires_human_review|escalated`) + `severity TEXT` (`info|warn|error|critical`) to `error_watch_events`. Backfill: `UPDATE error_watch_events SET remediation_status='unremediable', severity='warn' WHERE remediation_status IS NULL`. Generate via `npx drizzle-kit generate --name remediation_status`, hand-review for stray DROPs (Gotcha #6). Mirror the columns into `packages/database/src/schema.ts:3073` (`errorWatchEvents`).

2. **`apps/web/src/app/api/diagnostics/watcher-events/route.ts`** (new — **C10**): GET returns unhandled rows (`remediation_status IS NULL OR ='unremediable'` AND `severity` ≥ `warn`), grouped by `kind`, plus per-watcher liveness (`lastEventAt`, `eventCountLast5m`, `isActive`). Follow the standard `withRateLimit` → `validateQueryParams` route pattern. Add to Nginx allow-list (`setup-bartender-nginx.sh`) only if it must be reachable from :3002 (it should NOT — admin/diagnostic only, leave 403 on :3002).

3. **`verify-install.sh` → emit `/home/ubuntu/sports-bar-data/.verify-install-latest.json`** (folds Self-heal-audit correction): write the structured result `{timestamp, passed, total, failed[], layers:[{name, passed, exit_code, detail}]}` at the end of the run (or have auto-update.sh write it at Checkpoint C from the existing `--json` stdout — the `--json` mode already exists, line 32). Add deterministic exit-code → remediation-action mapping as a documented table, interpreted by the P4 skill (not emitted as free-text `remediationSuggestion`).

4. **Fix the trigger-path constant everywhere (C2):** the canonical HTTP trigger is `POST /api/system/auto-update/run-now`. Grep the repo for any `/api/auto-update/run-now` reference and correct it. (Specs #5 and #7 both had it wrong; the route does not exist there.)

5. **`check_watcher_event_table_exists()` / `schema_completeness` extension** in `verify-install.sh`: assert the new `0006` columns exist post-migrate (Gotcha #6 belt-and-suspenders — documented gotchas need enforcement, per memory).

### Risks
- **Migration silent-skip (Gotcha #6):** mitigated by using `drizzle-kit migrate` (not `push`) + the new verify layer.
- **Route 403 on :3002 (Nginx allow-list memory):** intentional here; do not add diagnostics routes to the bartender proxy.

### Verification
1. `npx drizzle-kit migrate` on a scratch DB → `0006` applies; `.schema error_watch_events` shows both columns.
2. `curl localhost:3001/api/diagnostics/watcher-events | jq` returns grouped rows.
3. After an auto-update, `/home/ubuntu/sports-bar-data/.verify-install-latest.json` exists and parses.
4. `verify-install.sh --json` passes the new completeness layer.

---

## Phase 2 — Scheduled Read-Only Monitoring · effort: M · needs P0

**Goal:** Hermes runs `fleet-health`, `fleet-heartbeat-watch`, `sports-bar-iso-audit` on a daily/12h cadence, reports drift to Telegram + the System-Admin TODO list. **Read-only — lowest blast radius — proves the autonomous loop before we let Hermes act.**

### Corrections folded in (Fleet-Monitoring audit)
- **Provider is a hard prerequisite** → satisfied by P0 (audit's "Step 0").
- **`hermes mcp add sports-bar-observe` will FAIL** because the repo is not cloned on CT212 (TODO #349) and `packages/mcp/start.sh` isn't there. → **Descope the MCP-on-CT212 path for P2.** fleet-health uses **SSH + `verify-install.sh --json`** against each box (deterministic, no MCP, no provider needed for the data-gathering leg). LLM is only used to *summarize* the collected JSON.
- **Fleet roster has no source of truth.** → P2 Step 1 creates one.
- **`hermes cron` plumbing unverified.** → P2 Step 0 verifies `hermes cron list` works before any `cron create`.

### Steps

0. **[OPERATOR] Verify cron infra:** `ssh ubuntu@100.70.56.34 'hermes cron list'`. If the subcommand errors, stop and file a ticket — do not proceed to create crons.

1. **[OPERATOR] Author `~/.hermes/config/fleet-boxes.json`** — the authoritative 7-box roster `{id, hostname/tailscale_ip, role}`. Operator supplies IPs (cross-ref `reference_tailscale_hostnames` memory; do NOT guess from branch slug — that memory explicitly warns conventions vary). **Exclude the gateway/local box from the sweep** (Fleet-audit blocking issue — Holmgren is the local box per `feedback_fleet_push_divergence`).

2. **[AGENT] Author skills in repo** under `scripts/hermes-skills/` (so they version + RAG-scan):
   - `fleet-health/SKILL.md` + `fleet-health.sh`: loops the roster, `ssh -o ConnectTimeout=10 <box> 'bash scripts/verify-install.sh --json'`, parses `{production_build_present, hub_agent_registered, schema_completeness}`, handles per-box SSH timeout gracefully (don't block the sweep on one dead box), maintains a **suppress-list** (Epson projector off-hours, .48 Atmosphere TV — both in memory) so known-expected offlines don't alarm.
   - Update `fleet-heartbeat-watch/SKILL.md` to also `POST /intel/relay` (agent-bus) in addition to Telegram, wrapped in a 5s timeout, fail-open.
   - `sports-bar-iso-audit` already exists in repo — operator copies to `~/.hermes/skills/`.

3. **[OPERATOR] Install + schedule on CT212:**
   - Copy skills into `~/.hermes/skills/`.
   - `sudo systemctl restart hermes-gateway` (SYSTEM scope — **C5**).
   - `hermes cron create --name fleet-daily-sweep --skill fleet-health 'every day at 06:00'` (06:00 CT = within 21:00–08:00 ET off-hours window, no phi4-trader contention — **C6**). The deep-summary LLM step uses `llama3.2:3b` (always-on) or, off-hours, qwen2.5:14b under the P0 gate.
   - `hermes cron create --name fleet-heartbeat --skill fleet-heartbeat-watch 'every 12h'`.
   - **Verify each:** `hermes cron list | grep fleet-daily-sweep`.

4. **[AGENT] Doc:** add a "Monitoring" section to `docs/HERMES_AGENT_OPERATIONS.md`; RAG-rescan after (Standing Rule 11).

### Risks
- **SSH key gaps** → a box reports UNREACHABLE once on transition; pre-verify Tailscale + keys on CT212 before enabling cron.
- **Sweep duration** (30–60s × 7 ≈ 3–7 min): 12h/daily cadence is safe; add a PID-file mutex so an overlapping manual run doesn't double-report.
- **Thermal:** all crons fire 06:00 CT (off-hours); summary on `llama3.2:3b` is light. Safe pre-PSU.

### Verification
1. First `fleet-health` run posts a full baseline to Telegram + creates/updates System-Admin TODOs.
2. Kill SSH to one box → next sweep reports exactly that box UNREACHABLE, others green.
3. `intel-alerts.log` / agent-bus relay shows the heartbeat POST landing on the trading side.

---

## Phase 3 — Agent-Bus Responder (passive detect → active triage) · effort: M · needs P0

**Goal:** upgrade the `*/15 intel-mail-monitor.sh` detect-only cron into an active skill that ACKs/answers low-risk asks and escalates the rest. **Three-tier taxonomy, no state mutation in v1.**

### Corrections folded in (Bus-responder audit)
- **`bot_message_claude` does not exist (C4).** DELEGATE = `create_maintenance_todo`; ESCALATE = `create_maintenance_todo` with an escalation flag (or `propose_action`, no-exec). Remove all `bot_message_claude` references.
- **Systemd scope (C5):** responder timer is SYSTEM-scoped (`/etc/systemd/system/`) to match the gateway, OR a user timer that shell-invokes `sudo systemctl` — pick SYSTEM to avoid the crash-loop-duplicate the audit flagged.
- **responder.py execution context undefined:** responder is a standalone process that invokes Hermes tools by shelling to `hermes -z` with a JSON tool request and parsing the JSON reply (the only documented IPC). Document the exact invocation in the skill.
- **`/api/agent-bus/status` (CT211 hub) is OUT OF SCOPE for v1** — mark optional; do not gate verification on it.
- **nvidia-smi T4 check in responder is INFORMATIONAL ONLY** — ask_claude_code runs on Holmgren, not the T4, so responder doesn't load the GPU. Log GPU state, don't block on it.
- **Verify the intel-proxy contract live first** (the spec reverse-engineered it): `curl -H "Authorization: Bearer $(cat ~/.hermes/.intel_token)" http://100.104.20.107:5057/intel/claude_messages | jq` before coding the parser. Use `dict.get()` with safe defaults (only `ts`+`text` required).

### Steps

0. **[OPERATOR] Pre-flight:** verify `hermes -z` works (P0 done), `hermes skill list` lists existing skills, and the intel-proxy returns valid JSON (curl above).
1. **[AGENT] Author `scripts/hermes-skills/agent-bus-responder/`** (SKILL.md + responder.py) in repo. Tiers: AUTO-RESPOND (ACK, health via `get_system_health`, log reads) → DELEGATE (`create_maintenance_todo`) → ESCALATE (`create_maintenance_todo` + flag). Cache health responses 60–300s. `.intel_last_seen` tracked under `flock`, fall back to `now-1h` if corrupt (idempotent POSTs make double-ack safe).
2. **[OPERATOR] Deploy on CT212** via idempotent `/tmp/deploy-agent-bus-responder.sh`: copy skill, install SYSTEM timer+service (`/etc/systemd/system/agent-bus-responder.{timer,service}`, 5-min), `sudo systemctl enable --now`, `sudo systemctl restart hermes-gateway`.
3. **[OPERATOR] Decommission the old `*/15 intel-mail-monitor.sh`** (comment out the crontab entry) to prevent dueling pollers (audit RISK-5). `.intel_last_seen` becomes the single source of truth.

### Risks
- **OAuth-fail for ask_claude_code (C9):** decision tree — timeout >30s → `create_maintenance_todo(category=hermes_ask_claude_timeout)`, retry next tick; 3 consecutive → escalate. Never silent-hang.
- **Token security:** `~/.hermes/.intel_token` chmod 600; whitelist message categories; rotate per ops runbook.
- **Schema drift on the proxy:** safe-default parser + WARN-and-continue on unknown fields.

### Verification
1. `systemctl status agent-bus-responder.timer` active+enabled; `journalctl -u agent-bus-responder -f` shows a run within 5 min.
2. `hermes run agent-bus-responder --dry-run` reports "N polled, M new, X auto-responded, Y escalated".
3. Inject a known ACK-class message on the trading side → responder posts `RECEIVED` to `/intel/relay`; a synthetic ASSIST message → a `create_maintenance_todo` appears in System Admin.

---

## Phase 4 — Closed-Loop Self-Healing (bounded remediation) · effort: M–H · needs P0 + P1 + P2

**Goal:** detection → diagnosis → **bounded, cooldown-gated, max-attempt-limited** auto-remediation (restart a stale watcher, ADB reconnect, re-trigger a stalled update). Risky actions ESCALATE only.

### Corrections folded in (Self-heal audit — verdict was `blocked-on-dependency`)
- **Migration is 0006, built in P1 (C3/C10).** P4 must not re-declare it.
- **`/api/diagnostics/watcher-events` built in P1 (C10).**
- **`.verify-install-latest.json` emitted in P1.**
- **Re-trigger path = `POST /api/system/auto-update/run-now` (C2)**, not `/api/auto-update/run-now`.
- **Diagnosis is DETERMINISTIC-FIRST.** Given OAuth fragility + thermal limits, the exit-code→action map is the primary path; `ask_claude_code` for unfamiliar signatures is best-effort and off-hours-gated. If unavailable → generic "unknown signature → escalate via `create_maintenance_todo`". (Self-heal-audit's lower-risk option (b).)
- **Off-hours cron wrapper must be written (C6/C7)** — the actual `date +%H` TZ gate, not a described one. ADB ops + any ask_claude_code only 21:00–08:00 ET.
- **Cooldown persistence:** add a `remediation_actions {id, action, target, last_executed_at, success}` table (in the P1 migration or a follow-on `0007`) so cooldowns survive skill restarts. In-memory cooldowns reset on restart and are NOT acceptable for max-attempts enforcement.
- **Hub audit token:** reuse the existing `HUB_AGENT_SECRET` pattern rather than a new `HUB_REMEDIATION_AUDIT_TOKEN`; hub endpoint must validate Bearer + return 403, and the skill logs HTTP codes.

### Steps

1. **[AGENT] Author bounded-remediation scripts** in `scripts/bounded-remediation/` (repo, exit 0/N+stderr, `timeout 30s`): `restart-error-watch.sh`, `restart-atlas-drop-watcher.sh`, `adb-reconnect-cube.sh <IP>`, `retrigger-auto-update.sh` (curl the **correct** run-now path, poll `auto_update_history` for the new row).
2. **[AGENT] Author `scripts/hermes-skills/sports-bar-self-healing/`** (SKILL.md + `guardrails.json`). SAFE actions (auto, cooldown): watcher restart (heartbeat stale >12 min), ADB reconnect (≥5 offline probes), update re-trigger (>26h since timer). RISKY (escalate only): PM2 restart (crash-loop check first), Fire TV factory reset, rollback. **Never trigger rollback** (operator-only, guarded at auto-update.sh). Read `.verify-install-latest.json` + `/api/diagnostics/watcher-events` for signals.
3. **[AGENT] `0007` migration** for `remediation_actions` (cooldown persistence) if not folded into 0006.
4. **[OPERATOR] Stage scripts on each box** (`/home/ubuntu/scripts/bounded-remediation/`, `chmod +x`) and install the skill + **off-hours cron wrapper** on CT212. Wrapper: skip 09:00–16:00 ET on weekdays (C7).
5. **[OPERATOR] Hub side (CT211):** add `/api/remediation-audit` to `/opt/sbcc-hub/apps/hub/server.js` with `HUB_AGENT_SECRET` validation; `pm2 restart sbcc-hub`. (SBCC deploy is build-and-copy as root per `reference_sbcc_hub_deploy` memory.)

### Risks
- **False-positive restart loops:** max-attempts 2×/24h (enforced via `remediation_actions` table) → then `unremediable` + escalate. Canary on Holmgren 3 days before fleet.
- **Cascading-failure / restart-script-fails-silently:** scripts must surface exit codes; skill logs `result=FAILED` to `self-healing-decisions.jsonl`.
- **Thermal/OAuth:** deterministic path needs neither GPU nor cloud; diagnosis LLM is off-hours best-effort.

### Verification
1. Kill the error-watch heartbeat on Holmgren, wait 12 min, run the skill → it detects, runs `restart-error-watch.sh`, heartbeat returns within 60s, row marked `action_taken`.
2. Set `auto_update_state` stalled → re-trigger fires a real `run-now`, new `auto_update_history` row appears.
3. 3 days on a healthy fleet → **zero** unnecessary restarts in the audit log (the real success metric).
4. Hub `remediation-audit.jsonl` shows POSTs with valid token; a forged token → 403.

---

## Phase 5 — Event-Driven Push Transport · effort: M · needs P1; gated by Hermes ingest endpoint

**Goal:** replace poll-only watcher visibility with fire-and-forget push to a unified ingest endpoint; **poll stays as the truth source** (best-effort push, never mission-critical).

### Corrections folded in (Event-ingest audit)
- **The Hermes gateway has NO event-ingest endpoint** — this is the gate (audit's Phase 1). **Re-sequence:** ship Steps 1–5 (local `WatcherEvent` table + ingest route + on-box emitters + status endpoint) as **Phase 5A**, fully independent and useful on their own. **Phase 5B** (the Hermes sync) ships ONLY after the gateway endpoint exists + has a documented POST schema.
- **Do NOT use `ask_claude_code` as the relay transport** (audit). Use a plain HTTP pull: Hermes curl-pulls `GET /api/ingest/watcher-events?since=<epoch>` on a */15 cron from CT212. ask_claude_code is for analysis, not message transport.
- **Correct run-now/trigger constants (C2).**
- **WatcherEvent table needs its own verify-install completeness check** (Gotcha #6).
- **`check_ingest_pipeline_active` is SKIP-if-flag-0, not WARN** — decouple canary rollout from verify-install success.
- **Thermal:** burst event-analysis on T4 is off-hours/load-shed behind phi4-trader (C6).

### Steps (5A all [AGENT])
1. `WatcherEvent` table in `schema.ts` + migration (`0008`), with the completeness check.
2. `apps/web/src/app/api/ingest/watcher-events/route.ts` — POST, dedup (watcherType, locationId, signature, 5s window), 202-Accepted.
3. Emit POSTs (try/catch, 3s timeout, non-blocking, poll stays) from `atlas-drop-watcher.ts`, `shure-rf-watcher.ts`, `scripts/watchers/error-watch.sh`.
4. `/api/ingest/status` freshness endpoint.
5. `WATCHER_INGEST_ENABLED` feature flag; canary on Holmgren 1 week before flipping fleet-wide.

**5B [OPERATOR + external dep]:** once the Hermes gateway exposes an ingest endpoint (separate Hermes-maintainer deliverable), deploy `scripts/hermes-ingest-sync.sh` (HTTP pull, `lastSeenEpoch` in `/tmp`, idempotent via `deduped_id`).

### Verification
- 5A: synthetic POST → 202; dedup drops a 2s-later duplicate; `/api/ingest/status` shows freshness; poll fallback still writes the local DB if ingest is down.
- 5B: events appear in `~/.hermes/events.jsonl` on CT212 within one */15 cycle; kill CT212 → no event loss, catch-up on return.

---

## Phase 6 — Shadow → Primary Checkpoint Cutover · effort: L · needs P0 + weeks of P2/P4 agreement data

**Goal:** once Hermes has demonstrably agreed with cloud reviewers, flip Hermes to **primary** auto-update reviewer (cloud as fallback), removing the cloud-credit single-point-of-failure that froze the fleet in v2.73.

### Corrections folded in (Shadow→primary audit — the biggest gap, ~800–1100 LOC missing)
- **The 14-day + 100-sample gate is mathematically incompatible** with deterministic-primary (shadow runs ~10% of the time → ~8 samples in 14 days). **Replace with: agreement >90% over 100+ samples in any window + zero STOP-vs-GO disagreements + <5% DECISION-line-omission rate** (Gotcha #12, which I confirmed lives in `checkpoint-hermes.sh:166` — llama omits the DECISION line). Drop the calendar gate.
- **Wrong path: `~/.config/cron.d/` is not a cron directory** → use a SYSTEM or user systemd `.timer` (C5).
- **Missing infrastructure is large and real:** the `/api/fleet/aggregate-shadows` hub route (~150 LOC), `checkpoint-shadow-analyzer` skill (~300 LOC), `hermes approve-checkpoint-cutover` / `revert` CLIs + state machine (~200 LOC), `HERMES_CHECKPOINT_PRIMARY` flip in `auto-update.sh` (~30 LOC). **This is the most expensive phase — schedule it last and budget accordingly.**
- **Timeout coordination (verified):** `hermes_shadow_review` uses hardcoded `timeout 150` (auto-update.sh:550) while the primary path uses the tunable timeout (line 641). Unify or document before cutover, so a slow shadow doesn't get misread as disagreement.
- **Thermal:** during cutover the primary review IS the qwen2.5:14b/llama3.2:3b call — gate to off-hours for the heavy model; prefer `llama3.2:3b` for the always-on path. Full-fleet activation waits on the **T4 PSU** (hard external dependency).
- **Cutover is operator-gated (C8):** `hermes approve-checkpoint-cutover` requires reading the agreement report; write to `.checkpoint-shadow-status.json` is gated; revert sets a 7-day cooldown.

### Steps (high level — this phase is its own mini-project)
1. **[AGENT]** centralize shadow JSONL → fleet log; extend the sidecar schema to capture `{real_decision, hermes_decision, agree, reasoning[:200]}`.
2. **[OPERATOR/CT211]** build `/api/fleet/aggregate-shadows` on the hub (reuse `HUB_AGENT_SECRET`).
3. **[AGENT]** `checkpoint-shadow-analyzer` skill → daily agreement report + `cutover_ready` rollup with the corrected metric.
4. **[AGENT]** `HERMES_CHECKPOINT_PRIMARY` flip logic in `auto-update.sh` (reads the gated status file).
5. **[OPERATOR]** approve/revert CLIs + audit trail; canary (Holmgren + Lime Kiln) first.

### Verification
- Agreement report shows >90% over 100+ real samples, 0 STOP-vs-GO, <5% DECISION-omission, before the approve CLI will even offer cutover.
- After approval: an intentional bad merge on the canary → Hermes STOPs → rollback fires. Revert CLI flips back to cloud-primary within one cron tick; 7-day cooldown blocks re-cutover.

---

## Risk & Constraint Register (whole roadmap)

| Constraint | Where it bites | Standing mitigation |
|---|---|---|
| **LLM credits** (grok OOC, ANTHROPIC_API_KEY OOC) | P0, P3, P4, P6 | Local Ollama (`llama3.2:3b` always; `qwen2.5:14b` off-hours) is primary. `ask_claude_code` OAuth is fragile fallback (C9) — degrade to deterministic + `create_maintenance_todo`, never hang. |
| **T4 thermal** (fan unpowered, ~69C idle) | P2, P4, P6 | Off-hours gate (C7) + `nvidia-smi` thermal abort (C6). Never evict phi4-trader. Full-fleet P6 waits on PSU. |
| **Permission gating** (no agent writes to CT212/CT211/creds) | every phase | Every config/credential write tagged **[OPERATOR]** via idempotent `/tmp/deploy-*.sh`; agent only commits repo files that ship via auto-update (C8). |
| **SYSTEM-scoped gateway** | P2, P3, P6 | `sudo systemctl restart hermes-gateway`; SYSTEM-scoped timers (C5). |
| **Drizzle push silent-skip** (Gotcha #6) | P1, P4, P5 | `drizzle-kit migrate` + per-table completeness checks in verify-install. |
| **Branch discipline** | every [AGENT] commit | Software → `main` first, then merge to location; `git branch --show-current` before commit (memory: branch-slip bit repeatedly). Bump `package.json`. RAG-rescan after doc/skill commits (Standing Rule 11). |

---

## The Single Highest-Leverage First Move

**Fix `scripts/checkpoint-hermes.sh:48` from `llama3.1:8b` → `llama3.2:3b`, commit + bump + ship, then have the operator run `/tmp/deploy-hermes-llm.sh` on CT212 to point Hermes' provider at local Ollama and confirm `hermes -z 'test'` returns < 10s.**

Why this and not "configure a provider" generically: the repo's committed default targets a model **that does not exist on the T4** (verified: T4 has qwen2.5:14b / llama3.2:3b / nomic-embed-text / mistral-nemo). The existing `hermes_shadow_review()` loop is already wired into `auto-update.sh` — it has been silently emitting `UNAVAILABLE` because every checkpoint call requests an absent model. One-line correctness fix + one operator config write turns the *already-built* shadow loop from dead to live, which is the data source Phase 6 needs and the execution substrate Phases 2–4 need. It is S-effort, zero thermal cost (3B model), and unblocks five downstream phases.

**Relevant files:** `/home/ubuntu/Sports-Bar-TV-Controller/scripts/checkpoint-hermes.sh` (line 48 default; lines 142+ gate insertion), `/home/ubuntu/Sports-Bar-TV-Controller/scripts/auto-update.sh` (lines 543/550/641/710 shadow+primary), `/home/ubuntu/Sports-Bar-TV-Controller/packages/database/src/schema.ts` (line 3073 `errorWatchEvents`), `/home/ubuntu/Sports-Bar-TV-Controller/drizzle/` (next migration is `0006`), `/home/ubuntu/Sports-Bar-TV-Controller/packages/mcp/src/server.ts` (real tool list, line 568), `/home/ubuntu/Sports-Bar-TV-Controller/scripts/hermes-skills/` (only `sports-bar-iso-audit` exists today).