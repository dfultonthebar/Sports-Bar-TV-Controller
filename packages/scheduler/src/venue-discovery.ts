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
    child.stdout?.on('data', (d) => { out += d.toString() })
    child.stderr?.on('data', (d) => { err += d.toString() })
    child.on('close', (code) => {
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
      logger.error('[VENUE-DISCOVERY] spawn error', { data: { error: e.message } })
      resolve({ newCount: 0, updatedCount: 0, skippedCount: 0, errored: true, rawLog: e.message })
    })
  })
}

/**
 * Scheduler-wrapped variant — reads lat/lon from env (LOCATION_LAT /
 * LOCATION_LON or falls back to a sane default if unset) and runs the
 * discovery. Called weekly from packages/scheduler/src/scheduler-service.ts.
 *
 * If LOCATION_LAT/LOCATION_LON are not set in .env, logs a one-line
 * skip notice + returns errored=false (it's a config gap, not a runtime
 * failure — most fleet locations will add these after the v2.51.1
 * deployment).
 */
export async function runScheduledVenueDiscovery(): Promise<DiscoveryResult> {
  const latStr = process.env.LOCATION_LAT
  const lonStr = process.env.LOCATION_LON
  if (!latStr || !lonStr) {
    logger.info('[VENUE-DISCOVERY] LOCATION_LAT / LOCATION_LON not set in .env — skipping weekly discovery. Add these to enable.')
    return { newCount: 0, updatedCount: 0, skippedCount: 0, errored: false, rawLog: '(not configured)' }
  }
  const lat = parseFloat(latStr)
  const lon = parseFloat(lonStr)
  if (isNaN(lat) || isNaN(lon)) {
    logger.error('[VENUE-DISCOVERY] LOCATION_LAT/LOCATION_LON in .env are not numbers', { data: { latStr, lonStr } })
    return { newCount: 0, updatedCount: 0, skippedCount: 0, errored: true, rawLog: 'bad config' }
  }
  const radiusMi = parseFloat(process.env.NEIGHBORHOOD_DISCOVERY_RADIUS_MI || '2')
  return runVenueDiscovery({ lat, lon, radiusMi, dryRun: false })
}
