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
import { spawn } from 'node:child_process'
import { z } from 'zod'

const APP_PORT = process.env.APP_PORT || '3001'
const BASE = `http://127.0.0.1:${APP_PORT}`
const API_TIMEOUT_MS = Number(process.env.MCP_API_TIMEOUT_MS) || 10_000

// Claude Code CLI (Anthropic's coding agent) — lets Hermes delegate deep
// code/diagnostic work to Claude. Full path because the gateway's spawn env
// may not include ~/.local/bin on PATH.
const CLAUDE_BIN = process.env.CLAUDE_BIN || '/home/ubuntu/.local/bin/claude'
const CLAUDE_TIMEOUT_MS = Number(process.env.MCP_CLAUDE_TIMEOUT_MS) || 180_000
const REPO_ROOT = process.env.REPO_ROOT || process.cwd()

/**
 * Run Claude Code headlessly in READ-ONLY plan mode (no edits/commits/mutating
 * bash). The question is passed as an argv element (no shell), so it can't be
 * injected. Returns Claude's answer text (truncated).
 */
function runClaude(question: string): Promise<{ ok: boolean; text: string }> {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(CLAUDE_BIN, ['-p', question, '--permission-mode', 'plan'], {
        cwd: REPO_ROOT,
        env: { ...process.env, PATH: `/home/ubuntu/.local/bin:${process.env.PATH || ''}` },
      })
    } catch (e) {
      return resolve({ ok: false, text: `Could not start Claude: ${(e as Error).message}` })
    }
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve({ ok: false, text: `Claude timed out after ${CLAUDE_TIMEOUT_MS / 1000}s` })
    }, CLAUDE_TIMEOUT_MS)
    child.stdout?.on('data', (d) => { out += d.toString() })
    child.stderr?.on('data', (d) => { err += d.toString() })
    child.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, text: `Could not run Claude: ${e.message}` }) })
    child.on('close', (code) => {
      clearTimeout(timer)
      const text = (out.trim() || err.trim() || '(no output)').slice(0, 6000)
      resolve({ ok: code === 0, text })
    })
  })
}

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

/** POST a JSON body to an app API path. Longer timeout — RAG generation can take a few seconds. */
async function apiPost(path: string, body: unknown): Promise<any> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), Math.max(API_TIMEOUT_MS, 30_000))
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`POST ${path} → HTTP ${res.status}`)
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

// Which surface is driving this MCP session — 'operator' (CLI / Grok) by default;
// the bartender web bridge (Phase 3) sets MCP_SURFACE=bartender. Recorded on every audit row.
const MCP_SURFACE = process.env.MCP_SURFACE || 'operator'

// Bound reference so registerAuditedTool can wrap the real method without a
// global-replace catching the wrapper's own call (which would recurse).
const _registerTool = server.registerTool.bind(server)

/** Fire-and-forget audit of a tool invocation to /api/agent/tool-log. Never blocks or throws. */
function logInvocation(tool: string, args: unknown, resultText: string, isError: boolean): void {
  const hasArgs = !!args && typeof args === 'object' && Object.keys(args as object).length > 0
  apiPost('/api/agent/tool-log', {
    tool,
    args: hasArgs ? args : undefined,
    resultSummary: (resultText || '').slice(0, 500),
    surface: MCP_SURFACE,
    isError,
  }).catch(() => {
    /* audit is best-effort; a logging failure must never affect the tool */
  })
}

/** registerTool + automatic audit of every invocation (intent + result). */
function registerAuditedTool(
  name: string,
  config: any,
  handler: (args: any) => Promise<any>,
): void {
  const hasInput = !!config?.inputSchema
  _registerTool(name, config, async (a: any) => {
    // For inputSchema tools the SDK passes validated args first; for zero-arg
    // tools the first param is the request `extra`, so treat args as empty.
    const args = hasInput ? a : {}
    const res = await handler(args)
    const text = res?.content?.[0]?.text ?? ''
    logInvocation(name, hasInput ? args : {}, text, res?.isError === true)
    return res
  })
}

// ── get_system_health ─────────────────────────────────────────────────────
registerAuditedTool(
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
registerAuditedTool(
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

// ── get_matrix_routes ─────────────────────────────────────────────────────
registerAuditedTool(
  'get_matrix_routes',
  {
    description:
      'Read-only list of the live Wolf Pack matrix routes (which input each TV output is showing). ' +
      'Use to answer "what is on the TVs?", "what input feeds output N?", or to start diagnosing a ' +
      'wrong/black TV. Output numbers are the logical TV output numbers (outputOffset already applied).',
  },
  async () => {
    try {
      const r = await apiGet('/api/matrix/routes')
      const routes: any[] = Array.isArray(r?.routes) ? r.routes : []
      const active = routes.filter((x) => x?.isActive !== false)
      if (!active.length) return ok('No active matrix routes reported.')
      const lines = active
        .sort((a, b) => (a.outputNum ?? 0) - (b.outputNum ?? 0))
        .map((x) => `Output ${x.outputNum} ← input ${x.inputNum}`)
      return ok(`Live matrix routes (source: ${r?.source ?? '?'}):\n${lines.join('\n')}`)
    } catch (e) {
      return fail(`Could not read matrix routes: ${(e as Error).message}`)
    }
  },
)

// ── explain_tv_output ─────────────────────────────────────────────────────
registerAuditedTool(
  'explain_tv_output',
  {
    description:
      'Explain what a specific TV output is currently showing: which matrix input feeds it. ' +
      'Use when asked "what is on TV/output N?" or "why is TV N showing the wrong thing?". ' +
      'Pass the logical output number (outputOffset is already applied in the route read-back).',
    // `as any` defeats a real TS2589 deep-instantiation between the MCP SDK registerTool
    // generics and zod v4 (empirically confirmed: removing it reintroduces TS2589 here). Runtime
    // validation is unaffected; the handler args are annotated explicitly below to keep type safety.
    inputSchema: { outputNumber: z.number().int().min(1).describe('The TV/matrix output number, 1-based') } as any,
  },
  async ({ outputNumber }: { outputNumber: number }) => {
    try {
      const r = await apiGet('/api/matrix/routes')
      const routes: any[] = Array.isArray(r?.routes) ? r.routes : []
      const match = routes.find((x) => Number(x?.outputNum) === Number(outputNumber) && x?.isActive !== false)
      if (!match) {
        return ok(`Output ${outputNumber} has no active route reported — it may be unrouted, off, or settling.`)
      }
      return ok(`Output ${outputNumber} is currently fed by matrix input ${match.inputNum}.`)
    } catch (e) {
      return fail(`Could not explain output ${outputNumber}: ${(e as Error).message}`)
    }
  },
)

// ── get_shure_rf_status ───────────────────────────────────────────────────
registerAuditedTool(
  'get_shure_rf_status',
  {
    description:
      'Read-only status of the Shure wireless/paging-mic receivers: per-channel connection, ' +
      'frequency, audio gain, and band. Use to answer "are the mics working?", "what frequency is ' +
      'the mic on?", or when interference/ghosting is suspected. (Plain wireless/paging mics — never "karaoke".)',
  },
  async () => {
    try {
      const r = await apiGet('/api/shure-rf/status')
      const receivers: any[] = Array.isArray(r?.receivers) ? r.receivers : []
      if (!receivers.length) return ok('No Shure receivers configured.')
      const out: string[] = []
      for (const rx of receivers) {
        out.push(
          `${rx.receiverName ?? rx.receiverId} (${rx.model ?? '?'}, band ${rx.rfBand ?? '?'}): ` +
            `${rx.connected ? 'connected' : 'NOT connected'}`,
        )
        for (const ch of (Array.isArray(rx.channels) ? rx.channels : []) as any[]) {
          out.push(
            `  • ${ch.channelName ?? `ch ${ch.channel}`}: ` +
              `${ch.frequency ? `${ch.frequency} ` : ''}gain ${ch.audioGainDb ?? '?'}dB` +
              `${ch.audioOutSwitch ? `, out=${ch.audioOutSwitch}` : ''}`,
          )
        }
      }
      return ok(out.join('\n'))
    } catch (e) {
      return fail(`Could not read Shure RF status: ${(e as Error).message}`)
    }
  },
)

// ── get_atlas_status ──────────────────────────────────────────────────────
registerAuditedTool(
  'get_atlas_status',
  {
    description:
      'Read-only Atlas audio status: whether a priority/page event is active (mics keying, zones ' +
      'overridden) and any recent zone volume "drop" events. Use when asked "is a mic live?", ' +
      '"did the audio drop?", or "why did a zone go quiet?".',
  },
  async () => {
    try {
      // Both reads are independent — run them concurrently (each has its own timeout).
      const [prio, drops] = await Promise.all([
        apiGet('/api/atlas-priority?active=true').catch(() => null),
        apiGet('/api/atlas-drops').catch(() => null),
      ])
      const lines: string[] = []
      if (prio?.active) {
        lines.push(
          `Priority ACTIVE: mics [${(prio.activeMics ?? []).join(', ') || 'none named'}], ` +
            `overridden zones [${(prio.overriddenZones ?? []).join(', ') || 'none'}].`,
        )
      } else {
        lines.push('No active Atlas priority/page event.')
      }
      // /api/atlas-drops returns { success, count, drops: [{ zone_number, zone_name, ... }] }
      // ordered most-recent-first. (Earlier this read drops?.events / .zone — wrong keys, so it
      // always reported zero drops; fixed per the v2.56.2 audit.)
      const dropRows: any[] = Array.isArray(drops?.drops) ? drops.drops : []
      lines.push(
        dropRows.length
          ? `Recent zone drop events: ${drops?.count ?? dropRows.length} ` +
              `(most recent on zone ${dropRows[0]?.zone_name ?? dropRows[0]?.zone_number ?? '?'}).`
          : 'No recent zone drop events.',
      )
      return ok(lines.join('\n'))
    } catch (e) {
      return fail(`Could not read Atlas status: ${(e as Error).message}`)
    }
  },
)

// ── get_firetv_status ─────────────────────────────────────────────────────
registerAuditedTool(
  'get_firetv_status',
  {
    description:
      'Read-only roster of Fire TV streaming devices with online/offline status and which matrix ' +
      'input each feeds. Use to answer "are the Fire TVs up?" or to find which device drives a TV. ' +
      'Does not poll the live foreground app (that is a slower per-device action).',
  },
  async () => {
    try {
      const r = await apiGet('/api/firetv-devices')
      const devices: any[] = Array.isArray(r?.devices) ? r.devices : []
      if (!devices.length) return ok('No Fire TV devices configured.')
      const lines = devices.map((d) => {
        const online = d?.isOnline === true || d?.status === 'online'
        // Deliberately omit ipAddress — no need to push internal LAN topology into the LLM
        // context (the agent may be cloud-backed Grok). Name + status + input is enough to diagnose.
        return `${d.name ?? d.id}: ${online ? 'online' : 'offline'}` +
          `${d.inputChannel ? `, feeds matrix input ${d.inputChannel}` : ''}` +
          `${d.disabled ? ' [disabled]' : ''}`
      })
      return ok(`Fire TV devices:\n${lines.join('\n')}`)
    } catch (e) {
      return fail(`Could not read Fire TV devices: ${(e as Error).message}`)
    }
  },
)

// ── search_system_docs ────────────────────────────────────────────────────
registerAuditedTool(
  'search_system_docs',
  {
    description:
      'Search this system\'s own documentation (CLAUDE.md, runbooks, hardware refs, per-location ' +
      'notes, package READMEs) and get a grounded answer with sources. Use this to look up HOW the ' +
      'system works or how to fix something (e.g. "how does outputOffset work?", "how do I learn an ' +
      'IR code?") instead of guessing. This is how the agent teaches itself the system on demand.',
    // `as any`: see the TS2589 note on explain_tv_output above (confirmed needed at SDK 1.29 + zod 4).
    inputSchema: {
      query: z.string().min(1).max(1000).describe('The question to look up in the system docs'),
      tech: z.string().optional().describe('Optional tech-tag filter, e.g. "cec", "matrix", "shure"'),
    } as any,
  },
  async ({ query, tech }: { query: string; tech?: string }) => {
    try {
      const body: Record<string, unknown> = { query }
      if (tech) body.tech = tech
      const r = await apiPost('/api/rag/query', body)
      const answer = r?.answer ?? r?.result?.answer ?? ''
      const sources: any[] = r?.sources ?? r?.result?.sources ?? []
      const srcList = sources
        .slice(0, 5)
        .map((s) => `- ${s?.filename ?? s?.filepath ?? 'unknown'}`)
        .join('\n')
      return ok(
        `${answer || '(no answer generated)'}` +
          (srcList ? `\n\nSources:\n${srcList}` : ''),
      )
    } catch (e) {
      return fail(`Could not search system docs: ${(e as Error).message}`)
    }
  },
)

// ── create_maintenance_todo (guarded WRITE — the only write this gateway permits) ──
registerAuditedTool(
  'create_maintenance_todo',
  {
    description:
      'Create a REVIEWABLE maintenance/work TODO on the System Admin → Todos list (tagged source ' +
      '"ai-chat"). Use this when you spot something that needs fixing or following up. This is the ONLY ' +
      'write this gateway permits, and it only adds a todo for a human to review — it never touches ' +
      'hardware. Deduped by title so repeats collapse into one open item.',
    // `as any`: TS2589 (MCP SDK + zod v4), same as the other arg tools.
    inputSchema: {
      title: z.string().min(1).max(200).describe('Short todo title'),
      description: z.string().max(2000).optional().describe('Details / context for the operator'),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().describe('Priority (default MEDIUM)'),
    } as any,
  },
  async ({ title, description, priority }: { title: string; description?: string; priority?: string }) => {
    try {
      const dedupeKey = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
      const r = await apiPost('/api/maintenance-todo', {
        title,
        description,
        priority,
        source: 'ai-chat',
        dedupeKey,
      })
      if (r?.created === false) return ok(`A todo for "${title}" is already open — not duplicated.`)
      return ok(`Filed todo: "${title}" (${priority || 'MEDIUM'}). It's on the System Admin → Todos list for review.`)
    } catch (e) {
      return fail(`Could not create todo: ${(e as Error).message}`)
    }
  },
)

// ── propose_action (returns a proposal for a HUMAN to confirm — NEVER executes) ──
registerAuditedTool(
  'propose_action',
  {
    description:
      'Propose a hardware action for a HUMAN to confirm — this tool does NOT execute anything. Use it ' +
      'when you want to recommend a concrete change. It returns the exact change plus the API call that ' +
      'would apply it; a person (or the confirm button in the UI) runs it. You CANNOT route TVs or tune ' +
      'channels directly — always propose. Supported: route_tv {input, output}; tune_channel ' +
      '{channelNumber, deviceId}.',
    // `as any`: TS2589 (MCP SDK + zod v4).
    inputSchema: {
      action: z.enum(['route_tv', 'tune_channel']).describe('The action to propose'),
      params: z
        .record(z.any())
        .describe('route_tv needs {input, output}; tune_channel needs {channelNumber, deviceId}'),
    } as any,
  },
  async ({ action, params }: { action: string; params: Record<string, any> }) => {
    const p = params || {}
    if (action === 'route_tv') {
      if (p.input == null || p.output == null) return fail('route_tv needs params {input, output}.')
      return ok(
        `PROPOSAL (not executed): route TV output ${p.output} to input ${p.input}.\n` +
          `To apply, a human confirms → POST /api/matrix/route {"input":${p.input},"output":${p.output}}.\n` +
          `I cannot execute this myself — it requires a human one-tap confirm.`,
      )
    }
    if (action === 'tune_channel') {
      if (!p.channelNumber || !p.deviceId) return fail('tune_channel needs params {channelNumber, deviceId}.')
      return ok(
        `PROPOSAL (not executed): tune ${p.deviceId} to channel ${p.channelNumber}.\n` +
          `To apply, a human confirms → POST /api/channel-presets/tune ` +
          `{"channelNumber":"${p.channelNumber}","deviceId":"${p.deviceId}"}.\n` +
          `I cannot execute this myself — it requires a human one-tap confirm.`,
      )
    }
    return fail(`Unsupported action "${action}". Supported: route_tv {input,output}, tune_channel {channelNumber,deviceId}.`)
  },
)

// ── ask_claude_code (delegate to Claude Code — read-only/advisory) ──
registerAuditedTool(
  'ask_claude_code',
  {
    description:
      'Ask Claude Code (Anthropic\'s coding agent, running on this same box) a question or to analyze ' +
      'something — it reads the actual codebase + system to answer. READ-ONLY (plan mode): Claude will ' +
      'investigate and explain / recommend / draft a plan, but will NOT make changes, commits, or run ' +
      'mutating commands. Use this for deep code or diagnostic questions beyond your observe tools, or to ' +
      'get a concrete fix plan for something you found. Returns Claude\'s answer (can take up to ~3 min).',
    // `as any`: TS2589 (MCP SDK + zod v4).
    inputSchema: {
      question: z
        .string()
        .min(1)
        .max(4000)
        .describe('The question or task for Claude Code (it has the full repo + system context)'),
    } as any,
  },
  async ({ question }: { question: string }) => {
    const r = await runClaude(question)
    return r.ok ? ok(r.text) : fail(r.text)
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // stdio server runs until the client disconnects; no stdout logging (it would
  // corrupt the JSON-RPC stream — diagnostics go to stderr only).
  process.stderr.write(
    '[sports-bar-mcp] connected (stdio) — 11 tools (8 observe + create_maintenance_todo [guarded write] ' +
      '+ propose_action [no-exec] + ask_claude_code [delegate to Claude, read-only]): get_system_health, ' +
      'list_open_todos, get_matrix_routes, explain_tv_output, get_shure_rf_status, get_atlas_status, ' +
      'get_firetv_status, search_system_docs, create_maintenance_todo, propose_action, ask_claude_code\n',
  )
}

main().catch((e) => {
  process.stderr.write(`[sports-bar-mcp] fatal: ${(e as Error)?.stack || e}\n`)
  process.exit(1)
})
