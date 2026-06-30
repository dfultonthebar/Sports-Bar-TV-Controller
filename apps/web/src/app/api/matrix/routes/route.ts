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
 * The cache stores one routing array per active chassis IP with a 30-second
 * TTL. Within the TTL, consecutive calls return the cached state without
 * touching hardware. The cache is invalidated explicitly whenever the route
 * POST handler (`/api/matrix/route`) successfully changes a route, so the
 * next GET after a bartender click is always fresh.
 *
 * The client polls every 15s, so a 30s TTL gives a cache hit every other
 * poll — roughly a 50% reduction in Wolf Pack hits. Previously at 10s the
 * TTL was shorter than the poll interval, which meant every poll missed
 * and we were hitting the hardware 3× per 15s (login + index.php + o2ox).
 * Out-of-band changes (someone using the Wolf Pack's own front panel) still
 * show up within ~30s worst case, which is acceptable for a bar.
 *
 * ### Hardware failure fallback
 *
 * If the live query fails (network blip, auth error), the handler falls back
 * to the MatrixRoute DB cache and flags the response with `source: 'cache'`
 * + a warning string so the UI can show a stale-state badge.
 */

type CachedState = {
  routes: Array<{ inputNum: number; outputNum: number; isActive: true; source?: 'db-fallback' | 'db-recent' }>
  expiry: number
  source: 'hardware'
}

// How long after an app-applied route (POST /api/matrix/route, which sets
// MatrixRoute.updatedAt) the DB row is treated as authoritative over the live
// o2ox read. See the "Recency override" block in GET() for the full rationale.
const DB_RECENCY_WINDOW_MS = 120_000

// Module-level cache. Single-instance Node process, no cluster, so a plain
// Map is fine. Keyed by chassis IP so if the operator ever runs two active
// chassis they don't clobber each other's state.
const cache = new Map<string, CachedState>()
const CACHE_TTL_MS = 30_000

/**
 * Invalidate the cache for a specific chassis IP, or all chassis if no IP is
 * provided. Prefer `updateRoutesCache()` when you already know the post-change
 * state — invalidation forces the next GET to hit hardware, which means another
 * login + o2ox round trip and another audible Wolf Pack beep. Only use this
 * when the new state is unknowable (e.g., out-of-band firmware error).
 */
export function invalidateRoutesCache(chassisIp?: string): void {
  if (chassisIp) {
    cache.delete(chassisIp)
  } else {
    cache.clear()
  }
}

/**
 * Update the cached routes in place with a single output→input change and
 * refresh the TTL. Called by POST /api/matrix/route after a successful route
 * so the next GET returns the post-change state from cache without re-querying
 * the Wolf Pack. This kills the "beep on click, beep again 5 seconds later
 * when the UI polls" double-beep pattern.
 *
 * If the cache is empty for this chassis (e.g., first-ever route after a
 * restart), the update is a no-op and the next GET will populate fresh.
 * We don't create a cache entry out of a single-route update because we don't
 * know the full state of the other 35 outputs — better to let the next query
 * populate everything.
 */
export function updateRoutesCache(outputNum: number, inputNum: number): void {
  const now = Date.now()
  for (const [, cached] of cache.entries()) {
    const idx = cached.routes.findIndex(r => r.outputNum === outputNum)
    const entry = { inputNum, outputNum, isActive: true as const }
    if (idx >= 0) {
      cached.routes[idx] = entry
    } else {
      cached.routes.push(entry)
    }
    // Refresh expiry so the updated cache lives for a full TTL from this
    // known-good state. Without this, an old entry that was about to expire
    // would force the next poll to re-query hardware.
    cached.expiry = now + CACHE_TTL_MS
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
      // sentinel to -1. Drop those positions from the live result.
      const liveRoutes = routingArray
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

      // v2.28.1 — DB fallback for outputs filtered out by the 65535
      // sentinel. Previously we relied on the bartender remote's local
      // currentSources Map to preserve last-known values, but that only
      // works for the iPad that made the route. Any OTHER iPad (or the
      // same iPad after a hard refresh) coming fresh to the Video/Routing
      // tab would see TV X as unrouted because the Wolf Pack returned
      // 65535 in the post-route settling window AND the GET response had
      // no entry for X. Manager-reported pattern: switch to Audio tab,
      // come back to Video tab, TV 1 checkmark gone — even though the
      // physical TV is correctly routed.
      //
      // Fix: for any output present in MatrixRoute (the persistent table
      // written by the POST handler) but missing from the live response,
      // fall back to the DB value and tag it with source='db-fallback'
      // so the UI can show a subtle indicator if desired. Keep the live
      // value where present — DB lags by one POST cycle so the live
      // query is more authoritative when it has data.
      // Seed the output→route map with the live values, then reconcile against
      // the MatrixRoute DB table in two ways below.
      const liveOutputs = new Set(liveRoutes.map(r => r.outputNum))
      const byOutput = new Map<number, { inputNum: number; outputNum: number; isActive: true; source?: 'db-fallback' | 'db-recent' }>()
      for (const r of liveRoutes) byOutput.set(r.outputNum, r)

      const dbRows = await db.select()
        .from(schema.matrixRoutes)
        .where(eq(schema.matrixRoutes.isActive, true))
        .all()

      // v2.89.x — Recency override (Stoneyard Greenville FM36 output-1 bug).
      //
      // Symptom: route output 1 to Cable 1 on the Routing tab, switch it to
      // Atmosphere on the Video tab, reopen the Routing tab → it shows Cable 1
      // again. The physical TV is correct (verified on the Wolf Pack's own web
      // UI); only the app DISPLAY reverts. A 90s raw-log capture during the
      // symptom showed ZERO matrix WRITE commands — nothing physically
      // re-routes; it's purely an unreliable READ feeding the display.
      //
      // Root cause: this Greenville FM36's firmware returns an unreliable o2ox
      // value for output 1 — either the 0xFFFF (65535) session-init sentinel
      // (normalized to -1 and dropped, then back-filled from a possibly-stale
      // DB row) OR a stale REAL value (e.g. the old Cable-1 input). Either way
      // the live read overwrites the operator's just-applied route on the next
      // tab switch / poll. Holmgren's firmware doesn't exhibit this.
      //
      // Fix: when an output was routed THROUGH THIS APP within the last
      // DB_RECENCY_WINDOW_MS, the MatrixRoute DB row is authoritative and WINS
      // over the live read. POST /api/matrix/route writes the DB row (with
      // updatedAt = now) only AFTER routeMatrix() succeeds against the
      // hardware, so a recently-updated row == the exact route we just
      // commanded == the intended physical state. A live read that disagrees
      // inside that window is the firmware settling/sentinel artifact, not a
      // real out-of-band change, so trusting the DB cannot show a wrong value.
      //
      // This is location-agnostic and safe for Holmgren: its live read already
      // agrees with the DB it just wrote, so the override is a no-op there. The
      // ONLY behavior change is for the ~2 minutes after an app route, during
      // which a stale/sentinel read can no longer clobber the display. After
      // the window the live read is authoritative again (so genuine front-panel
      // changes still surface within ~2 min, same as before).
      let recentOverrides = 0
      let fallbacks = 0
      for (const row of dbRows) {
        if (row.outputNum < 1 || row.outputNum > (activeConfig.outputCount || 36)) continue

        const updatedMs = row.updatedAt ? Date.parse(row.updatedAt as any) : NaN
        const isRecent = Number.isFinite(updatedMs) && (now - updatedMs) <= DB_RECENCY_WINDOW_MS

        if (isRecent) {
          // Just-applied via the app — DB wins over the (possibly stale/sentinel)
          // live read for this output.
          const existing = byOutput.get(row.outputNum)
          if (!existing || existing.inputNum !== row.inputNum) recentOverrides++
          byOutput.set(row.outputNum, { inputNum: row.inputNum, outputNum: row.outputNum, isActive: true, source: 'db-recent' })
        } else if (!liveOutputs.has(row.outputNum)) {
          // Existing v2.28.1 behavior: the live read dropped this output (65535
          // sentinel filtered out), so back-fill its last-known value from DB.
          byOutput.set(row.outputNum, { inputNum: row.inputNum, outputNum: row.outputNum, isActive: true, source: 'db-fallback' })
          fallbacks++
        }
      }
      const routes = [...byOutput.values()].sort((a, b) => a.outputNum - b.outputNum)

      if (recentOverrides > 0 || fallbacks > 0) {
        const overridden = routes.filter(r => r.source === 'db-recent').map(r => `out${r.outputNum}=in${r.inputNum}`)
        const filled = routes.filter(r => r.source === 'db-fallback').map(r => `out${r.outputNum}=in${r.inputNum}`)
        logger.info(`[api/matrix/routes] Reconciled live read with MatrixRoute DB — recent-override(${recentOverrides}): ${overridden.join(', ') || 'none'}; sentinel-fill(${fallbacks}): ${filled.join(', ') || 'none'}`)
      }

      cache.set(activeConfig.ipAddress, {
        routes,
        expiry: now + CACHE_TTL_MS,
        source: 'hardware',
      })

      return NextResponse.json({
        success: true,
        source: 'hardware',
        routes,
        fallbackCount: fallbacks,
        recentOverrideCount: recentOverrides,
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
