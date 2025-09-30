
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'

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

    // Get processor details
    const processor = await prisma.audioProcessor.findUnique({
      where: { id: processorId }
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
async function setZoneVolume(processor: any, zone: number, volume: number): Promise<any> {
  // Note: This would typically make HTTP requests to the processor's web API
  // For now, we'll simulate the command and update our database
  
  console.log(`Setting zone ${zone} volume to ${volume}% on ${processor.ipAddress}`)
  
  // Update zone volume in database
  await prisma.audioZone.updateMany({
    where: { 
      processorId: processor.id,
      zoneNumber: zone 
    },
    data: { volume }
  })

  return { zone, volume, timestamp: new Date() }
}

async function setZoneMute(processor: any, zone: number, muted: boolean): Promise<any> {
  console.log(`${muted ? 'Muting' : 'Unmuting'} zone ${zone} on ${processor.ipAddress}`)
  
  await prisma.audioZone.updateMany({
    where: { 
      processorId: processor.id,
      zoneNumber: zone 
    },
    data: { muted }
  })

  return { zone, muted, timestamp: new Date() }
}

async function setZoneSource(processor: any, zone: number, source: string): Promise<any> {
  console.log(`Setting zone ${zone} source to ${source} on ${processor.ipAddress}`)
  
  await prisma.audioZone.updateMany({
    where: { 
      processorId: processor.id,
      zoneNumber: zone 
    },
    data: { currentSource: source }
  })

  return { zone, source, timestamp: new Date() }
}

async function recallScene(processor: any, sceneId: number): Promise<any> {
  console.log(`Recalling scene ${sceneId} on ${processor.ipAddress}`)
  
  // In a real implementation, this would send HTTP commands to the Atmosphere processor
  // The processor supports scene recall via its web API
  
  return { sceneId, timestamp: new Date() }
}

async function playMessage(processor: any, messageId: number, zones?: number[]): Promise<any> {
  const targetZones = zones || 'all'
  console.log(`Playing message ${messageId} to zones ${targetZones} on ${processor.ipAddress}`)
  
  return { messageId, zones: targetZones, timestamp: new Date() }
}

async function combineRooms(processor: any, zones: number[]): Promise<any> {
  console.log(`Combining zones ${zones.join(', ')} on ${processor.ipAddress}`)
  
  return { combinedZones: zones, timestamp: new Date() }
}
