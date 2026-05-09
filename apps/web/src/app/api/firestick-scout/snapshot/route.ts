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

/**
 * v2.33.10 — Synthesize a search-style deepLink per app. Mirrors what
 * the server-side walker emits for the same apps, so the bartender's
 * Watch button works identically regardless of which path produced the
 * row. Null for apps we don't have a search-URL pattern for; bartender
 * falls back to plain app-launch in that case.
 */
function synthDeepLink(appName: string, contentTitle: string): string | null {
  const t = encodeURIComponent(contentTitle.trim())
  if (!t) return null
  switch (appName) {
    case 'Prime Video':
    case 'Sports Tab': // PVFTV-320 launcher Live tab → Prime Video search backend works
      return `https://watch.amazon.com/search?phrase=${t}`
    case 'ESPN':
      return `sportscenter://x-callback-url/showHomeTab?q=${t}`
    default:
      return null
  }
}

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

    let deviceId = String(body.deviceId)

    // v2.33.6 — Resolve "fire-tv-unknown" (Scout default before any
    // server CONFIG broadcast assigns a canonical deviceId) to the real
    // FireTVDevice.id by IP lookup. Pulls the requesting IP from the
    // forwarded headers (Next.js / nginx pass it as x-forwarded-for or
    // x-real-ip) and matches against FireTVDevice.ipAddress. Without
    // this, snapshot rows pile up under "fire-tv-unknown" and the
    // bartender remote / channel guide never see them (they query by
    // the canonical deviceId).
    if (deviceId === 'fire-tv-unknown' || deviceId.startsWith('fire-tv-unknown')) {
      // Node's net stack reports IPv4 connections as IPv6-mapped
      // ("::ffff:10.11.3.50"); FireTVDevice.ipAddress stores plain v4.
      const remoteIp = (
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        ''
      ).replace(/^::ffff:/, '')
      if (remoteIp) {
        try {
          const match = await db.select()
            .from(schema.fireTVDevices)
            .where(eq(schema.fireTVDevices.ipAddress, remoteIp))
            .get()
          if (match) {
            logger.info(`[SCOUT-SNAPSHOT] Resolved Scout deviceId=fire-tv-unknown@${remoteIp} → ${match.id} (${match.name})`)
            deviceId = match.id
          } else {
            logger.warn(`[SCOUT-SNAPSHOT] No FireTVDevice row for IP=${remoteIp} — keeping deviceId=${deviceId}`)
          }
        } catch (e: any) {
          logger.warn(`[SCOUT-SNAPSHOT] IP→deviceId lookup crashed: ${e.message}`)
        }
      }
    }
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

      // v2.33.9 — Per-source replace. Delete only rows previously written
      // by Scout-snapshot for this (deviceId, app) pair; walker-sourced
      // rows survive untouched, so the walker's broader extraction
      // coexists with Scout's faster/narrower one.
      try {
        await db.delete(schema.firetvStreamingCatalog).where(
          and(
            eq(schema.firetvStreamingCatalog.deviceId, deviceId),
            eq(schema.firetvStreamingCatalog.app, appName),
            eq(schema.firetvStreamingCatalog.source, 'scout-snapshot'),
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
            // v2.33.10 — synthesize deepLink per-app when Scout doesn't
            // supply one. Same patterns the walker uses, so the bartender
            // remote's Watch button does the same thing whichever source
            // produced the row.
            deepLink: tile.deepLink ?? synthDeepLink(appName, title),
            startTime: null,
            capturedAt: takenAtUnix,
            expiresAt,
            source: 'scout-snapshot',
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
