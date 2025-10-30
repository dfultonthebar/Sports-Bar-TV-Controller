
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findFirst, findMany, or } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { getSoundtrackAPI } from '@/lib/soundtrack-your-brand'


// GET - Fetch players (optionally filtered for bartender view)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bartenderOnly = searchParams.get('bartenderOnly') === 'true'

    // Get configuration with CACHED API key from database
    const config = await findFirst('soundtrackConfigs')
    
    if (!config) {
      return NextResponse.json({ 
        success: false, 
        error: 'Soundtrack not configured' 
      }, { status: 404 })
    }

    // Get player settings from database
    let whereClause = eq(schema.soundtrackPlayers.configId, config.id)
    if (bartenderOnly) {
      whereClause = and(
        eq(schema.soundtrackPlayers.configId, config.id),
        eq(schema.soundtrackPlayers.bartenderVisible, true)
      ) as any
    }

    const dbPlayers = await findMany('soundtrackPlayers', {
      where: whereClause,
      orderBy: asc(schema.soundtrackPlayers.displayOrder)
    })

    // Use CACHED token from database - no re-authentication needed
    const api = getSoundtrackAPI(config.apiKey)
    const liveSoundZones = await api.listSoundZones()

    // Merge database settings with live data and fetch now playing for each zone
    const playersPromises = liveSoundZones.map(async (soundZone: any) => {
      const dbPlayer = dbPlayers.find(p => p.playerId === soundZone.id)
      if (bartenderOnly && !dbPlayer?.bartenderVisible) {
        return null
      }

      // Fetch now playing data for this zone
      let nowPlayingData = null
      try {
        nowPlayingData = await api.getNowPlaying(soundZone.id)
      } catch (error) {
        logger.error(`Failed to fetch now playing for zone ${soundZone.id}:`, error)
      }

      return {
        id: soundZone.id,
        name: soundZone.name,
        account: soundZone.account,
        nowPlaying: nowPlayingData,
        // Infer playing status from whether there's a nowPlaying track
        isPlaying: !!nowPlayingData?.track?.title,
        volume: 0, // Volume controlled via Atlas, not needed
        currentStation: null, // Would need separate query
        bartenderVisible: dbPlayer?.bartenderVisible || false,
        displayOrder: dbPlayer?.displayOrder || 0
      }
    })

    const players = (await Promise.all(playersPromises))
      .filter((p: any) => p !== null)
      .sort((a: any, b: any) => a.displayOrder - b.displayOrder)

    return NextResponse.json({ success: true, players })
  } catch (error: any) {
    logger.error('Error fetching Soundtrack players:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}

// PATCH - Control a player (play/pause, change station, volume)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { playerId, playing, stationId, volume } = body

    if (!playerId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Player ID is required' 
      }, { status: 400 })
    }

    // Get CACHED API key from database
    const config = await findFirst('soundtrackConfigs')
    if (!config) {
      return NextResponse.json({ 
        success: false, 
        error: 'Soundtrack not configured' 
      }, { status: 404 })
    }

    // Use cached token - no authentication needed
    const api = getSoundtrackAPI(config.apiKey)
    
    // Update the sound zone with the provided parameters
    const updatedData: any = {}
    if (playing !== undefined) updatedData.playing = playing
    if (stationId) updatedData.stationId = stationId
    if (volume !== undefined) updatedData.volume = volume
    
    const soundZone = await api.updateSoundZone(playerId, updatedData)

    return NextResponse.json({
      success: true,
      player: {
        id: soundZone.id,
        name: soundZone.name,
        currentPlayback: soundZone.currentPlayback,
        // Extract fields for UI compatibility
        isPlaying: soundZone.currentPlayback?.playing || false,
        volume: soundZone.currentPlayback?.volume || 0,
        currentStation: soundZone.currentPlayback?.station || null
      }
    })
  } catch (error: any) {
    logger.error('Error controlling Soundtrack player:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}

