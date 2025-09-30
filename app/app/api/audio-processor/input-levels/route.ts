

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import * as dgram from 'dgram'
import * as net from 'net'

// Global maps to track active UDP servers and subscriptions
const activeUdpServers = new Map<string, dgram.Socket>()
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
    const processor = await prisma.audioProcessor.findUnique({
      where: { id: processorId }
    })

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
    // Set up UDP listener for meter updates (port 3131)
    let udpServer = activeUdpServers.get(serverKey)
    
    if (!udpServer) {
      udpServer = dgram.createSocket('udp4')
      activeUdpServers.set(serverKey, udpServer)
      
      udpServer.on('message', async (msg, rinfo) => {
        try {
          const data = JSON.parse(msg.toString())
          if (data.method === 'set' && data.params) {
            await handleMeterUpdate(processor.id, data.params)
          }
        } catch (error) {
          console.error('Error parsing UDP meter message:', error)
        }
      })
      
      udpServer.on('error', (error) => {
        console.error(`UDP server error for ${serverKey}:`, error)
      })
      
      udpServer.bind(3131) // Listen on UDP port 3131 for meter updates
    }
    
    // Subscribe to meter updates via TCP (port 5321)
    await subscribeToMeterUpdates(processor, inputMeter.parameterName)
    
  } catch (error) {
    console.error('Error setting up input level monitoring:', error)
    throw error
  }
}

// Subscribe to meter updates via TCP
async function subscribeToMeterUpdates(processor: any, parameterName: string) {
  return new Promise<void>((resolve, reject) => {
    const client = new net.Socket()
    const serverKey = `${processor.ipAddress}:${processor.port}`
    
    client.connect(5321, processor.ipAddress, () => {
      console.log(`Connected to processor ${processor.ipAddress} for meter subscription`)
      
      // Subscribe to the specific input meter
      const subscribeCommand = {
        jsonrpc: "2.0",
        method: "sub",
        params: {
          param: parameterName,
          fmt: "val" // Get dB values
        }
      }
      
      client.write(JSON.stringify(subscribeCommand) + '\n')
      
      // Track this subscription
      if (!activeSubscriptions.has(serverKey)) {
        activeSubscriptions.set(serverKey, new Set())
      }
      activeSubscriptions.get(serverKey)?.add(parameterName)
      
      // Set up keep-alive (every 4 minutes to be safe)
      const keepAliveInterval = setInterval(() => {
        const keepAliveCommand = {
          jsonrpc: "2.0",
          method: "get",
          params: {
            param: "KeepAlive",
            fmt: "str"
          }
        }
        client.write(JSON.stringify(keepAliveCommand) + '\n')
      }, 240000) // 4 minutes
      
      // Clean up on disconnect
      client.on('close', () => {
        console.log(`TCP connection closed for ${serverKey}`)
        clearInterval(keepAliveInterval)
        activeSubscriptions.delete(serverKey)
      })
      
      client.on('error', (error) => {
        console.error(`TCP connection error for ${serverKey}:`, error)
        clearInterval(keepAliveInterval)
        reject(error)
      })
      
      resolve()
    })
    
    client.on('error', (error) => {
      console.error(`Failed to connect to processor ${processor.ipAddress}:`, error)
      reject(error)
    })
  })
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

