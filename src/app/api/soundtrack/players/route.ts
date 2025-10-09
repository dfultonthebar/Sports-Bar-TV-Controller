
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSoundtrackAPI } from '@/lib/soundtrack-your-brand'


// GET - Fetch players (optionally filtered for bartender view)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bartenderOnly = searchParams.get('bartenderOnly') === 'true'

    // Get configuration with CACHED API key from database
    const config = await prisma.soundtrackConfig.findFirst()
    
    if (!config) {
      return NextResponse.json({ 
        success: false, 
        error: 'Soundtrack not configured' 
      }, { status: 404 })
    }

    // Get player settings from database
    const dbPlayers = await prisma.soundtrackPlayer.findMany({
      where: {
        configId: config.id,
        ...(bartenderOnly && { bartenderVisible: true })
      },
      orderBy: { displayOrder: 'asc' }
    })

    // Use CACHED token from database - no re-authentication needed
    const api = getSoundtrackAPI(config.apiKey)
    const liveSoundZones = await api.listSoundZones()

    // Merge database settings with live data
    const players = liveSoundZones
      .map(soundZone => {
        const dbPlayer = dbPlayers.find(p => p.playerId === soundZone.id)
        if (bartenderOnly && !dbPlayer?.bartenderVisible) {
          return null
        }
        return {
          id: soundZone.id,
          name: soundZone.name,
          account: soundZone.account,
          currentPlayback: soundZone.currentPlayback,
          bartenderVisible: dbPlayer?.bartenderVisible || false,
          displayOrder: dbPlayer?.displayOrder || 0
        }
      })
      .filter(p => p !== null)
      .sort((a: any, b: any) => a.displayOrder - b.displayOrder)

    return NextResponse.json({ success: true, players })
  } catch (error: any) {
    console.error('Error fetching Soundtrack players:', error)
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
    const config = await prisma.soundtrackConfig.findFirst()
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
        currentPlayback: soundZone.currentPlayback
      }
    })
  } catch (error: any) {
    console.error('Error controlling Soundtrack player:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}

