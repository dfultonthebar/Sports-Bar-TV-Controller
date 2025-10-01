
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSoundtrackAPI, setSoundtrackAPIKey } from '@/lib/soundtrack-your-brand'

const prisma = new PrismaClient()

// GET - Fetch Soundtrack configuration
export async function GET() {
  try {
    const config = await prisma.soundtrackConfig.findFirst({
      include: {
        players: {
          orderBy: { displayOrder: 'asc' }
        }
      }
    })

    if (!config) {
      return NextResponse.json({ 
        success: false, 
        message: 'No Soundtrack configuration found' 
      }, { status: 404 })
    }

    // Don't expose the full API key
    const safeConfig = {
      ...config,
      apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : null
    }

    return NextResponse.json({ 
      success: true, 
      config: safeConfig,
      players: config.players
    })
  } catch (error: any) {
    console.error('Error fetching Soundtrack config:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}

// POST - Create or update Soundtrack configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiKey } = body

    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'API key is required' 
      }, { status: 400 })
    }

    // Test the API key by fetching account info
    setSoundtrackAPIKey(apiKey)
    const api = getSoundtrackAPI()
    
    let accountInfo
    try {
      accountInfo = await api.getAccount()
    } catch (error: any) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid API key or unable to connect to Soundtrack' 
      }, { status: 400 })
    }

    // Save or update configuration
    const existingConfig = await prisma.soundtrackConfig.findFirst()

    const config = existingConfig
      ? await prisma.soundtrackConfig.update({
          where: { id: existingConfig.id },
          data: {
            apiKey,
            accountId: accountInfo.id || accountInfo.account?.id,
            accountName: accountInfo.name || accountInfo.account?.name,
            status: 'active',
            lastTested: new Date()
          }
        })
      : await prisma.soundtrackConfig.create({
          data: {
            apiKey,
            accountId: accountInfo.id || accountInfo.account?.id,
            accountName: accountInfo.name || accountInfo.account?.name,
            status: 'active',
            lastTested: new Date()
          }
        })

    // Fetch players from Soundtrack API and sync to database
    try {
      const players = await api.listPlayers()
      
      // Update or create player records
      for (const player of players) {
        await prisma.soundtrackPlayer.upsert({
          where: {
            configId_playerId: {
              configId: config.id,
              playerId: player.id
            }
          },
          create: {
            configId: config.id,
            playerId: player.id,
            playerName: player.name,
            accountId: player.accountId,
            bartenderVisible: false,
            displayOrder: 0
          },
          update: {
            playerName: player.name,
            accountId: player.accountId
          }
        })
      }
    } catch (error) {
      console.error('Error syncing players:', error)
    }

    return NextResponse.json({ 
      success: true, 
      config: {
        ...config,
        apiKey: '***' + apiKey.slice(-4)
      }
    })
  } catch (error: any) {
    console.error('Error saving Soundtrack config:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}

// PATCH - Update player visibility settings
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { playerId, bartenderVisible, displayOrder } = body

    if (!playerId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Player ID is required' 
      }, { status: 400 })
    }

    const player = await prisma.soundtrackPlayer.updateMany({
      where: { playerId },
      data: {
        ...(bartenderVisible !== undefined && { bartenderVisible }),
        ...(displayOrder !== undefined && { displayOrder })
      }
    })

    return NextResponse.json({ success: true, player })
  } catch (error: any) {
    console.error('Error updating player settings:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}

