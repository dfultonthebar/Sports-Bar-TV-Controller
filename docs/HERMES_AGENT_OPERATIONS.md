# SOP: Operating the Hermes Agent (the operator brain)

**Purpose:** how to run, troubleshoot, and extend the Hermes Agent — the always-on
AI operator brain that talks to staff over Telegram, monitors the fleet, and
delegates deep work to Claude Code. Stood up 2026-06-13/14. Runs on Holmgren.

**Audience:** operator / Claude Code. Per-box runtime lives in `~/.hermes/`
(OUTSIDE the repo + outside RAG); version-controlled pieces are in `hermes/`.

---

## What it is
- **Runtime:** `hermes` CLI + a systemd user service `hermes-gateway.service` that
  fires cron jobs + handles Telegram. Model: **grok-4** (xAI) — tool-capable.
  (The local `hermes3:8b` can't reliably tool-call; do NOT make it the gateway default.)
- **Persona:** `hermes/SOUL.md` → installed to `~/.hermes/SOUL.md`, loaded into the
  system prompt. Defines its identity, registers (bartender vs operator), tools, guardrails.
- **Memory:** **Honcho cloud** (`api.honcho.dev`) — cross-session. Distilled
  essentials in `~/.hermes/memories/MEMORY.md` (keep < ~2200 chars; full corpus is RAG).
- **Knowledge:** RAG (`search_system_docs` MCP tool) over all of CLAUDE.md + docs/ +
  per-location refs. This is how it "knows" the system — it looks things up, doesn't guess.
- **Tools (MCP):** `@sports-bar/mcp` stdio server (`packages/mcp/`, runs via tsx,
  registered with `hermes mcp add`). 11 tools: observe (system_health, matrix_routes,
  explain_tv_output, shure_rf, atlas, firetv, todos, search_system_docs), guarded
  (propose_action, create_maintenance_todo), and `ask_claude_code` (the Claude bridge).
- **Skills:** `hermes/skills/` → `~/.hermes/skills/`, all pinned (`hermes curator pin`).
  Sports-bar playbooks + Claude-collaboration + bartender-howto generation. See `hermes skills list`.

## Common commands
```bash
hermes gateway status|restart        # the service (restart = re-reads SOUL.md, config, MCP)
hermes -z "..." -m grok-4            # one-shot agent run (separate session; safe for tests)
hermes skills list                   # installed skills
hermes curator pin <skill>           # protect a skill from auto-prune
hermes cron list|create              # scheduled jobs (morning-brief, anomaly-alert, fleet-update-watch, backup)
hermes honcho status                 # memory connection + recall mode
hermes sessions list|delete <id>     # session history (see "repeat-loop" below)
```

## The `ask_claude_code` bridge (Hermes → Claude Code)
- Spawns `claude -p "<question>" --permission-mode plan` — **READ-ONLY** (Claude
  analyzes/plans/drafts, never edits/commits). Hermes is the brain; Claude is the
  read-only analyst.
- **Auth: subscription OAuth** (`~/.claude/.credentials.json`), NOT the metered API
  key — set by `MCP_CLAUDE_USE_OAUTH=true` in `packages/mcp/start.sh`. `runClaude`
  strips any inherited `ANTHROPIC_API_KEY` in OAuth mode. To revert to the durable
  metered key, unset that flag.
- Timeouts: the MCP per-tool cap is `timeout: 360` in `~/.hermes/config.yaml`
  (`mcp_servers.sports-bar`), and `runClaude`'s inner cap is 300 s (`MCP_CLAUDE_TIMEOUT_MS`).
  Keep the MCP cap > the inner cap so a deep delegation returns instead of being cut.

## Troubleshooting

### Telegram bot repeats itself / re-asks after a command
The session accumulated **message-alternation violations** (the gateway log shows
`Repaired N ... violations`, N climbing by ~1/turn). The history is corrupted from
mid-turn interruptions + gateway restarts, so the agent loses context and re-asks.
**Fix:** reset the session — `hermes sessions delete <session_id> --yes` (find it
in `hermes sessions list`). The next message starts a clean session; Honcho keeps
the memory. (Likely contributor: Honcho hybrid-recall injecting a context message
each turn — if it recurs fast on a fresh session, switch recall mode to `tools`.)

### It loops asking the operator to restart / "do it yourself"
Almost always: it was running the weak `hermes3:8b` (can't tool-call) OR a deep
`ask_claude_code` timed out. Confirm the gateway default is **grok-4**. It cannot
restart its own gateway (that terminates the turn) — restarts are a human/Claude job.

### Bridge fails / times out
Check `ask_claude_code` isn't being cut by the 120 s default MCP cap (must be 360),
and that OAuth is valid (`env -u ANTHROPIC_API_KEY claude -p "hi" --permission-mode plan`).

### Memory not recalling / "over 2200 chars"
`~/.hermes/memories/MEMORY.md` is over the soft limit — consolidate to the distilled
essentials (the full corpus is in RAG). Honcho uploads it on session setup.

## Extending it (skills)
1. Write `hermes/skills/<name>/SKILL.md` (frontmatter + `## Workflow`); copy to
   `~/.hermes/skills/`; `hermes curator pin <name>`.
2. Skills should ORCHESTRATE the tools + `search_system_docs` — do NOT duplicate the
   doc corpus (RAG is the single source of truth).
3. Commit the version-controlled copy under `hermes/skills/` to **main** (shared);
   `~/.hermes/skills/` is per-box runtime.
4. After any doc/skill change → RAG rescan (`scripts/rag-rescan-if-needed.sh`,
   Standing Rule 11) so the chat + the agent see it.

## Crons in play (fleet-standard)
`sports-bar-morning-brief` (7:45 AM), `sports-bar-anomaly-alert` (every 2h),
`fleet-update-watch` (every 6h — detects stuck/diverged boxes, hands the fix to
Claude), `daily-github-backup` (3 AM — backs up the agent's brain to a private repo).
