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

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export const dynamic = 'force-dynamic'

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


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  const requestId = Math.random().toString(36).substring(7)
  logInfo(`========== CHANNEL GUIDE REQUEST [${requestId}] ==========`)

  try {
    const { data } = bodyValidation
    const { inputNumber, deviceType, deviceId, startTime, endTime } = data
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

    logInfo(`Fetching ${days} days of guide data from The Rail Media API`)

    // Fetch data from The Rail Media API
    const api = getSportsGuideApi()
    const guide = await api.fetchDateRangeGuide(days)

    logInfo(`Received ${guide.listing_groups?.length || 0} listing groups from API`)

    // Transform The Rail Media API data to our format
    const programs = []
    const channels = new Map()

    for (const group of guide.listing_groups || []) {
      for (const listing of group.listings || []) {
        // Extract channel info based on device type - STRICT FILTERING
        let channelInfo: any = null
        
        // CRITICAL: Only create channels that match the requested device type
        if (deviceType === 'satellite') {
          // DirecTV/Satellite - ONLY if SAT channels exist
          if (listing.channel_numbers?.SAT) {
            const satChannels = listing.channel_numbers.SAT
            const firstStation = listing.stations ? Object.values(listing.stations)[0] : 'Unknown'
            const firstChannel = Object.values(satChannels)[0] as any
            const channelNumber = Array.isArray(firstChannel) ? firstChannel[0] : firstChannel
            
            channelInfo = {
              id: `sat-${firstStation}`,
              name: firstStation,
              number: String(channelNumber),
              type: 'satellite',
              cost: 'subscription',
              platforms: ['DirecTV', 'Dish Network'],
              channelNumber: String(channelNumber),
              deviceType: 'satellite'
            }
          }
        } else if (deviceType === 'cable') {
          // Cable - ONLY if CAB channels exist
          if (listing.channel_numbers?.CAB) {
            const cableChannels = listing.channel_numbers.CAB
            const firstStation = listing.stations ? Object.values(listing.stations)[0] : 'Unknown'
            const firstChannel = Object.values(cableChannels)[0] as any
            const channelNumber = Array.isArray(firstChannel) ? firstChannel[0] : firstChannel
            
            channelInfo = {
              id: `cable-${firstStation}`,
              name: firstStation,
              number: String(channelNumber),
              type: 'cable',
              cost: 'subscription',
              platforms: ['Cable'],
              channelNumber: String(channelNumber),
              deviceType: 'cable'
            }
          }
        } else if (deviceType === 'streaming') {
          // Streaming services - always available
          const firstStation = listing.stations ? Object.values(listing.stations)[0] : 'Unknown'
          
          channelInfo = {
            id: `stream-${firstStation}`,
            name: firstStation,
            type: 'streaming',
            cost: 'subscription',
            platforms: ['Streaming Services'],
            channelNumber: firstStation,
            deviceType: 'streaming'
          }
        }

        // CRITICAL: Skip this listing if no matching channel was found for the device type
        if (!channelInfo) {
          logInfo(`Skipping listing - no ${deviceType} channel available`, {
            groupTitle: group.group_title,
            time: listing.time,
            availableLineups: Object.keys(listing.channel_numbers || {})
          })
          continue
        }

        // Add channel to map
        channels.set(channelInfo.id, channelInfo)

        // Create program entry with proper date parsing
        const programId = `${group.group_title}-${listing.time}-${Math.random().toString(36).substring(7)}`
        
        // Parse the date properly - API returns dates like "Oct 27" without year
        // We need to add the current year to make it valid
        let eventDate: Date
        if (listing.date) {
          // Parse the date and add current year if missing
          const currentYear = new Date().getFullYear()
          const dateWithYear = `${listing.date} ${currentYear} ${listing.time}`
          eventDate = new Date(dateWithYear)
          
          // If the parsed date is invalid or in the past (more than 1 day ago), try next year
          if (isNaN(eventDate.getTime()) || eventDate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
            eventDate = new Date(`${listing.date} ${currentYear + 1} ${listing.time}`)
          }
        } else {
          // Fallback to today if no date provided
          eventDate = new Date(`${new Date().toDateString()} ${listing.time}`)
        }
        
        // Calculate end time (3 hours after start for sports events)
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

    logInfo(`Transformed ${programs.length} programs and ${channels.size} channels`)

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
    // Load channel presets from database
    const { db } = await import('@/db')
    const { schema } = await import('@/db')

    const presets = await db.select().from(schema.channelPresets)
    const presetDeviceType = deviceType === 'satellite' ? 'directv' : deviceType
    const presetChannels = new Set(
      presets
        .filter(p => p.deviceType === presetDeviceType)
        .map(p => p.channelNumber)
    )

    logInfo(`Loaded ${presetChannels.size} ${presetDeviceType} channel presets`)

    // Filter programs to only include preset channels
    const presetFilteredPrograms = freshPrograms.filter(program => {
      const channelNumber = program.channel?.channelNumber || program.channel?.number
      const isInPreset = channelNumber && presetChannels.has(channelNumber)

      if (!isInPreset) {
        logInfo(`Filtering out channel ${channelNumber} - not in presets`, {
          league: program.league,
          channel: program.channel?.name
        })
      }

      return isInPreset
    })

    const presetRemovedCount = freshPrograms.length - presetFilteredPrograms.length
    if (presetRemovedCount > 0) {
      logInfo(`[PRESET FILTER] Filtered out ${presetRemovedCount} programs not in channel presets`)
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
