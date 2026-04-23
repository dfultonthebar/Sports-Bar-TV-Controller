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
  getStreamingAppInfoForStation,
  normalizeStation,
} from '@/lib/network-channel-resolver'
import { STREAMING_APPS_DATABASE } from '@/lib/streaming/streaming-apps-database'

// v2.31.3 — Map any display name we might see (from scout, from the
// network-channel-resolver, from a UI label) to a streaming-apps-database
// catalog id. Keeps the lookup robust against the cosmetic name drift
// between sources ("Prime Video" vs "Amazon Prime Video", "ESPN" vs "ESPN+",
// etc.). Add new aliases here as new app sources are wired in.
const DISPLAY_NAME_TO_CATALOG_ID: Record<string, string> = {
  'prime video': 'amazon-prime',
  'amazon prime video': 'amazon-prime',
  'amazon prime': 'amazon-prime',
  'amazon-prime': 'amazon-prime',
  'espn': 'espn-plus',
  'espn+': 'espn-plus',
  'espn plus': 'espn-plus',
  'peacock': 'peacock',
  'paramount': 'paramount-plus',
  'paramount+': 'paramount-plus',
  'apple tv': 'apple-tv',
  'apple tv+': 'apple-tv',
  'hulu': 'hulu-live',
  'hulu live': 'hulu-live',
  'fubotv': 'fubo-tv',
  'fubo': 'fubo-tv',
  'youtube tv': 'youtube-tv',
  'youtube': 'youtube-tv',
  'netflix': 'netflix',
  'mlb.tv': 'mlb-tv',
  'mlb tv': 'mlb-tv',
  'nhl': 'nhl-tv',
  'nba league pass': 'nba-league-pass',
  'fox sports': 'fox-sports',
  'nbc sports': 'nbc-sports',
  'sling tv': 'sling-tv',
  'sling': 'sling-tv',
  'dazn': 'dazn',
  'nfhs network': 'nfhs-network',
  'nfhs': 'nfhs-network',
}

function findStreamingAppByDisplayName(name: string | undefined | null) {
  if (!name) return undefined
  const id = DISPLAY_NAME_TO_CATALOG_ID[name.toLowerCase().trim()]
  if (id) return STREAMING_APPS_DATABASE.find((a) => a.id === id)
  // Last-resort exact name match (catalog entries that haven't been aliased yet)
  return STREAMING_APPS_DATABASE.find(
    (a) => a.name === name || a.name.toLowerCase() === name.toLowerCase()
  )
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

            // Parse the date properly
            let eventDate: Date
            if (listing.date) {
              const currentYear = new Date().getFullYear()
              const dateWithYear = `${listing.date} ${currentYear} ${listing.time}`
              eventDate = new Date(dateWithYear)

              if (isNaN(eventDate.getTime()) || eventDate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
                eventDate = new Date(`${listing.date} ${currentYear + 1} ${listing.time}`)
              }
            } else {
              eventDate = new Date(`${new Date().toDateString()} ${listing.time}`)
            }

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

        // v2.28.2 — overlap filter PLUS in_progress catch-all. Previously
        // we filtered on scheduledStart only (`gte(start, windowStart) && lte(start, windowEnd)`)
        // which excluded any game that started BEFORE windowStart even if it
        // was still airing. The overlap check fixes upcoming + recently-started.
        // The OR(status='in_progress') catches games that ran past their
        // estimated_end (OT, weather delay, etc.) — ESPN still has them as
        // in_progress so we trust that label even when our duration estimate
        // is stale. Manager case: Wolves @ Nuggets ran into OT past midnight,
        // estimated_end was 90min in the past, but ESPN status was still
        // 'in_progress' and the game was actively playing on DirecTV 6.
        const { or, eq } = await import('drizzle-orm')
        const localGames = await db
          .select()
          .from(schema.gameSchedules)
          .where(
            or(
              and(
                lte(schema.gameSchedules.scheduledStart, windowEndSec),
                gte(schema.gameSchedules.estimatedEnd, windowStartSec)
              ),
              eq(schema.gameSchedules.status, 'in_progress')
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

          // Resolve via the shared helper. This walks the networks array,
          // does direct + alias lookup, and respects the WI RSN split.
          const resolution = await resolveChannelsForNetworks(
            broadcastNetworks,
            game.primaryNetwork ?? null
          )
          const resolvedForDevice = presetDeviceType === 'directv' ? resolution.directv : resolution.cable
          if (!resolvedForDevice) {
            gsSkippedNoChannel++
            continue
          }
          const resolvedPreset = {
            channelNumber: resolvedForDevice.channelNumber,
            name: resolvedForDevice.presetName,
          }
          const matchedStation = resolvedForDevice.matchedNetwork

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

          const channelInfo = {
            id: `${deviceType}-${resolvedPreset.channelNumber}`,
            name: resolvedPreset.name,
            number: resolvedPreset.channelNumber,
            type: deviceType,
            cost: 'subscription',
            platforms: [deviceType === 'satellite' ? 'DirecTV' : 'Cable'],
            channelNumber: resolvedPreset.channelNumber,
            deviceType: deviceType,
            station: matchedStation,
            presetName: resolvedPreset.name,
          }
          if (!channels.has(channelInfo.id)) {
            channels.set(channelInfo.id, channelInfo)
          }

          // v2.28.2 — derive isLive from current time + game status. ESPN
          // sometimes lags marking a game 'completed' (especially OT games);
          // trust the time window AND the explicit in_progress status when
          // either is true.
          const isLive =
            game.status === 'in_progress' ||
            (nowSec >= game.scheduledStart && nowSec <= game.estimatedEnd && game.status !== 'completed' && game.status !== 'final')

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

    // For streaming devices, use The Rail Media API
    if (deviceType === 'streaming') {
      logInfo(`Device logged in packages: ${deviceLoggedInPackages.join(', ')}`)

      const api = getSportsGuideApi()
      const guide = await api.fetchDateRangeGuide(days)
      logInfo(`The Rail API returned ${guide.listing_groups?.length || 0} listing groups for streaming`)

      for (const group of guide.listing_groups || []) {
        for (const listing of group.listings || []) {
          // Extract channel info for streaming devices
          let channelInfo: any = null

          // For streaming/Fire TV devices, check if any station has a streaming app
          const stationList = listing.stations
          if (stationList) {
            const stations: string[] = Array.isArray(stationList)
              ? stationList
              : Object.values(stationList).filter((s): s is string => typeof s === 'string')

            for (const station of stations) {
              // Pass group_title as the sport hint so league-gated streaming
              // codes (MLBEI, NHLCI, NBALP, MLSDK) resolve correctly. The
              // helper's normalizeSport() handles MLB/NBA/NHL/MLS strings.
              const appInfo = getStreamingAppInfoForStation(station, group.group_title)
              if (appInfo) {
                // Check if the Fire TV device has this service LOGGED IN (not just installed)
                const hasLoggedIn = deviceLoggedInPackages.some(pkg => appInfo.packages.includes(pkg))
                if (hasLoggedIn) {
                  channelInfo = {
                    id: `stream-${appInfo.app.replace(/\s+/g, '-').toLowerCase()}`,
                    name: appInfo.app,
                    number: station,
                    type: 'streaming',
                    cost: 'subscription',
                    platforms: ['Fire TV', 'Streaming'],
                    channelNumber: station,
                    deviceType: 'streaming',
                    streamingApp: appInfo.app,
                    packages: appInfo.packages
                  }
                  logInfo(`Matched streaming station ${station} to app ${appInfo.app} on device ${deviceId}`)
                  break
                }
              }
            }
          }

          // Skip this listing if no matching channel was found
          if (!channelInfo) {
            continue
          }

          // Add channel to map
          channels.set(channelInfo.id, channelInfo)

          // Create program entry with proper date parsing
          const programId = `${group.group_title}-${listing.time}-${Math.random().toString(36).substring(7)}`

          // Parse the date properly
          let eventDate: Date
          if (listing.date) {
            const currentYear = new Date().getFullYear()
            const dateWithYear = `${listing.date} ${currentYear} ${listing.time}`
            eventDate = new Date(dateWithYear)

            if (isNaN(eventDate.getTime()) || eventDate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
              eventDate = new Date(`${listing.date} ${currentYear + 1} ${listing.time}`)
            }
          } else {
            eventDate = new Date(`${new Date().toDateString()} ${listing.time}`)
          }

          // Calculate end time (3 hours after start)
          const endTime = new Date(eventDate.getTime() + 3 * 60 * 60 * 1000)

          const program = {
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
            venue: listing.data['venue'] || listing.data['location'] || ''
          }

          programs.push(program)
        }
      }
    }

    logInfo(`Processed ${programs.length} programs and ${channels.size} channels`)

    // Streaming: augment with ESPN-synced game_schedules. Rail Media only covers
    // nationally-carried games; our ESPN sync covers 23 leagues. For each game
    // we walk broadcast_networks looking for a streaming app, and ONLY include
    // games whose app is actually logged-in on THIS specific Fire TV — different
    // Fire TVs at the same venue can have different apps installed.
    if (deviceType === 'streaming' && deviceId) {
      try {
        const { db } = await import('@/db')
        const { schema } = await import('@/db')
        const { and, gte, lte } = await import('drizzle-orm')

        const windowStartSec = Math.floor(new Date(startTime).getTime() / 1000)
        const windowEndSec = Math.floor(new Date(endTime).getTime() / 1000)

        // v2.28.2 — overlap filter + in_progress catch-all (see cable/directv path)
        const { or, eq } = await import('drizzle-orm')
        const localGames = await db
          .select()
          .from(schema.gameSchedules)
          .where(
            or(
              and(
                lte(schema.gameSchedules.scheduledStart, windowEndSec),
                gte(schema.gameSchedules.estimatedEnd, windowStartSec)
              ),
              eq(schema.gameSchedules.status, 'in_progress')
            )
          )
          .all()

        let gsInjected = 0
        let gsSkippedNoApp = 0
        let gsSkippedNotLoggedIn = 0
        let gsSkippedDupe = 0

        const nowSec = Math.floor(Date.now() / 1000)

        for (const game of localGames) {
          if (!game.homeTeamName || !game.awayTeamName) continue

          let broadcastNetworks: string[] = []
          try {
            if (game.broadcastNetworks) {
              broadcastNetworks = JSON.parse(game.broadcastNetworks)
            }
          } catch {
            broadcastNetworks = []
          }

          // Walk networks looking for a streaming app this device can play.
          // Sport-gate MLBEI/NHLCI/NBALP/MLSDK by passing the game's league.
          let matchedAppInfo: { app: string; code: string; packages: string[] } | null = null
          let matchedNetwork: string | null = null
          for (const network of broadcastNetworks) {
            const appInfo = getStreamingAppInfoForStation(network, game.league)
            if (!appInfo) continue
            const loggedIn = deviceLoggedInPackages.some(pkg => appInfo.packages.includes(pkg))
            if (loggedIn) {
              matchedAppInfo = appInfo
              matchedNetwork = network
              break
            }
          }

          if (!matchedAppInfo) {
            // We had no streaming app resolution at all, OR the app isn't
            // logged in on this device.
            const anyResolved = broadcastNetworks.some(
              n => getStreamingAppInfoForStation(n, game.league)
            )
            if (anyResolved) gsSkippedNotLoggedIn++
            else gsSkippedNoApp++
            continue
          }

          // Dedupe against programs already added from Rail Media
          const dupe = programs.some(p =>
            p.channel?.streamingApp === matchedAppInfo!.app &&
            p.homeTeam === game.homeTeamName &&
            p.awayTeam === game.awayTeamName
          )
          if (dupe) {
            gsSkippedDupe++
            continue
          }

          // v2.31.2 + v2.31.3 — populate appId + packageName so bartender
          // remote can actually launch. Use the alias-aware lookup so display
          // name drift ("ESPN+" vs "ESPN", "Prime Video" vs "Amazon Prime
          // Video") doesn't hide the catalog entry.
          const catalogAppForGs = findStreamingAppByDisplayName(matchedAppInfo.app)
          const appChannel = {
            id: `stream-${matchedAppInfo.app.replace(/\s+/g, '-').toLowerCase()}`,
            name: matchedAppInfo.app,
            number: matchedNetwork || matchedAppInfo.code,
            type: 'streaming',
            cost: 'subscription',
            platforms: ['Fire TV', 'Streaming'],
            channelNumber: matchedNetwork || matchedAppInfo.code,
            deviceType: 'streaming',
            streamingApp: matchedAppInfo.app,
            appId: catalogAppForGs?.id,
            packageName: catalogAppForGs?.packageName ?? matchedAppInfo.packages[0],
            packages: matchedAppInfo.packages,
          }
          if (!channels.has(appChannel.id)) {
            channels.set(appChannel.id, appChannel)
          }

          const startDate = new Date(game.scheduledStart * 1000)
          const endDate = new Date(game.estimatedEnd * 1000)
          const gameTimeLabel = startDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }).toLowerCase()

          // v2.28.2 — derive isLive (see cable/directv path)
          const isLive =
            game.status === 'in_progress' ||
            (nowSec >= game.scheduledStart && nowSec <= game.estimatedEnd && game.status !== 'completed' && game.status !== 'final')

          programs.push({
            id: `gs-stream-${game.id}`,
            league: game.league || 'Sports',
            homeTeam: game.homeTeamName,
            awayTeam: game.awayTeamName,
            gameTime: gameTimeLabel,
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
            channel: appChannel,
            description: `${game.awayTeamName} @ ${game.homeTeamName}${game.venueName ? ' · ' + game.venueName : ''} (${matchedAppInfo.app})`,
            isSports: true,
            isLive,
            venue: game.venueName || '',
            station: matchedNetwork,
          })
          gsInjected++
        }

        if (gsInjected > 0 || gsSkippedNotLoggedIn > 0 || gsSkippedNoApp > 0) {
          logInfo(
            `game_schedules streaming fallback for ${deviceId}: +${gsInjected} injected, ${gsSkippedNotLoggedIn} skipped (app not logged in), ${gsSkippedNoApp} skipped (no streaming app), ${gsSkippedDupe} dedup`
          )
        }
      } catch (fallbackError: any) {
        logger.error('[Channel-Guide-API] game_schedules streaming fallback failed (non-fatal):', { error: fallbackError.message })
      }
    }

    // v2.30.0 — Per-box on-device catalog injection.
    // Sports Bar Scout's CatalogWalker reports per-box per-app sports content
    // tiles (regional broadcasts ESPN doesn't tag, on-demand sports docuseries,
    // app-specific live events). This data fills the gap left by the
    // broadcast_networks fallback above, which only covers content ESPN syncs.
    // Catalog rows live in firetv_streaming_catalog with a 36h TTL — older
    // rows are pruned by the daily cron (Phase 3).
    if (deviceType === 'streaming' && deviceId) {
      try {
        const { db } = await import('@/db')
        const { schema } = await import('@/db')
        const { eq, gt, and: dAnd } = await import('drizzle-orm')

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

        let catInjected = 0
        let catSkippedDupe = 0
        for (const row of catalogRows) {
          // Dedupe against programs already added — same app + same title
          const dupe = programs.some(
            (p) =>
              p.channel?.streamingApp === row.app &&
              (p.description?.includes(row.contentTitle) || p.homeTeam === row.contentTitle)
          )
          if (dupe) {
            catSkippedDupe++
            continue
          }

          const appChannelId = `stream-${row.app.replace(/\s+/g, '-').toLowerCase()}`
          let appChannel = channels.get(appChannelId)
          if (!appChannel) {
            // v2.31.2 + v2.31.3 — populate appId + packageName + packages on
            // the channel via the alias-aware lookup. Without these fields the
            // bartender click silently does nothing (channel.packageName is the
            // field the remote reads, channel.appId selects the catalog-aware
            // /api/streaming/launch path which knows about firebat-hosted
            // Prime Video on Cubes).
            const catalogApp = findStreamingAppByDisplayName(row.app)
            const fallbackPackages = catalogApp
              ? [catalogApp.packageName, ...(catalogApp.packageAliases || [])]
              : []
            appChannel = {
              id: appChannelId,
              name: row.app,
              number: row.app,
              type: 'streaming',
              cost: 'subscription',
              platforms: ['Fire TV', 'Streaming'],
              channelNumber: row.app,
              deviceType: 'streaming',
              streamingApp: row.app,
              appId: catalogApp?.id,                                 // canonical id for /api/streaming/launch
              packageName: catalogApp?.packageName ?? fallbackPackages[0],
              packages: fallbackPackages,
            }
            channels.set(appChannelId, appChannel)
          }

          programs.push({
            id: `cat-${row.id}`,
            league: row.sportTag || 'Sports',
            homeTeam: row.contentTitle,
            awayTeam: '',
            gameTime: row.isLive ? 'LIVE' : 'On demand',
            startTime: new Date(row.capturedAt * 1000).toISOString(),
            endTime: new Date(row.expiresAt * 1000).toISOString(),
            channel: appChannel,
            description: `${row.contentTitle} (${row.app}${row.deepLink ? ' · deep-linkable' : ''})`,
            isSports: true,
            isLive: !!row.isLive,
            venue: '',
            station: row.app,
            // Carry the deep link through so a downstream client can launch
            // directly to the content if scout captured one.
            deepLink: row.deepLink || undefined,
            sportTag: row.sportTag || undefined,
          } as any)
          catInjected++
        }

        if (catInjected > 0 || catSkippedDupe > 0) {
          logInfo(
            `firetv_streaming_catalog injection for ${deviceId}: +${catInjected} from scout walker, ${catSkippedDupe} dedup`
          )
        }
      } catch (catalogError: any) {
        logger.error('[Channel-Guide-API] catalog injection failed (non-fatal):', { error: catalogError.message })
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
              const nfhsChannel = {
                id: 'stream-nfhs-network',
                name: 'NFHS Network',
                number: 'NFHS',
                type: 'streaming',
                cost: 'subscription',
                platforms: ['Fire TV', 'Streaming'],
                channelNumber: 'NFHS',
                deviceType: 'streaming',
                streamingApp: 'NFHS Network',
                packages: NFHS_PACKAGES
              }
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
