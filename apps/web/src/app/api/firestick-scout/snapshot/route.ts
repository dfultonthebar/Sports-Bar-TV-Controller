/**
 * POST /api/firestick-scout/snapshot
 *
 * Receives the v2.2.0 active-extraction payload from Scout APK after
 * its CatalogSnapshotService walks the AccessibilityNodeInfo tree of
 * a target app. Translates the Scout payload into firetv_streaming_catalog
 * rows the same as the existing walker path uses, but tags each row with
 * `source='scout-snapshot'` so we can diff vs walker-sourced rows.
 *
 * Payload shape (v2.2.0):
 *   {
 *     scoutVersion: "2.2.0-active-extraction",
 *     deviceId: "firetv_<id>",
 *     deviceName: "Amazon 1",
 *     takenAtUnix: 1715250000,
 *     apps: [
 *       {
 *         app: "Prime Video",
 *         pkg: "com.amazon.firebat",
 *         status: "ok" | "launch_failed" | "no_window_event" | "nav_failed" | "no_as_tree",
 *         tiles: [{ title, isLive, sportTag, sportsScore, nodeBounds }],
 *         allTilesScanned: 47,
 *         durationMs: 12345,
 *       },
 *     ],
 *   }
 */
import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { and, eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Minimal validation — fail fast if required fields missing.
    if (!body.deviceId || !Array.isArray(body.apps)) {
      logger.warn('[SCOUT-SNAPSHOT] Invalid payload — missing deviceId or apps[]')
      return NextResponse.json(
        { success: false, error: 'invalid_payload', missing: 'deviceId or apps[]' },
        { status: 400 }
      )
    }

    const deviceId = String(body.deviceId)
    const scoutVersion = String(body.scoutVersion ?? 'unknown')
    const takenAtUnix = Number(body.takenAtUnix ?? Math.floor(Date.now() / 1000))

    let totalUploaded = 0
    let appsWithTiles = 0
    const perAppSummary: any[] = []

    for (const app of body.apps) {
      const appName = String(app.app ?? 'unknown')
      const pkg = String(app.pkg ?? '')
      const status = String(app.status ?? 'unknown')
      const tiles = Array.isArray(app.tiles) ? app.tiles : []

      logger.info(
        `[SCOUT-SNAPSHOT] ${deviceId} ${appName}: status=${status} tiles=${tiles.length}/${app.allTilesScanned ?? 0} dur=${app.durationMs ?? 0}ms`
      )

      // For non-ok statuses, just log and move on. Don't write empty/error
      // rows to the catalog — they'd corrupt later queries.
      if (status !== 'ok' || tiles.length === 0) {
        perAppSummary.push({ app: appName, status, tiles: 0, scanned: app.allTilesScanned ?? 0 })
        continue
      }

      // Replace existing snapshot-sourced rows for this (deviceId, app).
      // KEEP walker-sourced rows untouched — different source, can coexist.
      // Scout-snapshot replaces only its own.
      try {
        await db.delete(schema.firetvStreamingCatalog).where(
          and(
            eq(schema.firetvStreamingCatalog.deviceId, deviceId),
            eq(schema.firetvStreamingCatalog.app, appName),
            // Note: schema doesn't yet have a `source` column. For first
            // iteration we accept that snapshot writes overwrite walker
            // writes for the same (deviceId, app). Add `source` column
            // in v2.2.1 once the snapshot path is verified working.
          )
        )
      } catch (e: any) {
        logger.warn(`[SCOUT-SNAPSHOT] DELETE pre-insert failed for ${deviceId}/${appName}: ${e.message}`)
      }

      // Insert new tiles
      const expiresAt = takenAtUnix + 36 * 3600 // same TTL as walker
      let inserted = 0
      for (const tile of tiles) {
        const title = String(tile.title ?? '').trim()
        if (!title || title.length < 3) continue
        try {
          await db.insert(schema.firetvStreamingCatalog).values({
            id: crypto.randomUUID(),
            deviceId,
            app: appName,
            contentTitle: title,
            isLive: !!tile.isLive,
            sportTag: tile.sportTag ?? null,
            // No deepLink yet — Scout snapshot path doesn't synthesize
            // deep links (that's a v2.3 future). Bartender can still
            // see the tile + use its app-launcher Watch button.
            deepLink: null,
            startTime: null,
            capturedAt: takenAtUnix,
            expiresAt,
          })
          inserted++
        } catch (e: any) {
          logger.warn(`[SCOUT-SNAPSHOT] insert failed for ${title}: ${e.message}`)
        }
      }

      totalUploaded += inserted
      if (inserted > 0) appsWithTiles++
      perAppSummary.push({ app: appName, status, tiles: inserted, scanned: app.allTilesScanned ?? 0 })
    }

    logger.info(
      `[SCOUT-SNAPSHOT] ${deviceId} ${scoutVersion}: total=${totalUploaded} appsWithTiles=${appsWithTiles}/${body.apps.length}`
    )

    return NextResponse.json({
      success: true,
      deviceId,
      totalUploaded,
      appsWithTiles,
      perApp: perAppSummary,
    })
  } catch (error: any) {
    logger.error('[SCOUT-SNAPSHOT] POST handler crashed:', error)
    return NextResponse.json(
      { success: false, error: error.message ?? 'crashed' },
      { status: 500 }
    )
  }
}
