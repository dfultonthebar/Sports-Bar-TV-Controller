/**
 * Fire TV App Sync
 *
 * Periodically reconciles input_sources.installed_apps + available_networks
 * for each Fire TV input against the latest Sports Bar Scout heartbeat
 * (firestick_live_status). This is the bridge between the scout APK's
 * on-device truth and the input_sources catalog that AI Suggest, the
 * channel guide, and the smart input allocator all read.
 *
 * Why this exists:
 *
 * input_sources.installed_apps and .available_networks were originally
 * hand-maintained admin metadata. Operators forget to update them when
 * apps are installed/uninstalled at the device, so AI Suggest ends up
 * promising games on Fire TVs that no longer have the app (or hides games
 * Fire TVs CAN play because the metadata never grew). Scout reports the
 * actual installed-app list every 30 seconds via heartbeat — pull from
 * there instead of trusting the stale admin field.
 *
 * Per-box accuracy: scout reports per-device, so this job writes per-input
 * truth. Fire TV 2 might have Netflix + Hulu while Fire TV 3 doesn't —
 * after this sync, the AI Suggest gate (v2.28.7) will correctly prefer
 * the box that actually has the app.
 *
 * Launcher-hosted Prime Video special-case: on Fire TV Cube 2nd gen (AFTR)
 * and other PVFTV-build Cubes, Prime Video lives inside the launcher
 * (com.amazon.firebat) and there is no com.amazon.avod APK — see CLAUDE.md
 * Common Gotchas #10. Scout's AppDetector hard-codes com.amazon.avod and
 * doesn't know about firebat hosting, so it under-reports Prime Video.
 * This job back-fills "Prime Video" into available_networks for any Fire
 * TV whose underlying device confirms firebat is present (a quick ADB
 * probe via /api/firetv-devices/send-command). Once scout APK 2.0+ ships
 * with firebat in its detector map, this fallback becomes a no-op but
 * stays as belt-and-suspenders.
 *
 * Staleness guard: if scout's latest heartbeat is more than 5 minutes
 * old, the job SKIPS that input entirely. Better to keep the previous
 * (possibly outdated) data than to blank a real list because scout
 * crashed for a few minutes.
 */

import { db, schema, eq, and } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'
import { schedulerLogger } from './scheduler-logger'

const API_PORT = process.env.PORT || 3001
const SCOUT_STALE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

// Package-name → display-name map for translating scout's package list into
// the human-readable availableNetworks list. Mirror of the canonical mapping
// in packages/streaming/src/streaming-apps-database.ts. Inlined here to keep
// scheduler's dep graph minimal — if this drifts from the catalog, update
// both. Add new entries when scout's AppDetector grows new packages.
const PACKAGE_TO_DISPLAY_NAME: Record<string, string> = {
  // Live TV
  'com.google.android.youtube.tvunplugged': 'YouTube TV',
  'com.google.android.apps.youtube.unplugged': 'YouTube TV',
  'com.fubo.firetv.screen': 'fuboTV',
  'com.fubotv.android': 'fuboTV',
  'com.sling': 'Sling TV',
  'com.sling.livingroom': 'Sling TV',

  // YouTube (free)
  'com.amazon.firetv.youtube': 'YouTube',
  'com.amazon.firetv.youtube.tv': 'YouTube',
  'com.google.android.youtube.tv': 'YouTube',

  // Sports
  'com.espn.score_center': 'ESPN+',
  'com.espn.gtv': 'ESPN',
  'com.espn': 'ESPN',
  'com.foxsports.android': 'Fox Sports',
  'com.foxsports.android.foxsportsgo': 'Fox Sports',
  'com.foxsports.bigten.android': 'Big Ten+',
  'com.dazn': 'DAZN',
  'com.flosports.signal.tv': 'FloSports',
  'com.flosports.apps.android': 'FloSports',
  'com.bfrapp': 'Bally Sports',
  'com.ballysports.ftv': 'Bally Sports',
  'com.btn2go': 'BTN2Go',
  'com.nfl.fantasy': 'NFL',
  'com.nfl.app.android': 'NFL',
  'com.nba.app': 'NBA',
  'com.nba.leaguepass': 'NBA League Pass',
  'com.nbaimd.gametime.nba2011': 'NBA League Pass',
  'com.mlb.android': 'MLB.TV',
  'com.mlb.atbat': 'MLB.TV',
  'com.bamnetworks.mobile.android.gameday.atbat': 'MLB.TV',
  'com.nhl.gc': 'NHL',
  'com.nhl.gc1415': 'NHL',
  'com.nfhsnetwork.ui': 'NFHS Network',
  'com.nfhsnetwork.app': 'NFHS Network',
  'com.playon.nfhslive': 'NFHS Network',
  'com.nwlplus.app': 'NWSL+',

  // Streaming
  'com.peacocktv.peacockandroid': 'Peacock',
  'com.peacock.peacockfiretv': 'Peacock',
  'com.cbs.ott': 'Paramount+',
  'com.cbs.app': 'Paramount+',
  'com.apple.atve.amazon.appletv': 'Apple TV+',
  'com.apple.atve.androidtv.appletv': 'Apple TV+',
  'com.amazon.avod': 'Prime Video',
  'com.amazon.avod.thirdpartyclient': 'Prime Video',
  'com.amazon.firebat': 'Prime Video', // launcher-hosted on AFTR Cubes — see CLAUDE.md #10
  'com.netflix.ninja': 'Netflix',
  'com.netflix.mediaclient': 'Netflix',
  'com.hulu.plus': 'Hulu',
  'com.hulu.livingroomplus': 'Hulu',
  'com.wbd.stream': 'Max',
  'com.disney.disneyplus': 'Disney+',
  'tv.pluto.android': 'Pluto TV',
  'com.tubitv.ott': 'Tubi',
}

function packagesToDisplayNames(packageNames: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const pkg of packageNames) {
    const display = PACKAGE_TO_DISPLAY_NAME[pkg]
    if (display && !seen.has(display)) {
      seen.add(display)
      out.push(display)
    }
  }
  return out
}

interface FiretvAppSyncStats {
  inputsConsidered: number
  inputsUpdated: number
  inputsSkippedStale: number
  inputsSkippedNoScout: number
  errors: number
}

/**
 * Probe a single Fire TV directly via the device control endpoint to check
 * whether `com.amazon.firebat` (the launcher) is present. On AFTR Cubes
 * firebat hosts Prime Video — see CLAUDE.md gotcha #10.
 *
 * Returns true on confirmed presence, false on confirmed absence, null on
 * any error (treat null as "don't change current state").
 */
async function probeFirebatPresent(deviceId: string): Promise<boolean | null> {
  try {
    const resp = await fetch(`http://127.0.0.1:${API_PORT}/api/firetv-devices/send-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        command: 'pm path com.amazon.firebat',
      }),
    })
    if (!resp.ok) return null
    const json: any = await resp.json()
    if (!json?.success) {
      // pm path returns non-zero when package missing — that surfaces as
      // success=false. Treat as "absent" rather than "unknown" since the
      // negative answer is actually meaningful.
      return false
    }
    const result = String(json?.data?.result ?? '').trim()
    return result.startsWith('package:')
  } catch (err: any) {
    logger.warn(`[FIRETV-APP-SYNC] firebat probe failed for ${deviceId}: ${err.message}`)
    return null
  }
}

/**
 * Run a single sweep across all active Fire TV inputs.
 * Idempotent — only writes when computed list differs from stored list.
 */
export async function runFiretvAppSyncSweep(): Promise<FiretvAppSyncStats> {
  const correlationId = schedulerLogger.generateCorrelationId()
  const stats: FiretvAppSyncStats = {
    inputsConsidered: 0,
    inputsUpdated: 0,
    inputsSkippedStale: 0,
    inputsSkippedNoScout: 0,
    errors: 0,
  }

  try {
    const firetvInputs = await db
      .select()
      .from(schema.inputSources)
      .where(
        and(
          eq(schema.inputSources.isActive, true),
          eq(schema.inputSources.type, 'firetv')
        )
      )
      .all()

    stats.inputsConsidered = firetvInputs.length
    if (firetvInputs.length === 0) return stats

    // Pull all scout heartbeats once (small table)
    const allScoutRows = await db.select().from(schema.firestickLiveStatus).all()
    const scoutByDeviceId = new Map(allScoutRows.map((r) => [r.deviceId, r]))

    const nowMs = Date.now()

    for (const input of firetvInputs) {
      try {
        if (!input.deviceId) {
          // input_source not bound to a FireTVDevice yet
          stats.inputsSkippedNoScout++
          continue
        }

        const scoutRow = scoutByDeviceId.get(input.deviceId)
        if (!scoutRow || !scoutRow.lastHeartbeat) {
          stats.inputsSkippedNoScout++
          continue
        }

        const lastHbMs = new Date(scoutRow.lastHeartbeat).getTime()
        if (Number.isNaN(lastHbMs) || nowMs - lastHbMs > SCOUT_STALE_THRESHOLD_MS) {
          stats.inputsSkippedStale++
          continue
        }

        // Parse scout's package list. Prefer loggedInApps when available
        // (only counts apps the user is signed in to — matches our gate),
        // fall back to installedApps if loggedIn list is empty.
        let scoutPackages: string[] = []
        try {
          const li = scoutRow.loggedInApps ? JSON.parse(scoutRow.loggedInApps) : []
          const inst = scoutRow.installedApps ? JSON.parse(scoutRow.installedApps) : []
          scoutPackages = Array.isArray(li) && li.length > 0 ? li : (Array.isArray(inst) ? inst : [])
        } catch {
          scoutPackages = []
        }

        // Back-fill launcher-hosted Prime Video on AFTR Cubes (CLAUDE.md #10).
        // Only probe if Prime Video isn't already in scout's list — the
        // direct ADB call costs ~50ms so we avoid it when not needed.
        const hasPrimeAlready = scoutPackages.some((p) => PACKAGE_TO_DISPLAY_NAME[p] === 'Prime Video')
        if (!hasPrimeAlready) {
          const firebatPresent = await probeFirebatPresent(input.deviceId)
          if (firebatPresent === true && !scoutPackages.includes('com.amazon.firebat')) {
            scoutPackages = [...scoutPackages, 'com.amazon.firebat']
          }
        }

        const newAvailableNetworks = packagesToDisplayNames(scoutPackages)
        const newInstalledApps = scoutPackages

        const newAvailableNetworksJson = JSON.stringify(newAvailableNetworks)
        const newInstalledAppsJson = JSON.stringify(newInstalledApps)

        // Only write when something changed — keeps audit log readable
        // and avoids waking a downstream change watcher for no reason.
        const currentAvailableNetworksJson = input.availableNetworks ?? '[]'
        const currentInstalledAppsJson = input.installedApps ?? null

        if (
          currentAvailableNetworksJson === newAvailableNetworksJson &&
          (currentInstalledAppsJson ?? '[]') === newInstalledAppsJson
        ) {
          continue
        }

        await db
          .update(schema.inputSources)
          .set({
            availableNetworks: newAvailableNetworksJson,
            installedApps: newInstalledAppsJson,
            updatedAt: Math.floor(nowMs / 1000),
          })
          .where(eq(schema.inputSources.id, input.id))
          .run()

        stats.inputsUpdated++

        await schedulerLogger.info(
          'firetv-app-sync',
          'reconcile',
          `Updated ${input.name} (${input.deviceId}) — ${newAvailableNetworks.length} apps available`,
          correlationId,
          {
            inputSourceId: input.id,
            deviceId: input.deviceId,
            metadata: {
              availableNetworks: newAvailableNetworks,
              previousAvailableNetworks: currentAvailableNetworksJson,
              packageCount: newInstalledApps.length,
              scoutAgeMs: nowMs - lastHbMs,
            },
          }
        )

        logger.info(
          `[FIRETV-APP-SYNC] ✅ ${input.name}: ${newAvailableNetworks.length} apps — ${newAvailableNetworks.join(', ')}`
        )
      } catch (err: any) {
        stats.errors++
        logger.error(`[FIRETV-APP-SYNC] Error syncing ${input.name}:`, { error: err })
      }
    }

    if (stats.inputsUpdated > 0 || stats.inputsSkippedStale > 0 || stats.errors > 0) {
      logger.info(
        `[FIRETV-APP-SYNC] Sweep complete — considered=${stats.inputsConsidered} updated=${stats.inputsUpdated} stale=${stats.inputsSkippedStale} no-scout=${stats.inputsSkippedNoScout} errors=${stats.errors}`
      )
    }
  } catch (err: any) {
    stats.errors++
    logger.error('[FIRETV-APP-SYNC] Sweep failed:', { error: err })
  }

  return stats
}
