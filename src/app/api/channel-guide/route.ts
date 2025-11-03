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
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
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
    logger.info(`[${timestamp}] [Channel-Guide-API] DATA:`, JSON.stringify(data, null, 2))
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
  if (!bodyValidation.success) return bodyValidation.error

  // Path parameter validation
  const resolvedParams = await params
  const paramsValidation = validatePathParams(resolvedParams, z.object({ id: z.string().min(1) }))
  if (!paramsValidation.success) return paramsValidation.error


  const requestId = Math.random().toString(36).substring(7)
  logInfo(`========== CHANNEL GUIDE REQUEST [${requestId}] ==========`)
  
  try {
    const body: DeviceGuideRequest = await request.json()
    const { inputNumber, deviceType, deviceId, startTime, endTime } = body

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
    const start = startTime ? new Date(startTime) : new Date()
    const end = endTime ? new Date(endTime) : new Date(Date.now() + 24 * 60 * 60 * 1000)
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
      programs: programs,
      dataSource: 'The Rail Media API',
      summary: {
        programCount: programs.length,
        channelCount: channels.size,
        leagues: [...new Set(programs.map(p => p.league))]
      }
    }

    logInfo(`========== REQUEST COMPLETE [${requestId}] ==========`)
    logInfo(`Returning ${programs.length} programs for ${deviceType}`)

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


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Path parameter validation
  const resolvedParams = await params
  const paramsValidation = validatePathParams(resolvedParams, z.object({ id: z.string().min(1) }))
  if (!paramsValidation.success) return paramsValidation.error


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
