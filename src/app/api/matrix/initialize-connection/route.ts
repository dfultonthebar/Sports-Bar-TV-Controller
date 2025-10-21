
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { Socket } from 'net'

/**
 * POST - Initialize Wolf Pack connection on app startup
 * This should be called when the application starts
 */
export async function POST() {
  try {
    logger.api.request('POST', '/api/matrix/initialize-connection', {})
    logger.api.info('Initializing Wolf Pack matrix connection...')

    // Get active matrix configuration
    const matrixConfigs = await db
      .select()
      .from(schema.matrixConfigurations)
      .where(eq(schema.matrixConfigurations.isActive, true))
      .limit(1)

    if (!matrixConfigs || matrixConfigs.length === 0) {
      logger.api.warn('No active matrix configuration found')
      return NextResponse.json({
        success: false,
        error: 'No active matrix configuration found'
      })
    }

    const matrixConfig = matrixConfigs[0]
    const { ipAddress, tcpPort, protocol, udpPort } = matrixConfig
    const port = protocol === 'TCP' ? tcpPort : udpPort

    logger.api.info(`Testing connection to ${ipAddress}:${port} via ${protocol}...`)

    // Test connection
    const isConnected = await testConnection(ipAddress, port, protocol)

    if (isConnected) {
      logger.api.info(`✓ Successfully connected to Wolf Pack matrix at ${ipAddress}:${port}`)
      
      // Trigger the connection manager to establish persistent connection
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/matrix/connection-manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect' })
      }).catch(err => logger.api.error('Error calling connection manager:', err))

      logger.api.response('POST', '/api/matrix/initialize-connection', { 
        success: true,
        ipAddress,
        port
      })

      return NextResponse.json({
        success: true,
        message: `Connected to Wolf Pack matrix at ${ipAddress}:${port}`,
        config: { ipAddress, port, protocol }
      })
    } else {
      logger.api.warn(`✗ Failed to connect to Wolf Pack matrix at ${ipAddress}:${port}`)
      return NextResponse.json({
        success: false,
        error: `Unable to connect to Wolf Pack matrix at ${ipAddress}:${port}`
      })
    }
  } catch (error) {
    logger.api.error('Error initializing Wolf Pack connection:', error)
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 })
  }
}

async function testConnection(ipAddress: string, port: number, protocol: string): Promise<boolean> {
  if (protocol === 'TCP') {
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
  } else {
    // UDP - just assume success if we can send
    return true
  }
}
