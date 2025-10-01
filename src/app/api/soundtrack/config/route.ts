
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSoundtrackAPI, setSoundtrackAPIToken, clearSoundtrackAPI } from '@/lib/soundtrack-your-brand'

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
        message: 'No Soundtrack configuration found',
        hasConfig: false
      }, { status: 404 })
    }

    // Don't expose the full API token
    const safeConfig = {
      ...config,
      apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : null
    }

    return NextResponse.json({ 
      success: true, 
      config: safeConfig,
      players: config.players,
      hasConfig: true
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
        error: 'API token is required' 
      }, { status: 400 })
    }

    // Test the API token by fetching account info
    setSoundtrackAPIToken(apiKey)
    const api = getSoundtrackAPI()
    
    let accountInfo
    try {
      accountInfo = await api.getAccount()
    } catch (error: any) {
      clearSoundtrackAPI()
      return NextResponse.json({ 
        success: false, 
        error: error.message || 'Invalid API token or unable to connect to Soundtrack' 
      }, { status: 400 })
    }

    // Extract account information
    const firstAccount = accountInfo.accounts && accountInfo.accounts.length > 0 
      ? accountInfo.accounts[0] 
      : null
    
    // Save or update configuration
    const existingConfig = await prisma.soundtrackConfig.findFirst()

    const config = existingConfig
      ? await prisma.soundtrackConfig.update({
          where: { id: existingConfig.id },
          data: {
            apiKey,
            accountId: firstAccount?.id || accountInfo.id,
            accountName: firstAccount?.name || 'Soundtrack Account',
            status: 'active',
            lastTested: new Date()
          }
        })
      : await prisma.soundtrackConfig.create({
          data: {
            apiKey,
            accountId: firstAccount?.id || accountInfo.id,
            accountName: firstAccount?.name || 'Soundtrack Account',
            status: 'active',
            lastTested: new Date()
          }
        })

    // Fetch sound zones from Soundtrack API and sync to database
    try {
      const soundZones = await api.listSoundZones(firstAccount?.id)
      
      // Update or create sound zone (player) records
      for (const zone of soundZones) {
        await prisma.soundtrackPlayer.upsert({
          where: {
            configId_playerId: {
              configId: config.id,
              playerId: zone.id
            }
          },
          create: {
            configId: config.id,
            playerId: zone.id,
            playerName: zone.name,
            accountId: zone.account.id,
            bartenderVisible: false,
            displayOrder: 0
          },
          update: {
            playerName: zone.name,
            accountId: zone.account.id
          }
        })
      }
    } catch (error) {
      console.error('Error syncing sound zones:', error)
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

// DELETE - Remove Soundtrack configuration
export async function DELETE() {
  try {
    // Find existing config
    const config = await prisma.soundtrackConfig.findFirst()

    if (!config) {
      return NextResponse.json({ 
        success: false, 
        message: 'No configuration to delete' 
      }, { status: 404 })
    }

    // Delete all associated players first (cascade)
    await prisma.soundtrackPlayer.deleteMany({
      where: { configId: config.id }
    })

    // Delete the configuration
    await prisma.soundtrackConfig.delete({
      where: { id: config.id }
    })

    // Clear the API singleton
    clearSoundtrackAPI()

    return NextResponse.json({ 
      success: true, 
      message: 'Soundtrack configuration deleted successfully' 
    })
  } catch (error: any) {
    console.error('Error deleting Soundtrack config:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}

