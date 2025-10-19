
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { executeAtlasCommand } from '@/lib/atlasClient'

interface ControlCommand {
  action: 'volume' | 'mute' | 'source' | 'scene' | 'message' | 'combine'
  zone?: number
  value?: string | number | boolean
  zones?: number[]  // for room combine
  sceneId?: number
  messageId?: number
}

export async function POST(request: NextRequest) {
  try {
    const { processorId, command }: { processorId: string, command: ControlCommand } = await request.json()

    if (!processorId || !command) {
      return NextResponse.json(
        { error: 'Processor ID and command are required' },
        { status: 400 }
      )
    }

    // Verify database connection is available
    if (!prisma) {
      console.error('[Control API] Database client is not initialized')
      return NextResponse.json(
        { error: 'Database connection error. Please check server configuration.' },
        { status: 500 }
      )
    }

    // Get processor details
    const processor = await prisma.audioProcessor.findUnique({
      where: { id: processorId }
    }).catch((dbError) => {
      console.error('[Control API] Database query error:', dbError)
      throw new Error(`Database error: ${dbError.message}`)
    })

    if (!processor) {
      return NextResponse.json(
        { error: 'Audio processor not found' },
        { status: 404 }
      )
    }

    console.log(`Executing ${command.action} command on processor ${processor.name}`)

    let result;
    switch (command.action) {
      case 'volume':
        result = await setZoneVolume(processor, command.zone!, command.value as number)
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
        return NextResponse.json(
          { error: `Unknown command action: ${command.action}` },
          { status: 400 }
        )
    }

    // Update last seen timestamp
    await prisma.audioProcessor.update({
      where: { id: processorId },
      data: { lastSeen: new Date() }
    })

    return NextResponse.json({ 
      success: true, 
      result,
      message: `${command.action} command executed successfully`
    })

  } catch (error) {
    console.error('Error executing audio processor control:', error)
    return NextResponse.json(
      { error: 'Failed to execute control command' },
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
  console.log(`[Control API] Setting zone ${zone} volume to ${volume}% on ${processor.ipAddress}`)
  
  // Zone numbers are 1-based in UI, 0-based in Atlas protocol
  const zoneIndex = zone - 1
  
  // Send command to Atlas processor via TCP (port 5321 for AZMP8)
  const result = await executeAtlasCommand(
    { ipAddress: processor.ipAddress, port: processor.tcpPort || 5321 },
    async (client) => await client.setZoneVolume(zoneIndex, volume, true)
  )

  if (!result.success) {
    console.error('[Control API] Failed to set zone volume:', result.error)
    throw new Error(result.error || 'Failed to set zone volume')
  }
  
  // Update zone volume in database for state tracking
  await prisma.audioZone.updateMany({
    where: { 
      processorId: processor.id,
      zoneNumber: zone 
    },
    data: { volume }
  })

  return { zone, volume, timestamp: new Date(), atlasResponse: result }
}

/**
 * Set zone mute state
 * @param processor Audio processor details
 * @param zone Zone number (1-based from UI)
 * @param muted Mute state (true = muted, false = unmuted)
 */
async function setZoneMute(processor: any, zone: number, muted: boolean): Promise<any> {
  console.log(`[Control API] ${muted ? 'Muting' : 'Unmuting'} zone ${zone} on ${processor.ipAddress}`)
  
  // Zone numbers are 1-based in UI, 0-based in Atlas protocol
  const zoneIndex = zone - 1
  
  // Send command to Atlas processor via TCP (port 23 for telnet)
  const result = await executeAtlasCommand(
    { ipAddress: processor.ipAddress, port: processor.tcpPort || 5321 },
    async (client) => await client.setZoneMute(zoneIndex, muted)
  )

  if (!result.success) {
    console.error('[Control API] Failed to set zone mute:', result.error)
    throw new Error(result.error || 'Failed to set zone mute')
  }
  
  // Update zone mute state in database for state tracking
  await prisma.audioZone.updateMany({
    where: { 
      processorId: processor.id,
      zoneNumber: zone 
    },
    data: { muted }
  })

  return { zone, muted, timestamp: new Date(), atlasResponse: result }
}

/**
 * Set zone source
 * @param processor Audio processor details
 * @param zone Zone number (1-based from UI)
 * @param source Source identifier (could be "Source 1", "input_1", etc.)
 */
async function setZoneSource(processor: any, zone: number, source: string): Promise<any> {
  console.log(`[Control API] Setting zone ${zone} source to ${source} on ${processor.ipAddress}`)
  
  // Zone numbers are 1-based in UI, 0-based in Atlas protocol
  const zoneIndex = zone - 1
  
  // Parse source index from source string
  // Source can be: "Source 1", "input_1", "matrix_audio_1", etc.
  let sourceIndex = -1
  
  if (source.startsWith('Source ')) {
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
  } else if (!isNaN(parseInt(source))) {
    // Direct number
    sourceIndex = parseInt(source)
  }

  console.log(`[Control API] Mapped source "${source}" to index ${sourceIndex}`)
  
  // Send command to Atlas processor via TCP (port 23 for telnet)
  const result = await executeAtlasCommand(
    { ipAddress: processor.ipAddress, port: processor.tcpPort || 5321 },
    async (client) => await client.setZoneSource(zoneIndex, sourceIndex)
  )

  if (!result.success) {
    console.error('[Control API] Failed to set zone source:', result.error)
    throw new Error(result.error || 'Failed to set zone source')
  }
  
  // Update zone source in database for state tracking
  await prisma.audioZone.updateMany({
    where: { 
      processorId: processor.id,
      zoneNumber: zone 
    },
    data: { currentSource: source }
  })

  return { zone, source, sourceIndex, timestamp: new Date(), atlasResponse: result }
}

/**
 * Recall a scene
 * @param processor Audio processor details
 * @param sceneId Scene ID (0-based)
 */
async function recallScene(processor: any, sceneId: number): Promise<any> {
  console.log(`[Control API] Recalling scene ${sceneId} on ${processor.ipAddress}`)
  
  // Send command to Atlas processor via TCP (port 23 for telnet)
  const result = await executeAtlasCommand(
    { ipAddress: processor.ipAddress, port: processor.tcpPort || 5321 },
    async (client) => await client.recallScene(sceneId)
  )

  if (!result.success) {
    console.error('[Control API] Failed to recall scene:', result.error)
    throw new Error(result.error || 'Failed to recall scene')
  }
  
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
  console.log(`[Control API] Playing message ${messageId} to zones ${targetZones} on ${processor.ipAddress}`)
  
  // Send command to Atlas processor via TCP (port 23 for telnet)
  const result = await executeAtlasCommand(
    { ipAddress: processor.ipAddress, port: processor.tcpPort || 5321 },
    async (client) => await client.playMessage(messageId)
  )

  if (!result.success) {
    console.error('[Control API] Failed to play message:', result.error)
    throw new Error(result.error || 'Failed to play message')
  }
  
  return { messageId, zones: targetZones, timestamp: new Date(), atlasResponse: result }
}

/**
 * Combine rooms (activate group)
 * @param processor Audio processor details
 * @param zones Zones to combine
 */
async function combineRooms(processor: any, zones: number[]): Promise<any> {
  console.log(`[Control API] Combining zones ${zones.join(', ')} on ${processor.ipAddress}`)
  
  // Note: Atlas uses GroupActive parameter to combine zones
  // This requires a group to be configured in the Atlas processor
  // For now, we'll just log this as it requires additional group configuration
  
  console.warn('[Control API] Zone combining requires GroupActive configuration in Atlas')
  
  // If you have a specific group index, you can use:
  // const result = await executeAtlasCommand(
  //   { ipAddress: processor.ipAddress, port: processor.tcpPort || 5321 },
  //   async (client) => await client.setGroupActive(groupIndex, true)
  // )
  
  return { combinedZones: zones, timestamp: new Date(), note: 'Group configuration required' }
}
