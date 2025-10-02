
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

    // AUTHENTICATE ONCE: Test the API token before saving
    // This is the ONLY time we authenticate - token is then cached in database
    setSoundtrackAPIToken(apiKey)
    const api = getSoundtrackAPI()
    
    let testResult
    try {
      testResult = await api.testConnection()
      if (!testResult.success) {
        clearSoundtrackAPI()
        return NextResponse.json({ 
          success: false, 
          error: testResult.message || 'Unable to connect to Soundtrack API',
          details: testResult.details
        }, { status: 400 })
      }
      console.log('[Soundtrack] Token validated successfully - will be cached in database')
    } catch (error: any) {
      clearSoundtrackAPI()
      return NextResponse.json({ 
        success: false, 
        error: error.message || 'Invalid API token or unable to connect to Soundtrack' 
      }, { status: 400 })
    }

    // Try to get account info, but don't fail if it doesn't work
    let accountInfo
    let firstAccount = null
    try {
      accountInfo = await api.getAccount()
      firstAccount = accountInfo.accounts && accountInfo.accounts.length > 0 
        ? accountInfo.accounts[0] 
        : null
    } catch (error: any) {
      console.log('Could not fetch account info, will save token anyway:', error.message)
      // Continue anyway - we'll use default values
    }
    
    // Save or update configuration
    const existingConfig = await prisma.soundtrackConfig.findFirst()

    const config = existingConfig
      ? await prisma.soundtrackConfig.update({
          where: { id: existingConfig.id },
          data: {
            apiKey,
            accountId: firstAccount?.id || accountInfo?.id || 'unknown',
            accountName: firstAccount?.name || 'Soundtrack Account',
            status: 'active',
            lastTested: new Date()
          }
        })
      : await prisma.soundtrackConfig.create({
          data: {
            apiKey,
            accountId: firstAccount?.id || 'unknown',
            accountName: firstAccount?.name || 'Soundtrack Account',
            status: 'active',
            lastTested: new Date()
          }
        })

    // Fetch sound zones ONCE during initial setup
    // After this, we'll use the cached token from database for all operations
    let zonesWarning = null
    try {
      const soundZones = await api.listSoundZones(firstAccount?.id)
      
      if (soundZones && soundZones.length > 0) {
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
        console.log(`[Soundtrack] Synced ${soundZones.length} sound zones`)
      } else {
        zonesWarning = 'No sound zones found. Please configure players in your Soundtrack account.'
      }
    } catch (error: any) {
      console.error('Error syncing sound zones:', error)
      zonesWarning = 'Could not fetch sound zones automatically. Use the "Refresh" button to try again.'
    }

    return NextResponse.json({ 
      success: true, 
      config: {
        ...config,
        apiKey: '***' + apiKey.slice(-4)
      },
      warning: zonesWarning,
      testResult: testResult.details
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

