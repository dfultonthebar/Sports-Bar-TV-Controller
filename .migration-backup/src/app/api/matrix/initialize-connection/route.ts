
import { NextResponse, NextRequest } from 'next/server'
import { and, asc, desc, eq, or } from 'drizzle-orm'
import { db, schema } from '@/db'
import { logger } from '@/lib/logger'
import { Socket } from 'net'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

/**
 * POST - Initialize Wolf Pack connection on app startup
 * This should be called when the application starts
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    logger.debug('Initializing Wolf Pack matrix connection...')

    // Get active matrix configuration
    const matrixConfig = await db.select()
      .from(schema.matrixConfigurations)
      .where(eq(schema.matrixConfigurations.isActive, true))
      .limit(1)
      .get()

    if (!matrixConfig) {
      logger.debug('No active matrix configuration found')
      return NextResponse.json({
        success: false,
        error: 'No active matrix configuration found'
      })
    }

    const { ipAddress, tcpPort, protocol } = matrixConfig
    const port = protocol === 'TCP' ? tcpPort : matrixConfig.udpPort

    logger.debug(`Testing connection to ${ipAddress}:${port} via ${protocol}...`)

    // Test connection
    const isConnected = await testConnection(ipAddress, port, protocol)

    if (isConnected) {
      logger.debug(`✓ Successfully connected to Wolf Pack matrix at ${ipAddress}:${port}`)
      
      // Trigger the connection manager to establish persistent connection
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/matrix/connection-manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect' })
      }).catch(err => logger.error('Error calling connection manager:', err))

      return NextResponse.json({
        success: true,
        message: `Connected to Wolf Pack matrix at ${ipAddress}:${port}`,
        config: { ipAddress, port, protocol }
      })
    } else {
      logger.debug(`✗ Failed to connect to Wolf Pack matrix at ${ipAddress}:${port}`)
      return NextResponse.json({
        success: false,
        error: `Unable to connect to Wolf Pack matrix at ${ipAddress}:${port}`
      })
    }
  } catch (error) {
    logger.error('Error initializing Wolf Pack connection:', error)
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
