import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import net from 'net'

/**
 * POST /api/globalcache/devices/[id]/test
 * Test connection to a Global Cache device
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const device = await prisma.globalCacheDevice.findUnique({
      where: { id: params.id }
    })

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    console.log(`Testing connection to ${device.name} (${device.ipAddress}:${device.port})...`)

    const result = await testDeviceConnection(device.ipAddress, device.port)

    // Update device status
    await prisma.globalCacheDevice.update({
      where: { id: params.id },
      data: {
        status: result.online ? 'online' : 'offline',
        lastSeen: result.online ? new Date() : device.lastSeen
      }
    })

    console.log(`Connection test result: ${result.online ? 'ONLINE' : 'OFFLINE'}`)
    if (result.deviceInfo) {
      console.log(`Device info: ${result.deviceInfo}`)
    }

    return NextResponse.json({
      success: true,
      online: result.online,
      deviceInfo: result.deviceInfo,
      error: result.error
    })
  } catch (error) {
    console.error('Error testing device connection:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to test connection' },
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
