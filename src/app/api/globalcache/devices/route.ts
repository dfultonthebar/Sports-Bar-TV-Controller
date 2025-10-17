import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import net from 'net'

/**
 * GET /api/globalcache/devices
 * List all Global Cache devices
 */
export async function GET() {
  try {
    const devices = await prisma.globalCacheDevice.findMany({
      include: {
        ports: {
          orderBy: {
            portNumber: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      devices
    })
  } catch (error) {
    console.error('Error fetching Global Cache devices:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch devices' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/globalcache/devices
 * Add a new Global Cache device
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, ipAddress, port = 4998, model } = body

    // Validate required fields
    if (!name || !ipAddress) {
      return NextResponse.json(
        { success: false, error: 'Name and IP address are required' },
        { status: 400 }
      )
    }

    // Validate IP address format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipRegex.test(ipAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid IP address format' },
        { status: 400 }
      )
    }

    // Check if device with this IP already exists
    const existingDevice = await prisma.globalCacheDevice.findUnique({
      where: { ipAddress }
    })

    if (existingDevice) {
      return NextResponse.json(
        { success: false, error: 'Device with this IP address already exists' },
        { status: 409 }
      )
    }

    // Test connection to device
    console.log(`Testing connection to ${ipAddress}:${port}...`)
    const connectionTest = await testDeviceConnection(ipAddress, port)
    
    // Create device in database
    const device = await prisma.globalCacheDevice.create({
      data: {
        name,
        ipAddress,
        port,
        model: model || null,
        status: connectionTest.online ? 'online' : 'offline',
        lastSeen: connectionTest.online ? new Date() : null,
        ports: {
          create: [
            { portNumber: 1, portType: 'IR', enabled: true },
            { portNumber: 2, portType: 'IR', enabled: true },
            { portNumber: 3, portType: 'IR', enabled: true }
          ]
        }
      },
      include: {
        ports: true
      }
    })

    console.log(`Global Cache device added: ${device.name} (${device.ipAddress})`)
    console.log(`Connection status: ${device.status}`)

    return NextResponse.json({
      success: true,
      device,
      connectionTest
    })
  } catch (error) {
    console.error('Error adding Global Cache device:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to add device' 
      },
      { status: 500 }
    )
  }
}

/**
 * Test connection to Global Cache device
 */
async function testDeviceConnection(
  ipAddress: string, 
  port: number, 
  timeout: number = 5000
): Promise<{ online: boolean; deviceInfo?: string; error?: string }> {
  return new Promise((resolve) => {
    const client = new net.Socket()
    let deviceInfo = ''
    let resolved = false

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        client.destroy()
        resolve({ 
          online: false, 
          error: 'Connection timeout' 
        })
      }
    }, timeout)

    client.on('connect', () => {
      console.log(`Connected to ${ipAddress}:${port}`)
      // Send getdevices command to get device info
      client.write('getdevices\r\n')
    })

    client.on('data', (data) => {
      deviceInfo += data.toString()
      
      // If we got a response, consider it online
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        client.destroy()
        resolve({ 
          online: true, 
          deviceInfo: deviceInfo.trim() 
        })
      }
    })

    client.on('error', (error) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        console.error(`Connection error to ${ipAddress}:${port}:`, error.message)
        resolve({ 
          online: false, 
          error: error.message 
        })
      }
    })

    client.on('close', () => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        resolve({ 
          online: deviceInfo.length > 0, 
          deviceInfo: deviceInfo.trim() || undefined 
        })
      }
    })

    try {
      client.connect(port, ipAddress)
    } catch (error) {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        resolve({ 
          online: false, 
          error: error instanceof Error ? error.message : 'Connection failed' 
        })
      }
    }
  })
}
