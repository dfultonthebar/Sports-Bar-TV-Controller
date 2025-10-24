export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findFirst, or } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { getSoundtrackAPI } from '@/lib/soundtrack-your-brand'


// GET - Fetch now playing for a player
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get('playerId')

    if (!playerId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Player ID is required' 
      }, { status: 400 })
    }

    // Get API key from config
    const config = await findFirst('soundtrackConfigs')
    
    if (!config) {
      return NextResponse.json({ 
        success: false, 
        error: 'Soundtrack not configured' 
      }, { status: 404 })
    }

    const api = getSoundtrackAPI(config.apiKey)
    const nowPlaying = await api.getNowPlaying(playerId)

    return NextResponse.json({ success: true, nowPlaying })
  } catch (error: any) {
    logger.error('Error fetching now playing:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}

