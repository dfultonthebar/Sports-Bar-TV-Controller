
import { NextRequest, NextResponse } from 'next/server'
import { Socket } from 'net'
import dgram from 'dgram'
import { and, asc, desc, eq, or } from 'drizzle-orm'
import { db, schema } from '@/db'
import { logger } from '@/lib/logger'

// Global connection state
let connectionState = {
  isConnected: false,
  lastCheck: new Date(),
  config: null as any,
  socket: null as Socket | null,
  heartbeatInterval: null as NodeJS.Timeout | null
}

/**
 * GET - Get current connection status
 */
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      connected: connectionState.isConnected,
      lastCheck: connectionState.lastCheck,
      config: connectionState.config ? {
        ipAddress: connectionState.config.ipAddress,
        port: connectionState.config.protocol === 'TCP' ? connectionState.config.tcpPort : connectionState.config.udpPort,
        protocol: connectionState.config.protocol
      } : null
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 })
  }
}

/**
 * POST - Establish or refresh persistent connection
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const action = body.action || 'connect'

    if (action === 'disconnect') {
      // Disconnect and cleanup
      if (connectionState.heartbeatInterval) {
        clearInterval(connectionState.heartbeatInterval)
        connectionState.heartbeatInterval = null
      }
      if (connectionState.socket) {
        connectionState.socket.destroy()
        connectionState.socket = null
      }
      connectionState.isConnected = false
      connectionState.config = null

      return NextResponse.json({
        success: true,
        message: 'Disconnected from Wolf Pack matrix'
      })
    }

    // Get active matrix configuration
    const matrixConfig = await db.select()
      .from(schema.matrixConfigurations)
      .where(eq(schema.matrixConfigurations.isActive, true))
      .limit(1)
      .get()

    if (!matrixConfig) {
      return NextResponse.json({
        success: false,
        error: 'No active matrix configuration found'
      })
    }

    // Test connection
    const { ipAddress, tcpPort, udpPort, protocol } = matrixConfig
    const port = protocol === 'TCP' ? tcpPort : udpPort

    let connectionSuccess = false

    if (protocol === 'TCP') {
      connectionSuccess = await testTCPConnection(ipAddress, port)
    } else {
      connectionSuccess = await testUDPConnection(ipAddress, port)
    }

    if (connectionSuccess) {
      // Update connection state
      connectionState.isConnected = true
      connectionState.lastCheck = new Date()
      connectionState.config = matrixConfig

      // Setup heartbeat for TCP connections
      if (protocol === 'TCP') {
        setupHeartbeat(ipAddress, port)
      }

      return NextResponse.json({
        success: true,
        connected: true,
        message: `Connected to Wolf Pack matrix at ${ipAddress}:${port}`,
        config: {
          ipAddress,
          port,
          protocol
        }
      })
    } else {
      connectionState.isConnected = false
      return NextResponse.json({
        success: false,
        connected: false,
        error: `Unable to connect to Wolf Pack matrix at ${ipAddress}:${port}`
      })
    }
  } catch (error) {
    logger.error('Error in connection manager:', error)
    connectionState.isConnected = false
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 })
  }
}

/**
 * Test TCP connection
 */
async function testTCPConnection(ipAddress: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket()
    const timeout = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, 5000)

    socket.connect(port, ipAddress, () => {
      clearTimeout(timeout)
      socket.destroy()
      resolve(true)
    })

    socket.on('error', () => {
      clearTimeout(timeout)
      socket.destroy()
      resolve(false)
    })
  })
}

/**
 * Test UDP connection
 */
async function testUDPConnection(ipAddress: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4')
    const testMessage = '1?.'
    
    const timeout = setTimeout(() => {
      client.close()
      resolve(false)
    }, 5000)

    client.send(testMessage, port, ipAddress, (error) => {
      clearTimeout(timeout)
      client.close()
      if (error) {
        resolve(false)
      } else {
        resolve(true)
      }
    })
  })
}

/**
 * Setup heartbeat to maintain connection
 */
function setupHeartbeat(ipAddress: string, port: number) {
  // Clear existing heartbeat
  if (connectionState.heartbeatInterval) {
    clearInterval(connectionState.heartbeatInterval)
  }

  // Check connection every 30 seconds
  connectionState.heartbeatInterval = setInterval(async () => {
    const isConnected = await testTCPConnection(ipAddress, port)
    connectionState.isConnected = isConnected
    connectionState.lastCheck = new Date()

    if (!isConnected) {
      console.warn(`Lost connection to Wolf Pack matrix at ${ipAddress}:${port}`)
    }
  }, 30000)
}
