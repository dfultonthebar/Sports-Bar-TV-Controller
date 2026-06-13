#!/usr/bin/env tsx
/**
 * @sports-bar/mcp — Sports-Bar MCP server (Phase 1: read-only observe tools).
 *
 * A stdio Model Context Protocol server that exposes the system to Hermes Agent
 * (or any MCP client). Every tool is a THIN ADAPTER over an existing, already-
 * audited HTTP API on the local app (127.0.0.1:APP_PORT) — no business logic
 * lives here, and nothing in this package writes to hardware. This is the
 * single safe gateway from the agent brain to the system (see the Hermes
 * adoption plan + [[project-hermes-agent-adoption]]).
 *
 * Run (Hermes launches it as a subprocess):
 *   tsx packages/mcp/src/server.ts
 * Register with Hermes:
 *   hermes mcp add sports-bar --command tsx --args <abs path to this file>
 *
 * Phase 1a tools (this commit): get_system_health, list_open_todos.
 * Later commits add: get_matrix_routes, get_shure_rf_status, get_atlas_status,
 * get_firetv_apps, explain_tv_output, search_system_docs (RAG).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const APP_PORT = process.env.APP_PORT || '3001'
const BASE = `http://127.0.0.1:${APP_PORT}`
const API_TIMEOUT_MS = Number(process.env.MCP_API_TIMEOUT_MS) || 10_000

/** GET an app API path as JSON, with a hard timeout so a hung route can't hang the tool. */
async function apiGet(path: string): Promise<any> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { accept: 'application/json' },
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/** Wrap a tool body so any failure returns a clean MCP error result instead of crashing the server. */
function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] }
}
function fail(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true }
}

const server = new McpServer({ name: 'sports-bar', version: '1.0.0' })

// ── get_system_health ─────────────────────────────────────────────────────
server.registerTool(
  'get_system_health',
  {
    description:
      'Read-only snapshot of overall system + device health (TVs, audio, network, etc.). ' +
      'Use this to answer "is everything working?", "what is offline?", or as the first step ' +
      'when diagnosing a problem. Returns the overall status plus a list of any devices that ' +
      'are not online or have active issues.',
  },
  async () => {
    try {
      const h = await apiGet('/api/system/health')
      const o = h?.overall ?? {}
      const problems: string[] = []
      for (const [cat, devices] of Object.entries(h?.categories ?? {})) {
        if (!Array.isArray(devices)) continue
        for (const d of devices as any[]) {
          const issues: string[] = Array.isArray(d?.issues) ? d.issues : []
          if (d?.status !== 'online' || issues.length > 0) {
            problems.push(
              `${d?.name ?? d?.id ?? 'unknown'} (${cat}): ${d?.status ?? '?'}` +
                (issues.length ? ` — ${issues.join('; ')}` : ''),
            )
          }
        }
      }
      const summary = [
        `Overall: ${o.status ?? '?'} (health ${o.health ?? '?'}%), ` +
          `${o.devicesOnline ?? '?'}/${o.devicesTotal ?? '?'} devices online, ` +
          `${o.activeIssues ?? 0} active issue(s).`,
        problems.length
          ? `Devices needing attention:\n- ${problems.join('\n- ')}`
          : 'All devices report online with no active issues.',
      ].join('\n')
      return ok(summary)
    } catch (e) {
      return fail(`Could not read system health: ${(e as Error).message}`)
    }
  },
)

// ── list_open_todos ───────────────────────────────────────────────────────
server.registerTool(
  'list_open_todos',
  {
    description:
      'Read-only list of open (not-yet-complete) maintenance/work TODO items from the ' +
      'System Admin → Todos list, sorted needs-work first. Use this to answer ' +
      '"what needs fixing?", "what is on the to-do list?", or to check open issues. ' +
      'Read-only — does not create or change todos.',
  },
  async () => {
    try {
      const r = await apiGet('/api/todos')
      const rows: any[] = Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : []
      const open = rows.filter((t) => String(t?.status).toUpperCase() !== 'COMPLETE')
      if (!open.length) return ok('No open todos — the list is clear.')
      const lines = open
        .slice(0, 40)
        .map(
          (t) =>
            `• [${t.status}] [${t.priority}] ${t.title}` +
            (t.category ? ` (${t.category})` : ''),
        )
      return ok(`${open.length} open todo(s):\n${lines.join('\n')}`)
    } catch (e) {
      return fail(`Could not read todos: ${(e as Error).message}`)
    }
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // stdio server runs until the client disconnects; no stdout logging (it would
  // corrupt the JSON-RPC stream — diagnostics go to stderr only).
  process.stderr.write('[sports-bar-mcp] connected (stdio) — tools: get_system_health, list_open_todos\n')
}

main().catch((e) => {
  process.stderr.write(`[sports-bar-mcp] fatal: ${(e as Error)?.stack || e}\n`)
  process.exit(1)
})
