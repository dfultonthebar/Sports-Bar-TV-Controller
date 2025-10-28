import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, desc, asc } from 'drizzle-orm'
import { findMany, create } from '@/lib/db-helpers'
import net from 'net'
import { globalCacheDevices, globalCachePorts } from '@/db/schema'

/**
 * GET /api/globalcache/devices
 * List all Global Cache devices
 */
export async function GET() {
  try {
    // Fetch all Global Cache devices
    const devices = await findMany('globalCacheDevices', {
      orderBy: desc(schema.globalCacheDevices.createdAt)
    })

    // Fetch all ports
    const allPorts = await findMany('globalCachePorts', {
      orderBy: asc(schema.globalCachePorts.portNumber)
    })

    // Combine devices with their ports
    const devicesWithPorts = devices.map(device => ({
      ...device,
      ports: allPorts.filter(port => port.deviceId === device.id)
    }))

    return NextResponse.json({
      success: true,
      devices: devicesWithPorts
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
    const existingDevice = await db.select()
      .from(globalCacheDevices)
      .where(eq(globalCacheDevices.ipAddress, ipAddress))
      .limit(1)
      .get()

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
    const device = await create('globalCacheDevices', {
      name,
      ipAddress,
      port,
      model: model || null,
      status: connectionTest.online ? 'online' : 'offline',
      lastSeen: connectionTest.online ? new Date().toISOString() : null
    })

    // Create default ports for the device
    const ports = []
    for (let i = 1; i <= 3; i++) {
      const createdPort = await create('globalCachePorts', {
        deviceId: device.id,
        portNumber: i,
        portType: 'IR',
        enabled: true
      })
      ports.push(createdPort)
    }

    const deviceWithPorts = {
      ...device,
      ports
    }

    console.log(`Global Cache device added: ${device.name} (${device.ipAddress})`)
    console.log(`Connection status: ${device.status}`)

    return NextResponse.json({
      success: true,
      device: deviceWithPorts,
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
