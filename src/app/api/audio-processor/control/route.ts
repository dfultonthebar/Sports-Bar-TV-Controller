
import { NextRequest, NextResponse } from 'next/server'
import { findUnique, update, eq } from '@/lib/db-helpers'
import { schema } from '@/db'
import { executeAtlasCommand } from '@/lib/atlasClient'
import { atlasLogger } from '@/lib/atlas-logger'
import { logger } from '@/lib/logger'

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
  try {
    const { processorId, command }: { processorId: string, command: ControlCommand } = await request.json()

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

    atlasLogger.info('CONTROL', `Executing ${command.action} command on processor ${processor.name}`, {
      processorId,
      ipAddress: processor.ipAddress,
      tcpPort: processor.tcpPort,
      command
    })

    let result;
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
  console.log(`[Control API] Setting zone ${zone} output ${outputIndex} volume to ${volume}% on ${processor.ipAddress}`)
  
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
  
  console.log(`[Control API] Using parameter: ${atlasParamName}`)
  
  // Send command to Atlas processor
  const result = await executeAtlasCommand(
    { ipAddress: processor.ipAddress, port: processor.tcpPort || 5321 },
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
    console.error('[Control API] Failed to set output volume:', result.error)
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
