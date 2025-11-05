import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
// Converted to Drizzle ORM
import net from 'net'
import { globalCacheDevices } from '@/db/schema'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
/**
 * POST /api/globalcache/devices/[id]/test
 * Test connection to a Global Cache device
 */
export async function POST(
  request: NextRequest,
  {  params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Path parameter validation
  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error


  try {
    const { id } = params
    const device = await db.select().from(globalCacheDevices).where(eq(globalCacheDevices.id, id)).limit(1).get()

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    logger.info(`Testing connection to ${device.name} (${device.ipAddress}:${device.port})...`)

    const result = await testDeviceConnection(device.ipAddress, device.port)

    // Update device status
    await db.update(globalCacheDevices).set({
        status: result.online ? 'online' : 'offline',
        lastSeen: result.online ? new Date().toISOString() : device.lastSeen
      }).where(eq(globalCacheDevices.id, id)).returning().get()

    logger.info(`Connection test result: ${result.online ? 'ONLINE' : 'OFFLINE'}`)
    if (result.deviceInfo) {
      logger.info(`Device info: ${result.deviceInfo}`)
    }

    return NextResponse.json({
      success: true,
      online: result.online,
      deviceInfo: result.deviceInfo,
      error: result.error
    })
  } catch (error) {
    logger.error('Error testing device connection:', error)
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
      logger.info(`Connected to ${ipAddress}:${port}`)
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
        logger.error(`Connection error to ${ipAddress}:${port}:`, { data: error.message })
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
