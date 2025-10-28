
/**
 * API Route: Get Streaming Events
 * 
 * Get sports events from various streaming services
 */

import { NextRequest, NextResponse } from 'next/server'
import { unifiedStreamingApi } from '@/lib/streaming/unified-streaming-api'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'all' // all, live, today, upcoming
    const sport = searchParams.get('sport') || undefined
    const team = searchParams.get('team') || undefined
    const days = parseInt(searchParams.get('days') || '7')
    
    // Device info for getting events for installed apps
    const deviceId = searchParams.get('deviceId') || undefined
    const ipAddress = searchParams.get('ipAddress') || undefined
    const port = parseInt(searchParams.get('port') || '5555')

    console.log(`[API] Getting ${type} events${sport ? ` for ${sport}` : ''}`)

    let events

    switch (type) {
      case 'live':
        events = await unifiedStreamingApi.getAllLiveEvents()
        break

      case 'today':
        events = await unifiedStreamingApi.getTodaysEvents()
        break

      case 'upcoming':
        events = await unifiedStreamingApi.getUpcomingEvents(sport, days)
        break

      case 'search':
        if (!team) {
          return NextResponse.json(
            { error: 'team parameter required for search' },
            { status: 400 }
          )
        }
        events = await unifiedStreamingApi.searchEventsByTeam(team, sport)
        break

      case 'installed':
        if (!deviceId || !ipAddress) {
          return NextResponse.json(
            { error: 'deviceId and ipAddress required for installed apps' },
            { status: 400 }
          )
        }
        const installedEvents = await unifiedStreamingApi.getEventsForInstalledApps(
          deviceId,
          ipAddress,
          port
        )
        
        return NextResponse.json({
          success: true,
          type: 'installed',
          apps: installedEvents
        })

      default:
        // Get all upcoming events
        events = await unifiedStreamingApi.getUpcomingEvents(sport, days)
    }

    return NextResponse.json({
      success: true,
      type,
      sport,
      count: events.length,
      events
    })
  } catch (error: any) {
    console.error('[API] Error getting events:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get events',
        message: error.message
      },
      { status: 500 }
    )
  }
}
