import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
// Converted to Drizzle ORM
import net from 'net'
import { globalCacheDevices } from '@/db/schema'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
/**
 * POST /api/globalcache/learn
 * Start IR learning on a Global Cache device
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  try {
    const { deviceId } = bodyValidation.data

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('🎓 [GLOBAL CACHE] Starting IR learning')
    logger.info('   Device ID:', deviceId)
    logger.info('   Timestamp:', { data: new Date().toISOString() })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Validate required fields
    if (!deviceId) {
      logger.info('❌ [GLOBAL CACHE] Error: Device ID is required')
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      return NextResponse.json(
        { success: false, error: 'Device ID is required' },
        { status: 400 }
      )
    }

    // Get device from database
    const device = await db.select().from(globalCacheDevices).where(eq(globalCacheDevices.id, deviceId as string)).limit(1).get()

    if (!device) {
      logger.info('❌ [GLOBAL CACHE] Error: Device not found')
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    logger.info('📡 [GLOBAL CACHE] Device found')
    logger.info('   Name:', { data: device.name })
    logger.info('   IP:', { data: device.ipAddress })
    logger.info('   Port:', { data: device.port })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Start learning session
    const result = await startLearningSession(device.ipAddress, device.port)

    if (result.success) {
      logger.info('✅ [GLOBAL CACHE] Learning session started successfully')
      logger.info('   Status:', { data: result.status })
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    } else {
      logger.info('❌ [GLOBAL CACHE] Failed to start learning session')
      logger.info('   Error:', { data: result.error })
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    }

    return NextResponse.json(result)
  } catch (error) {
    logger.error('❌ [GLOBAL CACHE] Error in learning API:', error)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to start learning' 
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/globalcache/learn
 * Stop IR learning on a Global Cache device
 */
export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  try {
    const { deviceId } = bodyValidation.data

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('🛑 [GLOBAL CACHE] Stopping IR learning')
    logger.info('   Device ID:', deviceId)
    logger.info('   Timestamp:', { data: new Date().toISOString() })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Validate required fields
    if (!deviceId) {
      logger.info('❌ [GLOBAL CACHE] Error: Device ID is required')
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      return NextResponse.json(
        { success: false, error: 'Device ID is required' },
        { status: 400 }
      )
    }

    // Get device from database
    const device = await db.select().from(globalCacheDevices).where(eq(globalCacheDevices.id, deviceId as string)).limit(1).get()

    if (!device) {
      logger.info('❌ [GLOBAL CACHE] Error: Device not found')
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    logger.info('📡 [GLOBAL CACHE] Device found')
    logger.info('   Name:', { data: device.name })
    logger.info('   IP:', { data: device.ipAddress })
    logger.info('   Port:', { data: device.port })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Stop learning session
    const result = await stopLearningSession(device.ipAddress, device.port)

    if (result.success) {
      logger.info('✅ [GLOBAL CACHE] Learning session stopped successfully')
      logger.info('   Status:', { data: result.status })
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    } else {
      logger.info('❌ [GLOBAL CACHE] Failed to stop learning session')
      logger.info('   Error:', { data: result.error })
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    }

    return NextResponse.json(result)
  } catch (error) {
    logger.error('❌ [GLOBAL CACHE] Error stopping learning:', error)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to stop learning' 
      },
      { status: 500 }
    )
  }
}

/**
 * Start IR learning session on Global Cache device
 */
async function startLearningSession(
  ipAddress: string,
  port: number,
  timeout: number = 60000 // 60 seconds timeout for learning
): Promise<{
  success: boolean
  status?: string
  learnedCode?: string
  error?: string
}> {
  return new Promise((resolve) => {
    const client = new net.Socket()
    let dataBuffer = ''
    let resolved = false
    let learningEnabled = false

    logger.info('🔌 [GLOBAL CACHE] Connecting to device...')
    logger.info('   Address:', { data: `${ipAddress}:${port}` })

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        client.destroy()
        logger.info('⏱️  [GLOBAL CACHE] Learning session timeout')
        resolve({
          success: false,
          error: 'Learning session timeout - no IR code received within 60 seconds'
        })
      }
    }, timeout)

    client.on('connect', () => {
      logger.info('✅ [GLOBAL CACHE] Connected to device')
      logger.info('📤 [GLOBAL CACHE] Sending get_IRL command')
      
      // Send get_IRL command to enable learning mode
      client.write('get_IRL\r')
    })

    client.on('data', (data) => {
      const response = data.toString()
      dataBuffer += response
      
      logger.info('📥 [GLOBAL CACHE] Received data:', { data: response.trim() })

      // Check for "IR Learner Enabled" response
      if (response.includes('IR Learner Enabled')) {
        learningEnabled = true
        logger.info('✅ [GLOBAL CACHE] IR Learner enabled - waiting for IR code...')
        logger.info('👉 [GLOBAL CACHE] Point your remote at the Global Cache device and press a button')
        return
      }

      // Check for "IR Learner Unavailable" response (LED lighting configured)
      if (response.includes('IR Learner Unavailable')) {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutId)
          client.destroy()
          logger.info('❌ [GLOBAL CACHE] IR Learner unavailable (device may be configured for LED lighting)')
          resolve({
            success: false,
            error: 'IR Learner unavailable - device may be configured for LED lighting'
          })
        }
        return
      }

      // Check if we received a learned IR code (starts with "sendir")
      if (learningEnabled && response.includes('sendir')) {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutId)
          
          // Extract the IR code
          const lines = dataBuffer.split('\r')
          const irCodeLine = lines.find(line => line.trim().startsWith('sendir'))
          
          if (irCodeLine) {
            const learnedCode = irCodeLine.trim()
            logger.info('🎉 [GLOBAL CACHE] IR code learned successfully!')
            logger.info(`   Code length: ${learnedCode.length} characters`)
            logger.info('   Code preview:', { data: learnedCode.substring(0, 100) + '...' })
            
            // Automatically stop learning
            client.write('stop_IRL\r')
            
            // Give it a moment to process stop command, then close
            setTimeout(() => {
              client.destroy()
            }, 500)
            
            resolve({
              success: true,
              status: 'IR code learned successfully',
              learnedCode
            })
          }
        }
      }
    })

    client.on('error', (error) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        logger.error('❌ [GLOBAL CACHE] Socket error:', { data: error.message })
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
        logger.info('🔌 [GLOBAL CACHE] Connection closed')
        
        if (learningEnabled) {
          resolve({
            success: false,
            error: 'Connection closed before IR code was received'
          })
        } else {
          resolve({
            success: false,
            error: 'Failed to enable IR learning mode'
          })
        }
      }
    })

    try {
      client.connect(port, ipAddress)
    } catch (error) {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        logger.error('❌ [GLOBAL CACHE] Connection failed:', error)
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Connection failed'
        })
      }
    }
  })
}

/**
 * Stop IR learning session on Global Cache device
 */
async function stopLearningSession(
  ipAddress: string,
  port: number,
  timeout: number = 5000
): Promise<{
  success: boolean
  status?: string
  error?: string
}> {
  return new Promise((resolve) => {
    const client = new net.Socket()
    let dataBuffer = ''
    let resolved = false

    logger.info('🔌 [GLOBAL CACHE] Connecting to device to stop learning...')

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        client.destroy()
        logger.info('⏱️  [GLOBAL CACHE] Stop learning timeout')
        resolve({
          success: false,
          error: 'Connection timeout'
        })
      }
    }, timeout)

    client.on('connect', () => {
      logger.info('✅ [GLOBAL CACHE] Connected to device')
      logger.info('📤 [GLOBAL CACHE] Sending stop_IRL command')
      
      // Send stop_IRL command to disable learning mode
      client.write('stop_IRL\r')
    })

    client.on('data', (data) => {
      const response = data.toString()
      dataBuffer += response
      
      logger.info('📥 [GLOBAL CACHE] Received data:', { data: response.trim() })

      // Check for "IR Learner Disabled" response
      if (response.includes('IR Learner Disabled')) {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutId)
          logger.info('✅ [GLOBAL CACHE] IR Learner disabled successfully')
          
          // Close connection
          setTimeout(() => {
            client.destroy()
          }, 100)
          
          resolve({
            success: true,
            status: 'IR Learner disabled'
          })
        }
      }
    })

    client.on('error', (error) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        logger.error('❌ [GLOBAL CACHE] Socket error:', { data: error.message })
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
        logger.info('🔌 [GLOBAL CACHE] Connection closed')
        resolve({
          success: true,
          status: 'Connection closed (learning likely stopped)'
        })
      }
    })

    try {
      client.connect(port, ipAddress)
    } catch (error) {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        logger.error('❌ [GLOBAL CACHE] Connection failed:', error)
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Connection failed'
        })
      }
    }
  })
}
