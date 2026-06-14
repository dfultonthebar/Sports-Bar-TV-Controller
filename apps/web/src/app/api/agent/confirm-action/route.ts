/**
 * POST /api/agent/confirm-action
 *
 * The "one-tap confirm" execution path for Hermes Phase 3. The agent proposes an
 * action (via the MCP `propose_action` tool) but CANNOT execute it. A HUMAN — by
 * tapping Confirm in the UI — POSTs here, which executes the proposal through the
 * EXISTING deterministic, audited control API. The agent has no way to call this
 * endpoint itself (it is not an MCP tool), so there is no autonomous-write path:
 * every hardware change still requires a deliberate human tap.
 *
 * Whitelisted actions (must match propose_action):
 *   route_tv     { input, output }                       → POST /api/matrix/route
 *   tune_channel { channelNumber, deviceType, deviceId } → POST /api/channel-presets/tune
 *
 * Body: { action, params, surface?: 'operator'|'bartender'|'unknown' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'

export const dynamic = 'force-dynamic'

const PORT = process.env.PORT || '3001'
const BASE = `http://127.0.0.1:${PORT}`
const SURFACES = new Set(['operator', 'bartender', 'unknown'])

async function audit(action: string, params: unknown, surface: string, ok: boolean, summary: string) {
  try {
    await db.insert(schema.agentToolInvocations).values({
      tool: `confirm_action:${action}`,
      args: JSON.stringify(params ?? {}).slice(0, 2000),
      resultSummary: summary.slice(0, 500),
      surface: SURFACES.has(surface) ? surface : 'unknown',
      isError: !ok,
    })
  } catch {
    /* audit is best-effort */
  }
}

export async function POST(request: NextRequest) {
  // Rate-limited as HARDWARE — this actuates real devices (on a human's tap).
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  let action = ''
  let params: any = {}
  let surface = 'unknown'
  try {
    const body = await request.json().catch(() => ({}))
    action = String(body?.action || '')
    params = body?.params || {}
    surface = String(body?.surface || 'unknown')

    if (action === 'route_tv') {
      const input = Number(params.input)
      const output = Number(params.output)
      if (!input || !output) {
        await audit(action, params, surface, false, 'missing input/output')
        return NextResponse.json({ success: false, error: 'route_tv needs {input, output}' }, { status: 400 })
      }
      const r = await fetch(`${BASE}/api/matrix/route`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input, output, source: 'manual' }),
      })
      const j = await r.json().catch(() => ({}))
      const ok = j?.success === true
      await audit(action, params, surface, ok, ok ? `routed output ${output} ← input ${input}` : `route failed: ${JSON.stringify(j).slice(0, 200)}`)
      return NextResponse.json({ success: ok, action, result: j }, { status: ok ? 200 : 502 })
    }

    if (action === 'tune_channel') {
      const channelNumber = String(params.channelNumber || '')
      if (!channelNumber || (!params.deviceType && !params.presetId)) {
        await audit(action, params, surface, false, 'missing channelNumber/deviceType')
        return NextResponse.json({ success: false, error: 'tune_channel needs {channelNumber, deviceType, deviceId}' }, { status: 400 })
      }
      // Forward the proposal params straight to the deterministic tune endpoint.
      const r = await fetch(`${BASE}/api/channel-presets/tune`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params),
      })
      const j = await r.json().catch(() => ({}))
      const ok = j?.success === true
      await audit(action, params, surface, ok, ok ? `tuned ${params.deviceId ?? params.deviceType} → ch ${channelNumber}` : `tune failed: ${JSON.stringify(j).slice(0, 200)}`)
      return NextResponse.json({ success: ok, action, result: j }, { status: ok ? 200 : 502 })
    }

    await audit(action, params, surface, false, 'unsupported action')
    return NextResponse.json(
      { success: false, error: `Unsupported action "${action}". Supported: route_tv, tune_channel.` },
      { status: 400 },
    )
  } catch (err) {
    logger.error('[CONFIRM-ACTION] failed:', err)
    await audit(action, params, surface, false, `exception: ${(err as Error)?.message}`)
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 })
  }
}
