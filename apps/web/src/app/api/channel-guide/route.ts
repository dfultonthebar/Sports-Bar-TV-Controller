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
export const dynamic = 'force-dynamic'

// Module-level cache for station aliases loaded from DB
let _cachedStationAliases: Record<string, string[]> | null = null
let _stationAliasesCacheTime = 0
const STATION_ALIASES_TTL_MS = 5 * 60 * 1000 // 5 minutes

async function loadStationAliases(): Promise<Record<string, string[]>> {
  const now = Date.now()
  if (_cachedStationAliases && (now - _stationAliasesCacheTime) < STATION_ALIASES_TTL_MS) {
    return _cachedStationAliases
  }

  try {
    const { db } = await import('@/db')
    const { schema } = await import('@/db')
    const rows = await db.select().from(schema.stationAliases)

    const aliasMap: Record<string, string[]> = {}
    for (const row of rows) {
      aliasMap[row.standardName] = JSON.parse(row.aliases)
    }

    _cachedStationAliases = aliasMap
    _stationAliasesCacheTime = now
    logger.info(`[Channel-Guide-API] Loaded ${rows.length} station alias entries from DB`)
    return aliasMap
  } catch (error) {
    logger.error(`[Channel-Guide-API] Failed to load station aliases from DB, using cached or empty`, error)
    // Return cached data if available, otherwise empty object
    return _cachedStationAliases || {}
  }
}

// Cache for local channel overrides (5-minute TTL)
let _overridesCache: { data: { teamName: string; channelNumber: number; channelName: string }[]; ts: number } | null = null
const OVERRIDES_TTL = 5 * 60 * 1000 // 5 minutes

async function getLocalChannelOverrides(): Promise<{ teamName: string; channelNumber: number; channelName: string }[]> {
  if (_overridesCache && Date.now() - _overridesCache.ts < OVERRIDES_TTL) {
    return _overridesCache.data
  }
  const { db } = await import('@/db')
  const { schema } = await import('@/db')
  const { eq } = await import('drizzle-orm')
  const rows = await db.select().from(schema.localChannelOverrides)
    .where(eq(schema.localChannelOverrides.isActive, true))
  const data = rows.map(r => ({
    teamName: r.teamName,
    channelNumber: r.channelNumber,
    channelName: r.channelName,
  }))
  _overridesCache = { data, ts: Date.now() }
  return data
}

// Streaming station codes to app mapping for Fire TV devices
const STREAMING_STATION_MAP: Record<string, { appName: string; packages: string[] }> = {
  'NBALP': { appName: 'NBA League Pass', packages: ['com.nba.leaguepass', 'com.nba.app'] },
  'NHLCI': { appName: 'NHL Center Ice', packages: ['com.nhl.gc', 'com.nhl.gc1415'] },
  'MLBEI': { appName: 'MLB.TV', packages: ['com.mlb.android', 'com.mlb.atbat'] },
  'ESPND': { appName: 'ESPN+', packages: ['com.espn.score_center', 'com.espn.gtv', 'com.espn'] },
  'ESPN+': { appName: 'ESPN+', packages: ['com.espn.score_center', 'com.espn.gtv', 'com.espn'] },
  'NBCUN': { appName: 'Peacock', packages: ['com.peacocktv.peacockandroid', 'com.peacock.peacockfiretv'] },
  'PEACOCK': { appName: 'Peacock', packages: ['com.peacocktv.peacockandroid', 'com.peacock.peacockfiretv'] },
  'PRIME': { appName: 'Prime Video', packages: ['com.amazon.avod'] },
  'AMZN': { appName: 'Prime Video', packages: ['com.amazon.avod'] },
  'FOXD': { appName: 'Fox Sports', packages: ['com.foxsports.android', 'com.foxsports.android.foxsportsgo'] },
  'APPLETV': { appName: 'Apple TV+', packages: ['com.apple.atve.amazon.appletv'] },
  'MLSDK': { appName: 'MLS Season Pass', packages: ['tv.mls', 'com.apple.atve.amazon.appletv'] },
  'BSNOR+': { appName: 'Bally Sports', packages: ['com.bfrapp', 'com.ballysports.ftv'] },
  'B10+': { appName: 'Big Ten+', packages: ['com.foxsports.bigten.android'] },
  'NFHS': { appName: 'NFHS Network', packages: ['com.nfhsnetwork.ui', 'com.nfhsnetwork.app', 'com.playon.nfhslive'] },
}

// NFHS Network packages for detecting if device has NFHS login
const NFHS_PACKAGES = ['com.nfhsnetwork.ui', 'com.nfhsnetwork.app', 'com.playon.nfhslive']

// Get streaming app info for a station code
function getStreamingAppInfo(station: string): { appName: string; packages: string[] } | null {
  return STREAMING_STATION_MAP[station.toUpperCase()] || null
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

      // Build station name -> channel mapping (normalized names)
      // Map common variations: ESPN, ESPN2, FS1, Fox Sports 1, B10, Big Ten Network, etc.
      const stationToPreset = new Map<string, { channelNumber: string; name: string }>()

      // Load station aliases from database (cached with 5-minute TTL)
      const stationAliases = await loadStationAliases()

      // Normalize station names for matching
      function normalizeStation(name: string): string {
        return name.toUpperCase()
          .replace(/\s+/g, '')
          .replace(/-TV$/i, '')   // WLUK-TV, WGBA-TV → WLUK, WGBA
          .replace(/-/g, '')
          .replace(/HD$/i, '')
          .replace(/NETWORK$/i, '')
          .replace(/CHANNEL$/i, '')
      }

      // Build preset lookup
      for (const preset of presets) {
        const normalizedName = normalizeStation(preset.name)
        stationToPreset.set(normalizedName, {
          channelNumber: preset.channelNumber,
          name: preset.name
        })

        // Also add by variations in preset name
        for (const [standard, aliases] of Object.entries(stationAliases)) {
          for (const alias of aliases) {
            if (normalizeStation(alias) === normalizedName) {
              stationToPreset.set(standard.toUpperCase(), {
                channelNumber: preset.channelNumber,
                name: preset.name
              })
            }
          }
        }
      }

      logInfo(`Built station lookup with ${stationToPreset.size} entries`)

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

          // Get all stations and try to match them to presets
          for (const [station, channelNums] of Object.entries(channelNumbers)) {
            const numArray = channelNums as (number | string)[]
            if (!numArray || numArray.length === 0) continue

            // Try to find this station in user's presets
            const normalizedStation = station.toUpperCase()
            let presetMatch = stationToPreset.get(normalizedStation)

            // Try aliases if direct match fails
            if (!presetMatch) {
              for (const [standard, aliases] of Object.entries(stationAliases)) {
                if (aliases.some(a => normalizeStation(a) === normalizedStation)) {
                  presetMatch = stationToPreset.get(standard.toUpperCase())
                  if (presetMatch) break
                }
              }
            }

            // If no preset match, track and skip
            if (!presetMatch) {
              unmatchedStations.add(station)
              continue
            }

            matchedCount++
            const userChannelNumber = presetMatch.channelNumber

            // Create channel info using USER's channel number
            const channelInfo = {
              id: `${deviceType}-${userChannelNumber}`,
              name: presetMatch.name,
              number: userChannelNumber,
              type: deviceType,
              cost: 'subscription',
              platforms: [deviceType === 'satellite' ? 'DirecTV' : 'Cable'],
              channelNumber: userChannelNumber,
              deviceType: deviceType,
              station: station,
              presetName: presetMatch.name
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

      // Local channel overrides: inject local channels for teams with business carriage deals
      // Loaded from DB table local_channel_overrides (cached 5-min TTL)
      const localOverrides = await getLocalChannelOverrides()

      if (deviceType !== 'satellite') {
        // Scan ALL listings (not just matched ones) for local override teams
        for (const group of guide.listing_groups || []) {
          for (const listing of group.listings || []) {
            const homeTeam = listing.data?.['home team'] || listing.data?.['team'] || ''
            const awayTeam = listing.data?.['visiting team'] || listing.data?.['opponent'] || ''

            for (const override of localOverrides) {
              if (!homeTeam.includes(override.teamName) && !awayTeam.includes(override.teamName)) continue
              if (!homeTeam.trim() && !awayTeam.trim()) continue

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
      // broadcast_networks can be resolved to a user preset via the same
      // stationToPreset map we already built.
      try {
        const { db } = await import('@/db')
        const { schema } = await import('@/db')
        const { and, gte, lte } = await import('drizzle-orm')

        const windowStartSec = Math.floor(new Date(startTime).getTime() / 1000)
        const windowEndSec = Math.floor(new Date(endTime).getTime() / 1000)

        const localGames = await db
          .select()
          .from(schema.gameSchedules)
          .where(
            and(
              gte(schema.gameSchedules.scheduledStart, windowStartSec),
              lte(schema.gameSchedules.scheduledStart, windowEndSec)
            )
          )
          .all()

        let gsInjected = 0
        let gsSkippedNoChannel = 0
        let gsSkippedDupe = 0

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
          // Include primary network first in the walk order
          if (game.primaryNetwork && !broadcastNetworks.includes(game.primaryNetwork)) {
            broadcastNetworks.unshift(game.primaryNetwork)
          }

          // Walk the networks array and find the first one that maps to a preset
          let resolvedPreset: { channelNumber: string; name: string } | undefined
          let matchedStation = ''
          for (const network of broadcastNetworks) {
            if (!network) continue
            const normalizedNetwork = normalizeStation(network)
            // Direct preset lookup
            let hit = stationToPreset.get(normalizedNetwork)
            // Alias fallback
            if (!hit) {
              for (const [standard, aliases] of Object.entries(stationAliases)) {
                if (aliases.some(a => normalizeStation(a) === normalizedNetwork)) {
                  hit = stationToPreset.get(standard.toUpperCase())
                  if (hit) break
                }
              }
            }
            if (hit) {
              resolvedPreset = hit
              matchedStation = network
              break
            }
          }

          if (!resolvedPreset) {
            gsSkippedNoChannel++
            continue
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
            isLive: false,
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
      // Fetch installed apps from Scout
      try {
        const scoutResponse = await fetch('http://localhost:3001/api/firestick-scout')
        if (scoutResponse.ok) {
          const scoutData = await scoutResponse.json()
          const device = scoutData.statuses?.find((d: any) => d.deviceId === deviceId)
          if (device && device.installedApps) {
            deviceInstalledApps = device.installedApps
            logInfo(`Fire TV device ${deviceId} has ${deviceInstalledApps.length} installed apps`)
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
              const appInfo = getStreamingAppInfo(station)
              if (appInfo) {
                // Check if the Fire TV device has this service LOGGED IN (not just installed)
                const hasLoggedIn = deviceLoggedInPackages.some(pkg => appInfo.packages.includes(pkg))
                if (hasLoggedIn) {
                  channelInfo = {
                    id: `stream-${appInfo.appName.replace(/\s+/g, '-').toLowerCase()}`,
                    name: appInfo.appName,
                    number: station,
                    type: 'streaming',
                    cost: 'subscription',
                    platforms: ['Fire TV', 'Streaming'],
                    channelNumber: station,
                    deviceType: 'streaming',
                    streamingApp: appInfo.appName,
                    packages: appInfo.packages
                  }
                  logInfo(`Matched streaming station ${station} to app ${appInfo.appName} on device ${deviceId}`)
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

    // Filter out games that started more than 2 hours ago to keep the guide fresh
    const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000))
    const freshPrograms = programs.filter(program => {
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
