/**
 * Unified Channel Guide API - Powered by The Rail Media API
 * 
 * This endpoint provides channel guide data for all device types
 * (cable, satellite, streaming) using The Rail Media API as the single source
 * 
 * Version: 5.0.0 - Simplified Integration with The Rail Media API
 * Last Updated: October 16, 2025
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSportsGuideApi } from '@/lib/sportsGuideApi'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
import {
  getStationToPresetMaps,
  resolveChannelsForNetworks,
  findLocalChannelOverride,
  normalizeStation,
} from '@/lib/network-channel-resolver'
// v2.32.9 — display-name lookup is now centralized in
// @sports-bar/streaming via the displayNameAliases field on each
// catalog entry. The previous inline DISPLAY_NAME_TO_CATALOG_ID +
// findStreamingAppByDisplayName here (added v2.31.3) was a cosmetic-
// drift footgun: a new app added to the catalog without also being
// added to this local map silently failed to resolve. Single source
// of truth fixes it.
import { findStreamingAppByDisplayName } from '@/lib/streaming/streaming-apps-database'

// v2.31.7 — Shared streaming channel builder. Both injection paths
// (broadcast_networks fallback + per-box catalog injection) construct the
// same shape and call findStreamingAppByDisplayName for the same reason —
// without appId/packageName populated the bartender click silently does
// nothing. Centralizing keeps any new field (e.g. a future deep-link
// format) in one spot.
interface StreamingAppChannel {
  id: string
  name: string
  number: string
  type: 'streaming'
  cost: 'subscription'
  platforms: string[]
  channelNumber: string
  deviceType: 'streaming'
  streamingApp: string
  appId?: string
  packageName?: string
  packages: string[]
  // v2.32.84 — per-event deep link copied onto a shallow copy of the cached
  // channel for catalog-injected programs (the cached channel itself stays
  // generic so multiple games for the same app can still share it).
  deepLink?: string
}
function buildStreamingAppChannel(opts: {
  appName: string
  channelNumber: string
  packagesOverride?: string[]   // broadcast_networks path supplies matchedAppInfo.packages
}): StreamingAppChannel {
  const catalogApp = findStreamingAppByDisplayName(opts.appName)
  const fallbackPackages = catalogApp
    ? [catalogApp.packageName, ...(catalogApp.packageAliases || [])]
    : []
  const packages = opts.packagesOverride ?? fallbackPackages
  return {
    id: `stream-${opts.appName.replace(/\s+/g, '-').toLowerCase()}`,
    name: opts.appName,
    number: opts.channelNumber,
    type: 'streaming',
    cost: 'subscription',
    platforms: ['Fire TV', 'Streaming'],
    channelNumber: opts.channelNumber,
    deviceType: 'streaming',
    streamingApp: opts.appName,
    appId: catalogApp?.id,
    packageName: catalogApp?.packageName ?? packages[0],
    packages,
  }
}
export const dynamic = 'force-dynamic'

// NFHS Network packages for detecting if device has NFHS login.
// Kept local (not in shared resolver) because NFHS detection uses the package
// list directly to check against device login status, not station-code lookup.
const NFHS_PACKAGES = ['com.nfhsnetwork.ui', 'com.nfhsnetwork.app', 'com.playon.nfhslive']

// Per-request fetch of local_channel_overrides rows — needed because the
// override-injection block uses channelName (which the shared helper does not
// expose). The shared helper has its own 5-min cache for the channel-number
// lookup; this DB call returns the row-level data alongside it.
async function getLocalChannelOverrideRows(): Promise<{ teamName: string; channelNumber: number; channelName: string }[]> {
  const { db } = await import('@/db')
  const { schema } = await import('@/db')
  const { eq } = await import('drizzle-orm')
  const rows = await db.select().from(schema.localChannelOverrides)
    .where(eq(schema.localChannelOverrides.isActive, true))
  return rows.map(r => ({
    teamName: r.teamName,
    channelNumber: r.channelNumber,
    channelName: r.channelName,
  }))
}

interface DeviceGuideRequest {
  inputNumber: number
  deviceType: 'cable' | 'satellite' | 'streaming'
  deviceId?: string
  startTime?: string
  endTime?: string
}

// MAXIMUM VERBOSITY LOGGING
function logInfo(message: string, data?: any) {
  const timestamp = new Date().toISOString()
  logger.info(`[${timestamp}] [Channel-Guide-API] INFO: ${message}`)
  if (data) {
    logger.info(`[${timestamp}] [Channel-Guide-API] DATA:`, { data: JSON.stringify(data, null, 2) })
  }
}

function logError(message: string, error?: any) {
  const timestamp = new Date().toISOString()
  logger.error(`[${timestamp}] [Channel-Guide-API] ERROR: ${message}`)
  if (error) {
    logger.error(`[${timestamp}] [Channel-Guide-API] ERROR-DETAILS:`, error)
  }
}

/**
 * v2.32.79 — Derive isLive from a game_schedules row + current unix time.
 * ESPN sometimes lags marking a game 'completed' (especially OT games);
 * trust the time window AND the explicit in_progress status when either
 * is true. Replaces two copy-pasted inline expressions in this file
 * (cable/satellite injection at ~line 521 + streaming injection at ~line
 * 841 — easy to drift when ESPN's status string set changes).
 */
function deriveIsLive(
  game: { status: string | null; scheduledStart: number; estimatedEnd: number },
  nowSec: number
): boolean {
  return (
    game.status === 'in_progress' ||
    (nowSec >= game.scheduledStart &&
      nowSec <= game.estimatedEnd &&
      game.status !== 'completed' &&
      game.status !== 'final')
  )
}

/**
 * v2.32.79 — Parse a Rail Media listing's (date, time) pair into a Date.
 * Year-rollover heuristic: try the current year; if the result is NaN or
 * more than 24h in the past, retry with year+1 (Rail returns date strings
 * like "Wed Dec 31" that need a year context, and December games viewed in
 * January need to land in the upcoming year). When `date` is missing,
 * fall back to today's date with the given time.
 *
 * Replaces three copy-pasted blocks in this file (the local-channel-override
 * path keeps its own variant — different control flow: `continue` on NaN
 * instead of rollover).
 */
function parseListingDate(date: string | undefined, time: string): Date {
  if (date) {
    const currentYear = new Date().getFullYear()
    const dateWithYear = `${date} ${currentYear} ${time}`
    let eventDate = new Date(dateWithYear)
    if (isNaN(eventDate.getTime()) || eventDate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
      eventDate = new Date(`${date} ${currentYear + 1} ${time}`)
    }
    return eventDate
  }
  return new Date(`${new Date().toDateString()} ${time}`)
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation - define expected schema for channel guide request
  const channelGuideSchema = z.object({
    inputNumber: z.number(),
    deviceType: z.enum(['cable', 'satellite', 'streaming']),
    deviceId: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional()
  })
  const bodyValidation = await validateRequestBody(request, channelGuideSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error


  const requestId = Math.random().toString(36).substring(7)
  logInfo(`========== CHANNEL GUIDE REQUEST [${requestId}] ==========`)

  try {
    const { inputNumber, deviceType, deviceId, startTime, endTime } = bodyValidation.data
    logInfo(`Request params:`, {
      inputNumber,
      deviceType,
      deviceId,
      startTime,
      endTime
    })

    if (!inputNumber || !deviceType) {
      logError('Missing required parameters')
      return NextResponse.json({ 
        success: false,
        error: 'Input number and device type are required' 
      }, { status: 400 })
    }

    // Calculate days from now
    const start = startTime ? new Date(startTime as string | number | Date) : new Date()
    const end = endTime ? new Date(endTime as string | number | Date) : new Date(Date.now() + 24 * 60 * 60 * 1000)
    const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))

    logInfo(`Fetching ${days} days of guide data`)

    // Use The Rail Media API for all device types (cable, satellite, streaming)
    // The API returns SAT and CAB channel numbers that we'll use appropriately
    let programs: any[] = []
    const channels = new Map()

    // Load channel presets ONCE for cable/satellite — reused for both
    // station matching and result filtering later
    let presets: any[] = []
    let presetDeviceType = deviceType === 'satellite' ? 'directv' : deviceType

    if (deviceType === 'cable' || deviceType === 'satellite') {
      // Use The Rail Media API for cable/satellite - it has comprehensive SAT/CAB channel data
      logInfo(`Using The Rail Media API for ${deviceType} guide data`)

      // Load channel presets and build a station name -> user channel mapping
      // This is critical because Rail API returns national channel numbers, but users
      // configure their own local channel numbers in presets
      const { db: dbPresets } = await import('@/db')
      const { schema: schemaPresets } = await import('@/db')

      presets = await dbPresets.select().from(schemaPresets.channelPresets)
        .where(require('drizzle-orm').eq(schemaPresets.channelPresets.deviceType, presetDeviceType))

      logInfo(`Loaded ${presets.length} ${presetDeviceType} channel presets`)

      // Build station-name -> channel-number lookup via the shared resolver.
      // The helper handles normalization, alias-bundle matching, and the
      // Wisconsin RSN split (FanDuelWI ch 40 vs BallyWIPlus ch 308) — see
      // packages/.../network-channel-resolver.ts and CLAUDE.md.
      const { stationToCable, stationToDirectv } = await getStationToPresetMaps()
      const stationLookup = presetDeviceType === 'directv' ? stationToDirectv : stationToCable

      // Local channelNumber -> preset name map for downstream channelInfo
      // construction (the helper map only returns channel numbers).
      const channelNumberToPresetName = new Map<string, string>()
      for (const p of presets) {
        channelNumberToPresetName.set(p.channelNumber, p.name)
      }

      logInfo(`Built station lookup with ${stationLookup.size} entries`)

      // NOW: Fetch guide data from Rail API
      const api = getSportsGuideApi()
      const guide = await api.fetchDateRangeGuide(days)
      logInfo(`The Rail API returned ${guide.listing_groups?.length || 0} listing groups`)

      // The lineup key to use for this device type
      // Rail Media API uses 'DRTV' for DirecTV satellite, not 'SAT'
      const lineupKey = deviceType === 'satellite' ? 'DRTV' : 'CAB'
      logInfo(`Using lineup key: ${lineupKey}`)

      let matchedCount = 0
      let unmatchedStations = new Set<string>()

      for (const group of guide.listing_groups || []) {
        for (const listing of group.listings || []) {
          // Get channel numbers for this device type
          const channelNumbers = listing.channel_numbers?.[lineupKey]
          if (!channelNumbers) continue

          // Get all stations and try to match them to presets via the shared
          // resolver lookup (handles normalization + aliases + WI RSN split).
          for (const [station, channelNums] of Object.entries(channelNumbers)) {
            const numArray = channelNums as (number | string)[]
            if (!numArray || numArray.length === 0) continue

            const userChannelNumber = stationLookup.get(normalizeStation(station))
            if (!userChannelNumber) {
              unmatchedStations.add(station)
              continue
            }

            const presetName = channelNumberToPresetName.get(userChannelNumber) || station
            matchedCount++

            // Create channel info using USER's channel number
            const channelInfo = {
              id: `${deviceType}-${userChannelNumber}`,
              name: presetName,
              number: userChannelNumber,
              type: deviceType,
              cost: 'subscription',
              platforms: [deviceType === 'satellite' ? 'DirecTV' : 'Cable'],
              channelNumber: userChannelNumber,
              deviceType: deviceType,
              station: station,
              presetName: presetName
            }
            channels.set(channelInfo.id, channelInfo)

            const eventDate = parseListingDate(listing.date, listing.time)

            // Calculate end time (3 hours after start for most games)
            const endTime = new Date(eventDate.getTime() + 3 * 60 * 60 * 1000)

            // Create program entry
            const programId = `rail-${deviceType}-${userChannelNumber}-${group.group_title}-${listing.time}-${Math.random().toString(36).substring(7)}`

            programs.push({
              id: programId,
              league: group.group_title,
              homeTeam: listing.data['home team'] || listing.data['team'] || '',
              awayTeam: listing.data['visiting team'] || listing.data['opponent'] || '',
              gameTime: listing.time,
              startTime: eventDate.toISOString(),
              endTime: endTime.toISOString(),
              channel: channelInfo,
              description: Object.entries(listing.data).map(([k, v]) => `${k}: ${v}`).join(', '),
              isSports: true,
              isLive: false,
              venue: listing.data['venue'] || listing.data['location'] || '',
              date: listing.date,
              station: station
            })
          }
        }
      }

      // Local channel overrides: inject local channels for teams with business carriage deals.
      // Row data (channelName + channelNumber) comes from a direct DB query;
      // the team-name match itself goes through the shared resolver's
      // findLocalChannelOverride() so the normalization rules stay in one place.
      const localOverrideRows = await getLocalChannelOverrideRows()

      if (deviceType !== 'satellite' && localOverrideRows.length > 0) {
        // Scan ALL listings (not just matched ones) for local override teams
        for (const group of guide.listing_groups || []) {
          for (const listing of group.listings || []) {
            const homeTeam = listing.data?.['home team'] || listing.data?.['team'] || ''
            const awayTeam = listing.data?.['visiting team'] || listing.data?.['opponent'] || ''
            if (!homeTeam.trim() && !awayTeam.trim()) continue

            // Use the shared helper to check both team names against the
            // overrides table (it normalizes + does bidirectional substring match).
            const homeOverride = homeTeam ? await findLocalChannelOverride(homeTeam) : null
            const awayOverride = awayTeam ? await findLocalChannelOverride(awayTeam) : null
            const cableOverrideChannel = homeOverride?.cable || awayOverride?.cable
            if (!cableOverrideChannel) continue
            const channelNumberInt = parseInt(cableOverrideChannel, 10)
            if (Number.isNaN(channelNumberInt)) continue

            // Loop kept for compatibility with original "for each override"
            // structure — but we now resolve via the helper above.
            for (const override of localOverrideRows.filter(o => o.channelNumber === channelNumberInt)) {

              // Check if this game already has a program entry on ch 308
              const alreadyHas308 = programs.some(p =>
                p.channel?.number === override.channelNumber &&
                p.homeTeam === homeTeam && p.awayTeam === awayTeam &&
                p.gameTime === listing.time
              )
              if (alreadyHas308) continue

              // Parse date
              let eventDate: Date
              if (listing.date) {
                const currentYear = new Date().getFullYear()
                eventDate = new Date(`${listing.date} ${currentYear} ${listing.time}`)
                if (isNaN(eventDate.getTime())) continue
              } else {
                eventDate = new Date(`${new Date().toDateString()} ${listing.time}`)
              }

              const endTime = new Date(eventDate.getTime() + 3 * 60 * 60 * 1000)
              const programId = `local-${override.channelNumber}-${group.group_title}-${listing.time}-${Math.random().toString(36).substring(7)}`

              programs.push({
                id: programId,
                league: group.group_title,
                homeTeam,
                awayTeam,
                gameTime: listing.time,
                startTime: eventDate.toISOString(),
                endTime: endTime.toISOString(),
                channel: {
                  id: `local-${override.channelNumber}`,
                  name: override.channelName,
                  number: override.channelNumber,
                  type: deviceType,
                  cost: 'subscription',
                  platforms: ['Cable'],
                  channelNumber: override.channelNumber,
                  deviceType,
                  station: override.channelName,
                  presetName: override.channelName,
                },
                description: Object.entries(listing.data || {}).map(([k, v]) => `${k}: ${v}`).join(', '),
                isSports: true,
                isLive: false,
                venue: listing.data?.['venue'] || listing.data?.['location'] || '',
                date: listing.date,
                station: override.channelName,
              })
            }
          }
        }
        const overrideCount = programs.filter(p => p.id?.startsWith('local-')).length
        if (overrideCount > 0) {
          logInfo(`Added ${overrideCount} local channel overrides`)
        }
      }

      // Fallback: augment with games from the local game_schedules table.
      // The Rail Media API only covers nationally-carried games and a handful of
      // RSN broadcasts — it omits many MLB/NBA/NHL games that air on team-specific
      // streaming/RSN feeds (e.g. Brewers @ Nationals on Brewers.TV). We query our
      // own ESPN-synced game_schedules table and inject any games whose
      // broadcast_networks can be resolved to a user preset via the shared
      // network-channel-resolver helper.
      try {
        const { db } = await import('@/db')
        const { schema } = await import('@/db')
        const { and, gte, lte } = await import('drizzle-orm')

        const windowStartSec = Math.floor(new Date(startTime).getTime() / 1000)
        const windowEndSec = Math.floor(new Date(endTime).getTime() / 1000)

        // v2.28.2 — overlap filter PLUS in_progress catch-all (for OT/delays).
        // v2.32.62 — tightened the in_progress carve-out: ESPN sync doesn't
        // reliably mark old games 'completed', so 72+ zombie games stuck in
        // 'in_progress' for days were getting injected (NFL Draft from 11
        // days ago surfacing in AI Suggest at Holmgren). Only trust the
        // in_progress label when estimated_end is also still in the future
        // (small 6h grace allows real OT past the original estimate).
        const nowSecForFilter = Math.floor(Date.now() / 1000)
        const sixHoursAgo = nowSecForFilter - 6 * 60 * 60
        const { or, eq, and: andOp } = await import('drizzle-orm')
        const localGames = await db
          .select()
          .from(schema.gameSchedules)
          .where(
            or(
              and(
                lte(schema.gameSchedules.scheduledStart, windowEndSec),
                gte(schema.gameSchedules.estimatedEnd, windowStartSec)
              ),
              andOp(
                eq(schema.gameSchedules.status, 'in_progress'),
                gte(schema.gameSchedules.estimatedEnd, sixHoursAgo)
              )
            )
          )
          .all()

        let gsInjected = 0
        let gsSkippedNoChannel = 0
        let gsSkippedDupe = 0

        const nowSec = Math.floor(Date.now() / 1000)

        for (const game of localGames) {
          // Skip games without real team matchups
          if (!game.homeTeamName || !game.awayTeamName) continue

          let broadcastNetworks: string[] = []
          try {
            if (game.broadcastNetworks) {
              broadcastNetworks = JSON.parse(game.broadcastNetworks)
            }
          } catch {
            broadcastNetworks = []
          }

          // v2.33.15 — For STREAMING devices (Fire TV cubes), the cable/
          // directv preset resolver doesn't apply. Instead, walk the
          // broadcast_networks and check if any maps to a streaming app
          // the device has in `available_networks`. Without this branch,
          // streaming devices got ZERO game_schedules fallback rows —
          // Angels @ Guardians (today 17:10 today, broadcasts on
          // "ESPN Unlmtd"/"MLB.TV"/team RSN feeds) was invisible in the
          // Cube 2 bartender guide despite Cube 2 having ESPN installed.
          // Operator reported 2026-05-11.
          let resolvedPreset: { channelNumber: string; name: string } | null = null
          let matchedStation = ''
          let resolvedStreamingApp: string | null = null

          if (presetDeviceType === 'streaming') {
            // Normalize each broadcast_network → canonical streaming app
            // name. Match against the device's available_networks.
            const STREAMING_NETWORK_ALIASES: Record<string, string> = {
              'espn': 'ESPN',
              'espn2': 'ESPN', 'espnu': 'ESPN', 'espnnews': 'ESPN',
              'espn unlmtd': 'ESPN', 'espn unlimited': 'ESPN', 'espn+': 'ESPN',
              'sec network': 'ESPN', 'acc network': 'ESPN', 'big ten network': 'ESPN',
              'mlb.tv': 'MLB.TV', 'mlb network': 'MLB.TV',
              'nhl.tv': 'NHL.TV',
              'nba.tv': 'NBA.TV',
              'prime video': 'Amazon Prime Video', 'amazon prime video': 'Amazon Prime Video',
              'apple tv+': 'Apple TV', 'apple tv': 'Apple TV',
              'peacock': 'Peacock', 'hulu': 'Hulu',
              'paramount+': 'Paramount+', 'max': 'Max', 'hbo max': 'Max',
              'fubo': 'FuboTV', 'fubotv': 'FuboTV',
              'youtube tv': 'YouTube TV', 'sling tv': 'Sling TV',
              'nfhs network': 'NFHS Network',
              // Team RSN-as-app feeds — fold to MLB.TV for the bartender
              // (most operator cubes that have MLB.TV will have access).
              'brewers.tv': 'MLB.TV', 'angels.tv': 'MLB.TV',
              'cleguardians.tv': 'MLB.TV', 'guardians.tv': 'MLB.TV',
              'dodgers.tv': 'MLB.TV', 'yankees.tv': 'MLB.TV',
            }
            for (const net of broadcastNetworks) {
              const canonical = STREAMING_NETWORK_ALIASES[net.toLowerCase().trim()]
              if (!canonical) continue
              if (deviceInstalledApps.length > 0 &&
                  !deviceInstalledApps.includes(canonical)) {
                continue  // device doesn't have this app
              }
              // Otherwise (or no installed-apps list): accept
              resolvedStreamingApp = canonical
              matchedStation = net
              resolvedPreset = { channelNumber: canonical, name: canonical }
              break
            }
            if (!resolvedStreamingApp) {
              gsSkippedNoChannel++
              continue
            }
          } else {
            // Cable / DirecTV: existing preset-resolver path.
            const resolution = await resolveChannelsForNetworks(
              broadcastNetworks,
              game.primaryNetwork ?? null
            )
            const resolvedForDevice = presetDeviceType === 'directv' ? resolution.directv : resolution.cable
            if (!resolvedForDevice) {
              gsSkippedNoChannel++
              continue
            }
            resolvedPreset = {
              channelNumber: resolvedForDevice.channelNumber,
              name: resolvedForDevice.presetName,
            }
            matchedStation = resolvedForDevice.matchedNetwork
          }

          const startDate = new Date(game.scheduledStart * 1000)
          const endDate = new Date(game.estimatedEnd * 1000)
          const gameTimeLabel = startDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }).toLowerCase()

          // Dedupe: skip if we already have a Rail program for this channel at this time
          // for the same matchup
          const dupe = programs.some(p =>
            p.channel?.number === resolvedPreset!.channelNumber &&
            p.homeTeam === game.homeTeamName &&
            p.awayTeam === game.awayTeamName
          )
          if (dupe) {
            gsSkippedDupe++
            continue
          }

          // v2.33.15 — Use the standard streaming app-channel for
          // streaming devices so the bartender's Watch button hits the
          // same code path as catalog-sourced rows. For cable/satellite
          // keep the existing channel info shape.
          const channelInfo = presetDeviceType === 'streaming' && resolvedStreamingApp
            ? buildStreamingAppChannel({ appName: resolvedStreamingApp, channelNumber: resolvedStreamingApp })
            : {
                id: `${deviceType}-${resolvedPreset!.channelNumber}`,
                name: resolvedPreset!.name,
                number: resolvedPreset!.channelNumber,
                type: deviceType,
                cost: 'subscription',
                platforms: [deviceType === 'satellite' ? 'DirecTV' : 'Cable'],
                channelNumber: resolvedPreset!.channelNumber,
                deviceType: deviceType,
                station: matchedStation,
                presetName: resolvedPreset!.name,
              }
          if (!channels.has(channelInfo.id)) {
            channels.set(channelInfo.id, channelInfo)
          }

          const isLive = deriveIsLive(game, nowSec)

          programs.push({
            id: `gs-${game.id}`,
            league: game.league || 'Sports',
            homeTeam: game.homeTeamName,
            awayTeam: game.awayTeamName,
            gameTime: gameTimeLabel,
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
            channel: channelInfo,
            description: `${game.awayTeamName} @ ${game.homeTeamName}${game.venueName ? ' · ' + game.venueName : ''}`,
            isSports: true,
            isLive,
            venue: game.venueName || '',
            date: startDate.toDateString(),
            station: matchedStation,
          })
          gsInjected++
        }

        if (gsInjected > 0 || gsSkippedNoChannel > 0 || gsSkippedDupe > 0) {
          logInfo(`game_schedules fallback: +${gsInjected} injected, ${gsSkippedDupe} dedup, ${gsSkippedNoChannel} skipped (no channel match from broadcast_networks)`)
        }
      } catch (fallbackError: any) {
        logger.error('[Channel-Guide-API] game_schedules fallback failed (non-fatal):', { error: fallbackError.message })
      }

      // Filter out tournament-style events without team matchups (Golf, NASCAR, etc.)
      const preFilterCount = programs.length
      programs = programs.filter(p => p.homeTeam.trim() !== '' || p.awayTeam.trim() !== '')
      if (programs.length < preFilterCount) {
        logInfo(`Filtered out ${preFilterCount - programs.length} programs without team matchups`)
      }

      logInfo(`Processed ${programs.length} programs (Rail + local) for ${deviceType}`)
      logInfo(`Matched ${matchedCount} station listings to presets`)
      if (unmatchedStations.size > 0) {
        logInfo(`Unmatched stations (consider adding to presets): ${[...unmatchedStations].slice(0, 20).join(', ')}`)
      }
    }

    // For streaming devices (Fire TV), fetch the device's installed apps AND logged-in subscriptions
    let deviceInstalledApps: string[] = []
    let deviceLoggedInPackages: string[] = []  // Packages for services the device is logged into

    if (deviceType === 'streaming' && deviceId) {
      // Look up the Fire TV's IP so we can match Scout reports by IP as well
      // as by deviceId. Scout's deviceId ("amazon-2") rarely matches
      // FireTVDevice.id ("firetv_1741700000002_holmgren2") — they're configured
      // independently — but both rows share the same ipAddress.
      let deviceIp: string | null = null
      try {
        const { db } = await import('@/db')
        const { schema } = await import('@/db')
        const { eq } = await import('drizzle-orm')
        const row = await db.select().from(schema.fireTVDevices)
          .where(eq(schema.fireTVDevices.id, deviceId)).get()
        deviceIp = row?.ipAddress ?? null
      } catch { /* non-fatal */ }

      // Fetch installed apps from Scout
      try {
        const scoutResponse = await fetch('http://localhost:3001/api/firestick-scout')
        if (scoutResponse.ok) {
          const scoutData = await scoutResponse.json()
          const statuses = (scoutData.statuses || []) as any[]
          const device =
            statuses.find(d => d.deviceId === deviceId) ||
            (deviceIp ? statuses.find(d => d.ipAddress === deviceIp) : null)
          if (device && device.installedApps) {
            deviceInstalledApps = device.installedApps
            logInfo(`Fire TV ${deviceId} (ip=${deviceIp || '?'}, scoutId=${device.deviceId}) has ${deviceInstalledApps.length} installed apps`)
          } else {
            logInfo(`Fire TV ${deviceId} (ip=${deviceIp || '?'}) not found in Scout reports (${statuses.length} devices reporting)`)
          }
        }
      } catch (error: any) {
        logError(`Could not fetch Fire TV device apps: ${error.message}`)
      }

      // Fetch device login status (which subscriptions are logged in)
      try {
        const { db } = await import('@/db')
        const { schema } = await import('@/db')
        const { eq, and } = await import('drizzle-orm')

        // Get all services with their packages
        const services = await db.select().from(schema.streamingServices)

        // Get logins for this device
        const logins = await db.select()
          .from(schema.deviceStreamingLogins)
          .where(and(
            eq(schema.deviceStreamingLogins.deviceId, deviceId),
            eq(schema.deviceStreamingLogins.isLoggedIn, true)
          ))

        // Build list of packages for logged-in services
        const loggedInServiceIds = new Set(logins.map(l => l.serviceId))

        for (const service of services) {
          if (loggedInServiceIds.has(service.id)) {
            const packages = JSON.parse(service.packages || '[]')
            deviceLoggedInPackages.push(...packages)
          }
        }

        // If no logins configured, fall back to installed apps (legacy behavior)
        if (logins.length === 0) {
          logInfo(`No subscription logins configured for ${deviceId}, falling back to installed apps`)
          deviceLoggedInPackages = deviceInstalledApps
        } else {
          logInfo(`Fire TV device ${deviceId} has ${logins.length} services logged in (${deviceLoggedInPackages.length} packages)`)
        }
      } catch (error: any) {
        logError(`Could not fetch device logins, using installed apps: ${error.message}`)
        deviceLoggedInPackages = deviceInstalledApps
      }
    }

    logInfo(`Processed ${programs.length} programs and ${channels.size} channels`)

    // Per-box on-device catalog injection — SOLE SOURCE for streaming games.
    // Sports Bar Scout's CatalogWalker reports per-box per-app sports content
    // tiles (regional broadcasts, league passes, on-demand sports docuseries,
    // app-specific live events) with the actual deep links resolved off the
    // device's UI. Catalog rows live in firetv_streaming_catalog with a 36h
    // TTL — older rows are pruned by the daily cron (Phase 3).
    //
    // Replaces (v2.32.99+) the previous Rail-Media + game_schedules streaming
    // injection paths whose search-query deep links were not specific enough
    // to land on the right game's playback. The walker's per-tile deep links
    // come straight from each app's tile metadata so the bartender's Watch
    // button reaches the actual content. NFHS still has its own injection
    // block below (separate data source, app-specific deep links).
    //
    // VENUE_TIMEZONE: All locations are in America/Chicago (Wisconsin). The
    // `day` and `time` display fields are formatted in this zone so the
    // bartender remote shows the local time the game starts, not UTC.
    const VENUE_TIMEZONE = 'America/Chicago'
    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: VENUE_TIMEZONE,
      weekday: 'short',
    })
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: VENUE_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    })

    if (deviceType === 'streaming' && deviceId) {
      try {
        const { db } = await import('@/db')
        const { schema } = await import('@/db')
        const { eq, gt, gte, lte, and: dAnd } = await import('drizzle-orm')

        const nowSec = Math.floor(Date.now() / 1000)
        const catalogRows = await db
          .select()
          .from(schema.firetvStreamingCatalog)
          .where(
            dAnd(
              eq(schema.firetvStreamingCatalog.deviceId, deviceId),
              gt(schema.firetvStreamingCatalog.expiresAt, nowSec)
            )
          )
          .all()

        // v2.33.0 — Start-time enrichment from game_schedules. The walker
        // doesn't always extract a startTime from tile UI (Prime Video
        // hides times unless the tile is focused, ESPN tiles vary by
        // sport). For each catalog row missing a startTime, look up
        // game_schedules within ±2h..+48h and match by team-name token
        // overlap. This DOES NOT change which games appear (Scout is
        // still source of truth for that) — only fills in the start
        // time so the bartender remote can show "Fri 7:30 PM CT" instead
        // of "On demand". Match priority: both home AND away tokens
        // present → enrich. Single-team match → skip (too ambiguous).
        const scheduleWindowStart = nowSec - 6 * 3600 // 6h grace for in-progress games
        const scheduleWindowEnd = nowSec + 48 * 3600
        const upcomingSchedules = await db
          .select({
            home: schema.gameSchedules.homeTeamName,
            away: schema.gameSchedules.awayTeamName,
            scheduledStart: schema.gameSchedules.scheduledStart,
            estimatedEnd: schema.gameSchedules.estimatedEnd,
            status: schema.gameSchedules.status,
            statusDetail: schema.gameSchedules.statusDetail,
            espnEventId: schema.gameSchedules.espnEventId,
            league: schema.gameSchedules.league,
            // v2.33.1 — pull live state too. ESPN sync writes these every
            // 10min. Streaming programs include this inline so the
            // bartender remote can show scores/clock without a separate
            // /api/sports-guide/live-by-channel fetch (which is hardcoded
            // to deviceType=cable and skips streaming-only games like
            // Prime Video NBA exclusives).
            homeScore: schema.gameSchedules.homeScore,
            awayScore: schema.gameSchedules.awayScore,
            currentPeriod: schema.gameSchedules.currentPeriod,
            clockTime: schema.gameSchedules.clockTime,
          })
          .from(schema.gameSchedules)
          .where(
            dAnd(
              gte(schema.gameSchedules.scheduledStart, scheduleWindowStart),
              lte(schema.gameSchedules.scheduledStart, scheduleWindowEnd)
            )
          )
          .all()
        const tokenize = (s: string): string[] =>
          s.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter((t) => t.length >= 4) // skip short tokens like "vs", "the", "at"
        type ScheduleMatch = {
          home: string
          away: string
          scheduledStart: number
          estimatedEnd: number
          status: string | null
          statusDetail: string | null
          espnEventId: string | null
          league: string | null
          homeScore: number | null
          awayScore: number | null
          currentPeriod: number | null
          clockTime: string | null
        }
        const lookupSchedule = (title: string): ScheduleMatch | undefined => {
          const titleTokens = new Set(tokenize(title))
          if (titleTokens.size < 2) return undefined
          let best: { row: ScheduleMatch; matchedTokens: number } | null = null
          for (const sch of upcomingSchedules) {
            const homeTokens = tokenize(sch.home)
            const awayTokens = tokenize(sch.away)
            const homeHit = homeTokens.some((t) => titleTokens.has(t))
            const awayHit = awayTokens.some((t) => titleTokens.has(t))
            if (!homeHit || !awayHit) continue
            const matched =
              homeTokens.filter((t) => titleTokens.has(t)).length +
              awayTokens.filter((t) => titleTokens.has(t)).length
            if (!best || matched > best.matchedTokens) {
              best = { row: sch, matchedTokens: matched }
            }
          }
          return best?.row
        }
        // Statuses that mean "this game is over — don't show it on the
        // bartender remote." Cable/satellite path filters the same way.
        const completedStatuses = new Set(['completed', 'final', 'postponed', 'cancelled'])

        let catInjected = 0
        let catSkippedDupe = 0
        let catEnriched = 0
        let catSkippedCompleted = 0
        let catSkippedNoSubscription = 0
        // Within-catalog dedup: same app + same title. The walker can capture
        // the same tile twice on adjacent passes (e.g. featured carousel +
        // sport-specific row); de-dup so the bartender doesn't see twins.
        const seenInCatalog = new Set<string>()

        // v2.33.16 — ESPN tier filter. ESPN's content tiles embed the
        // required-subscription tier in their title suffix, e.g.:
        //   "First Take ESPN • First Take"            → ESPN linear (cable)
        //   "Truist Championship ESPN+ • PGA TOUR"    → ESPN+
        //   "Backlash 2026 ESPN Unlimited • WWE..."   → ESPN Unlimited
        //   "WNBA Countdown ESPN on ABC • WNBA"       → ABC broadcast
        //   "ESPN Deportes/ESPN+ • EN/ES • ..."       → ESPN+ (Spanish)
        // Operator on 2026-05-11 reported clicking "First Take" produced
        // a "get access" paywall — the bar has ESPN+ but not linear ESPN
        // (no cable provider login on the cube) and not ESPN Unlimited.
        // Hide tiles whose tier isn't in the device's subscription set.
        //
        // Without per-device subscription data in DeviceStreamingLogin
        // (table is empty fleet-wide as of v2.33.16), default streaming
        // devices to ESPN+ only. Once operators populate the login
        // table this default falls through to actual data.
        const detectEspnTier = (title: string, isLive: boolean): 'espn-linear' | 'espn-plus' | 'espn-unlimited' | 'espn-abc' | null => {
          const t = title.toLowerCase()
          if (t.includes('espn unlimited')) return 'espn-unlimited'
          if (t.includes('espn on abc')) return 'espn-abc'
          // v2.33.18 — "ESPN/ESPN+" simulcasts → always espn-plus. The
          // slash indicates the content is available on BOTH linear ESPN
          // AND on ESPN+ (live simulcast + on-demand replay). A bar with
          // ESPN+ subscription can watch via the ESPN+ feed regardless
          // of whether it's currently live or already aired.
          // (Reverted v2.33.17's live=linear treatment after operator
          // confirmed Pat McAfee Show should be playable on ESPN+.)
          if (t.includes('espn/espn+') || t.includes('espn / espn+')) return 'espn-plus'
          if (t.includes('espn+') || t.includes('espn deportes/espn+')) return 'espn-plus'
          // Bare " espn " or "espn •" suffix (linear) — must NOT match espn+ which has + before space
          if (/\bespn\s*(?:[2u]|news)?\s*[•·]/i.test(title)) return 'espn-linear'
          return null
        }
        // Per-device subscription tier set. TODO: populate from
        // DeviceStreamingLogin when operators configure subscriptions
        // per-cube. Default for streaming devices: ESPN+ only.
        const deviceSubscribedTiers = new Set<string>(['espn-plus'])

        for (const row of catalogRows) {
          const dupeKey = `${row.app}::${row.contentTitle}`
          if (seenInCatalog.has(dupeKey)) {
            catSkippedDupe++
            continue
          }
          seenInCatalog.add(dupeKey)

          // ESPN tier check: only filter ESPN app rows; other apps unaffected.
          if (row.app === 'ESPN') {
            const tier = detectEspnTier(row.contentTitle, !!row.isLive)
            if (tier && !deviceSubscribedTiers.has(tier)) {
              catSkippedNoSubscription++
              continue
            }
          }

          const appChannelId = `stream-${row.app.replace(/\s+/g, '-').toLowerCase()}`
          let appChannel = channels.get(appChannelId)
          if (!appChannel) {
            appChannel = buildStreamingAppChannel({ appName: row.app, channelNumber: row.app })
            channels.set(appChannelId, appChannel)
          }

          // v2.33.1 — Look up the full schedule match (start time, status,
          // espnEventId, home/away team names) from game_schedules. Match
          // is by team-token overlap; we use the result for: (a) start
          // time enrichment, (b) auto-removal of completed games,
          // (c) proper home/away split (so bartender's existing live-
          // data match-by-team-name lookup works), (d) espnEventId so
          // future code can fetch live scores by ID.
          const scheduleMatch = lookupSchedule(row.contentTitle)
          if (scheduleMatch && scheduleMatch.status &&
              completedStatuses.has(scheduleMatch.status.toLowerCase())) {
            // Game is over — don't include it. Same behavior as cable/sat
            // path which filters status='completed'/'final' rows out.
            catSkippedCompleted++
            continue
          }

          // v2.33.14 — Stale-live filter for catalog rows without a
          // game_schedules match. Walker's `isLive` is captured-in-time:
          // it was true when the walker dumped the AS tree, but the
          // catalog row sits in the DB for 36h, so a game that finished
          // hours ago still reads isLive=1. game_schedules can rescue
          // SOME games (ESPN-tracked leagues — NBA/NFL/MLB/NHL/MLS/EPL/
          // college), but not all (Spanish La Liga 2nd division, Copa
          // del Rey, lower-tier soccer, niche events). For those, if
          // row.isLive=1 and capturedAt is more than STALE_LIVE_HOURS
          // ago, treat the row as completed and skip injection.
          // Operator-reported on 2026-05-11: "CD Tenerife vs FC Barcelona"
          // captured 02:05, still showing LIVE 8h after end of match.
          const STALE_LIVE_HOURS = 4
          if (row.isLive && !scheduleMatch &&
              (nowSec - row.capturedAt) > STALE_LIVE_HOURS * 3600) {
            catSkippedCompleted++
            continue
          }

          // Walker's startTime takes precedence; otherwise enrichment
          // match's scheduledStart; otherwise fall back to NOW so the
          // bartender's "past midnight of scheduled day" filter passes
          // for live/on-demand tiles. Pre-v2.33.1 we fell back to
          // capturedAt (typically yesterday) and the bartender filter
          // discarded every program — that's why "NO LIVE GAMES"
          // showed instead of the expected list.
          let resolvedStart: number | undefined =
            typeof row.startTime === 'number' && row.startTime > 0
              ? row.startTime
              : undefined
          if (resolvedStart === undefined && scheduleMatch) {
            resolvedStart = scheduleMatch.scheduledStart
            catEnriched++
          }
          // v2.33.21 — Hardcoded ESPN show schedule lookup. Shows like
          // Pat McAfee Show, Rich Eisen Show, First Take, SportsCenter
          // etc. aren't in game_schedules (no ESPN events feed for talk
          // shows) and Scout doesn't extract start times. Without this,
          // live show tiles only display "LIVE" with no time context.
          // Lookup is title-substring → daily ET start time. Times are
          // computed for TODAY in America/New_York (ESPN's broadcast TZ).
          if (resolvedStart === undefined && row.isLive) {
            const KNOWN_ESPN_SHOWS: Array<{ titleKey: string; etHour: number; etMin: number; weekdaysOnly: boolean }> = [
              { titleKey: 'first take',         etHour: 10, etMin: 0,  weekdaysOnly: true },
              { titleKey: 'get up',             etHour: 8,  etMin: 0,  weekdaysOnly: true },
              { titleKey: 'pat mcafee show',    etHour: 12, etMin: 0,  weekdaysOnly: true },
              { titleKey: 'rich eisen show',    etHour: 12, etMin: 0,  weekdaysOnly: true },
              { titleKey: 'around the horn',    etHour: 17, etMin: 0,  weekdaysOnly: true },
              { titleKey: 'pardon the interruption', etHour: 17, etMin: 30, weekdaysOnly: true },
              { titleKey: 'nfl live',           etHour: 16, etMin: 0,  weekdaysOnly: true },
              { titleKey: 'nba today',          etHour: 15, etMin: 0,  weekdaysOnly: true },
              { titleKey: 'baseball tonight',   etHour: 20, etMin: 0,  weekdaysOnly: false },
              { titleKey: 'sportscenter',       etHour: 6,  etMin: 0,  weekdaysOnly: false },
              { titleKey: 'espn radio',         etHour: 6,  etMin: 0,  weekdaysOnly: false },
            ]
            const titleLower = row.contentTitle.toLowerCase()
            const show = KNOWN_ESPN_SHOWS.find(s => titleLower.includes(s.titleKey))
            if (show) {
              // Build today's ET start time. ESPN's broadcast TZ is
              // always America/New_York; convert to a unix timestamp.
              const now = new Date()
              const etDateStr = now.toLocaleString('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
              const [m, d, y] = etDateStr.split('/').map(Number)
              const dayOfWeek = new Date(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}T12:00:00-05:00`).getUTCDay()
              if (!show.weekdaysOnly || (dayOfWeek >= 1 && dayOfWeek <= 5)) {
                // Construct ET timestamp manually: EDT in May = UTC-4
                const etOffsetHours = -4  // DST in May
                const utcHour = show.etHour - etOffsetHours
                const showStartUtcMs = Date.UTC(y, m - 1, d, utcHour, show.etMin)
                resolvedStart = Math.floor(showStartUtcMs / 1000)
              }
            }
          }
          const hasStartTime = resolvedStart !== undefined
          const startSec = hasStartTime ? (resolvedStart as number) : nowSec
          const startMs = startSec * 1000
          const startDate = new Date(startMs)

          // 3-hour estimated duration when we have a real startTime;
          // otherwise default to 3h from now so the program stays valid
          // through current game window. Don't use expiresAt (36h TTL)
          // anymore — that was forward-looking but unrelated to game end.
          const endMs = hasStartTime
            ? startMs + 3 * 60 * 60 * 1000
            : startMs + 3 * 60 * 60 * 1000

          // Display fields formatted in VENUE_TIMEZONE (America/Chicago).
          let day = ''
          let time = ''
          let gameTimeLabel: string
          // v2.33.14 — scheduleMatch is authoritative when present
          // (real-time ESPN status). Only trust the walker's row.isLive
          // when no schedule match — and even then only if not stale
          // (already filtered above).
          const effectiveIsLive = scheduleMatch
            ? scheduleMatch.status === 'in_progress'
            : !!row.isLive
          if (effectiveIsLive) {
            // v2.33.21 — Show go-live time alongside LIVE marker when known.
            // Bartender wants context — "did this game just start, or has
            // it been on for hours?" — so a Pat McAfee Show or in-progress
            // matchup displays e.g. "LIVE • 11:00 AM" instead of just
            // "LIVE". Uses scheduleMatch.scheduledStart when available
            // (game_schedules sync), otherwise the walker's row.startTime
            // (parseTileTime extracted from the tile content-desc), and
            // only falls back to "LIVE" alone when no start time exists
            // anywhere.
            if (hasStartTime) {
              const startTimeLabel = timeFormatter.format(startDate)
              gameTimeLabel = `LIVE • ${startTimeLabel}`
              time = `LIVE • ${startTimeLabel}`
              day = dayFormatter.format(startDate)
            } else {
              gameTimeLabel = 'LIVE'
              time = 'LIVE'
              day = 'LIVE'
            }
          } else if (hasStartTime) {
            day = dayFormatter.format(startDate)
            time = timeFormatter.format(startDate)
            gameTimeLabel = time
          } else {
            // No walker startTime + no schedule match → on-demand / replay.
            gameTimeLabel = 'On demand'
            day = 'On demand'
            time = ''
          }

          // v2.32.84 — bartender consumer reads `game.channel.deepLink`
          // (EnhancedChannelGuideBartenderRemote.tsx line ~1139). The channels
          // Map caches one channel per app id, so build a per-program shallow
          // copy that carries this game's specific deep link.
          const programChannel = row.deepLink
            ? { ...appChannel, deepLink: row.deepLink }
            : appChannel

          // v2.33.1 — Split contentTitle into home/away on " vs.? "
          // separator so the bartender's existing live-data lookup
          // (keyed by `${away}-${home}`) can match these tiles.
          // When the schedule match is found, prefer ITS team names —
          // they're authoritative ESPN names, while the walker tile
          // text may have minor variations ("Mariners vs. White Sox"
          // vs ESPN's "Seattle Mariners" / "Chicago White Sox").
          let homeTeam = row.contentTitle
          let awayTeam = ''
          if (scheduleMatch && scheduleMatch.home && scheduleMatch.away) {
            homeTeam = scheduleMatch.home
            awayTeam = scheduleMatch.away
          } else {
            const vsMatch = row.contentTitle.split(/\s+vs\.?\s+/i)
            if (vsMatch.length === 2 && vsMatch[0].length >= 2 && vsMatch[1].length >= 2) {
              awayTeam = vsMatch[0].trim()
              homeTeam = vsMatch[1].trim()
            }
          }

          // v2.33.1 — Inline liveData on the program when we have a
          // schedule match. The bartender remote already renders
          // homeScore/awayScore/timeRemaining/quarter/status from
          // program.liveData when present (mirrors the cable/satellite
          // path which gets it from the separate live-by-channel
          // endpoint). For streaming we put it inline so bartender
          // doesn't need a second round-trip.
          const liveData = scheduleMatch ? {
            isLive: scheduleMatch.status === 'in_progress',
            homeScore: scheduleMatch.homeScore,
            awayScore: scheduleMatch.awayScore,
            clock: scheduleMatch.clockTime,
            period: scheduleMatch.currentPeriod,
            statusDetail: scheduleMatch.statusDetail,
            espnGameId: scheduleMatch.espnEventId,
          } : undefined

          programs.push({
            id: `cat-${row.id}`,
            league: scheduleMatch?.league || row.sportTag || 'Sports',
            homeTeam,
            awayTeam,
            gameTime: gameTimeLabel,
            day,
            time,
            startTime: startDate.toISOString(),
            endTime: new Date(endMs).toISOString(),
            channel: programChannel,
            // v2.33.1 — clean bartender-facing description. No more
            // "(deep-linkable)" annotation; that's an internal detail
            // the bartender doesn't need.
            description: `${row.contentTitle} on ${row.app}`,
            isSports: true,
            isLive: effectiveIsLive,
            venue: '',
            station: row.app,
            sportTag: row.sportTag || undefined,
            // v2.33.1 — espnEventId for downstream live-data matching.
            espnEventId: scheduleMatch?.espnEventId || undefined,
            liveData,
          })
          catInjected++
        }

        if (catInjected > 0 || catSkippedDupe > 0 || catSkippedCompleted > 0) {
          logInfo(
            `firetv_streaming_catalog injection for ${deviceId}: +${catInjected} from scout walker, ${catSkippedDupe} dedup, ${catEnriched} enriched startTime from game_schedules, ${catSkippedCompleted} completed games skipped, ${catSkippedNoSubscription} tier-paywall skipped`
          )
        }
      } catch (catalogError: any) {
        logger.error('[Channel-Guide-API] catalog injection failed (non-fatal):', { error: catalogError.message })
      }

      // v2.33.15 — game_schedules fallback for STREAMING. The cable/sat
      // path has had this since v2.28.2, but streaming has only ever
      // pulled from the catalog. So a game ESPN has in game_schedules
      // but Scout/walker didn't capture (because the cube was in
      // screensaver, the tile was below the fold, etc.) is INVISIBLE
      // in the bartender guide. Operator caught Angels @ Guardians +
      // UC Irvine + Avalanche missing on Holmgren Cube 2 today
      // (2026-05-11) even though all three were on the cube's ESPN
      // "Upcoming" rail.
      //
      // For each scheduled-today game in game_schedules, resolve its
      // broadcast_networks against the streaming app aliases. If any
      // alias matches an app the cube has installed (or any app at
      // all when installedApps unknown), synthesize a program.
      try {
        const { db } = await import('@/db')
        const { schema } = await import('@/db')
        const { and: andOp2, gte: gteOp, lte: lteOp, or: orOp, eq: eqOp } = await import('drizzle-orm')

        // Use `start`/`end` (local Date vars with defaults) — `startTime`/
        // `endTime` are the raw request params and are often undefined,
        // which would give NaN unix seconds and match 0 rows.
        const windowStartSec = Math.floor(start.getTime() / 1000)
        const windowEndSec = Math.floor(end.getTime() / 1000)
        const nowSec = Math.floor(Date.now() / 1000)
        const sixHoursAgo = nowSec - 6 * 60 * 60

        const localGames = await db
          .select()
          .from(schema.gameSchedules)
          .where(
            orOp(
              andOp2(
                lteOp(schema.gameSchedules.scheduledStart, windowEndSec),
                gteOp(schema.gameSchedules.estimatedEnd, windowStartSec)
              ),
              andOp2(
                eqOp(schema.gameSchedules.status, 'in_progress'),
                gteOp(schema.gameSchedules.estimatedEnd, sixHoursAgo)
              )
            )
          )
          .all()

        // Network-name → canonical streaming app name. Matches against the
        // device's installedApps (case-insensitive substring) so e.g.
        // "ESPN Unlmtd" resolves to ESPN when the cube has the ESPN app.
        const STREAMING_NETWORK_ALIASES: Record<string, string> = {
          'espn': 'ESPN', 'espn2': 'ESPN', 'espnu': 'ESPN', 'espnnews': 'ESPN',
          'espn unlmtd': 'ESPN', 'espn unlimited': 'ESPN', 'espn+': 'ESPN',
          'sec network': 'ESPN', 'acc network': 'ESPN', 'big ten network': 'ESPN',
          'mlb.tv': 'MLB.TV', 'mlb network': 'MLB.TV',
          'nhl.tv': 'NHL.TV', 'nba.tv': 'NBA.TV',
          'prime video': 'Amazon Prime Video', 'amazon prime video': 'Amazon Prime Video',
          'apple tv+': 'Apple TV', 'apple tv': 'Apple TV',
          'peacock': 'Peacock', 'hulu': 'Hulu',
          'paramount+': 'Paramount+', 'max': 'Max', 'hbo max': 'Max',
          'fubo': 'FuboTV', 'fubotv': 'FuboTV',
          'youtube tv': 'YouTube TV', 'sling tv': 'Sling TV',
          'nfhs network': 'NFHS Network',
          // Team RSN-as-streaming feeds — fold to MLB.TV
          'brewers.tv': 'MLB.TV', 'angels.tv': 'MLB.TV',
          'cleguardians.tv': 'MLB.TV', 'guardians.tv': 'MLB.TV',
          'dodgers.tv': 'MLB.TV', 'yankees.tv': 'MLB.TV',
        }

        let gsStreamInjected = 0
        let gsStreamSkippedNoApp = 0
        let gsStreamSkippedDupe = 0

        for (const game of localGames) {
          if (!game.homeTeamName || !game.awayTeamName) continue

          let broadcastNetworks: string[] = []
          try {
            if (game.broadcastNetworks) broadcastNetworks = JSON.parse(game.broadcastNetworks)
          } catch { broadcastNetworks = [] }
          if (broadcastNetworks.length === 0) continue

          // v2.33.15 — Find a network that maps to an app the cube has.
          // v2.33.16 — Two-pass: prefer dedicated apps (MLB.TV / NHL.TV /
          // NBA.TV / Peacock) over ESPN linear when both are listed,
          // because ESPN linear/Unlimited often requires a higher tier
          // than ESPN+. Operator caught this 2026-05-11: Angels @
          // Guardians broadcast networks = ["ESPN Unlmtd","MLB.TV",
          // "CLEGuardians.TV","Angels.TV"]. ESPN was picked first → bar
          // paywalled. Should prefer MLB.TV (dedicated app, broader MLB
          // coverage).
          //
          // deviceInstalledApps contains PACKAGE names (e.g. "com.espn.gtv"),
          // not display names, so check via canonical-app → package-token map.
          // Accept when installedApps is empty (Scout hasn't reported)
          // so we don't suppress all upcoming games during cube startup.
          // Substring tokens that match the actual package names installed
          // on Fire TV cubes. Verified against real `pm list packages`
          // output on Holmgren Cube 2: MLB.TV ships as
          // `com.bamnetworks.mobile.android.gameday.atbat` — no "mlb"
          // substring, so use `bamnetworks`. Peacock package is
          // `com.peacock.peacockfiretv` not `com.peacocktv.peacockandroid`
          // — accept either via `peacock` substring.
          const APP_TO_PACKAGE_TOKEN: Record<string, string> = {
            'ESPN': 'espn',
            'MLB.TV': 'bamnetworks',
            'NHL.TV': 'nhl',
            'NBA.TV': 'nba',
            'Amazon Prime Video': 'firebat',
            'Apple TV': 'appletv',
            'Peacock': 'peacock',
            'Hulu': 'hulu',
            'Paramount+': 'paramount',
            'Max': 'wbtvd',
            'FuboTV': 'fubo',
            'YouTube TV': 'youtube',
            'Sling TV': 'sling',
            'NFHS Network': 'nfhs',
          }
          // Preference: dedicated subscription apps > ESPN+ > ESPN linear.
          const APP_PREFERENCE: Record<string, number> = {
            'MLB.TV': 100, 'NHL.TV': 100, 'NBA.TV': 100,
            'Peacock': 80, 'Paramount+': 80, 'Max': 80,
            'Amazon Prime Video': 70, 'Apple TV': 70, 'Hulu': 70,
            'FuboTV': 60, 'YouTube TV': 60, 'Sling TV': 60,
            'ESPN': 50,
            'NFHS Network': 40,
          }
          const isAppInstalled = (canonical: string): boolean => {
            if (deviceInstalledApps.length === 0) return true  // unknown — accept
            const token = APP_TO_PACKAGE_TOKEN[canonical]
            if (!token) return true  // unknown — accept
            const installedLower = deviceInstalledApps.map(a => a.toLowerCase())
            return installedLower.some(pkg => pkg.includes(token))
          }
          // v2.33.16 — ESPN tier from broadcast_networks. "ESPN Unlmtd" /
          // "ESPN Unlimited" requires the higher tier; ESPN+ flagged
          // networks work with ESPN+ subscription. Bare ESPN/ESPN2/ESPNU
          // is linear (requires cable provider login).
          const espnTierFromNetworks = (networks: string[]): 'espn-plus' | 'espn-unlimited' | 'espn-linear' | null => {
            const lower = networks.map(n => n.toLowerCase().trim())
            if (lower.some(n => n === 'espn+' || n === 'espn plus')) return 'espn-plus'
            if (lower.some(n => n.includes('unlmtd') || n.includes('unlimited'))) return 'espn-unlimited'
            if (lower.some(n => n === 'espn' || n === 'espn2' || n === 'espnu' || n === 'espnnews')) return 'espn-linear'
            return null
          }
          // Hardcoded device tiers — bar has ESPN+ only per operator
          // statement 2026-05-11. Replace with DeviceStreamingLogin
          // table lookup once populated.
          const deviceTiers = new Set<string>(['espn-plus'])

          // v2.33.16 — Scout's installedApps report is incomplete (only
          // tracks apps with catalog DB entries, ~8 of ~19 on Holmgren
          // Cube 2). So an isAppInstalled check is too strict — would
          // wrongly hide MLB.TV games even though the bartender can play
          // them. Strategy: for non-ESPN canonicals (dedicated sport
          // apps, streaming services), TRUST broadcast_networks. For
          // ESPN, apply the tier check against the bar's subscription
          // set. If bartender clicks Watch and the app isn't actually
          // installed, the launch fails — but installed cases work.
          let matchedApp: string | null = null
          let matchedNetwork = ''
          let bestPref = -1
          for (const net of broadcastNetworks) {
            const canonical = STREAMING_NETWORK_ALIASES[net.toLowerCase().trim()]
            if (!canonical) continue
            if (canonical === 'ESPN') {
              // ESPN: must pass install AND tier check.
              if (!isAppInstalled(canonical)) continue
              const tier = espnTierFromNetworks(broadcastNetworks)
              if (tier && !deviceTiers.has(tier)) continue
            }
            // Non-ESPN dedicated apps: trust broadcast_networks. Bartender's
            // launch path will handle absent-app cases at runtime.
            const pref = APP_PREFERENCE[canonical] ?? 0
            if (pref > bestPref) {
              matchedApp = canonical
              matchedNetwork = net
              bestPref = pref
            }
          }
          if (!matchedApp) { gsStreamSkippedNoApp++; continue }

          // Dedup against catalog-injected programs for same teams
          const dupe = programs.some(p =>
            p.homeTeam?.toLowerCase() === game.homeTeamName.toLowerCase() &&
            p.awayTeam?.toLowerCase() === game.awayTeamName.toLowerCase()
          )
          if (dupe) { gsStreamSkippedDupe++; continue }

          const appChannelId = `stream-${matchedApp.replace(/\s+/g, '-').toLowerCase()}`
          let appChan = channels.get(appChannelId)
          if (!appChan) {
            appChan = buildStreamingAppChannel({ appName: matchedApp, channelNumber: matchedApp })
            channels.set(appChannelId, appChan)
          }

          const startDate = new Date(game.scheduledStart * 1000)
          const endDate = new Date(game.estimatedEnd * 1000)
          const isLive = game.status === 'in_progress'
          // v2.33.21 — Same go-live time format as the catalog injection
          // path: for live games show "LIVE • <start time>" so bartender
          // knows when it actually started (vs just "LIVE" with no context).
          const startTimeLabel = startDate.toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago',
          })
          const gameTimeLabel = isLive ? `LIVE • ${startTimeLabel}` : startTimeLabel

          programs.push({
            id: `gs-stream-${game.id}`,
            league: game.league || 'Sports',
            homeTeam: game.homeTeamName,
            awayTeam: game.awayTeamName,
            gameTime: gameTimeLabel,
            day: isLive ? 'LIVE' : startDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Chicago' }),
            time: isLive ? `LIVE • ${startTimeLabel}` : startTimeLabel,
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
            channel: appChan,
            description: `${game.awayTeamName} @ ${game.homeTeamName}${game.venueName ? ' · ' + game.venueName : ''} on ${matchedApp}`,
            isSports: true,
            isLive,
            venue: game.venueName || '',
            station: matchedApp,
            sportTag: game.league?.toUpperCase().replace(/[^A-Z]/g, '') || undefined,
            espnEventId: game.espnEventId || undefined,
          })
          gsStreamInjected++
        }

        if (gsStreamInjected > 0 || gsStreamSkippedNoApp > 0) {
          logInfo(`game_schedules STREAMING fallback for ${deviceId}: +${gsStreamInjected} injected, ${gsStreamSkippedDupe} dedup, ${gsStreamSkippedNoApp} skipped (no app match)`)
        }
      } catch (streamFallbackError: any) {
        logger.error('[Channel-Guide-API] streaming game_schedules fallback failed (non-fatal):', { error: streamFallbackError.message })
      }
    }

    // For streaming devices, check if NFHS Network is logged in and add NFHS games
    if (deviceType === 'streaming' && deviceId) {
      const hasNfhsLogin = NFHS_PACKAGES.some(pkg => deviceLoggedInPackages.includes(pkg))

      if (hasNfhsLogin) {
        logInfo(`Device ${deviceId} has NFHS Network login - fetching NFHS games`)

        try {
          // Fetch NFHS games from the NFHS API
          const nfhsResponse = await fetch('http://localhost:3001/api/nfhs')
          if (nfhsResponse.ok) {
            const nfhsData = await nfhsResponse.json()

            if (nfhsData.success && nfhsData.games) {
              logInfo(`Found ${nfhsData.games.length} NFHS games to add`)

              // Add NFHS channel
              // v2.32.9 — shared builder so NFHS programs carry appId+
              // packageName (was previously omitted, breaking the
              // bartender click for NFHS games per v2.31.2 root cause).
              const nfhsChannel = buildStreamingAppChannel({
                appName: 'NFHS Network',
                channelNumber: 'NFHS',
                packagesOverride: NFHS_PACKAGES,
              })
              channels.set(nfhsChannel.id, nfhsChannel)

              // Add NFHS games as programs
              for (const game of nfhsData.games) {
                // Parse dateTime for sorting and filtering
                let startTime: Date
                let endTime: Date

                if (game.dateTime) {
                  startTime = new Date(game.dateTime)
                } else {
                  // Try parsing date + time
                  startTime = new Date(`${game.date} ${game.time}`)
                }

                // Assume 2 hour games for high school sports
                endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000)

                const program = {
                  id: `nfhs-${game.id}`,
                  league: 'High School Sports',
                  homeTeam: game.homeTeam,
                  awayTeam: game.awayTeam,
                  gameTime: game.time,
                  startTime: startTime.toISOString(),
                  endTime: endTime.toISOString(),
                  channel: nfhsChannel,
                  description: `${game.sport} - ${game.homeTeam} vs ${game.awayTeam} at ${game.location}`,
                  isSports: true,
                  isLive: game.status === 'live',
                  venue: game.location,
                  sport: game.sport,
                  level: game.level,
                  eventUrl: game.eventUrl,
                  status: game.status
                }

                programs.push(program)
                logInfo(`Added NFHS game: ${game.sport} - ${game.homeTeam} vs ${game.awayTeam}`)
              }
            }
          }
        } catch (nfhsError: any) {
          logError(`Could not fetch NFHS games: ${nfhsError.message}`)
        }
      }
    }

    // Filter out games that started more than 2 hours ago to keep the guide fresh.
    // v2.28.2 — EXCEPT keep games that are explicitly isLive=true regardless of
    // start time. ESPN sometimes leaves OT games in_progress for hours past
    // estimated_end; the bartender absolutely needs to see those in the guide
    // because they're still on a TV right now (Wolves @ Nuggets case 2026-04-21).
    const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000))
    const freshPrograms = programs.filter(program => {
      if (program.isLive) return true // never filter live-now games on age
      if (program.startTime) {
        const gameStart = new Date(program.startTime)
        return gameStart >= twoHoursAgo
      }
      return true // Keep programs without startTime
    })

    const removedCount = programs.length - freshPrograms.length
    if (removedCount > 0) {
      logInfo(`[CLEANUP] Filtered out ${removedCount} old programs that started more than 2 hours ago`)
    }

    // Filter by channel presets - only show channels that are configured
    // Reuse presets already loaded above (no second DB query)
    let presetFilteredPrograms = freshPrograms
    let presetChannels = new Set<string>()
    let presetRemovedCount = 0

    if (deviceType !== 'streaming') {
      // For cable/satellite, build preset channel set from already-loaded presets
      presetChannels = new Set(
        presets.map(p => p.channelNumber)
      )

      logInfo(`Filtering by ${presetChannels.size} ${presetDeviceType} channel presets (reused from station matching)`)

      // Filter programs to only include preset channels
      presetFilteredPrograms = freshPrograms.filter(program => {
        const channelNumber = program.channel?.channelNumber || program.channel?.number
        const isInPreset = channelNumber && (presetChannels.has(channelNumber) || presetChannels.has(String(channelNumber)))

        if (!isInPreset) {
          logInfo(`Filtering out channel ${channelNumber} - not in presets`, {
            league: program.league,
            channel: program.channel?.name
          })
        }

        return isInPreset
      })

      presetRemovedCount = freshPrograms.length - presetFilteredPrograms.length
      if (presetRemovedCount > 0) {
        logInfo(`[PRESET FILTER] Filtered out ${presetRemovedCount} programs not in channel presets`)
      }
    } else {
      // For streaming devices, no preset filtering - already filtered by installed apps
      logInfo(`Streaming device - skipping preset filtering, showing ${freshPrograms.length} programs`)
    }

    const response = {
      success: true,
      inputNumber,
      deviceType,
      deviceId,
      timeRange: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      lastUpdated: new Date().toISOString(),
      type: deviceType,
      channels: Array.from(channels.values()),
      programs: presetFilteredPrograms,
      dataSource: 'The Rail Media API',
      summary: {
        programCount: presetFilteredPrograms.length,
        channelCount: channels.size,
        leagues: [...new Set(presetFilteredPrograms.map(p => p.league))],
        presetFiltered: true,
        presetChannelCount: presetChannels.size
      }
    }

    logInfo(`========== REQUEST COMPLETE [${requestId}] ==========`)
    logInfo(`Returning ${presetFilteredPrograms.length} programs for ${deviceType} (filtered ${removedCount} old games, ${presetRemovedCount} non-preset channels)`)

    return NextResponse.json(response)

  } catch (error) {
    logError('Failed to fetch channel guide data', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch channel guide data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  const requestId = Math.random().toString(36).substring(7)
  logInfo(`========== GET REQUEST [${requestId}] - Returning help info ==========`)
  
  return NextResponse.json({
    success: true,
    message: 'Channel Guide API - Use POST method with device type and input number',
    dataSource: 'The Rail Media API',
    supportedDeviceTypes: ['cable', 'satellite', 'streaming'],
    requiredParams: ['inputNumber', 'deviceType'],
    optionalParams: ['deviceId', 'startTime', 'endTime'],
    example: {
      inputNumber: 1,
      deviceType: 'satellite',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }
  })
}
