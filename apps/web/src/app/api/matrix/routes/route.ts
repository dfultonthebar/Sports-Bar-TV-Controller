import { NextResponse, NextRequest } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { queryWolfpackRouteState } from '@sports-bar/wolfpack'

/**
 * GET /api/matrix/routes
 *
 * Returns the live routing state of the active Wolf Pack matrix. Queries the
 * hardware directly via `/get_json_cmd.php?cmd=o2ox` (no `prm` — read-only) and
 * converts the 0-based array into 1-based { inputNum, outputNum } pairs.
 *
 * Falls back to the MatrixRoute table cache only if the hardware is unreachable
 * so the Routing tab still shows something useful during brief network blips.
 * Adds a `source: 'hardware' | 'cache'` field so the UI can show a warning
 * when it's reading from cache.
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const activeConfig = await db.select()
      .from(schema.matrixConfigurations)
      .where(eq(schema.matrixConfigurations.isActive, true))
      .limit(1)
      .get()

    if (!activeConfig) {
      return NextResponse.json(
        { success: false, error: 'No active Wolf Pack matrix configuration', routes: [] },
        { status: 503 }
      )
    }

    const credentials = { username: 'admin', password: 'admin' }

    try {
      const routingArray = await queryWolfpackRouteState({
        ipAddress: activeConfig.ipAddress,
        credentials,
      })

      const offset = activeConfig.outputOffset || 0
      const routes = routingArray.map((input0Based, output0Based) => ({
        inputNum: input0Based + 1,
        outputNum: output0Based + 1 - offset,
        isActive: true,
      })).filter(r => r.outputNum >= 1 && r.outputNum <= activeConfig.outputCount)

      return NextResponse.json({
        success: true,
        source: 'hardware',
        routes,
      })
    } catch (hwError: any) {
      logger.warn(`[api/matrix/routes] hardware query failed, falling back to DB cache: ${hwError?.message ?? hwError}`)

      const cached = await db.select()
        .from(schema.matrixRoutes)
        .where(eq(schema.matrixRoutes.isActive, true))
        .orderBy(asc(schema.matrixRoutes.outputNum))
        .all()

      return NextResponse.json({
        success: true,
        source: 'cache',
        warning: `Live query failed (${hwError?.message ?? 'unknown'}); showing last-known DB state`,
        routes: cached.map(r => ({
          inputNum: r.inputNum,
          outputNum: r.outputNum,
          isActive: r.isActive,
        })),
      })
    }
  } catch (error: any) {
    logger.error('[api/matrix/routes] unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to get routes', routes: [] },
      { status: 500 }
    )
  }
}
