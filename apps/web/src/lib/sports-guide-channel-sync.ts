/**
 * Sports Guide Channel Sync
 *
 * Extracts channel_numbers from Rail Media API responses and syncs them
 * into the ChannelPreset database table. This allows automatic population
 * of channel presets from the sports guide configuration.
 */

import { getSportsGuideApi, type SportsGuideResponse } from '@sports-bar/sports-apis'
import { findMany, findFirst, upsert, eq, and } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@sports-bar/logger'

// Rail Media station abbreviation → display name for presets
const STATION_DISPLAY_NAMES: Record<string, string> = {
  'ESPN': 'ESPN',
  'ESPN2': 'ESPN2',
  'ESPNU': 'ESPN U',
  'ESPNEWS': 'ESPN News',
  'FS1': 'Fox Sports 1',
  'FS2': 'Fox Sports 2',
  'FSWI': 'Fan Duel',
  'B10': 'Big 10',
  'SEC': 'SEC Network',
  'TNT': 'TNT',
  'TRUTV': 'TruTV',
  'TBS': 'TBS',
  'CBSSN': 'CBS Sports Network',
  'GOLF': 'Golf',
  'TENN': 'Tennis',
  'MLBNet': 'MLB Network',
  'PSP': 'Peacock/NBC Sports',
  'USA': 'USA Network',
  'WGBA-TV': 'WGBA',
  'WISC-TV': 'WISC (CBS)',
  'WMTV': 'WMTV (NBC)',
  'WKOW': 'WKOW (ABC)',
  'WMSN-TV': 'WMSN (FOX)',
  'Willow': 'Willow Cricket',
  'BSNOR+': 'Fan Duel North',
  'FSP': 'Fox Sports Prime',
  'FOX': 'FOX',
  'CBS': 'CBS',
  'NBC': 'NBC',
  'ABC': 'ABC',
  'CW': 'CW',
  'NHLNet': 'NHL Network',
  'NBATV': 'NBA TV',
  'ESPNN': 'ESPN News',
  'beINS': 'beIN Sports',
  'WISC': 'WISC (CBS)',
}

// Premium/league-pass channels to skip (extra cost, not on standard cable)
// Foreign language channels and non-sports channels also excluded
const SKIP_STATIONS = new Set([
  'MLBEI', 'NHLCI', 'NBALP', 'MLSDK', 'ESPND', 'FOXD', 'NBCUN', 'TUDN',
  'TV5MUS', 'RCNNT', 'UniMas', 'Estrella', 'TELE',
  'ION-C', 'VICE', 'IN1', 'CNBC', 'WMTV2',
])

// Lineup key → deviceType mapping for ChannelPreset
const LINEUP_TO_DEVICE_TYPE: Record<string, string> = {
  'CAB': 'cable',
  'SAT': 'directv',
  'DRTV': 'directv',
}

export interface ChannelMapEntry {
  station: string
  displayName: string
  cab: number[]
  sat: number[]
}

export interface SyncResult {
  created: number
  updated: number
  unchanged: number
  presets: Array<{
    name: string
    deviceType: string
    channelNumber: string
    action: 'created' | 'updated' | 'unchanged'
  }>
}

/**
 * Extract a station→channel map from Rail Media guide data.
 * Collects unique station/channel pairs across all listings.
 */
export function extractChannelMap(guideData: SportsGuideResponse): Map<string, ChannelMapEntry> {
  const channelMap = new Map<string, ChannelMapEntry>()

  for (const group of (guideData.listing_groups || [])) {
    for (const listing of (group.listings || [])) {
      if (!listing.channel_numbers || typeof listing.channel_numbers !== 'object') continue

      for (const [lineup, stations] of Object.entries(listing.channel_numbers)) {
        if (!LINEUP_TO_DEVICE_TYPE[lineup]) continue
        if (!stations || typeof stations !== 'object') continue

        for (const [station, channels] of Object.entries(stations)) {
          if (SKIP_STATIONS.has(station)) continue
          if (!Array.isArray(channels)) continue

          let entry = channelMap.get(station)
          if (!entry) {
            entry = {
              station,
              displayName: STATION_DISPLAY_NAMES[station] || station,
              cab: [],
              sat: [],
            }
            channelMap.set(station, entry)
          }

          const targetArr = lineup === 'CAB' ? entry.cab : entry.sat
          for (const ch of channels) {
            // Filter out placeholder channel values (0 and 2 appear across
            // many stations in the Rail API as invalid/placeholder entries)
            const chNum = typeof ch === 'string' ? parseInt(ch, 10) : ch
            if (chNum <= 2 || isNaN(chNum)) continue
            if (!targetArr.includes(ch)) {
              targetArr.push(ch)
            }
          }
        }
      }
    }
  }

  // Sort channel numbers so lowest (SD) comes first
  for (const entry of channelMap.values()) {
    entry.cab.sort((a, b) => a - b)
    entry.sat.sort((a, b) => a - b)
  }

  return channelMap
}

/**
 * Pick the primary channel number from an array.
 * Uses the first (lowest) channel number as the primary.
 */
function pickPrimaryChannel(channels: number[]): string | null {
  if (channels.length === 0) return null
  return String(channels[0])
}

/**
 * Sync channel presets from Rail Media Sports Guide API.
 * Upserts into ChannelPreset table — creates new, updates changed, leaves matching unchanged.
 */
export async function syncPresetsFromGuide(): Promise<SyncResult> {
  logger.info('[CHANNEL-SYNC] Starting channel preset sync from Sports Guide API')

  const api = getSportsGuideApi()
  const guideData = await api.fetchDateRangeGuide(7)
  const channelMap = extractChannelMap(guideData)

  logger.info(`[CHANNEL-SYNC] Extracted ${channelMap.size} stations from guide data`)

  const result: SyncResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
    presets: [],
  }

  // Get max order for each device type (for new presets)
  const existingCablePresets = await findMany('channelPresets', {
    where: eq(schema.channelPresets.deviceType, 'cable'),
  })
  const existingDtvPresets = await findMany('channelPresets', {
    where: eq(schema.channelPresets.deviceType, 'directv'),
  })

  let nextCableOrder = existingCablePresets.reduce((max: number, p: any) => Math.max(max, p.order || 0), -1) + 1
  let nextDtvOrder = existingDtvPresets.reduce((max: number, p: any) => Math.max(max, p.order || 0), -1) + 1

  for (const entry of channelMap.values()) {
    // Sync cable preset
    const cabChannel = pickPrimaryChannel(entry.cab)
    if (cabChannel) {
      const syncResult = await syncSinglePreset(
        entry.displayName,
        cabChannel,
        'cable',
        nextCableOrder
      )
      result.presets.push({
        name: entry.displayName,
        deviceType: 'cable',
        channelNumber: cabChannel,
        action: syncResult,
      })
      if (syncResult === 'created') {
        result.created++
        nextCableOrder++
      } else if (syncResult === 'updated') {
        result.updated++
      } else {
        result.unchanged++
      }
    }

    // Sync DirecTV/satellite preset
    const satChannel = pickPrimaryChannel(entry.sat)
    if (satChannel) {
      const syncResult = await syncSinglePreset(
        entry.displayName,
        satChannel,
        'directv',
        nextDtvOrder
      )
      result.presets.push({
        name: entry.displayName,
        deviceType: 'directv',
        channelNumber: satChannel,
        action: syncResult,
      })
      if (syncResult === 'created') {
        result.created++
        nextDtvOrder++
      } else if (syncResult === 'updated') {
        result.updated++
      } else {
        result.unchanged++
      }
    }
  }

  logger.info(
    `[CHANNEL-SYNC] Sync complete: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged`
  )

  return result
}

/**
 * Sync a single preset by name + deviceType.
 * Returns the action taken.
 */
async function syncSinglePreset(
  name: string,
  channelNumber: string,
  deviceType: string,
  nextOrder: number
): Promise<'created' | 'updated' | 'unchanged'> {
  const existing = await findFirst('channelPresets', {
    where: and(
      eq(schema.channelPresets.name, name),
      eq(schema.channelPresets.deviceType, deviceType)
    ),
  })

  if (existing) {
    // Already exists — check if channel number changed
    if (existing.channelNumber === channelNumber) {
      return 'unchanged'
    }
    // Update with new channel number
    await upsert(
      'channelPresets',
      and(
        eq(schema.channelPresets.name, name),
        eq(schema.channelPresets.deviceType, deviceType)
      ),
      {}, // not used since record exists
      { channelNumber, updatedAt: new Date().toISOString() }
    )
    logger.info(`[CHANNEL-SYNC] Updated ${name} (${deviceType}): ${existing.channelNumber} → ${channelNumber}`)
    return 'updated'
  }

  // Create new preset
  await upsert(
    'channelPresets',
    and(
      eq(schema.channelPresets.name, name),
      eq(schema.channelPresets.deviceType, deviceType)
    ),
    {
      name,
      channelNumber,
      deviceType,
      order: nextOrder,
      isActive: true,
    },
    { channelNumber }
  )
  logger.info(`[CHANNEL-SYNC] Created ${name} (${deviceType}): ch ${channelNumber}`)
  return 'created'
}
