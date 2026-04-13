/**
 * Network-to-channel resolver
 *
 * Shared helper for mapping broadcast network names (from ESPN, The Rail
 * Media, or game_schedules.broadcast_networks) to the user's local channel
 * numbers via the channel_presets + station_aliases tables.
 *
 * This is the same logic that /api/channel-guide uses inline — extracted so
 * /api/scheduling/games and any future route can reuse it without
 * duplicating the Wisconsin-RSN alias conventions.
 *
 * Critical: the station_aliases table has separate standard_name rows for
 * each Wisconsin RSN variant (FanDuelWI for ch 40 Bucks/main WI RSN,
 * BallyWIPlus for ch 308 Brewers-only overflow). DO NOT COLLAPSE them. See
 * docs/SCHEDULER_FIXES_APRIL_2026.md section 5a and CLAUDE.md.
 */

import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'

export interface ResolvedChannel {
  channelNumber: string
  presetName: string
  matchedNetwork: string
}

// Module-level cache for station aliases + channel presets loaded from DB.
// 5-minute TTL. Invalidated on app restart — which is fine since
// station_aliases only change during deploys.
interface CacheEntry {
  ts: number
  stationAliases: Record<string, string[]>
  cablePresets: Array<{ name: string; channelNumber: string }>
  directvPresets: Array<{ name: string; channelNumber: string }>
}
let _cache: CacheEntry | null = null
const TTL_MS = 5 * 60 * 1000

async function loadResolverData(): Promise<CacheEntry> {
  if (_cache && Date.now() - _cache.ts < TTL_MS) return _cache

  const aliasRows = await db.select().from(schema.stationAliases)
  const stationAliases: Record<string, string[]> = {}
  for (const row of aliasRows) {
    try {
      stationAliases[row.standardName] = JSON.parse(row.aliases)
    } catch {
      stationAliases[row.standardName] = []
    }
  }

  const presetRows = await db
    .select()
    .from(schema.channelPresets)
    .where(eq(schema.channelPresets.isActive, true))

  const cablePresets: Array<{ name: string; channelNumber: string }> = []
  const directvPresets: Array<{ name: string; channelNumber: string }> = []
  for (const p of presetRows) {
    if (p.deviceType === 'cable') {
      cablePresets.push({ name: p.name, channelNumber: p.channelNumber })
    } else if (p.deviceType === 'directv') {
      directvPresets.push({ name: p.name, channelNumber: p.channelNumber })
    }
  }

  _cache = { ts: Date.now(), stationAliases, cablePresets, directvPresets }
  return _cache
}

/**
 * Normalize a station/network name for comparison. Strips HD, NETWORK,
 * CHANNEL, -TV suffixes, spaces, and dashes. Must match the logic in
 * apps/web/src/app/api/channel-guide/route.ts so both routes resolve
 * the same way.
 */
export function normalizeStation(name: string): string {
  return (name || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/-TV$/i, '')
    .replace(/-/g, '')
    .replace(/HD$/i, '')
    .replace(/NETWORK$/i, '')
    .replace(/CHANNEL$/i, '')
}

/**
 * Build a station->preset lookup map. Same algorithm as the channel-guide
 * route: for each preset, try to match its normalized name against every
 * alias in every standard_name bundle; when a match is found, the standard
 * name (uppercased) becomes a key pointing to the preset.
 */
function buildStationToPreset(
  presets: Array<{ name: string; channelNumber: string }>,
  aliases: Record<string, string[]>
): Map<string, { channelNumber: string; name: string }> {
  const map = new Map<string, { channelNumber: string; name: string }>()
  for (const preset of presets) {
    const normalizedName = normalizeStation(preset.name)
    map.set(normalizedName, { channelNumber: preset.channelNumber, name: preset.name })
    for (const [standard, aliasList] of Object.entries(aliases)) {
      for (const alias of aliasList) {
        if (normalizeStation(alias) === normalizedName) {
          map.set(standard.toUpperCase(), {
            channelNumber: preset.channelNumber,
            name: preset.name,
          })
        }
      }
    }
  }
  return map
}

/**
 * Resolve a preset match for a single network name, trying direct lookup
 * first, then alias fallback.
 */
function lookupNetwork(
  network: string,
  stationToPreset: Map<string, { channelNumber: string; name: string }>,
  aliases: Record<string, string[]>
): { channelNumber: string; name: string } | null {
  const normalized = normalizeStation(network)
  const direct = stationToPreset.get(normalized)
  if (direct) return direct
  // Try alias fallback: does any standard_name's alias list contain this network?
  for (const [standard, aliasList] of Object.entries(aliases)) {
    if (aliasList.some(a => normalizeStation(a) === normalized)) {
      const viaStandard = stationToPreset.get(standard.toUpperCase())
      if (viaStandard) return viaStandard
    }
  }
  return null
}

/**
 * Resolve cable + directv channel numbers for a game given its array of
 * broadcast networks (e.g. from game_schedules.broadcast_networks or ESPN
 * getAllNetworks). Walks the networks in order and returns the first match
 * for each device type independently.
 */
export async function resolveChannelsForNetworks(
  broadcastNetworks: string[] | null | undefined,
  primaryNetwork?: string | null
): Promise<{ cable: ResolvedChannel | null; directv: ResolvedChannel | null }> {
  if ((!broadcastNetworks || broadcastNetworks.length === 0) && !primaryNetwork) {
    return { cable: null, directv: null }
  }

  const { stationAliases, cablePresets, directvPresets } = await loadResolverData()
  const cableMap = buildStationToPreset(cablePresets, stationAliases)
  const directvMap = buildStationToPreset(directvPresets, stationAliases)

  // Walk networks in priority order: primaryNetwork first (usually the most
  // specific RSN), then the rest of the broadcast array.
  const ordered: string[] = []
  if (primaryNetwork) ordered.push(primaryNetwork)
  if (Array.isArray(broadcastNetworks)) {
    for (const n of broadcastNetworks) {
      if (n && !ordered.includes(n)) ordered.push(n)
    }
  }

  let cableMatch: ResolvedChannel | null = null
  let directvMatch: ResolvedChannel | null = null

  for (const network of ordered) {
    if (!network) continue
    if (!cableMatch) {
      const hit = lookupNetwork(network, cableMap, stationAliases)
      if (hit) {
        cableMatch = { channelNumber: hit.channelNumber, presetName: hit.name, matchedNetwork: network }
      }
    }
    if (!directvMatch) {
      const hit = lookupNetwork(network, directvMap, stationAliases)
      if (hit) {
        directvMatch = { channelNumber: hit.channelNumber, presetName: hit.name, matchedNetwork: network }
      }
    }
    if (cableMatch && directvMatch) break
  }

  return { cable: cableMatch, directv: directvMatch }
}

/**
 * Invalidate the module-level cache. Call from tests or admin endpoints
 * that modify station_aliases / channel_presets at runtime.
 */
export function invalidateNetworkChannelResolverCache() {
  _cache = null
}
