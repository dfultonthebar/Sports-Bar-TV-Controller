/**
 * Venue Discovery — scheduler-side wrapper around scripts/discover-venues.ts
 *
 * v2.51.1+ — runs weekly (or on-demand) to find new NeighborhoodVenue
 * candidates near each fleet location using OpenStreetMap (Overpass API)
 * and Ollama llama3.1:8b post-filtering. Writes pending_review rows that
 * the operator can approve/decline via the admin UI.
 *
 * Why weekly cadence: venues don't open/close often, and Overpass's OSM
 * data isn't updated faster than that anyway. Once-a-week catches new
 * bars/clubs without thrashing OSM's volunteer servers.
 *
 * The actual discovery logic lives in scripts/discover-venues.ts as a CLI
 * tool (operator runs once at install). This module re-uses the same
 * algorithm by spawning the script as a child process — cleaner than
 * duplicating ~250 lines of Overpass+Ollama logic, and the script is
 * already battle-tested via the dry-run path.
 */

import { spawn } from 'child_process'
import { logger } from '@sports-bar/logger'

const REPO_ROOT = '/home/ubuntu/Sports-Bar-TV-Controller'
const DISCOVER_SCRIPT = `${REPO_ROOT}/scripts/discover-venues.ts`

export interface DiscoveryOpts {
  lat: number
  lon: number
  radiusMi?: number
  dryRun?: boolean
}

export interface DiscoveryResult {
  newCount: number
  updatedCount: number
  skippedCount: number
  errored: boolean
  rawLog: string
}

/**
 * Run Overpass + Ollama venue discovery for a given lat/lon.
 *
 * On success, pending_review rows are written to NeighborhoodVenue with
 * discovery_source='overpass_osm'. Operator approves/declines via the
 * admin UI before they're used by the correlation engine.
 *
 * Throws on Overpass API failure; logs + returns errored=true otherwise.
 */
export async function runVenueDiscovery(opts: DiscoveryOpts): Promise<DiscoveryResult> {
  const { lat, lon, radiusMi = 2, dryRun = false } = opts
  const args = ['tsx', DISCOVER_SCRIPT, '--lat', String(lat), '--lon', String(lon), '--radius-mi', String(radiusMi)]
  if (dryRun) args.push('--dry-run')

  return new Promise((resolve) => {
    const child = spawn('npx', args, { cwd: REPO_ROOT, env: process.env })
    let out = ''
    let err = ''
    let resolved = false
    // v2.52.4 fix (BG-process audit Finding #6): 20-min hard timeout.
    // Pre-v2.52.4 had no timeout — Ollama hang during LLM-filter step
    // (qwen2.5:14b OOM on Graystone per `project_graystone_ram_constraint`
    // memory) blocked the spawn indefinitely → scheduler tick never
    // returned → other registered polls in the same Map kept firing on
    // their own intervals, but runScheduledVenueDiscoverySafe held its
    // slot forever. SIGTERM first; if child ignores it (rare for Node
    // children), SIGKILL after 10s.
    const TIMEOUT_MS = 20 * 60 * 1000
    const timeoutHandle = setTimeout(() => {
      if (resolved) return
      logger.warn(`[VENUE-DISCOVERY] script timeout after ${TIMEOUT_MS / 1000}s — sending SIGTERM`)
      child.kill('SIGTERM')
      // Escalate to SIGKILL if still alive after 10s
      setTimeout(() => { if (!child.killed) child.kill('SIGKILL') }, 10_000)
    }, TIMEOUT_MS)
    child.stdout?.on('data', (d) => { out += d.toString() })
    child.stderr?.on('data', (d) => { err += d.toString() })
    child.on('close', (code) => {
      clearTimeout(timeoutHandle)
      if (resolved) return
      resolved = true
      const combined = out + (err ? '\n' + err : '')
      // Parse the SUMMARY line: "SUMMARY: X new, Y updated, Z skipped (...)"
      const m = combined.match(/SUMMARY:\s*(\d+)\s*new,\s*(\d+)\s*updated,\s*(\d+)\s*skipped/i)
      const newCount = m ? parseInt(m[1], 10) : 0
      const updatedCount = m ? parseInt(m[2], 10) : 0
      const skippedCount = m ? parseInt(m[3], 10) : 0
      const errored = code !== 0
      if (errored) {
        logger.error('[VENUE-DISCOVERY] script exited non-zero', { data: { code, lastErr: err.slice(-500) } })
      } else {
        logger.info(`[VENUE-DISCOVERY] complete: ${newCount} new, ${updatedCount} updated, ${skippedCount} skipped`)
      }
      resolve({ newCount, updatedCount, skippedCount, errored, rawLog: combined })
    })
    child.on('error', (e) => {
      clearTimeout(timeoutHandle)
      if (resolved) return
      resolved = true
      logger.error('[VENUE-DISCOVERY] spawn error', { data: { error: e.message } })
      resolve({ newCount: 0, updatedCount: 0, skippedCount: 0, errored: true, rawLog: e.message })
    })
  })
}

/**
 * Scheduler-wrapped variant — reads lat/lon from the Location table.
 * Called weekly from packages/scheduler/src/scheduler-service.ts.
 *
 * v2.51.2: Lookup order:
 *   1. Location.latitude / Location.longitude (already geocoded — preferred)
 *   2. Geocode Location.address + city + state + zipCode via Nominatim,
 *      save back to the Location row, then use the result
 *   3. LOCATION_LAT / LOCATION_LON env (backwards compat with v2.51.1)
 *   4. Skip with informational log (no error)
 *
 * The geocode-on-the-fly path means a new fleet location only has to
 * fill in their bar's address via the System Admin UI — the discovery
 * pipeline self-bootstraps from there.
 */
export async function runScheduledVenueDiscovery(): Promise<DiscoveryResult> {
  const locationId = process.env.LOCATION_ID
  let lat: number | undefined
  let lon: number | undefined

  if (locationId) {
    try {
      const { db, schema } = await import('@sports-bar/database')
      const { eq } = await import('drizzle-orm')
      const rows = await db.select().from(schema.locations).where(eq(schema.locations.id, locationId)).limit(1)
      if (rows.length > 0) {
        const row = rows[0] as any
        if (row.latitude !== null && row.longitude !== null) {
          lat = row.latitude
          lon = row.longitude
          logger.info(`[VENUE-DISCOVERY] using geocoded Location lat/lon: (${lat?.toFixed(4)}, ${lon?.toFixed(4)})`)
        } else if (row.address && row.city) {
          // Auto-geocode via Nominatim + save back to Location row.
          logger.info(`[VENUE-DISCOVERY] Location lat/lon empty — geocoding "${row.address}, ${row.city}, ${row.state}, ${row.zipCode}"...`)
          const { geocodeAndPersist } = await import('@sports-bar/utils')
          const geo = await geocodeAndPersist({ db, schema, locationId })
          if (geo) {
            lat = geo.latitude
            lon = geo.longitude
            logger.info(`[VENUE-DISCOVERY] geocoded to (${lat.toFixed(4)}, ${lon.toFixed(4)}) and saved to Location row`)
          }
        }
      }
    } catch (e: any) {
      logger.warn('[VENUE-DISCOVERY] Location table lookup failed', { data: { error: e.message } })
    }
  }

  // Backwards-compat fallback to env vars (v2.51.1 path).
  if (lat === undefined || lon === undefined) {
    const latStr = process.env.LOCATION_LAT
    const lonStr = process.env.LOCATION_LON
    if (latStr && lonStr) {
      const e1 = parseFloat(latStr)
      const e2 = parseFloat(lonStr)
      if (!isNaN(e1) && !isNaN(e2)) {
        lat = e1
        lon = e2
        logger.info(`[VENUE-DISCOVERY] using env LOCATION_LAT/LOCATION_LON fallback: (${lat?.toFixed(4)}, ${lon?.toFixed(4)})`)
      }
    }
  }

  if (lat === undefined || lon === undefined) {
    logger.info('[VENUE-DISCOVERY] no coordinates available (Location row has no lat/lon AND no address, and no LOCATION_LAT/LON env vars). Configure either path to enable weekly auto-discovery.')
    return { newCount: 0, updatedCount: 0, skippedCount: 0, errored: false, rawLog: '(not configured)' }
  }

  const radiusMi = parseFloat(process.env.NEIGHBORHOOD_DISCOVERY_RADIUS_MI || '2')
  return runVenueDiscovery({ lat, lon, radiusMi, dryRun: false })
}
