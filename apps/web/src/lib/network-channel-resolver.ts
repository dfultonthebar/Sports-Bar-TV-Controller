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
import { logger } from '@sports-bar/logger'

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

// Separate cache for local_channel_overrides (different table, different TTL semantics
// not actually different — just keeping its lifecycle independent so cache invalidation
// after preset edits doesn't have to thrash the override table).
interface OverrideRow {
  teamName: string
  channelNumber: number
  channelName: string
  deviceType: string | null
}
interface OverrideCache {
  ts: number
  rows: OverrideRow[]
}
let _overrideCache: OverrideCache | null = null

// Separate cache for the pre-built station-to-preset Maps so consumers like
// channel-guide can call getStationToPresetMaps() repeatedly without rebuilding.
interface StationToPresetCache {
  ts: number
  stationToCable: Map<string, string>
  stationToDirectv: Map<string, string>
}
let _stationToPresetCache: StationToPresetCache | null = null

async function loadResolverData(): Promise<CacheEntry> {
  if (_cache && Date.now() - _cache.ts < TTL_MS) {
    logger.debug('[CHANNEL_RESOLVER] cache hit', {
      data: {
        ageSec: Math.round((Date.now() - _cache.ts) / 1000),
        aliases: Object.keys(_cache.stationAliases).length,
        cablePresets: _cache.cablePresets.length,
        directvPresets: _cache.directvPresets.length,
      },
    })
    return _cache
  }

  const t0 = Date.now()
  const aliasRows = await db.select().from(schema.stationAliases)
  const stationAliases: Record<string, string[]> = {}
  let aliasParseErrors = 0
  for (const row of aliasRows) {
    try {
      stationAliases[row.standardName] = JSON.parse(row.aliases)
    } catch {
      stationAliases[row.standardName] = []
      aliasParseErrors++
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
  logger.info('[CHANNEL_RESOLVER] cache refresh', {
    data: {
      durationMs: Date.now() - t0,
      aliases: Object.keys(stationAliases).length,
      aliasParseErrors,
      cablePresets: cablePresets.length,
      directvPresets: directvPresets.length,
    },
  })
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

  logger.debug('[CHANNEL_RESOLVER] resolveChannelsForNetworks', {
    data: {
      networks: ordered.slice(0, 6),
      primaryNetwork: primaryNetwork ?? null,
      cable: cableMatch ? `${cableMatch.channelNumber} (${cableMatch.presetName} via ${cableMatch.matchedNetwork})` : null,
      directv: directvMatch ? `${directvMatch.channelNumber} (${directvMatch.presetName} via ${directvMatch.matchedNetwork})` : null,
    },
  })

  return { cable: cableMatch, directv: directvMatch }
}

/* ============================================================================
 * Phase 1 additions (v2.5.0 channel-resolver consolidation)
 * ============================================================================
 *
 * Pure additions — no existing exports modified. The functions below extend
 * the helper API for Phases 2-5 of the consolidation plan to migrate routes
 * onto. See docs/CHANNEL_RESOLVER_CONSOLIDATION_PLAN.md.
 *
 * IMPORTANT: any changes here must preserve:
 *   1. The Wisconsin RSN split (FanDuelWI ch 40 vs BallyWIPlus ch 308)
 *   2. The sport-gating for league-specific streaming codes (MLBEI, NHLCI,
 *      NBALP, MLSDK)
 *   3. The cache TTL semantics (5-min, single DB hit per window)
 */

/**
 * Canonical streaming station map. This is the THIRD copy of this data —
 * the other two live at:
 *   - apps/web/src/app/api/channel-guide/route.ts (line ~76, 15 entries)
 *   - apps/web/src/app/api/schedules/ai-game-plan/route.ts (line ~22, 14 entries)
 *
 * Phases 2-5 will delete those copies and replace with imports from this
 * helper. This map is the union of both with deduplication. The only delta
 * between the two existing copies is that channel-guide includes `NFHS`
 * (NFHS Network) and ai-game-plan does not — we include it here.
 *
 * Sport-gating: MLBEI / NHLCI / NBALP / MLSDK are league-specific streaming
 * packages. They only resolve when the game's sport matches:
 *   MLBEI -> baseball
 *   NHLCI -> hockey
 *   NBALP -> basketball
 *   MLSDK -> soccer
 * All other entries (Peacock, Prime, ESPN+, Apple TV+, etc.) are sport-agnostic.
 */
export interface StreamingAppInfo {
  appName: string
  packages: string[]
}

const STREAMING_STATION_MAP: Record<string, StreamingAppInfo> = {
  NBALP: { appName: 'NBA League Pass', packages: ['com.nba.leaguepass', 'com.nba.app'] },
  NHLCI: { appName: 'NHL Center Ice', packages: ['com.nhl.gc', 'com.nhl.gc1415'] },
  MLBEI: { appName: 'MLB.TV', packages: ['com.mlb.android', 'com.mlb.atbat'] },
  'MLB.TV': { appName: 'MLB.TV', packages: ['com.mlb.android', 'com.mlb.atbat'] },
  ESPND: { appName: 'ESPN+', packages: ['com.espn.score_center', 'com.espn.gtv', 'com.espn'] },
  'ESPN+': { appName: 'ESPN+', packages: ['com.espn.score_center', 'com.espn.gtv', 'com.espn'] },
  NBCUN: { appName: 'Peacock', packages: ['com.peacocktv.peacockandroid', 'com.peacock.peacockfiretv'] },
  PEACOCK: { appName: 'Peacock', packages: ['com.peacocktv.peacockandroid', 'com.peacock.peacockfiretv'] },
  PRIME: { appName: 'Prime Video', packages: ['com.amazon.avod'] },
  'PRIME VIDEO': { appName: 'Prime Video', packages: ['com.amazon.avod'] },
  AMZN: { appName: 'Prime Video', packages: ['com.amazon.avod'] },
  FOXD: { appName: 'Fox Sports', packages: ['com.foxsports.android', 'com.foxsports.android.foxsportsgo'] },
  APPLETV: { appName: 'Apple TV+', packages: ['com.apple.atve.amazon.appletv'] },
  'APPLE TV': { appName: 'Apple TV+', packages: ['com.apple.atve.amazon.appletv'] },
  'APPLE TV+': { appName: 'Apple TV+', packages: ['com.apple.atve.amazon.appletv'] },
  MLSDK: { appName: 'MLS Season Pass', packages: ['tv.mls', 'com.apple.atve.amazon.appletv'] },
  'BSNOR+': { appName: 'Bally Sports', packages: ['com.bfrapp', 'com.ballysports.ftv'] },
  'B10+': { appName: 'Big Ten+', packages: ['com.foxsports.bigten.android'] },
  NFHS: { appName: 'NFHS Network', packages: ['com.nfhsnetwork.ui', 'com.nfhsnetwork.app', 'com.playon.nfhslive'] },
  MAX: { appName: 'Max', packages: ['com.wbd.stream', 'com.hbo.hbonow'] },
  'HBO MAX': { appName: 'Max', packages: ['com.wbd.stream', 'com.hbo.hbonow'] },
  'PARAMOUNT+': { appName: 'Paramount+', packages: ['com.cbs.app', 'com.cbs.ott'] },
  HULU: { appName: 'Hulu', packages: ['com.hulu.plus'] },
  NETFLIX: { appName: 'Netflix', packages: ['com.netflix.ninja'] },
  'YOUTUBE TV': { appName: 'YouTube TV', packages: ['com.google.android.youtube.tvunplugged'] },
}

const SPORT_GATED_STREAMING_CODES: Record<string, string> = {
  MLBEI: 'baseball',
  NHLCI: 'hockey',
  NBALP: 'basketball',
  MLSDK: 'soccer',
}

/**
 * Normalize a sport/league string into one of: 'baseball' | 'basketball' |
 * 'hockey' | 'soccer' | 'football' | other. Used by sport-gating logic.
 */
function normalizeSport(sportOrLeague: string | null | undefined): string {
  if (!sportOrLeague) return ''
  const s = sportOrLeague.toLowerCase()
  if (s.includes('mlb') || s.includes('baseball')) return 'baseball'
  if (s.includes('nhl') || s.includes('hockey')) return 'hockey'
  if (s.includes('nba') || s.includes('basketball')) return 'basketball'
  if (s.includes('mls') || s.includes('soccer')) return 'soccer'
  if (s.includes('nfl') || s.includes('football')) return 'football'
  return s
}

/**
 * Look up a streaming app for a station code, with optional sport-gating.
 *
 * If the station code is one of the league-specific packages (MLBEI, NHLCI,
 * NBALP, MLSDK), `sport` MUST match that package's sport or this returns null.
 * If `sport` is omitted for a sport-gated code, it is treated as a mismatch —
 * callers must pass the sport for league-specific codes to resolve.
 *
 * Sport-agnostic codes (Peacock, Prime, ESPN+, etc.) ignore the `sport` arg.
 *
 * Unknown station codes return null.
 */
export function getStreamingAppForStation(
  stationCode: string,
  sport?: string | null
): { app: string; code: string } | null {
  if (!stationCode) return null
  const code = stationCode.toUpperCase()
  const entry = STREAMING_STATION_MAP[code]
  if (!entry) return null

  // Sport-gate league-specific packages
  if (code in SPORT_GATED_STREAMING_CODES) {
    const requiredSport = SPORT_GATED_STREAMING_CODES[code]
    if (normalizeSport(sport) !== requiredSport) {
      return null
    }
  }

  return { app: entry.appName, code }
}

/**
 * Like `getStreamingAppForStation()` but also returns the package list so
 * Fire TV consumers can check device login status against installed packages.
 *
 * Sport-gating semantics are identical to `getStreamingAppForStation()`.
 */
export function getStreamingAppInfoForStation(
  stationCode: string,
  sport?: string | null
): { app: string; code: string; packages: string[] } | null {
  if (!stationCode) return null
  const code = stationCode.toUpperCase()
  const entry = STREAMING_STATION_MAP[code]
  if (!entry) return null

  if (code in SPORT_GATED_STREAMING_CODES) {
    const requiredSport = SPORT_GATED_STREAMING_CODES[code]
    if (normalizeSport(sport) !== requiredSport) {
      return null
    }
  }

  return { app: entry.appName, code, packages: entry.packages }
}

/**
 * Read the module-cached or freshly-loaded local_channel_overrides table.
 * 5-minute TTL aligned with the main resolver cache.
 */
async function loadLocalChannelOverrides(): Promise<OverrideRow[]> {
  if (_overrideCache && Date.now() - _overrideCache.ts < TTL_MS) {
    return _overrideCache.rows
  }
  const rows = await db
    .select()
    .from(schema.localChannelOverrides)
    .where(eq(schema.localChannelOverrides.isActive, true))
  const mapped: OverrideRow[] = rows.map(r => ({
    teamName: r.teamName,
    channelNumber: r.channelNumber,
    channelName: r.channelName,
    deviceType: r.deviceType ?? 'cable',
  }))
  _overrideCache = { ts: Date.now(), rows: mapped }
  return mapped
}

/**
 * Find a local channel override for a network/team name. Returns null if no
 * matching row exists.
 *
 * NOTE on schema mismatch: the `local_channel_overrides` table is keyed by
 * `team_name`, not network name. The Phase 1 plan's signature
 * `findLocalChannelOverride(networkName)` uses the term "network" loosely —
 * in practice channel-guide passes team-display strings (e.g. "Milwaukee
 * Brewers", "Brewers.TV") that share enough normalized text with the
 * stored team names to match. We compare via `normalizeStation()` on both
 * sides for consistency with the rest of the resolver.
 *
 * Returns shape `{cable?: string, directv?: string}` keyed by device type.
 */
export async function findLocalChannelOverride(
  networkName: string
): Promise<{ cable?: string; directv?: string } | null> {
  if (!networkName) return null
  const overrides = await loadLocalChannelOverrides()
  if (overrides.length === 0) return null

  const target = normalizeStation(networkName)
  if (!target) return null

  const result: { cable?: string; directv?: string } = {}
  for (const row of overrides) {
    const teamNorm = normalizeStation(row.teamName)
    if (!teamNorm) continue
    // Bidirectional substring match — `Brewers` matches both `Brewers.TV`
    // and `Milwaukee Brewers` after normalization
    const matches = target === teamNorm || target.includes(teamNorm) || teamNorm.includes(target)
    if (!matches) continue
    const dt = (row.deviceType || 'cable').toLowerCase()
    if (dt === 'cable' && !result.cable) result.cable = String(row.channelNumber)
    else if (dt === 'directv' && !result.directv) result.directv = String(row.channelNumber)
  }
  if (!result.cable && !result.directv) return null
  return result
}

/**
 * Build and return pre-computed station-name -> channel-number Maps for
 * each device type. Cached so consumers (e.g. channel-guide's listing loop)
 * can call this on every request without rebuilding.
 *
 * Map keys are NORMALIZED via `normalizeStation()` — both raw preset names
 * and station-alias standard names populate the maps. Map values are the
 * channel number as a string.
 *
 * Wisconsin RSN safety: this delegates to the same `buildStationToPreset()`
 * builder used by `resolveChannelsForNetworks()`, so the FanDuelWI/BallyWIPlus
 * split is preserved automatically.
 */
export async function getStationToPresetMaps(): Promise<{
  stationToCable: Map<string, string>
  stationToDirectv: Map<string, string>
}> {
  if (_stationToPresetCache && Date.now() - _stationToPresetCache.ts < TTL_MS) {
    return {
      stationToCable: _stationToPresetCache.stationToCable,
      stationToDirectv: _stationToPresetCache.stationToDirectv,
    }
  }
  const { stationAliases, cablePresets, directvPresets } = await loadResolverData()
  const cableFull = buildStationToPreset(cablePresets, stationAliases)
  const directvFull = buildStationToPreset(directvPresets, stationAliases)

  const stationToCable = new Map<string, string>()
  for (const [k, v] of cableFull.entries()) stationToCable.set(k, v.channelNumber)
  const stationToDirectv = new Map<string, string>()
  for (const [k, v] of directvFull.entries()) stationToDirectv.set(k, v.channelNumber)

  _stationToPresetCache = { ts: Date.now(), stationToCable, stationToDirectv }
  return { stationToCable, stationToDirectv }
}

/**
 * Resolve channels for a complete game object across multiple device types.
 *
 * Resolution order per device type:
 *   1. Existing `resolveChannelsForNetworks()` against channel_presets +
 *      station_aliases (preferred — uses the preserved Wisconsin RSN split)
 *   2. `findLocalChannelOverride()` for cable/directv if step 1 missed
 *   3. `getStreamingAppForStation()` for streaming, sport-gated against
 *      `game.sport ?? game.league`
 *
 * The `deviceTypesAvailable` array controls which lookups are attempted.
 * Pass `['cable']` to skip directv and streaming entirely, etc.
 */
export interface ResolveGameInput {
  networks: string[]
  primaryNetwork?: string | null
  league?: string | null
  sport?: string | null
}

export interface ResolveGameOutput {
  cableChannel: string | null
  directvChannel: string | null
  streamingApp: { app: string; code: string } | null
  resolvedVia: 'preset' | 'alias' | 'streaming' | 'override' | null
  primaryMatch: string | null
}

export async function resolveChannelsForGame(
  game: ResolveGameInput,
  deviceTypesAvailable: Array<'cable' | 'directv' | 'streaming'>
): Promise<ResolveGameOutput> {
  const out: ResolveGameOutput = {
    cableChannel: null,
    directvChannel: null,
    streamingApp: null,
    resolvedVia: null,
    primaryMatch: null,
  }

  const wantCable = deviceTypesAvailable.includes('cable')
  const wantDirectv = deviceTypesAvailable.includes('directv')
  const wantStreaming = deviceTypesAvailable.includes('streaming')

  // Step 1: existing preset/alias resolver (handles WI RSN split correctly)
  if (wantCable || wantDirectv) {
    const presetResolution = await resolveChannelsForNetworks(
      game.networks,
      game.primaryNetwork ?? undefined
    )
    if (wantCable && presetResolution.cable) {
      out.cableChannel = presetResolution.cable.channelNumber
      out.primaryMatch = presetResolution.cable.matchedNetwork
      out.resolvedVia = 'preset'
    }
    if (wantDirectv && presetResolution.directv) {
      out.directvChannel = presetResolution.directv.channelNumber
      if (!out.primaryMatch) out.primaryMatch = presetResolution.directv.matchedNetwork
      if (!out.resolvedVia) out.resolvedVia = 'preset'
    }
  }

  // Step 2: local_channel_overrides for any device type still missing
  if ((wantCable && !out.cableChannel) || (wantDirectv && !out.directvChannel)) {
    // Walk networks in priority order (primary first)
    const ordered: string[] = []
    if (game.primaryNetwork) ordered.push(game.primaryNetwork)
    for (const n of game.networks ?? []) {
      if (n && !ordered.includes(n)) ordered.push(n)
    }
    for (const network of ordered) {
      const override = await findLocalChannelOverride(network)
      if (!override) continue
      if (wantCable && !out.cableChannel && override.cable) {
        out.cableChannel = override.cable
        if (!out.primaryMatch) out.primaryMatch = network
        if (!out.resolvedVia) out.resolvedVia = 'override'
      }
      if (wantDirectv && !out.directvChannel && override.directv) {
        out.directvChannel = override.directv
        if (!out.primaryMatch) out.primaryMatch = network
        if (!out.resolvedVia) out.resolvedVia = 'override'
      }
      if ((!wantCable || out.cableChannel) && (!wantDirectv || out.directvChannel)) break
    }
  }

  // Step 3: streaming app — only if requested AND nothing else matched yet
  if (wantStreaming && !out.cableChannel && !out.directvChannel && !out.streamingApp) {
    const sport = game.sport ?? game.league ?? null
    const ordered: string[] = []
    if (game.primaryNetwork) ordered.push(game.primaryNetwork)
    for (const n of game.networks ?? []) {
      if (n && !ordered.includes(n)) ordered.push(n)
    }
    for (const network of ordered) {
      const app = getStreamingAppForStation(network, sport)
      if (app) {
        out.streamingApp = app
        if (!out.primaryMatch) out.primaryMatch = network
        out.resolvedVia = 'streaming'
        break
      }
    }
  }

  logger.debug('[CHANNEL_RESOLVER] resolveChannelsForGame', {
    data: {
      networks: (game.networks ?? []).slice(0, 6),
      primaryNetwork: game.primaryNetwork ?? null,
      sport: game.sport ?? null,
      league: game.league ?? null,
      devices: deviceTypesAvailable,
      result: {
        cable: out.cableChannel,
        directv: out.directvChannel,
        streaming: out.streamingApp?.code ?? null,
        via: out.resolvedVia,
        matchedOn: out.primaryMatch,
      },
    },
  })

  return out
}

/**
 * Invalidate ALL module-level caches (resolver data, overrides, station
 * maps). Call this from any admin endpoint that writes to channel_presets,
 * station_aliases, or local_channel_overrides at runtime.
 *
 * TODO: wire this call into the following endpoints when they're built /
 * touched next:
 *   - POST/PUT/DELETE /api/channel-presets and /api/channel-presets/[id]
 *   - POST/PUT/DELETE /api/station-aliases (does not exist yet)
 *   - POST/PUT/DELETE /api/local-channel-overrides (does not exist yet)
 *
 * The legacy `invalidateNetworkChannelResolverCache()` export is retained
 * for backward compatibility — it now also clears the new caches via this
 * function.
 */
export function invalidateChannelResolverCache() {
  _cache = null
  _overrideCache = null
  _stationToPresetCache = null
}

/**
 * Invalidate the module-level cache. Call from tests or admin endpoints
 * that modify station_aliases / channel_presets at runtime.
 *
 * Backward-compatible alias for `invalidateChannelResolverCache()`. Both
 * now clear all caches (resolver data + overrides + station maps).
 */
export function invalidateNetworkChannelResolverCache() {
  invalidateChannelResolverCache()
}
