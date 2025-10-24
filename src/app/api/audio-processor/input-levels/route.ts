

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
import { getAtlasClient, releaseAtlasClient } from '@/lib/atlas-client-manager'
import { audioInputMeters, audioProcessors } from '@/db/schema'
import { prisma } from '@/db/prisma-adapter'

// Global map to track active subscriptions
const activeSubscriptions = new Map<string, Set<string>>()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const processorId = searchParams.get('processorId')

    if (!processorId) {
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }

    const inputMeters = await prisma.audioInputMeter.findMany({
      where: { processorId: processorId },
      orderBy: { inputNumber: 'asc' }
    })

    return NextResponse.json({ inputMeters })
  } catch (error) {
    console.error('Error fetching input meters:', error)
    return NextResponse.json(
      { error: 'Failed to fetch input meters' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { processorId, inputNumber, parameterName, inputName, warningThreshold, dangerThreshold } = data

    if (!processorId || inputNumber === undefined || !parameterName) {
      return NextResponse.json(
        { error: 'Processor ID, input number, and parameter name are required' },
        { status: 400 }
      )
    }

    // Get processor info
    const processor = await db.select().from(audioProcessors).where(eq(audioProcessors.id, processorId)).limit(1).get()

    if (!processor) {
      return NextResponse.json(
        { error: 'Audio processor not found' },
        { status: 404 }
      )
    }

    const inputMeter = await prisma.audioInputMeter.create({
      data: {
        processorId,
        inputNumber,
        parameterName,
        inputName: inputName || `Input ${inputNumber + 1}`,
        warningThreshold: warningThreshold || -12.0,
        dangerThreshold: dangerThreshold || -3.0,
        isActive: true
      }
    })

    // Start monitoring this input
    await startInputLevelMonitoring(processor, inputMeter)

    return NextResponse.json({ inputMeter })
  } catch (error) {
    console.error('Error creating input meter:', error)
    return NextResponse.json(
      { error: 'Failed to create input meter' },
      { status: 500 }
    )
  }
}

// Start monitoring input levels for a specific processor
async function startInputLevelMonitoring(processor: any, inputMeter: any) {
  const serverKey = `${processor.ipAddress}:${processor.port}`
  
  console.log(`Starting input level monitoring for ${inputMeter.parameterName} on ${processor.ipAddress}`)
  
  try {
    // Get the centralized Atlas client (this manages the UDP socket on port 3131)
    // NO duplicate UDP server creation - the AtlasTCPClient handles all UDP communication
    const atlasClient = await getAtlasClient(processor.id, {
      ipAddress: processor.ipAddress,
      tcpPort: processor.port || 5321,
      udpPort: processor.udpPort || 3131
    })
    
    // Register callback for meter updates (if not already registered)
    if (!activeSubscriptions.has(serverKey)) {
      atlasClient.addUpdateCallback(async (processorId, param, value, fullParams) => {
        // Handle meter updates for this processor
        await handleMeterUpdate(processorId, { param, val: value, ...fullParams })
      })
    }
    
    // Subscribe to meter updates using the Atlas client
    await atlasClient.subscribe(inputMeter.parameterName, 'val')
    
    // Track this subscription
    if (!activeSubscriptions.has(serverKey)) {
      activeSubscriptions.set(serverKey, new Set())
    }
    activeSubscriptions.get(serverKey)?.add(inputMeter.parameterName)
    
    console.log(`Successfully subscribed to ${inputMeter.parameterName}`)
    
  } catch (error) {
    console.error('Error setting up input level monitoring:', error)
    throw error
  }
}



// Handle meter update from UDP message
async function handleMeterUpdate(processorId: string, params: any) {
  try {
    // params format: { param: "SourceMeter_0", val: -25.5 }
    const paramName = params.param
    const levelValue = parseFloat(params.val)
    
    if (!paramName.startsWith('SourceMeter_')) {
      return // Not an input meter update
    }
    
    // Update the database with the new level
    await prisma.audioInputMeter.updateMany({
      where: {
        processorId: processorId,
        parameterName: paramName
      },
      data: {
        currentLevel: levelValue,
        peakLevel: {
          // Only update peak if this level is higher
          set: levelValue
        },
        levelPercent: Math.round(((levelValue + 80) / 80) * 100), // Convert dB to percentage
        lastUpdate: new Date()
      }
    })
    
    console.log(`Updated ${paramName}: ${levelValue}dB`)
    
  } catch (error) {
    console.error('Error handling meter update:', error)
  }
}

