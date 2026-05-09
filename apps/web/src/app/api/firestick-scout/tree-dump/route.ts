/**
 * POST /api/firestick-scout/tree-dump
 *
 * v2.2.1 diagnostic endpoint. Receives an AccessibilityNodeInfo tree
 * dump from a Cube's Scout APK (TreeDumpReceiver) and persists it to
 * disk under `apps/web/data/tree-dumps/` so we can analyze real launcher
 * structure offline.
 *
 * Why: PVFTV-320 launcher home navigation has been guesswork — the
 * 2026 redesign moved Sports/Live/Movies/TV from inside Prime Video
 * up to launcher top-nav tabs that aggregate content from multiple
 * providers. We need ground truth (real text/desc/viewId/bounds for
 * the actual nodes) before we can write reliable selectors.
 *
 * Trigger: from any Cube with Scout v2.2.1+ installed,
 *   adb -s <ip>:5555 shell "am broadcast \
 *     -a com.sportsbar.scout.ACTION_DUMP_LAUNCHER_TREE \
 *     -n com.sportsbar.scout/.TreeDumpReceiver"
 *
 * Optional extras pass through the dump JSON:
 *   --es trigger "manual_lucky_cube_1"
 */
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@sports-bar/logger'
import { promises as fs } from 'fs'
import path from 'path'

// Under PM2 the runtime cwd is apps/web/, so a literal `apps/web/data/...`
// path doubles up. Use `data/tree-dumps` (relative to apps/web/) which
// works whether started from project root or apps/web.
const DUMP_DIR = path.isAbsolute(process.env.SCOUT_DUMP_DIR ?? '')
  ? (process.env.SCOUT_DUMP_DIR as string)
  : path.resolve(process.cwd(), 'data/tree-dumps')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const deviceId = String(body.deviceId ?? 'fire-tv-unknown').replace(/[^a-zA-Z0-9_\-]/g, '_')
    const trigger = String(body.trigger ?? 'unknown').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 40)
    const takenAt = Number(body.takenAtUnix ?? Math.floor(Date.now() / 1000))
    const rootPackage = String(body.rootPackage ?? 'unknown').replace(/[^a-zA-Z0-9._\-]/g, '_')

    // Resolve fire-tv-unknown → canonical deviceId (same pattern as snapshot endpoint)
    let resolvedDeviceId = deviceId
    if (deviceId.startsWith('fire-tv-unknown') || deviceId === 'fire_tv_unknown') {
      const remoteIp = (
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        ''
      ).replace(/^::ffff:/, '')
      if (remoteIp) {
        try {
          const { db, schema } = await import('@/db')
          const { eq } = await import('drizzle-orm')
          const match = await db.select()
            .from(schema.fireTVDevices)
            .where(eq(schema.fireTVDevices.ipAddress, remoteIp))
            .get()
          if (match) {
            resolvedDeviceId = match.id.replace(/[^a-zA-Z0-9_\-]/g, '_')
            logger.info(`[TREE-DUMP] Resolved deviceId=${deviceId}@${remoteIp} → ${resolvedDeviceId} (${match.name})`)
          }
        } catch (e: any) {
          logger.warn(`[TREE-DUMP] IP→deviceId lookup failed: ${e.message}`)
        }
      }
    }

    await fs.mkdir(DUMP_DIR, { recursive: true })

    const filename = `${takenAt}_${resolvedDeviceId}_${rootPackage}_${trigger}.json`
    const fullPath = path.join(DUMP_DIR, filename)

    const enriched = {
      ...body,
      receivedAtUnix: Math.floor(Date.now() / 1000),
      resolvedDeviceId,
      remoteIp: (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                 request.headers.get('x-real-ip') || '').replace(/^::ffff:/, ''),
    }

    await fs.writeFile(fullPath, JSON.stringify(enriched, null, 2))

    const nodeCount = Number(body.nodeCount ?? 0)
    const screenSize = String(body.screenSize ?? '?')
    logger.info(`[TREE-DUMP] Stored: ${filename} (rootPkg=${rootPackage} nodes=${nodeCount} screen=${screenSize})`)

    return NextResponse.json({
      success: true,
      stored: filename,
      nodeCount,
      rootPackage,
    })
  } catch (error: any) {
    logger.error('[TREE-DUMP] POST handler crashed:', error)
    return NextResponse.json(
      { success: false, error: error.message ?? 'crashed' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/firestick-scout/tree-dump
 *
 * List recent dumps. Useful for sanity-checking that a Cube's
 * broadcast actually arrived (e.g. before a session that needs to
 * write selectors from the dump).
 *
 * Query params:
 *   ?deviceId=...   filter to a single device
 *   ?limit=20       max entries to return (default 20, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const filterDevice = url.searchParams.get('deviceId') ?? ''
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '20'), 100)

    let files: string[] = []
    try {
      files = await fs.readdir(DUMP_DIR)
    } catch (e) {
      return NextResponse.json({ success: true, dumps: [] })
    }

    const dumps = await Promise.all(
      files
        .filter(f => f.endsWith('.json'))
        .filter(f => filterDevice === '' || f.includes(filterDevice))
        .sort()
        .reverse()
        .slice(0, limit)
        .map(async f => {
          const stat = await fs.stat(path.join(DUMP_DIR, f))
          return {
            filename: f,
            sizeBytes: stat.size,
            modifiedAt: stat.mtime.toISOString(),
          }
        })
    )

    return NextResponse.json({ success: true, dumps })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message ?? 'crashed' },
      { status: 500 }
    )
  }
}
