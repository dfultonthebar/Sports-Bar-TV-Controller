/**
 * Sports Service Initialization
 *
 * Wires DB-based channel preset lookup into LiveSportsService
 * so that channel resolution uses synced Rail Media data.
 *
 * Import this module from server-side code that uses liveSportsService
 * to ensure the channel lookup is connected.
 */

import { liveSportsService } from '@sports-bar/sports-apis'
import { findFirst, eq, and } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@sports-bar/logger'

// Broadcast name aliases: ESPN API broadcast name → ChannelPreset name
const BROADCAST_ALIASES: Record<string, string[]> = {
  'ESPN': ['ESPN'],
  'ESPN2': ['ESPN2'],
  'ESPNU': ['ESPN U', 'ESPNU'],
  'ESPNEWS': ['ESPN News', 'ESPNEWS'],
  'ESPN+': ['ESPN+'],
  'FOX': ['FOX'],
  'FS1': ['Fox Sports 1', 'FS1'],
  'FS2': ['Fox Sports 2', 'FS2'],
  'CBS': ['CBS'],
  'NBC': ['NBC'],
  'ABC': ['ABC'],
  'TNT': ['TNT'],
  'TBS': ['TBS'],
  'TruTV': ['TruTV'],
  'USA': ['USA Network', 'USA'],
  'NFL Network': ['NFL Network'],
  'NFL RedZone': ['NFL RedZone'],
  'NBA TV': ['NBA TV'],
  'MLB Network': ['MLB Network', 'MLBNet'],
  'NHL Network': ['NHL Network'],
  'Golf Channel': ['Golf', 'Golf Channel'],
  'Big Ten Network': ['Big 10', 'Big Ten Network'],
  'SEC Network': ['SEC Network', 'SEC'],
  'CBS Sports Network': ['CBS Sports Network', 'CBSSN'],
  'Peacock': ['Peacock/NBC Sports', 'Peacock'],
  'Fan Duel Sports': ['Fan Duel', 'FSWI'],
}

let initialized = false

/**
 * Initialize the channel lookup on LiveSportsService.
 * Safe to call multiple times — only initializes once.
 */
export function initSportsServiceChannelLookup(): void {
  if (initialized) return
  initialized = true

  liveSportsService.setChannelLookup(async (networkName: string, deviceType: string) => {
    const upperNetwork = networkName.toUpperCase()

    // Build list of names to try
    const namesToTry: string[] = []

    // Check aliases
    for (const [key, aliases] of Object.entries(BROADCAST_ALIASES)) {
      if (upperNetwork.includes(key.toUpperCase())) {
        namesToTry.push(...aliases)
        break
      }
    }

    // Also try the raw broadcast name
    if (namesToTry.length === 0) {
      namesToTry.push(networkName)
    }

    // Query DB for each candidate name
    for (const name of namesToTry) {
      const preset = await findFirst('channelPresets', {
        where: and(
          eq(schema.channelPresets.name, name),
          eq(schema.channelPresets.deviceType, deviceType),
          eq(schema.channelPresets.isActive, true)
        ),
      })
      if (preset) {
        return preset.channelNumber
      }
    }

    return null
  })

  logger.info('[SPORTS-INIT] Channel lookup wired to DB presets')
}
