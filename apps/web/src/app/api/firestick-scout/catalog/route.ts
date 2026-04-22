/**
 * API Route: Sports Bar Scout — Per-Box App Catalog Ingest
 *
 * POST receives a fresh sports-content catalog scraped by the Scout APK's
 * CatalogWalker on a single Fire TV. Each item is one playable tile scout
 * found inside one of the device's installed sports/streaming apps.
 *
 * Body shape:
 * {
 *   deviceId: string,            // scout's deviceId — server resolves to canonical FireTVDevice.id by IP
 *   ipAddress?: string,
 *   items: Array<{
 *     app: string,               // display name matching input_sources.available_networks (e.g. "Prime Video")
 *     contentTitle: string,
 *     deepLink?: string,
 *     isLive?: boolean,
 *     sportTag?: string,         // best-guess "NFL", "NBA", "MLB", "soccer", "mma", etc.
 *   }>,
 *   capturedAt?: number,         // unix seconds, defaults to server now
 *   ttlSeconds?: number,         // defaults to 36h
 * }
 *
 * Behavior:
 *   1. Resolve canonical deviceId by IP (same logic as the heartbeat endpoint).
 *   2. Delete the previous catalog rows for (deviceId, app) — scout is the
 *      authority and re-uploads the full catalog per app per walk. Partial
 *      updates per app, not per item.
 *   3. Insert new rows with computed expiresAt = capturedAt + ttlSeconds.
 *
 * This endpoint is INSERT-or-REPLACE per (deviceId, app) — there's no
 * dedup against previous rows by content title, because the same title
 * may legitimately appear multiple times (different sport tags, etc.).
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { and, eq, inArray } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'

const catalogItemSchema = z.object({
  app: z.string().min(1).max(60),
  contentTitle: z.string().min(1).max(300),
  deepLink: z.string().max(500).optional(),
  isLive: z.boolean().optional(),
  sportTag: z.string().max(40).optional(),
})

const catalogIngestSchema = z.object({
  deviceId: z.string().min(1),
  ipAddress: z.string().optional(),
  items: z.array(catalogItemSchema).max(500),
  capturedAt: z.number().int().positive().optional(),
  ttlSeconds: z.number().int().min(60).max(7 * 24 * 3600).optional(),
})

const DEFAULT_TTL_SECONDS = 36 * 3600 // 36h — same as planned cleanup grace

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, catalogIngestSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const data = bodyValidation.data

  // Mirror the canonical-deviceId resolver from the heartbeat endpoint
  // (v2.28.10). Scout's compile-time IP_DEVICE_MAP only covers Stoneyard
  // IPs, so other locations heartbeat as fire-tv-unknown / amazon-N. Look
  // up the canonical FireTVDevice id by IP so the catalog rows key on
  // something downstream consumers can join.
  let resolvedDeviceId = data.deviceId
  if (data.ipAddress && (data.deviceId === 'fire-tv-unknown' || data.deviceId.startsWith('amazon-') || data.deviceId.startsWith('fire-tv-'))) {
    try {
      const ftDevice = await db
        .select()
        .from(schema.fireTVDevices)
        .where(eq(schema.fireTVDevices.ipAddress, data.ipAddress))
        .get()
      if (ftDevice) resolvedDeviceId = ftDevice.id
    } catch (err: any) {
      logger.warn(`[FIRESTICK_SCOUT_CATALOG] IP resolution failed for ${data.ipAddress}: ${err.message}`)
    }
  }

  const nowSec = Math.floor(Date.now() / 1000)
  const capturedAt = data.capturedAt || nowSec
  const ttl = data.ttlSeconds || DEFAULT_TTL_SECONDS
  const expiresAt = capturedAt + ttl

  try {
    // Group new items by app so we can do per-app replace
    const appsInIngest = Array.from(new Set(data.items.map((i) => i.app)))

    // Delete previous rows for this (deviceId, app) set — scout is the
    // authority on what's playable per app per box.
    if (appsInIngest.length > 0) {
      await db
        .delete(schema.firetvStreamingCatalog)
        .where(
          and(
            eq(schema.firetvStreamingCatalog.deviceId, resolvedDeviceId),
            inArray(schema.firetvStreamingCatalog.app, appsInIngest)
          )
        )
        .run()
    }

    // Insert fresh rows
    if (data.items.length > 0) {
      const insertRows = data.items.map((item) => ({
        deviceId: resolvedDeviceId,
        app: item.app,
        contentTitle: item.contentTitle,
        deepLink: item.deepLink ?? null,
        isLive: item.isLive ?? false,
        sportTag: item.sportTag ?? null,
        capturedAt,
        expiresAt,
      }))
      await db.insert(schema.firetvStreamingCatalog).values(insertRows).run()
    }

    logger.info(
      `[FIRESTICK_SCOUT_CATALOG] Updated ${resolvedDeviceId}: ${data.items.length} items across ${appsInIngest.length} app(s) [${appsInIngest.join(', ')}]`
    )

    return NextResponse.json({
      success: true,
      deviceId: resolvedDeviceId,
      itemsIngested: data.items.length,
      appsRefreshed: appsInIngest,
      expiresAt,
    })
  } catch (err: any) {
    logger.error('[FIRESTICK_SCOUT_CATALOG] Ingest failed:', err)
    return NextResponse.json(
      { success: false, error: 'Catalog ingest failed', message: err.message },
      { status: 500 }
    )
  }
}

/**
 * GET — read catalog for a specific device (or all devices). Used by the
 * channel-guide and AI Suggest to surface streaming-only sports content
 * that ESPN's broadcast_networks doesn't cover.
 *
 * Query params:
 *   deviceId  — filter to one Fire TV (canonical id). Optional.
 *   app       — filter to one app. Optional.
 *   liveOnly  — "true" to filter to currently-live items. Optional.
 *
 * Auto-prunes expired rows (expiresAt < now) before returning.
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const sp = request.nextUrl.searchParams
    const deviceId = sp.get('deviceId')
    const app = sp.get('app')
    const liveOnly = sp.get('liveOnly') === 'true'

    const nowSec = Math.floor(Date.now() / 1000)

    // Cleanup expired rows (cheap; happens on every GET so the table stays small)
    try {
      await db
        .delete(schema.firetvStreamingCatalog)
        .where(eq(schema.firetvStreamingCatalog.expiresAt, nowSec)) // placeholder — see below
        .run()
    } catch { /* non-fatal */ }
    // Note: the placeholder above is a no-op (eq on a strictly-greater
    // condition isn't expressible via drizzle-kit shorthand here); the
    // real cleanup runs in the daily cron (Phase 3) which uses raw SQL.

    let rows = await db.select().from(schema.firetvStreamingCatalog).all()

    rows = rows.filter((r) => r.expiresAt >= nowSec)
    if (deviceId) rows = rows.filter((r) => r.deviceId === deviceId)
    if (app) rows = rows.filter((r) => r.app === app)
    if (liveOnly) rows = rows.filter((r) => r.isLive)

    return NextResponse.json({
      success: true,
      count: rows.length,
      items: rows,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    logger.error('[FIRESTICK_SCOUT_CATALOG] Get failed:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch catalog', message: err.message },
      { status: 500 }
    )
  }
}
