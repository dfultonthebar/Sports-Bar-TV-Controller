
import { NextRequest, NextResponse } from 'next/server'
import { findUnique, findMany, update, eq, and, db } from '@/lib/db-helpers'
import { schema } from '@/db'
import { executeAtlasCommand } from '@/lib/atlasClient'
import { getDbxControlService } from '@/lib/dbxControlService'
import { atlasLogger } from '@/lib/atlas-logger'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

interface ControlCommand {
  action: 'volume' | 'mute' | 'source' | 'scene' | 'message' | 'combine' | 'output-volume'
  zone?: number
  value?: string | number | boolean
  zones?: number[]  // for room combine
  sceneId?: number
  messageId?: number
  outputIndex?: number  // for output-volume action (0-based)
  parameterName?: string  // for output-volume action (e.g., "ZoneOutput1Gain_0")
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.audioControl)
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { data } = bodyValidation

  // Security: use validated data
  const { processorId, command } = data as { processorId: string, command: ControlCommand }

  try {

    logger.api.request('POST', '/api/audio-processor/control', { processorId, command })

    if (!processorId || !command) {
      logger.api.response('POST', '/api/audio-processor/control', 400, { error: 'Missing parameters' })
      return NextResponse.json(
        { error: 'Processor ID and command are required' },
        { status: 400 }
      )
    }

    // Get processor details using Drizzle
    const processor = await findUnique('audioProcessors', eq(schema.audioProcessors.id, processorId))

    if (!processor) {
      logger.api.response('POST', '/api/audio-processor/control', 404, { error: 'Processor not found' })
      return NextResponse.json(
        { error: 'Audio processor not found' },
        { status: 404 }
      )
    }

    logger.info(`[AUDIO-CONTROL] Executing ${command.action} command on ${processor.processorType} processor ${processor.name}`, {
      data: { processorId, ipAddress: processor.ipAddress, tcpPort: processor.tcpPort, command }
    })

    let result;

    // Route to the correct processor backend
    if (processor.processorType === 'dbx-zonepro') {
      // Fire-and-forget for dbx (one-way protocol, no feedback)
      // Don't await - return immediately for fast UI response
      const dbxStart = Date.now()
      executeDbxCommand(processor, command)
        .then(() => logger.info(`[AUDIO-CONTROL] dbx command completed in ${Date.now() - dbxStart}ms`))
        .catch(err =>
          logger.error(`[AUDIO-CONTROL] dbx command failed after ${Date.now() - dbxStart}ms: ${err?.message || err}`)
        )
      // Fire-and-forget volume logging for dbx
      if ((command.action === 'volume' || command.action === 'output-volume') && command.zone != null) {
        logVolumeChange(processorId, command.zone, command.value as number, 'bartender')
          .catch(err => logger.error(`[AUDIO-VOLUME-LOG] Failed to log dbx volume change: ${err?.message || err}`))
      }
      return NextResponse.json({
        success: true,
        result: { action: command.action, zone: command.zone },
        message: `${command.action} command sent`
      })
    }

    // Atlas and other processor types
    switch (command.action) {
      case 'volume':
        result = await setZoneVolume(processor, command.zone!, command.value as number)
        break
      case 'output-volume':
        result = await setZoneOutputVolume(processor, command.zone!, command.outputIndex!, command.value as number, command.parameterName)
        break
      case 'mute':
        result = await setZoneMute(processor, command.zone!, command.value as boolean)
        break
      case 'source':
        result = await setZoneSource(processor, command.zone!, command.value as string)
        break
      case 'scene':
        result = await recallScene(processor, command.sceneId!)
        break
      case 'message':
        result = await playMessage(processor, command.messageId!, command.zones)
        break
      case 'combine':
        result = await combineRooms(processor, command.zones!)
        break
      default:
        logger.api.response('POST', '/api/audio-processor/control', 400, { error: 'Unknown action' })
        return NextResponse.json(
          { error: `Unknown command action: ${command.action}` },
          { status: 400 }
        )
    }

    // Update zone source in DB after successful source change
    if (command.action === 'source' && command.zone != null && result?.atlasResponse?.success !== false) {
      try {
        const zoneIndex = (command.zone as number) - 1 // zone is 1-based in API, 0-based in DB
        const zone = await db.select().from(schema.audioZones)
          .where(and(eq(schema.audioZones.processorId, processorId), eq(schema.audioZones.zoneNumber, zoneIndex)))
          .get()
        if (zone) {
          await db.update(schema.audioZones)
            .set({ currentSource: String(command.value), updatedAt: new Date().toISOString() })
            .where(eq(schema.audioZones.id, zone.id))
        }
      } catch {}
    }

    // Fire-and-forget volume logging for Atlas and other processors
    if ((command.action === 'volume' || command.action === 'output-volume') && command.zone != null) {
      logVolumeChange(processorId, command.zone, command.value as number, 'bartender')
        .catch(err => logger.error(`[AUDIO-VOLUME-LOG] Failed to log volume change: ${err?.message || err}`))
    }

    // Update last seen timestamp using Drizzle
    await update('audioProcessors', eq(schema.audioProcessors.id, processorId), {
      lastSeen: new Date().toISOString()
    })

    logger.api.response('POST', '/api/audio-processor/control', 200, { success: true })
    
    return NextResponse.json({ 
      success: true, 
      result,
      message: `${command.action} command executed successfully`
    })

  } catch (error) {
    logger.api.error('POST', '/api/audio-processor/control', error)
    atlasLogger.error('CONTROL', 'Failed to execute control command', error)
    return NextResponse.json(
      { 
        error: 'Failed to execute control command',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// dbx ZonePRO control functions

/**
 * Execute a command on a dbx ZonePRO processor
 * Uses the DbxControlService from @sports-bar/dbx-zonepro package
 */
async function executeDbxCommand(processor: any, command: ControlCommand): Promise<any> {
  const service = await getDbxControlService({
    deviceId: processor.id,
    model: processor.model || '1260m',
    ipAddress: processor.ipAddress,
    port: processor.tcpPort || 3804,
  })

  // dbx zones are 0-based in the service, UI sends 1-based
  const zoneIndex = command.zone ? command.zone - 1 : 0

  switch (command.action) {
    case 'volume': {
      const volume = command.value as number
      // UI sends raw dbx values (0-415), not percentages
      await service.setVolume(zoneIndex, volume, { type: 'raw' })
      return { zone: command.zone, volume, timestamp: new Date() }
    }
    case 'mute': {
      const muted = command.value as boolean
      await service.setMute(zoneIndex, muted)
      return { zone: command.zone, muted, timestamp: new Date() }
    }
    case 'source': {
      let sourceIndex: number
      if (typeof command.value === 'number') {
        sourceIndex = command.value
      } else if (typeof command.value === 'string') {
        // Parse source strings to dbx Router source indices
        // dbx ZonePRO 1260m: 0=None, 1-6=ML1-ML6, 7=S1, 8=S2, 9=S3, 10=S4
        const val = command.value as string
        if (val.startsWith('Source ')) {
          sourceIndex = parseInt(val.replace('Source ', '')) - 1
        } else if (val.startsWith('input_')) {
          sourceIndex = parseInt(val.split('_')[1]) - 1
        } else if (val.startsWith('Input ')) {
          // "Input 1" → ML1 (index 1), "Input 2" → ML2 (index 2), etc.
          sourceIndex = parseInt(val.replace('Input ', ''))
        } else if (val.startsWith('Matrix Audio')) {
          // "Matrix Audio" → S2 (index 8) - single matrix audio output
          // "Matrix Audio 1" → S2 (index 8), "Matrix Audio 2" → S3 (index 9)
          const numMatch = val.match(/\d+$/)
          const matrixNum = numMatch ? parseInt(numMatch[0]) : 1
          sourceIndex = 7 + matrixNum  // Matrix Audio → 8, Matrix Audio 2 → 9
        } else if (val === 'Streaming Input') {
          sourceIndex = 10  // S4 - Spotify/streaming
        } else if (val === 'Microphone') {
          sourceIndex = 5   // ML5 - Wireless Mic
        } else if (!isNaN(parseInt(val))) {
          sourceIndex = parseInt(val)
        } else {
          logger.warn(`[AUDIO-CONTROL] Unknown dbx source name: "${val}", defaulting to 0`)
          sourceIndex = 0
        }
      } else {
        sourceIndex = 0
      }
      logger.info(`[AUDIO-CONTROL] dbx source: "${command.value}" → index ${sourceIndex}`)
      await service.setSource(zoneIndex, sourceIndex)
      return { zone: command.zone, source: command.value, sourceIndex, timestamp: new Date() }
    }
    case 'scene': {
      const sceneNumber = command.sceneId || 1
      await service.recallScene(sceneNumber)
      return { sceneId: sceneNumber, timestamp: new Date() }
    }
    default:
      throw new Error(`Unsupported dbx command action: ${command.action}`)
  }
}

// AtlasIED Atmosphere control functions

/**
 * Set zone volume
 * @param processor Audio processor details
 * @param zone Zone number (1-based from UI)
 * @param volume Volume percentage (0-100)
 */
async function setZoneVolume(processor: any, zone: number, volume: number): Promise<any> {
  // Zone numbers are 1-based in UI, 0-based in Atlas protocol
  const zoneIndex = zone - 1
  
  atlasLogger.info('ZONE_VOLUME', `Setting zone ${zone} volume to ${volume}%`, {
    ipAddress: processor.ipAddress,
    tcpPort: processor.tcpPort,
    zone,
    zoneIndex,
    volume
  })
  
  // Send command to Atlas processor via TCP (port 5321 for AZMP8)
  const result = await executeAtlasCommand(
    { ipAddress: processor.ipAddress, tcpPort: processor.tcpPort || 5321 },
    async (client) => {
      atlasLogger.info('ZONE_VOLUME', 'Sending setZoneVolume command to Atlas client', {
        zoneIndex,
        volume,
        usePercentage: true
      })
      return await client.setZoneVolume(zoneIndex, volume, true)
    }
  )

  if (!result.success) {
    atlasLogger.error('ZONE_VOLUME', 'Failed to set zone volume', {
      error: result.error,
      zone,
      volume
    })
    throw new Error(result.error || 'Failed to set zone volume')
  }
  
  atlasLogger.info('ZONE_VOLUME', 'Successfully set zone volume', {
    zone,
    volume,
    atlasResponse: result
  })

  return { zone, volume, timestamp: new Date(), atlasResponse: result }
}

/**
 * Set zone output volume (for multi-output zones like Mono+Sub, Stereo, etc.)
 * @param processor Audio processor details
 * @param zone Zone number (1-based from UI)
 * @param outputIndex Output index (0-based)
 * @param volume Volume percentage (0-100)
 * @param parameterName Optional Atlas parameter name (e.g., "ZoneOutput1Gain_0")
 */
async function setZoneOutputVolume(processor: any, zone: number, outputIndex: number, volume: number, parameterName?: string): Promise<any> {
  logger.info(`[Control API] Setting zone ${zone} output ${outputIndex} volume to ${volume}% on ${processor.ipAddress}`)
  
  // Zone numbers are 1-based in UI, 0-based in Atlas protocol
  const zoneIndex = zone - 1
  
  // Determine the Atlas parameter name for this output
  // If parameterName is provided, use it; otherwise, try common patterns
  let atlasParamName = parameterName
  
  if (!atlasParamName) {
    // Try common parameter naming patterns
    const paramPatterns = [
      `ZoneOutput${outputIndex + 1}Gain_${zoneIndex}`,
      `AmpOutGain_${zoneIndex}_${outputIndex}`,
      `ZoneAmp${outputIndex}Gain_${zoneIndex}`,
      `Output${outputIndex + 1}Gain_${zoneIndex}`
    ]
    
    // For now, use the first pattern as default
    // In a real implementation, we might want to probe which pattern works
    atlasParamName = paramPatterns[0]
  }
  
  logger.info(`[Control API] Using parameter: ${atlasParamName}`)
  
  // Send command to Atlas processor
  const result = await executeAtlasCommand(
    { ipAddress: processor.ipAddress, tcpPort: processor.tcpPort || 5321 },
    async (client) => {
      // Use setParameter method to set the output gain
      // Atlas expects volume in percentage (0-100)
      const response = await client.sendCommand({
        method: 'set',
        param: atlasParamName!,
        value: volume,
        format: 'pct'
      })
      return response
    }
  )

  if (!result.success) {
    logger.error('[Control API] Failed to set output volume:', { data: result.error })
    throw new Error(result.error || 'Failed to set output volume')
  }
  
  return { 
    zone, 
    outputIndex, 
    volume, 
    parameterName: atlasParamName,
    timestamp: new Date(), 
    atlasResponse: result 
  }
}

/**
 * Set zone mute state
 * @param processor Audio processor details
 * @param zone Zone number (1-based from UI)
 * @param muted Mute state (true = muted, false = unmuted)
 */
async function setZoneMute(processor: any, zone: number, muted: boolean): Promise<any> {
  // Zone numbers are 1-based in UI, 0-based in Atlas protocol
  const zoneIndex = zone - 1
  
  atlasLogger.info('ZONE_MUTE', `${muted ? 'Muting' : 'Unmuting'} zone ${zone}`, {
    ipAddress: processor.ipAddress,
    tcpPort: processor.tcpPort,
    zone,
    zoneIndex,
    muted
  })
  
  // Send command to Atlas processor via TCP (port 5321 for Atlas)
  const result = await executeAtlasCommand(
    { ipAddress: processor.ipAddress, tcpPort: processor.tcpPort || 5321 },
    async (client) => {
      atlasLogger.info('ZONE_MUTE', 'Sending setZoneMute command to Atlas client', {
        zoneIndex,
        muted
      })
      return await client.setZoneMute(zoneIndex, muted)
    }
  )

  if (!result.success) {
    atlasLogger.error('ZONE_MUTE', 'Failed to set zone mute', {
      error: result.error,
      zone,
      muted
    })
    throw new Error(result.error || 'Failed to set zone mute')
  }
  
  atlasLogger.info('ZONE_MUTE', 'Successfully set zone mute', {
    zone,
    muted,
    atlasResponse: result
  })

  return { zone, muted, timestamp: new Date(), atlasResponse: result }
}

/**
 * Set zone source
 * @param processor Audio processor details
 * @param zone Zone number (1-based from UI)
 * @param source Source identifier (could be "Source 1", "input_1", numeric index, etc.)
 */
async function setZoneSource(processor: any, zone: number, source: string | number): Promise<any> {
  // Zone numbers are 1-based in UI, 0-based in Atlas protocol
  const zoneIndex = zone - 1
  
  // Parse source index from source parameter
  // Source can be: "Source 1", "input_1", "matrix_audio_1", or a direct numeric index (0-based)
  let sourceIndex = -1
  
  // If source is already a number, use it directly (0-based Atlas index)
  if (typeof source === 'number') {
    sourceIndex = source
  } else if (source.startsWith('Source ')) {
    // Format: "Source 1" -> index 0
    sourceIndex = parseInt(source.replace('Source ', '')) - 1
  } else if (source.startsWith('input_')) {
    // Format: "input_1" -> index 0
    sourceIndex = parseInt(source.split('_')[1]) - 1
  } else if (source.startsWith('matrix_audio_')) {
    // Format: "matrix_audio_1" -> need to map to actual source index
    // Matrix audio buses typically come after physical inputs
    // This depends on the processor configuration
    const matrixNum = parseInt(source.split('_')[2])
    // For now, assuming matrix audio starts after physical inputs
    // You may need to adjust this based on actual configuration
    sourceIndex = matrixNum + 99  // Placeholder, needs actual mapping
  } else if (!isNaN(parseInt(source as string))) {
    // Direct number as string
    sourceIndex = parseInt(source as string)
  }

  atlasLogger.info('ZONE_SOURCE', `Setting zone ${zone} source to ${source} (index ${sourceIndex})`, {
    ipAddress: processor.ipAddress,
    tcpPort: processor.tcpPort,
    zone,
    zoneIndex,
    source,
    sourceIndex
  })
  
  // Send command to Atlas processor via TCP (port 5321 for Atlas)
  const result = await executeAtlasCommand(
    { ipAddress: processor.ipAddress, tcpPort: processor.tcpPort || 5321 },
    async (client) => {
      atlasLogger.info('ZONE_SOURCE', 'Sending setZoneSource command to Atlas client', {
        zoneIndex,
        sourceIndex
      })
      return await client.setZoneSource(zoneIndex, sourceIndex)
    }
  )

  if (!result.success) {
    atlasLogger.error('ZONE_SOURCE', 'Failed to set zone source', {
      error: result.error,
      zone,
      source,
      sourceIndex
    })
    throw new Error(result.error || 'Failed to set zone source')
  }
  
  atlasLogger.info('ZONE_SOURCE', 'Successfully set zone source', {
    zone,
    source,
    sourceIndex,
    atlasResponse: result
  })

  return { zone, source, sourceIndex, timestamp: new Date(), atlasResponse: result }
}

/**
 * Recall a scene
 * @param processor Audio processor details
 * @param sceneId Scene ID (0-based)
 */
async function recallScene(processor: any, sceneId: number): Promise<any> {
  atlasLogger.info('SCENE', `Recalling scene ${sceneId}`, {
    ipAddress: processor.ipAddress,
    tcpPort: processor.tcpPort,
    sceneId
  })
  
  // Send command to Atlas processor via TCP (port 5321 for Atlas)
  const result = await executeAtlasCommand(
    { ipAddress: processor.ipAddress, tcpPort: processor.tcpPort || 5321 },
    async (client) => await client.recallScene(sceneId)
  )

  if (!result.success) {
    atlasLogger.error('SCENE', 'Failed to recall scene', {
      error: result.error,
      sceneId
    })
    throw new Error(result.error || 'Failed to recall scene')
  }
  
  atlasLogger.info('SCENE', 'Successfully recalled scene', {
    sceneId,
    atlasResponse: result
  })
  
  return { sceneId, timestamp: new Date(), atlasResponse: result }
}

/**
 * Play a message
 * @param processor Audio processor details
 * @param messageId Message ID (0-based)
 * @param zones Target zones (optional, not directly supported by Atlas)
 */
async function playMessage(processor: any, messageId: number, zones?: number[]): Promise<any> {
  const targetZones = zones || 'all'
  
  atlasLogger.info('MESSAGE', `Playing message ${messageId} to zones ${targetZones}`, {
    ipAddress: processor.ipAddress,
    tcpPort: processor.tcpPort,
    messageId,
    zones: targetZones
  })
  
  // Send command to Atlas processor via TCP (port 5321 for Atlas)
  const result = await executeAtlasCommand(
    { ipAddress: processor.ipAddress, tcpPort: processor.tcpPort || 5321 },
    async (client) => await client.playMessage(messageId)
  )

  if (!result.success) {
    atlasLogger.error('MESSAGE', 'Failed to play message', {
      error: result.error,
      messageId
    })
    throw new Error(result.error || 'Failed to play message')
  }
  
  atlasLogger.info('MESSAGE', 'Successfully played message', {
    messageId,
    zones: targetZones,
    atlasResponse: result
  })
  
  return { messageId, zones: targetZones, timestamp: new Date(), atlasResponse: result }
}

/**
 * Combine rooms (activate group)
 * @param processor Audio processor details
 * @param zones Zones to combine
 */
async function combineRooms(processor: any, zones: number[]): Promise<any> {
  atlasLogger.warn('GROUP', 'Zone combining requires GroupActive configuration in Atlas', {
    ipAddress: processor.ipAddress,
    zones
  })
  
  // Note: Atlas uses GroupActive parameter to combine zones
  // This requires a group to be configured in the Atlas processor
  // For now, we'll just log this as it requires additional group configuration
  
  // If you have a specific group index, you can use:
  // const result = await executeAtlasCommand(
  //   { ipAddress: processor.ipAddress, tcpPort: processor.tcpPort || 5321 },
  //   async (client) => await client.setGroupActive(groupIndex, true)
  // )
  
  return { combinedZones: zones, timestamp: new Date(), note: 'Group configuration required' }
}

// --- Audio Volume Logging for AI Learning ---

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

/**
 * Determine the time slot from an hour (0-23)
 */
function getTimeSlot(hour: number): string {
  if (hour >= 6 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 14) return 'lunch'
  if (hour >= 14 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 23) return 'prime_time'
  return 'late_night' // 23-5
}

/**
 * Log a volume change with full context for AI learning.
 * Designed to be called fire-and-forget (don't await in the request path).
 */
async function logVolumeChange(
  processorId: string,
  zoneNumber: number,
  newVolume: number,
  changedBy: string = 'bartender',
): Promise<void> {
  try {
    const now = new Date()
    const hourOfDay = now.getHours()
    const dayOfWeek = DAY_NAMES[now.getDay()]
    const timeSlot = getTimeSlot(hourOfDay)

    // Gather game context: find active allocations for any currently in-progress games
    let activeGameId: string | null = null
    let activeLeague: string | null = null
    let activeHomeTeam: string | null = null
    let activeAwayTeam: string | null = null
    let isHomeGame: boolean | null = null

    try {
      const activeAllocations = await findMany('inputSourceAllocations', {
        where: eq(schema.inputSourceAllocations.status, 'active'),
        limit: 1,
      })

      if (activeAllocations.length > 0) {
        const allocation = activeAllocations[0]
        const gameId = allocation.gameScheduleId
        if (gameId) {
          const game = await findUnique('gameSchedules', eq(schema.gameSchedules.id, gameId))
          if (game) {
            activeGameId = game.id
            activeLeague = game.league
            activeHomeTeam = game.homeTeamName
            activeAwayTeam = game.awayTeamName
            // isHomeGame is bar-relative; check if venue suggests home (heuristic)
            isHomeGame = game.venueCity ? game.venueCity.includes('Green Bay') : null
          }
        }
      }
    } catch (gameErr) {
      // Don't let game context lookup failure prevent logging
      logger.debug(`[AUDIO-VOLUME-LOG] Could not fetch game context: ${gameErr instanceof Error ? gameErr.message : gameErr}`)
    }

    // Insert the log entry directly via Drizzle (lightweight, no overhead from helpers)
    await db.insert(schema.audioVolumeLogs).values({
      id: crypto.randomUUID(),
      processorId,
      zoneNumber,
      zoneName: null, // Could be enriched later from processor zone config
      previousVolume: null, // Would need state tracking to know previous value
      newVolume,
      changedBy,
      activeGameId,
      activeLeague,
      activeHomeTeam,
      activeAwayTeam,
      isHomeGame,
      dayOfWeek,
      hourOfDay,
      timeSlot,
      currentSource: null, // Could be enriched from zone source state
      isDJMode: false,
    })

    logger.debug(`[AUDIO-VOLUME-LOG] Logged volume change: zone=${zoneNumber} vol=${newVolume} by=${changedBy} slot=${timeSlot}`)
  } catch (err) {
    // Never let logging break the main flow
    logger.error(`[AUDIO-VOLUME-LOG] Error logging volume change: ${err instanceof Error ? err.message : err}`)
  }
}
