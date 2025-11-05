import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { irCommands, irDevices, globalCacheDevices } from '@/db/schema'
import net from 'net'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
/**
 * POST /api/ir/commands/send
 * Send an IR command via Global Cache device
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error
  const body = bodyValidation.data


  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('📤 [IR SEND] Sending IR command')
  logger.info('   Timestamp:', new Date().toISOString())
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const { deviceId, commandId } = body

    if (!deviceId || !commandId) {
      logger.info('❌ [IR SEND] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'Device ID and Command ID are required' },
        { status: 400 }
      )
    }

    logger.info('   Device ID:', deviceId)
    logger.info('   Command ID:', commandId)

    // Get the command
    const command = await db.select()
      .from(irCommands)
      .where(eq(irCommands.id, commandId))
      .limit(1)
      .get()

    if (!command) {
      logger.info('❌ [IR SEND] Command not found')
      return NextResponse.json(
        { success: false, error: 'Command not found' },
        { status: 404 }
      )
    }

    logger.info('   Function Name:', command.functionName)
    logger.info('   IR Code length:', command.irCode.length)

    // Get the IR device
    const device = await db.select()
      .from(irDevices)
      .where(eq(irDevices.id, deviceId))
      .limit(1)
      .get()

    if (!device) {
      logger.info('❌ [IR SEND] Device not found')
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    if (!device.globalCacheDeviceId) {
      logger.info('❌ [IR SEND] Device not configured with Global Cache')
      return NextResponse.json(
        { success: false, error: 'Device is not configured with a Global Cache device' },
        { status: 400 }
      )
    }

    // Get the Global Cache device
    const globalCacheDevice = await db.select()
      .from(globalCacheDevices)
      .where(eq(globalCacheDevices.id, device.globalCacheDeviceId))
      .limit(1)
      .get()

    if (!globalCacheDevice) {
      logger.info('❌ [IR SEND] Global Cache device not found')
      return NextResponse.json(
        { success: false, error: 'Global Cache device not found' },
        { status: 404 }
      )
    }

    logger.info('📡 [IR SEND] Global Cache device found')
    logger.info('   Name:', globalCacheDevice.name)
    logger.info('   IP:', globalCacheDevice.ipAddress)
    logger.info('   Port:', globalCacheDevice.port)

    // Send the IR command
    const result = await sendIRCommand(
      globalCacheDevice.ipAddress,
      globalCacheDevice.port,
      command.irCode
    )

    if (result.success) {
      logger.info('✅ [IR SEND] Command sent successfully')
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      return NextResponse.json({
        success: true,
        message: 'Command sent successfully'
      })
    } else {
      logger.info('❌ [IR SEND] Failed to send command')
      logger.info('   Error:', result.error)
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }
  } catch (error) {
    logger.error('❌ [IR SEND] Error sending command:', error)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send command' 
      },
      { status: 500 }
    )
  }
}

/**
 * Send IR command to Global Cache device
 */
async function sendIRCommand(
  ipAddress: string,
  port: number,
  irCode: string,
  timeout: number = 5000
): Promise<{
  success: boolean
  error?: string
}> {
  return new Promise((resolve) => {
    const client = new net.Socket()
    let resolved = false

    logger.info('🔌 [IR SEND] Connecting to Global Cache device...')
    logger.info('   Address:', `${ipAddress}:${port}`)

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        client.destroy()
        logger.info('⏱️  [IR SEND] Connection timeout')
        resolve({
          success: false,
          error: 'Connection timeout'
        })
      }
    }, timeout)

    client.on('connect', () => {
      logger.info('✅ [IR SEND] Connected to Global Cache device')
      logger.info('📤 [IR SEND] Sending IR command:', irCode.substring(0, 50) + '...')
      
      // Send the IR command
      client.write(irCode + '\r')
    })

    client.on('data', (data) => {
      const response = data.toString()
      logger.info('📥 [IR SEND] Received response:', response.trim())

      // Check for successful completion
      if (response.includes('completeir') || response.includes('busyIR')) {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutId)
          client.destroy()
          logger.info('✅ [IR SEND] Command sent successfully')
          resolve({
            success: true
          })
        }
      }

      // Check for error
      if (response.includes('ERR')) {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutId)
          client.destroy()
          logger.info('❌ [IR SEND] Error response:', response.trim())
          resolve({
            success: false,
            error: 'Global Cache returned an error: ' + response.trim()
          })
        }
      }
    })

    client.on('error', (error) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        logger.error('❌ [IR SEND] Socket error:', error.message)
        resolve({
          success: false,
          error: `Connection error: ${error.message}`
        })
      }
    })

    client.on('close', () => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        logger.info('🔌 [IR SEND] Connection closed')
        resolve({
          success: true
        })
      }
    })

    try {
      client.connect(port, ipAddress)
    } catch (error) {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        logger.error('❌ [IR SEND] Connection failed:', error)
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Connection failed'
        })
      }
    }
  })
}
