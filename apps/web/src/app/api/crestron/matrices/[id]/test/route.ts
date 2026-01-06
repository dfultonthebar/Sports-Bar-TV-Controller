import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { crestronMatrices } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import * as net from 'net'

// POST - Test connection to a Crestron matrix
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [matrix] = await db.select().from(crestronMatrices).where(eq(crestronMatrices.id, id))

    if (!matrix) {
      return NextResponse.json(
        { success: false, message: 'Matrix not found' },
        { status: 404 }
      )
    }

    logger.info(`[CRESTRON API] Testing connection to ${matrix.name} at ${matrix.ipAddress}:${matrix.port}`)

    // Test TCP connection
    const connectionResult = await testConnection(matrix.ipAddress, matrix.port)

    // Update status in database
    const now = new Date().toISOString()
    await db.update(crestronMatrices)
      .set({
        status: connectionResult.success ? 'online' : 'offline',
        lastSeen: connectionResult.success ? now : matrix.lastSeen,
        updatedAt: now
      })
      .where(eq(crestronMatrices.id, id))

    return NextResponse.json({
      success: connectionResult.success,
      message: connectionResult.message,
      deviceInfo: connectionResult.deviceInfo
    })
  } catch (error: any) {
    logger.error('[CRESTRON API] Connection test failed:', error)
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    )
  }
}

async function testConnection(
  ipAddress: string,
  port: number
): Promise<{ success: boolean; message: string; deviceInfo?: any }> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const timeout = 5000

    const timer = setTimeout(() => {
      socket.destroy()
      resolve({ success: false, message: 'Connection timeout' })
    }, timeout)

    socket.on('connect', () => {
      clearTimeout(timer)

      // Try to get version info
      let response = ''

      socket.on('data', (data) => {
        response += data.toString()
      })

      // Send VER command to get device info
      socket.write('VER\r\n')

      // Wait a bit for response
      setTimeout(() => {
        socket.destroy()
        resolve({
          success: true,
          message: 'Connection successful',
          deviceInfo: {
            response: response.trim() || 'Connected (no response data)'
          }
        })
      }, 1000)
    })

    socket.on('error', (error) => {
      clearTimeout(timer)
      resolve({ success: false, message: `Connection error: ${error.message}` })
    })

    socket.connect(port, ipAddress)
  })
}
