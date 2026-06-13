# @sports-bar/mcp

Sports-Bar **MCP server** — the single safe gateway between the Hermes Agent brain (or any
[Model Context Protocol](https://modelcontextprotocol.io) client) and this system.

Every tool here is a **thin adapter over an existing, already-audited HTTP API** on the local app
(`127.0.0.1:${APP_PORT}`, default 3001). No business logic lives in this package, and **nothing here
writes to hardware** — Phase 1 tools are strictly read-only "observe" tools. Writes (later phases) go
through a `propose_action` pattern that returns a proposal for a human one-tap confirm, never an
autonomous hardware command (see the Hermes adoption plan).

## Run / register

```bash
# run standalone (stdio JSON-RPC) — Hermes launches this as a subprocess:
node_modules/.bin/tsx packages/mcp/src/server.ts          # or: packages/mcp/start.sh

# register with Hermes Agent (answer Y to the "enable tools" prompt):
hermes mcp add sports-bar --command /home/ubuntu/Sports-Bar-TV-Controller/packages/mcp/start.sh
hermes mcp test sports-bar      # connect + enumerate tools
hermes mcp list
```

`start.sh` resolves the repo root relative to itself and uses the repo-local `tsx`, so no global
install is needed. Transport is **stdio**; diagnostics go to **stderr only** (stdout is the JSON-RPC
stream and must not be polluted).

## Tools

| Tool | Reads | Notes |
|------|-------|-------|
| `get_system_health` | `GET /api/system/health` | Overall status + any device not online / with issues. First step for "is everything working?" |
| `list_open_todos` | `GET /api/todos` | Open (non-COMPLETE) System Admin todos, needs-work first. |
| `get_matrix_routes` | `GET /api/matrix/routes` | Live Wolf Pack routes (output ← input). Logical outputs (outputOffset applied). |
| `explain_tv_output` | `GET /api/matrix/routes` | Arg `outputNumber`: which input feeds that TV. |
| `get_shure_rf_status` | `GET /api/shure-rf/status` | Wireless/paging-mic receivers: per-channel connect/freq/gain/band. |
| `get_atlas_status` | `GET /api/atlas-priority`, `/api/atlas-drops` | Active priority/page events + recent zone drops. |
| `get_firetv_status` | `GET /api/firetv-devices` | Fire TV roster: online/offline + matrix input fed. |
| `search_system_docs` | `POST /api/rag/query` | Args `query`, optional `tech`: grounded answer + sources from the system docs (RAG). How the agent teaches itself on demand. |
| `create_maintenance_todo` | `POST /api/maintenance-todo` | Phase 2 — guarded WRITE. Args `title`, `description?`, `priority?`. Files a reviewable todo (source `ai-chat`, deduped). The only write this gateway permits; never touches hardware. |
| `propose_action` | (none — pure) | Phase 2 — returns a PROPOSAL for a human to confirm; **never executes**. Args `action` (`route_tv`/`tune_channel`), `params`. Maps to the deterministic API call a human/UI then runs. |

Read tools + `propose_action` never write anything. `create_maintenance_todo` only appends a reviewable
todo. **No tool here ever issues an autonomous hardware command** — hardware changes always go through a
human one-tap confirm against the existing deterministic, audited API.

## Audit (Phase 2)

Every tool invocation is fire-and-forget logged to `agent_tool_invocations` (via `POST /api/agent/tool-log`):
tool, args, result summary, `surface` (`operator` by default; the bartender web bridge sets
`MCP_SURFACE=bartender`), and error flag. Audit failures never affect the tool result.

## Model note (important)

Tool-calling needs a capable model. **`hermes3:8b` is too weak** — it prints the tool-call JSON as
text instead of invoking it. Use **Grok** (the xAI escape hatch) or a **14B** local model for any
tool-using agent turn; reserve 8B for plain chat/summarize. Verified end-to-end via Grok 2026-06-13.

## Config

- `APP_PORT` — app port the tools call (default `3001`).
- `MCP_API_TIMEOUT_MS` — per-call HTTP timeout (default `10000`).
