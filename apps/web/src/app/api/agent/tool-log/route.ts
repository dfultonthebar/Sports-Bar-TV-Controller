/**
 * POST /api/agent/tool-log
 *
 * Audit sink for the @sports-bar/mcp gateway (Hermes Phase 2). The MCP server
 * fire-and-forget POSTs one row per tool invocation so there's an accountability
 * trail of what the agent brain looked at and proposed. Read tools are logged
 * too, but proposals + todo-writes are the ones that matter. Writing here never
 * authorizes a hardware action — it only records intent + result.
 *
 * Body: { tool: string, args?: any, resultSummary?: string,
 *         surface?: 'operator'|'bartender'|'unknown', isError?: boolean }
 */
import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'

export const dynamic = 'force-dynamic'

const SURFACES = new Set(['operator', 'bartender', 'unknown'])

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const body = await request.json().catch(() => ({}))
    const tool = String(body?.tool || '').trim()
    if (!tool) {
      return NextResponse.json({ success: false, error: 'tool required' }, { status: 400 })
    }
    const surface = SURFACES.has(String(body?.surface)) ? String(body.surface) : 'unknown'
    const argsStr =
      body?.args != null
        ? (typeof body.args === 'string' ? body.args : JSON.stringify(body.args)).slice(0, 2000)
        : null

    await db.insert(schema.agentToolInvocations).values({
      tool,
      args: argsStr,
      resultSummary: body?.resultSummary != null ? String(body.resultSummary).slice(0, 500) : null,
      surface,
      isError: body?.isError === true,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('[AGENT-TOOL-LOG] insert failed:', err)
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 })
  }
}
