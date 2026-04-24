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
import { getDisplayNameForPackage } from '@sports-bar/streaming'
import { schedulerLogger } from './scheduler-logger'

const API_PORT = process.env.PORT || 3001
const SCOUT_STALE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

// v2.32.9 — Package → display-name lookup is now centralized in
// @sports-bar/streaming via the catalog's packageName + packageAliases
// fields. The previous inline PACKAGE_TO_DISPLAY_NAME map (~75 entries)
// drifted from the catalog over time — adding a new app to the catalog
// without updating this map silently dropped it from
// input_sources.available_networks. Single source of truth fixes it.
//
// One special case the catalog DOES carry: com.amazon.firebat as a
// packageAlias for amazon-prime (CLAUDE.md gotcha #10 — Cube launcher
// hosts Prime Video).

function packagesToDisplayNames(packageNames: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const pkg of packageNames) {
    const display = getDisplayNameForPackage(pkg)
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
        // v2.32.9 — uses shared catalog lookup instead of inline map.
        const hasPrimeAlready = scoutPackages.some((p) => getDisplayNameForPackage(p) === 'Prime Video')
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
