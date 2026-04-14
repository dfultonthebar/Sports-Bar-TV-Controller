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
 * ### Server-side TTL cache
 *
 * The bartender remote page polls this endpoint every 15 seconds while the
 * Video or Routing tab is open. Without caching, every poll triggers a full
 * login + index.php + o2ox round-trip against the Wolf Pack, and the Wolf
 * Pack's firmware emits an audible beep on each authenticated HTTP request.
 * That's one beep every 5 seconds (3 requests per poll) continuously as long
 * as a bartender has the UI open — incredibly annoying in a live bar.
 *
 * The cache stores one routing array per active chassis IP with a 10-second
 * TTL. Within the TTL, consecutive calls return the cached state without
 * touching hardware. The cache is invalidated explicitly whenever the route
 * POST handler (`/api/matrix/route`) successfully changes a route, so the
 * next GET after a bartender click is always fresh.
 *
 * 10s is shorter than the client's 15s poll interval, which means the cache
 * expires between polls — so live hardware changes (someone using the Wolf
 * Pack's own front panel) show up within ~15s at worst.
 *
 * ### Hardware failure fallback
 *
 * If the live query fails (network blip, auth error), the handler falls back
 * to the MatrixRoute DB cache and flags the response with `source: 'cache'`
 * + a warning string so the UI can show a stale-state badge.
 */

type CachedState = {
  routes: Array<{ inputNum: number; outputNum: number; isActive: true }>
  expiry: number
  source: 'hardware'
}

// Module-level cache. Single-instance Node process, no cluster, so a plain
// Map is fine. Keyed by chassis IP so if the operator ever runs two active
// chassis they don't clobber each other's state.
const cache = new Map<string, CachedState>()
const CACHE_TTL_MS = 10_000

/**
 * Invalidate the cache for a specific chassis IP, or all chassis if no IP is
 * provided. Exported so POST /api/matrix/route can call it after a successful
 * route change — the next GET will then query the hardware for fresh state
 * instead of returning the pre-change cache.
 */
export function invalidateRoutesCache(chassisIp?: string): void {
  if (chassisIp) {
    cache.delete(chassisIp)
  } else {
    cache.clear()
  }
}

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

    const now = Date.now()
    const cached = cache.get(activeConfig.ipAddress)
    if (cached && cached.expiry > now) {
      return NextResponse.json({
        success: true,
        source: 'cache-hit',
        cachedAgeMs: CACHE_TTL_MS - (cached.expiry - now),
        routes: cached.routes,
      })
    }

    const credentials = { username: 'admin', password: 'admin' }

    try {
      const routingArray = await queryWolfpackRouteState({
        ipAddress: activeConfig.ipAddress,
        credentials,
      })

      const offset = activeConfig.outputOffset || 0
      // queryWolfpackRouteState normalizes the Wolf Pack 65535 firmware
      // sentinel to -1. Drop those positions from the result — the UI
      // should continue showing whatever it had before, which is exactly
      // what "route missing from the list" produces via the currentSources
      // Map fallback in the bartender remote page.
      const routes = routingArray
        .map((input0Based, output0Based) => ({
          inputNum: input0Based + 1,
          outputNum: output0Based + 1 - offset,
          isActive: true as const,
        }))
        .filter(r =>
          r.inputNum >= 1 &&
          r.inputNum <= (activeConfig.inputCount || 36) &&
          r.outputNum >= 1 &&
          r.outputNum <= (activeConfig.outputCount || 36)
        )

      cache.set(activeConfig.ipAddress, {
        routes,
        expiry: now + CACHE_TTL_MS,
        source: 'hardware',
      })

      return NextResponse.json({
        success: true,
        source: 'hardware',
        routes,
      })
    } catch (hwError: any) {
      logger.warn(`[api/matrix/routes] hardware query failed, falling back to DB cache: ${hwError?.message ?? hwError}`)

      const cachedDb = await db.select()
        .from(schema.matrixRoutes)
        .where(eq(schema.matrixRoutes.isActive, true))
        .orderBy(asc(schema.matrixRoutes.outputNum))
        .all()

      return NextResponse.json({
        success: true,
        source: 'cache',
        warning: `Live query failed (${hwError?.message ?? 'unknown'}); showing last-known DB state`,
        routes: cachedDb.map(r => ({
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
