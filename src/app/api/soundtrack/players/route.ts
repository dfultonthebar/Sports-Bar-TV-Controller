
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSoundtrackAPI } from '@/lib/soundtrack-your-brand'

const prisma = new PrismaClient()

// GET - Fetch players (optionally filtered for bartender view)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bartenderOnly = searchParams.get('bartenderOnly') === 'true'

    // Get configuration with API key
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

    // Fetch live player data from Soundtrack API
    const api = getSoundtrackAPI(config.apiKey)
    const livePlayers = await api.listPlayers()

    // Merge database settings with live data
    const players = livePlayers
      .map(livePlayer => {
        const dbPlayer = dbPlayers.find(p => p.playerId === livePlayer.id)
        if (bartenderOnly && !dbPlayer?.bartenderVisible) {
          return null
        }
        return {
          ...livePlayer,
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

    // Get API key from config
    const config = await prisma.soundtrackConfig.findFirst()
    if (!config) {
      return NextResponse.json({ 
        success: false, 
        error: 'Soundtrack not configured' 
      }, { status: 404 })
    }

    const api = getSoundtrackAPI(config.apiKey)
    const player = await api.updatePlayer(playerId, {
      ...(playing !== undefined && { playing }),
      ...(stationId && { stationId }),
      ...(volume !== undefined && { volume })
    })

    return NextResponse.json({ success: true, player })
  } catch (error: any) {
    console.error('Error controlling Soundtrack player:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}

