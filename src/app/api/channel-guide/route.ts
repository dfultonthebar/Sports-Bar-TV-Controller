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
  console.log(`[${timestamp}] [Channel-Guide-API] INFO: ${message}`)
  if (data) {
    console.log(`[${timestamp}] [Channel-Guide-API] DATA:`, JSON.stringify(data, null, 2))
  }
}

function logError(message: string, error?: any) {
  const timestamp = new Date().toISOString()
  console.error(`[${timestamp}] [Channel-Guide-API] ERROR: ${message}`)
  if (error) {
    console.error(`[${timestamp}] [Channel-Guide-API] ERROR-DETAILS:`, error)
  }
}

export async function POST(request: NextRequest) {
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
        // Create program entry
        const programId = `${group.group_title}-${listing.time}-${Math.random().toString(36).substring(7)}`
        
        // Extract channel info based on device type
        let channelInfo: any = null
        
        if (deviceType === 'satellite' && listing.channel_numbers?.SAT) {
          // DirecTV/Satellite
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
            channelNumber: String(channelNumber)
          }
        } else if (deviceType === 'cable' && listing.channel_numbers?.CAB) {
          // Cable
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
            channelNumber: String(channelNumber)
          }
        } else if (deviceType === 'streaming') {
          // Streaming services
          const firstStation = listing.stations ? Object.values(listing.stations)[0] : 'Unknown'
          
          channelInfo = {
            id: `stream-${firstStation}`,
            name: firstStation,
            type: 'streaming',
            cost: 'subscription',
            platforms: ['Streaming Services'],
            channelNumber: firstStation
          }
        } else {
          // Default fallback
          const firstStation = listing.stations ? Object.values(listing.stations)[0] : 'Unknown'
          channelInfo = {
            id: `channel-${firstStation}`,
            name: firstStation,
            type: deviceType,
            cost: 'subscription',
            platforms: [deviceType],
            channelNumber: firstStation
          }
        }

        // Add channel to map
        if (channelInfo) {
          channels.set(channelInfo.id, channelInfo)
        }

        // Create program entry
        const program = {
          id: programId,
          league: group.group_title,
          homeTeam: listing.data['home team'] || listing.data['team'] || '',
          awayTeam: listing.data['visiting team'] || listing.data['opponent'] || '',
          gameTime: listing.time,
          startTime: new Date(`${listing.date || new Date().toDateString()} ${listing.time}`).toISOString(),
          endTime: new Date(new Date(`${listing.date || new Date().toDateString()} ${listing.time}`).getTime() + 3 * 60 * 60 * 1000).toISOString(),
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
