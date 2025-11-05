
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, create, deleteMany, deleteRecord, desc, eq, findFirst, findMany, or, update, updateMany, upsert } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { getSoundtrackAPI, setSoundtrackAPIToken, clearSoundtrackAPI } from '@/lib/soundtrack-your-brand'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'


// GET - Fetch Soundtrack configuration
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const config = await findFirst('soundtrackConfigs')

    if (!config) {
      return NextResponse.json({
        success: false,
        message: 'No Soundtrack configuration found',
        hasConfig: false
      }, { status: 404 })
    }

    // Get players for this config
    const players = await findMany('soundtrackPlayers', {
      where: eq(schema.soundtrackPlayers.configId, config.id),
      orderBy: asc(schema.soundtrackPlayers.displayOrder)
    })

    // Don't expose the full API token
    const safeConfig = {
      ...config,
      apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : null
    }

    return NextResponse.json({
      success: true,
      config: safeConfig,
      players,
      hasConfig: true
    })
  } catch (error: any) {
    logger.error('Error fetching Soundtrack config:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// POST - Create or update Soundtrack configuration
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { data: body } = bodyValidation
  try {
    const { apiKey } = body

    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'API token is required' 
      }, { status: 400 })
    }

    // AUTHENTICATE ONCE: Test the API token before saving
    // This is the ONLY time we authenticate - token is then cached in database
    const api = getSoundtrackAPI(apiKey)
    
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
      logger.debug('[Soundtrack] Token validated successfully - will be cached in database')
    } catch (error: any) {
      clearSoundtrackAPI()
      return NextResponse.json({ 
        success: false, 
        error: error.message || 'Invalid API token or unable to connect to Soundtrack' 
      }, { status: 400 })
    }

    // Try to get account info, but don't fail if it doesn't work
    let accountInfo
    let firstAccount: any = null
    try {
      accountInfo = await api.getAccount()
      firstAccount = accountInfo.accounts && accountInfo.accounts.length > 0 
        ? accountInfo.accounts[0] 
        : null
    } catch (error: any) {
      logger.debug('Could not fetch account info, will save token anyway:', error.message)
      // Continue anyway - we'll use default values
    }
    
    // Save or update configuration
    const existingConfig = await findFirst('soundtrackConfigs')

    const configData = {
      apiKey,
      accountId: firstAccount?.id || accountInfo?.id || 'unknown',
      accountName: firstAccount?.name || 'Soundtrack Account',
      isActive: true,
      lastSync: new Date()
    }

    const config = existingConfig
      ? await update('soundtrackConfigs', existingConfig.id, configData)
      : await create('soundtrackConfigs', configData)

    // Fetch sound zones ONCE during initial setup
    // After this, we'll use the cached token from database for all operations
    let zonesWarning: string | null = null
    try {
      logger.debug(`[Soundtrack] Fetching sound zones for account: ${firstAccount?.id || 'all accounts'}`)
      const soundZones = await api.listSoundZones(firstAccount?.id)
      logger.debug(`[Soundtrack] listSoundZones returned:`, { data: soundZones })

      if (soundZones && soundZones.length > 0) {
        // Update or create sound zone (player) records
        logger.debug(`[Soundtrack] Processing ${soundZones.length} sound zones`)
        for (let i = 0; i < soundZones.length; i++) {
          const zone = soundZones[i]

          // Skip undefined or null zones
          if (!zone || !zone.id || !zone.name) {
            logger.debug(`[Soundtrack] Skipping invalid zone at index ${i}`)
            continue
          }

          logger.debug(`[Soundtrack] Zone ${i}: ${JSON.stringify({ id: zone.id, name: zone.name })}`)

          // Check if player exists
          const existing = await findFirst('soundtrackPlayers', {
            where: and(
              eq(schema.soundtrackPlayers.configId, config.id),
              eq(schema.soundtrackPlayers.playerId, zone.id)
            )
          })

          if (existing) {
            // Update existing player
            logger.debug(`[Soundtrack] Updating existing player: ${existing.id}`)
            await update('soundtrackPlayers', existing.id, {
              playerName: zone.name
            })
          } else {
            // Create new player
            logger.debug(`[Soundtrack] Creating new player for zone: ${zone.id}`)
            await create('soundtrackPlayers', {
              configId: config.id,
              playerId: zone.id,
              playerName: zone.name,
              bartenderVisible: false,
              displayOrder: 0
            })
          }
        }
        logger.debug(`[Soundtrack] Synced ${soundZones.length} sound zones`)
      } else {
        zonesWarning = 'No sound zones found. Please configure players in your Soundtrack account.'
      }
    } catch (error: any) {
      logger.error('[Soundtrack] Error syncing sound zones')
      logger.error('[Soundtrack] Error type:', typeof error)
      logger.error('[Soundtrack] Error name:', error?.name)
      logger.error('[Soundtrack] Error message:', error?.message)
      logger.error('[Soundtrack] Error stack:', error?.stack)
      logger.error('[Soundtrack] Error toString:', error?.toString())
      if (error?.response) {
        logger.error('[Soundtrack] Error response:', error.response)
      }
      zonesWarning = `Could not fetch sound zones automatically. Error: ${error?.message || error}. Use the "Refresh" button to try again.`
    }

    return NextResponse.json({
      success: true,
      config: {
        ...config,
        apiKey: '***' + (typeof apiKey === 'string' ? apiKey.slice(-4) : '')
      },
      warning: zonesWarning,
      testResult: testResult.details
    })
  } catch (error: any) {
    logger.error('Error saving Soundtrack config:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}

// PATCH - Update player visibility settings
export async function PATCH(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { data: body } = bodyValidation
  try {
    const { playerId, bartenderVisible, displayOrder } = body

    if (!playerId) {
      return NextResponse.json({
        success: false,
        error: 'Player ID is required'
      }, { status: 400 })
    }

    // Find the player
    const player = await findFirst('soundtrackPlayers', {
      where: eq(schema.soundtrackPlayers.playerId, playerId as string)
    })

    if (!player) {
      return NextResponse.json({
        success: false,
        error: 'Player not found'
      }, { status: 404 })
    }

    // Update the player
    const updateData: any = {}
    if (bartenderVisible !== undefined) updateData.bartenderVisible = bartenderVisible
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder

    const updated = await update('soundtrackPlayers', eq(schema.soundtrackPlayers.id, player.id), updateData)

    return NextResponse.json({ success: true, player: updated })
  } catch (error: any) {
    logger.error('Error updating player settings:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// DELETE - Remove Soundtrack configuration
export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Find existing config
    const config = await findFirst('soundtrackConfigs')

    if (!config) {
      return NextResponse.json({
        success: false,
        message: 'No configuration to delete'
      }, { status: 404 })
    }

    // Delete all associated players first
    await deleteMany('soundtrackPlayers', eq(schema.soundtrackPlayers.configId, config.id))

    // Delete the configuration
    await deleteRecord('soundtrackConfigs', config.id)

    // Clear the API singleton
    clearSoundtrackAPI()

    return NextResponse.json({
      success: true,
      message: 'Soundtrack configuration deleted successfully'
    })
  } catch (error: any) {
    logger.error('Error deleting Soundtrack config:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

