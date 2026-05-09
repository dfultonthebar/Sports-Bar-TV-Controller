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
        const scheduleWindowStart = nowSec - 2 * 3600
        const scheduleWindowEnd = nowSec + 48 * 3600
        const upcomingSchedules = await db
          .select({
            home: schema.gameSchedules.homeTeamName,
            away: schema.gameSchedules.awayTeamName,
            scheduledStart: schema.gameSchedules.scheduledStart,
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
        const lookupStartTime = (title: string): number | undefined => {
          const titleTokens = new Set(tokenize(title))
          if (titleTokens.size < 2) return undefined
          // Prefer the temporally-closest match if multiple games match.
          let best: { ts: number; matchedTokens: number } | null = null
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
              best = { ts: sch.scheduledStart, matchedTokens: matched }
            }
          }
          return best?.ts
        }

        let catInjected = 0
        let catSkippedDupe = 0
        let catEnriched = 0
        // Within-catalog dedup: same app + same title. The walker can capture
        // the same tile twice on adjacent passes (e.g. featured carousel +
        // sport-specific row); de-dup so the bartender doesn't see twins.
        const seenInCatalog = new Set<string>()

        for (const row of catalogRows) {
          const dupeKey = `${row.app}::${row.contentTitle}`
          if (seenInCatalog.has(dupeKey)) {
            catSkippedDupe++
            continue
          }
          seenInCatalog.add(dupeKey)

          const appChannelId = `stream-${row.app.replace(/\s+/g, '-').toLowerCase()}`
          let appChannel = channels.get(appChannelId)
          if (!appChannel) {
            appChannel = buildStreamingAppChannel({ appName: row.app, channelNumber: row.app })
            channels.set(appChannelId, appChannel)
          }

          // Walker's startTime takes precedence; if missing, try the
          // game_schedules enrichment lookup (v2.33.0); finally fall back
          // to capturedAt for tiles with no time anchor anywhere.
          let resolvedStart: number | undefined =
            typeof row.startTime === 'number' && row.startTime > 0
              ? row.startTime
              : undefined
          if (resolvedStart === undefined) {
            const enriched = lookupStartTime(row.contentTitle)
            if (enriched !== undefined) {
              resolvedStart = enriched
              catEnriched++
            }
          }
          const hasStartTime = resolvedStart !== undefined
          const startSec = hasStartTime ? (resolvedStart as number) : row.capturedAt
          const startMs = startSec * 1000
          const startDate = new Date(startMs)

          // 3-hour estimated duration when we have a real startTime; otherwise
          // use the catalog row's expiresAt (which is capturedAt + 36h TTL —
          // not a real game end, but at least a valid forward-looking ISO).
          const endMs = hasStartTime
            ? startMs + 3 * 60 * 60 * 1000
            : row.expiresAt * 1000

          // Display fields formatted in VENUE_TIMEZONE (America/Chicago).
          // `gameTime` keeps the legacy display (LIVE / time / "On demand")
          // for backwards compat with components that already render it.
          // `day` + `time` are new explicit fields the UI can render directly
          // (e.g. "Sat" / "7:30 PM CT") without re-parsing the ISO string.
          let day = ''
          let time = ''
          let gameTimeLabel: string
          if (row.isLive) {
            // For live tiles: show "LIVE" as the prominent label. If we have
            // a real startTime, surface the day too (so a multi-day live
            // event shows e.g. "Sun · LIVE" not just "Live · Live").
            gameTimeLabel = 'LIVE'
            time = 'LIVE'
            day = hasStartTime ? dayFormatter.format(startDate) : 'LIVE'
          } else if (hasStartTime) {
            day = dayFormatter.format(startDate)
            time = timeFormatter.format(startDate)
            gameTimeLabel = time
          } else {
            // Older walker passes that didn't populate startTime: tile has
            // a title but no time anchor (on-demand / replay / featured).
            // Show "On demand" consistently across all three fields rather
            // than the misleading "Live" we used to emit here.
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

          programs.push({
            id: `cat-${row.id}`,
            league: row.sportTag || 'Sports',
            homeTeam: row.contentTitle,
            awayTeam: '',
            gameTime: gameTimeLabel,
            day,
            time,
            startTime: startDate.toISOString(),
            endTime: new Date(endMs).toISOString(),
            channel: programChannel,
            description: `${row.contentTitle} (${row.app}${row.deepLink ? ' · deep-linkable' : ''})`,
            isSports: true,
            isLive: !!row.isLive,
            venue: '',
            station: row.app,
            sportTag: row.sportTag || undefined,
          })
          catInjected++
        }

        if (catInjected > 0 || catSkippedDupe > 0) {
          logInfo(
            `firetv_streaming_catalog injection for ${deviceId}: +${catInjected} from scout walker, ${catSkippedDupe} dedup, ${catEnriched} enriched startTime from game_schedules`
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
