/**
 * API Route: Get AI Scheduler's Game Plan
 *
 * Returns the games that the AI scheduler found and which inputs/TVs they're scheduled for
 * NOW USING FRESH DATA FROM THE RAIL MEDIA API
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, inArray } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { espnScoreboardAPI } from '@/lib/sports-apis/espn-scoreboard-api'
import { findMany } from '@/lib/db-helpers'

// Streaming station codes to app mapping
// Maps Rail Media station codes to Fire TV app package names and display names
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
}

// Check if a station is streaming-only (no cable/satellite channel)
function isStreamingStation(station: string): boolean {
  const streamingOnly = ['NBALP', 'NHLCI', 'MLBEI', 'ESPND', 'ESPN+', 'MLSDK', 'BSNOR+', 'B10+', 'APPLETV', 'PRIME', 'AMZN']
  return streamingOnly.includes(station.toUpperCase())
}

// Get streaming app info for a station
function getStreamingAppInfo(station: string): { appName: string; packages: string[] } | null {
  return STREAMING_STATION_MAP[station.toUpperCase()] || null
}

// Map league names to ESPN API parameters
function mapLeagueToESPN(league: string): { sport: string; league: string } | null {
  const leagueLower = league.toLowerCase()

  if (leagueLower.includes('nfl')) return { sport: 'football', league: 'nfl' }
  if (leagueLower.includes('ncaa football') || leagueLower.includes('college football'))
    return { sport: 'football', league: 'college-football' }

  if (leagueLower.includes('nba')) return { sport: 'basketball', league: 'nba' }
  if (leagueLower.includes('ncaa basketball') || leagueLower.includes('college basketball')) {
    if (leagueLower.includes("women")) return { sport: 'basketball', league: 'womens-college-basketball' }
    return { sport: 'basketball', league: 'mens-college-basketball' }
  }

  if (leagueLower.includes('nhl')) return { sport: 'hockey', league: 'nhl' }
  if (leagueLower.includes('mlb') || leagueLower.includes('baseball')) return { sport: 'baseball', league: 'mlb' }
  if (leagueLower.includes('mls') || leagueLower.includes('soccer')) return { sport: 'soccer', league: 'usa.1' }

  return null
}

// Match game by team names (fuzzy matching)
function matchGameByTeams(espnGames: any[], homeTeam: string, awayTeam: string): any | null {
  const cleanTeam = (name: string) => {
    // Remove common prefixes like "NCAA:", "NFL:", "NBA:", etc.
    let cleaned = name.replace(/^(NCAA|NFL|NBA|NHL|MLB|MLS):\s*/i, '')
    // Convert to lowercase and remove all non-alphanumeric characters
    return cleaned.toLowerCase().replace(/[^a-z0-9]/g, '')
  }
  const homeClean = cleanTeam(homeTeam)
  const awayClean = cleanTeam(awayTeam)

  for (const espnGame of espnGames) {
    const espnHomeClean = cleanTeam(espnGame.homeTeam.displayName)
    const espnAwayClean = cleanTeam(espnGame.awayTeam.displayName)

    // Check if teams match (in either order since sometimes home/away can be swapped)
    const exactMatch = (
      (espnHomeClean.includes(homeClean) || homeClean.includes(espnHomeClean)) &&
      (espnAwayClean.includes(awayClean) || awayClean.includes(espnAwayClean))
    ) || (
      (espnHomeClean.includes(awayClean) || awayClean.includes(espnHomeClean)) &&
      (espnAwayClean.includes(homeClean) || homeClean.includes(espnAwayClean))
    )

    if (exactMatch) {
      return espnGame
    }
  }

  return null
}

/**
 * Fetch fresh games from The Rail Media API
 * Replicates the logic from /api/schedules/execute/route.ts searchForGames function
 */
async function fetchFreshGamesFromRailMedia(homeTeams: any[]): Promise<any[]> {
  const games: any[] = []

  try {
    logger.info(`[AI_GAME_PLAN] Fetching fresh games from The Rail Media API for ${homeTeams.length} home teams`)

    // Load channel presets to validate available channels
    const channelPresets = await db.select().from(schema.channelPresets).where(eq(schema.channelPresets.isActive, true))

    // Create lookup maps for quick channel validation
    const cableChannels = new Set(
      channelPresets
        .filter(p => p.deviceType === 'cable')
        .map(p => p.channelNumber.toLowerCase())
    )
    const directvChannels = new Set(
      channelPresets
        .filter(p => p.deviceType === 'directv')
        .map(p => p.channelNumber.toLowerCase())
    )

    // Create cross-reference maps based on preset names
    // This allows us to find the equivalent channel on the other device type
    const cableChannelToName = new Map<string, string>()
    const directvChannelToName = new Map<string, string>()
    const nameToCableChannel = new Map<string, string>()
    const nameToDirectvChannel = new Map<string, string>()

    for (const preset of channelPresets) {
      const normalizedName = preset.name.toLowerCase().trim()
      const channelNum = preset.channelNumber.toLowerCase()

      if (preset.deviceType === 'cable') {
        cableChannelToName.set(channelNum, normalizedName)
        // Only set if not already set (first match wins)
        if (!nameToCableChannel.has(normalizedName)) {
          nameToCableChannel.set(normalizedName, preset.channelNumber)
        }
      } else if (preset.deviceType === 'directv') {
        directvChannelToName.set(channelNum, normalizedName)
        if (!nameToDirectvChannel.has(normalizedName)) {
          nameToDirectvChannel.set(normalizedName, preset.channelNumber)
        }
      }
    }

    // Normalize network names for matching Rail Media station names to preset names
    // Rail Media uses compact names like "NBATV", presets use names like "NBA TV"
    const normalizeNetworkName = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/\s+/g, '') // Remove all spaces
        .replace(/network/gi, '') // Remove "network"
        .replace(/channel/gi, '') // Remove "channel"
        .replace(/hd$/i, '') // Remove HD suffix
        .trim()
    }

    // Build network name lookup maps (normalized name -> preset channel number)
    const networkToCableChannel = new Map<string, string>()
    const networkToDirectvChannel = new Map<string, string>()

    for (const preset of channelPresets) {
      const normalizedNetwork = normalizeNetworkName(preset.name)

      if (preset.deviceType === 'cable') {
        if (!networkToCableChannel.has(normalizedNetwork)) {
          networkToCableChannel.set(normalizedNetwork, preset.channelNumber)
        }
      } else if (preset.deviceType === 'directv') {
        if (!networkToDirectvChannel.has(normalizedNetwork)) {
          networkToDirectvChannel.set(normalizedNetwork, preset.channelNumber)
        }
      }
    }

    logger.info(`[AI_GAME_PLAN] Network lookup maps: ${networkToCableChannel.size} cable networks, ${networkToDirectvChannel.size} DirecTV networks`)

    logger.info(`[AI_GAME_PLAN] Loaded ${cableChannels.size} cable channels and ${directvChannels.size} DirecTV channels from presets`)
    logger.info(`[AI_GAME_PLAN] Cross-reference maps: ${nameToCableChannel.size} cable names, ${nameToDirectvChannel.size} DirecTV names`)

    // Fetch sports guide data from The Rail Media API (1 day = today's games)
    const guideResponse = await fetch('http://localhost:3001/api/sports-guide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 1 })
    })

    if (!guideResponse.ok) {
      logger.error('[AI_GAME_PLAN] Failed to fetch sports guide data')
      return games
    }

    const guideData = await guideResponse.json()

    if (!guideData.success || !guideData.data) {
      logger.error('[AI_GAME_PLAN] Sports guide returned unsuccessful response')
      return games
    }

    // Parse the guide data to find matching games
    const allGames: any[] = []

    // Parse listing_groups from The Rail Media API
    for (const group of guideData.data.listing_groups || []) {
      for (const listing of group.listings || []) {
        // Parse the date properly
        let eventDate: Date
        if (listing.date) {
          const currentYear = new Date().getFullYear()
          const dateWithYear = `${listing.date} ${currentYear} ${listing.time}`
          eventDate = new Date(dateWithYear)

          // If date is in the past, try next year
          if (isNaN(eventDate.getTime()) || eventDate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
            eventDate = new Date(`${listing.date} ${currentYear + 1} ${listing.time}`)
          }
        } else {
          eventDate = new Date(`${new Date().toDateString()} ${listing.time}`)
        }

        // Extract BOTH cable and DirecTV channel numbers
        // PRIMARY METHOD: Use network/station name to look up channel from our presets
        // FALLBACK: Try direct channel number matching if network name doesn't match
        let cableChannelNumber = ''
        let directvChannelNumber = ''
        let matchedNetworkName = ''

        // First, try to match by station/network name (most reliable method)
        // Rail Media provides station names like "ESPN", "NBATV", "FOX", etc.
        if (listing.stations && Array.isArray(listing.stations)) {
          for (const station of listing.stations) {
            const normalizedStation = normalizeNetworkName(station)

            // Look up cable channel by network name
            if (!cableChannelNumber) {
              const cableChannel = networkToCableChannel.get(normalizedStation)
              if (cableChannel) {
                cableChannelNumber = cableChannel
                matchedNetworkName = station
                logger.debug(`[AI_GAME_PLAN] Matched station "${station}" to cable channel ${cableChannel}`)
              }
            }

            // Look up DirecTV channel by network name
            if (!directvChannelNumber) {
              const directvChannel = networkToDirectvChannel.get(normalizedStation)
              if (directvChannel) {
                directvChannelNumber = directvChannel
                matchedNetworkName = station
                logger.debug(`[AI_GAME_PLAN] Matched station "${station}" to DirecTV channel ${directvChannel}`)
              }
            }

            // If we found both, stop looking
            if (cableChannelNumber && directvChannelNumber) break
          }
        }

        // FALLBACK: If network name matching didn't work, try direct channel number matching
        // Extract cable channels and match against presets
        if (!cableChannelNumber && listing.channel_numbers?.CAB) {
          const cabChannels = listing.channel_numbers.CAB
          for (const providerChannels of Object.values(cabChannels)) {
            const channels = providerChannels as any
            const channelList = Array.isArray(channels) ? channels : [channels]

            // Find first channel that exists in our cable presets
            for (const ch of channelList) {
              if (ch) {
                const chStr = String(ch).toLowerCase()
                if (cableChannels.has(chStr)) {
                  cableChannelNumber = String(ch)
                  break
                }
              }
            }
            if (cableChannelNumber) break
          }
        }

        // Extract satellite/DirecTV channels and match against presets (fallback)
        if (!directvChannelNumber && listing.channel_numbers?.SAT) {
          const satChannels = listing.channel_numbers.SAT
          for (const providerChannels of Object.values(satChannels)) {
            const channels = providerChannels as any
            const channelList = Array.isArray(channels) ? channels : [channels]

            // Find first channel that exists in our DirecTV presets
            for (const ch of channelList) {
              if (ch) {
                const chStr = String(ch).toLowerCase()
                if (directvChannels.has(chStr)) {
                  directvChannelNumber = String(ch)
                  break
                }
              }
            }
            if (directvChannelNumber) break
          }
        }

        // Cross-reference: If we only have one channel type, try to find the equivalent for the other
        // This allows games to be scheduled on either cable OR DirecTV inputs
        if (cableChannelNumber && !directvChannelNumber) {
          // We have cable, try to find matching DirecTV channel by preset name
          const presetName = cableChannelToName.get(cableChannelNumber.toLowerCase())
          if (presetName) {
            const matchingDirectv = nameToDirectvChannel.get(presetName)
            if (matchingDirectv) {
              directvChannelNumber = matchingDirectv
              logger.debug(`[AI_GAME_PLAN] Cross-referenced cable ${cableChannelNumber} (${presetName}) to DirecTV ${directvChannelNumber}`)
            }
          }
        } else if (directvChannelNumber && !cableChannelNumber) {
          // We have DirecTV, try to find matching cable channel by preset name
          const presetName = directvChannelToName.get(directvChannelNumber.toLowerCase())
          if (presetName) {
            const matchingCable = nameToCableChannel.get(presetName)
            if (matchingCable) {
              cableChannelNumber = matchingCable
              logger.debug(`[AI_GAME_PLAN] Cross-referenced DirecTV ${directvChannelNumber} (${presetName}) to cable ${cableChannelNumber}`)
            }
          }
        }

        // Check for streaming-only availability
        // Extract all station codes and check for streaming services
        let streamingApp: string | null = null
        let streamingPackages: string[] = []
        let isStreamingOnly = false

        const stationList = listing.stations
        if (stationList) {
          // Handle both array and object formats
          const stations: string[] = Array.isArray(stationList)
            ? stationList
            : Object.values(stationList).filter((s): s is string => typeof s === 'string')

          for (const station of stations) {
            const appInfo = getStreamingAppInfo(station)
            if (appInfo) {
              streamingApp = appInfo.appName
              streamingPackages = appInfo.packages
              // Check if this is a streaming-only station (no traditional TV channel)
              if (isStreamingStation(station)) {
                isStreamingOnly = !cableChannelNumber && !directvChannelNumber
              }
              logger.debug(`[AI_GAME_PLAN] Found streaming option: ${station} -> ${appInfo.appName}`)
              break // Use first matching streaming app
            }
          }
        }

        // Add game if we have cable/satellite channel OR streaming availability
        if (cableChannelNumber || directvChannelNumber || streamingApp) {
          // Extract team names from various data formats
          let homeTeam = listing.data['home team'] || listing.data['team'] || ''
          let awayTeam = listing.data['visiting team'] || listing.data['opponent'] || ''

          // Handle combined "teams" field (e.g., Soccer: "Pachuca v Pumas UNAM")
          const combinedField = listing.data['teams'] || listing.data['event']
          if (!homeTeam && !awayTeam && combinedField) {
            // Try to split by common separators
            const separators = [' v ', ' vs ', ' vs. ', ' @ ', ' - ']
            for (const sep of separators) {
              if (combinedField.includes(sep)) {
                const parts = combinedField.split(sep)
                if (parts.length === 2) {
                  awayTeam = parts[0].trim()
                  homeTeam = parts[1].trim()
                  break
                }
              }
            }
          }

          const game = {
            league: group.group_title,
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            gameTime: listing.time,
            startTime: eventDate.toISOString(),
            cableChannel: cableChannelNumber,
            directvChannel: directvChannelNumber,
            channelNumber: cableChannelNumber || directvChannelNumber,
            venue: listing.data['venue'] || listing.data['location'] || '',
            // Streaming info
            streamingApp: streamingApp,
            streamingPackages: streamingPackages,
            streamingOnly: isStreamingOnly
          }

          allGames.push(game)
        }
      }
    }

    logger.info(`[AI_GAME_PLAN] Found ${allGames.length} total games in sports guide`)

    // Filter out games that started more than 2 hours ago
    const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000))
    const freshGames = allGames.filter(game => {
      const gameStart = new Date(game.startTime)
      return gameStart >= twoHoursAgo
    })

    const removedCount = allGames.length - freshGames.length
    if (removedCount > 0) {
      logger.info(`[AI_GAME_PLAN] Filtered out ${removedCount} games that started more than 2 hours ago`)
    }

    // Tag games that involve home teams for priority
    for (const game of freshGames) {
      let matchedHomeTeam = null

      for (const homeTeam of homeTeams) {
        const homeTeamMatch =
          game.homeTeam?.toLowerCase().includes(homeTeam.teamName.toLowerCase()) ||
          game.awayTeam?.toLowerCase().includes(homeTeam.teamName.toLowerCase())

        if (homeTeamMatch) {
          matchedHomeTeam = homeTeam
          break
        }
      }

      // Add game with home team info
      games.push({
        ...game,
        id: `${game.homeTeam}-${game.awayTeam}`,
        homeTeamId: matchedHomeTeam?.id || null,
        homeTeamName: matchedHomeTeam?.teamName || null,
        isHomeTeamGame: !!matchedHomeTeam
      })
    }

    logger.info(`[AI_GAME_PLAN] Returning ${games.length} games (${games.filter(g => g.isHomeTeamGame).length} home team games)`)

  } catch (error: any) {
    logger.error('[AI_GAME_PLAN] Error fetching games from Rail Media API:', error)
  }

  return games
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    logger.info('[AI_GAME_PLAN] Fetching fresh game data from The Rail Media API')

    // Get the AI Game Monitor schedule
    const aiSchedule = await db
      .select()
      .from(schema.schedules)
      .where(eq(schema.schedules.scheduleType, 'continuous'))
      .limit(1)
      .get()

    if (!aiSchedule) {
      return NextResponse.json({
        success: false,
        error: 'AI Game Monitor schedule not found'
      }, { status: 404 })
    }

    // Get home teams to identify which games are priority
    const homeTeamIds = JSON.parse(aiSchedule.homeTeamIds || '[]')
    const homeTeamsList = homeTeamIds.length > 0
      ? await findMany('homeTeams', {
          where: inArray(schema.homeTeams.id, homeTeamIds)
        })
      : []

    // Fetch FRESH game data from The Rail Media API (not stale database data)
    const freshGames = await fetchFreshGamesFromRailMedia(homeTeamsList)

    logger.info(`[AI_GAME_PLAN] Fetched ${freshGames.length} fresh games from Rail Media API`)

    // Fetch Fire TV device statuses for streaming capability matching
    let fireTVDevices: any[] = []
    try {
      const scoutResponse = await fetch('http://localhost:3001/api/firestick-scout')
      if (scoutResponse.ok) {
        const scoutData = await scoutResponse.json()
        fireTVDevices = scoutData.statuses || []
        logger.info(`[AI_GAME_PLAN] Fetched ${fireTVDevices.length} Fire TV devices for streaming matching`)
      }
    } catch (error: any) {
      logger.warn(`[AI_GAME_PLAN] Could not fetch Fire TV devices: ${error.message}`)
    }

    // Fetch device login statuses (which subscriptions are logged in per device)
    const deviceLoggedInPackages: Record<string, string[]> = {}
    try {
      const services = await db.select().from(schema.streamingServices)
      const logins = await db.select().from(schema.deviceStreamingLogins)

      // Group logins by device
      for (const login of logins) {
        if (!login.isLoggedIn) continue
        const service = services.find(s => s.id === login.serviceId)
        if (service) {
          const packages = JSON.parse(service.packages || '[]')
          if (!deviceLoggedInPackages[login.deviceId]) {
            deviceLoggedInPackages[login.deviceId] = []
          }
          deviceLoggedInPackages[login.deviceId].push(...packages)
        }
      }
      logger.info(`[AI_GAME_PLAN] Fetched login status for ${Object.keys(deviceLoggedInPackages).length} Fire TV devices`)
    } catch (error: any) {
      logger.warn(`[AI_GAME_PLAN] Could not fetch device logins: ${error.message}`)
    }

    // Create a helper to find Fire TV devices that can play a streaming app
    // Checks BOTH installed apps AND subscription logins
    const findCompatibleFireTVDevices = (packages: string[]): any[] => {
      return fireTVDevices.filter(device => {
        if (!device.installedApps || !device.isOnline) return false
        // Check if app is installed
        const hasAppInstalled = packages.some(pkg => device.installedApps.includes(pkg))
        if (!hasAppInstalled) return false

        // Check if the service is logged in on this device
        // If no logins configured for this device, fall back to installed apps (legacy behavior)
        const loggedInPkgs = deviceLoggedInPackages[device.deviceId]
        if (!loggedInPkgs || loggedInPkgs.length === 0) {
          return true // No subscription config = allow based on installed apps
        }
        return packages.some(pkg => loggedInPkgs.includes(pkg))
      }).map(device => ({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        ipAddress: device.ipAddress
      }))
    }

    // Add Fire TV compatibility info to games with streaming options
    for (const game of freshGames) {
      if (game.streamingPackages && game.streamingPackages.length > 0) {
        game.availableFireTVDevices = findCompatibleFireTVDevices(game.streamingPackages)
        if (game.availableFireTVDevices.length > 0) {
          logger.debug(`[AI_GAME_PLAN] Game "${game.homeTeam} vs ${game.awayTeam}" can stream on ${game.availableFireTVDevices.length} Fire TV devices via ${game.streamingApp}`)
        }
      }
    }

    // Get matrix inputs
    const inputs = await db.select().from(schema.matrixInputs).all()

    // Get ACTUAL device states from inputCurrentChannels table
    // This tracks what's actually tuned on each input (cable, DirecTV, etc.)
    const currentChannels = await db.select().from(schema.inputCurrentChannels).all()

    logger.info(`[AI_GAME_PLAN] Found ${currentChannels.length} inputs with tracked channels`)

    // Create a map of input ID to current game/program by matching current channels against fresh games
    const inputGameMap = new Map<string, any>()

    // Process all current channel entries (cable boxes, DirecTV, Fire TV - everything)
    for (const channelInfo of currentChannels) {
      if (channelInfo.channelNumber) {
        // Match input to matrix input by inputNum
        const input = inputs.find(i => i.channelNumber === channelInfo.inputNum)

        if (input) {
          // Find game on this channel from fresh data
          // Match against both cable and DirecTV channels
          const gameOnChannel = freshGames.find((game: any) => {
            const channelNum = String(channelInfo.channelNumber)
            // Check both cable and DirecTV channel fields
            return game.cableChannel === channelNum ||
                   game.directvChannel === channelNum ||
                   game.channelNumber === channelNum
          })

          if (gameOnChannel) {
            // We found a game on this channel - add it to the map
            inputGameMap.set(input.id, {
              inputLabel: channelInfo.inputLabel || input.label,
              inputNumber: input.channelNumber,
              deviceType: channelInfo.deviceType,
              league: gameOnChannel.league,
              homeTeam: gameOnChannel.homeTeam,
              awayTeam: gameOnChannel.awayTeam,
              gameTime: gameOnChannel.gameTime,
              channelNumber: channelInfo.channelNumber,
              channelName: channelInfo.channelName,
              venue: gameOnChannel.venue,
              startTime: gameOnChannel.startTime,
              isHomeTeamGame: gameOnChannel.isHomeTeamGame,
              lastTuned: channelInfo.lastTuned
            })
            logger.debug(`[AI_GAME_PLAN] Matched ${channelInfo.inputLabel} (${channelInfo.deviceType}) on channel ${channelInfo.channelNumber} to ${gameOnChannel.homeTeam} vs ${gameOnChannel.awayTeam}`)
          } else {
            // No game found, but still show what's tuned
            logger.debug(`[AI_GAME_PLAN] ${channelInfo.inputLabel} (${channelInfo.deviceType}) is on channel ${channelInfo.channelNumber} (${channelInfo.channelName || 'unknown'}) - no game on this channel`)
          }
        }
      }
    }

    logger.info(`[AI_GAME_PLAN] Found ${inputGameMap.size} inputs currently showing games`)

    // Fetch live ESPN data for all games
    logger.info('[AI_GAME_PLAN] Fetching live ESPN data for assigned games')
    const espnDataByLeague = new Map<string, any[]>()

    // Group games by league and fetch ESPN data
    const leaguesInUse = new Set<string>()
    for (const [_, gameData] of inputGameMap.entries()) {
      leaguesInUse.add(gameData.league)
    }

    // Fetch ESPN data for each league
    for (const league of leaguesInUse) {
      const espnMapping = mapLeagueToESPN(league)
      if (espnMapping) {
        try {
          const espnGames = await espnScoreboardAPI.getTodaysGames(espnMapping.sport, espnMapping.league)
          logger.info(`[AI_GAME_PLAN] Fetched ${espnGames.length} ESPN games for ${league}`)
          espnDataByLeague.set(league, espnGames)
        } catch (error: any) {
          logger.error(`[AI_GAME_PLAN] Failed to fetch ESPN data for ${league}:`, error.message)
        }
      }
    }

    // Identify which games are home team games from fresh data
    const homeTeamGameIds = new Set(
      freshGames
        .filter((g: any) => g.isHomeTeamGame)
        .map((g: any) => `${g.homeTeam}-${g.awayTeam}`)
    )

    // Group games by input and enrich with ESPN live data
    const gamesByInput: Record<string, any[]> = {}
    const games: any[] = []

    for (const [inputId, gameData] of inputGameMap.entries()) {
      const gameId = `${gameData.homeTeam}-${gameData.awayTeam}`
      const isHomeTeamGame = homeTeamGameIds.has(gameId)

      // Try to find matching ESPN game for live data
      let liveData = null
      const espnGames = espnDataByLeague.get(gameData.league)
      if (espnGames) {
        const matchedGame = matchGameByTeams(espnGames, gameData.homeTeam, gameData.awayTeam)
        if (matchedGame) {
          liveData = {
            homeScore: matchedGame.homeTeam.score,
            awayScore: matchedGame.awayTeam.score,
            clock: matchedGame.status.displayClock,
            period: matchedGame.status.period,
            statusState: matchedGame.status.type.state, // 'pre', 'in', 'post'
            statusDetail: matchedGame.status.type.shortDetail,
            isLive: espnScoreboardAPI.isLive(matchedGame),
            isCompleted: espnScoreboardAPI.isCompleted(matchedGame),
          }
          logger.debug(`[AI_GAME_PLAN] Matched ESPN data for ${gameData.homeTeam} vs ${gameData.awayTeam}`)
        }
      }

      const game = {
        ...gameData,
        isHomeTeamGame,
        startTime: null, // We don't have exact start time from cable box data
        liveData, // Add live ESPN data if available
      }

      games.push(game)

      if (!gamesByInput[gameData.inputLabel]) {
        gamesByInput[gameData.inputLabel] = []
      }
      gamesByInput[gameData.inputLabel].push(game)
    }

    // Get upcoming games from fresh data that aren't currently assigned
    const assignedGameIds = new Set(games.map(g => `${g.homeTeam}-${g.awayTeam}`))

    // Fetch ESPN data for all leagues in upcoming games
    const upcomingLeagues = new Set(
      freshGames
        .filter((g: any) => !assignedGameIds.has(`${g.homeTeam}-${g.awayTeam}`))
        .map((g: any) => g.league)
        .filter(Boolean)
    )

    for (const league of upcomingLeagues) {
      if (!espnDataByLeague.has(league)) {
        const espnMapping = mapLeagueToESPN(league)
        if (espnMapping) {
          try {
            const espnGames = await espnScoreboardAPI.getTodaysGames(espnMapping.sport, espnMapping.league)
            espnDataByLeague.set(league, espnGames)
          } catch (error: any) {
            logger.error(`[AI_GAME_PLAN] Failed to fetch ESPN data for ${league}:`, error.message)
          }
        }
      }
    }

    const upcomingGames = freshGames
      .filter((g: any) => !assignedGameIds.has(`${g.homeTeam}-${g.awayTeam}`))
      .map((g: any) => {
        // Try to find matching ESPN game for live data
        let liveData = null
        const espnGames = espnDataByLeague.get(g.league)
        if (espnGames && g.homeTeam && g.awayTeam) {
          const matchedGame = matchGameByTeams(espnGames, g.homeTeam, g.awayTeam)
          if (matchedGame) {
            liveData = {
              homeScore: matchedGame.homeTeam.score,
              awayScore: matchedGame.awayTeam.score,
              homeAbbrev: matchedGame.homeTeam.abbreviation,
              awayAbbrev: matchedGame.awayTeam.abbreviation,
              clock: matchedGame.status.displayClock,
              period: matchedGame.status.period,
              statusState: matchedGame.status.type.state,
              statusDetail: matchedGame.status.type.shortDetail,
              isLive: espnScoreboardAPI.isLive(matchedGame),
              isCompleted: espnScoreboardAPI.isCompleted(matchedGame),
            }
          }
        }
        return {
          ...g,
          liveData
        }
      })
      .sort((a: any, b: any) => {
        // Put live games first, then sort by start time
        if (a.liveData?.isLive && !b.liveData?.isLive) return -1
        if (!a.liveData?.isLive && b.liveData?.isLive) return 1
        if (a.startTime && b.startTime) {
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        }
        return (a.league || '').localeCompare(b.league || '')
      })

    // Count streaming games
    const streamingOnlyGames = freshGames.filter((g: any) => g.streamingOnly).length
    const gamesWithStreaming = freshGames.filter((g: any) => g.streamingApp).length

    return NextResponse.json({
      success: true,
      scheduleName: aiSchedule.name,
      lastExecuted: aiSchedule.lastExecuted,
      gamesFound: freshGames.length,
      channelsSet: games.length, // Games currently assigned to inputs
      games,
      gamesByInput,
      upcomingGames,
      fireTVDevices: fireTVDevices.map(d => ({
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        ipAddress: d.ipAddress,
        isOnline: d.isOnline,
        installedApps: d.installedApps
      })),
      dataSource: 'The Rail Media API (Fresh)',
      fetchedAt: new Date().toISOString(),
      summary: {
        totalGames: freshGames.length,
        homeTeamGames: freshGames.filter((g: any) => g.isHomeTeamGame).length,
        inputsWithGames: Object.keys(gamesByInput).length,
        upcomingCount: upcomingGames.length,
        streamingOnlyGames,
        gamesWithStreaming,
        fireTVDevicesOnline: fireTVDevices.filter(d => d.isOnline).length,
        leagues: [...new Set(freshGames.map((g: any) => g.league))].filter(Boolean)
      }
    })

  } catch (error: any) {
    logger.error('[AI_GAME_PLAN] Error getting AI game plan:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to get AI game plan',
      details: error.message
    }, { status: 500 })
  }
}
