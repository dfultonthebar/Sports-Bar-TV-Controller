import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { update } from '@/lib/db-helpers'
import net from 'net'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'

// Use schema references for tables
const { globalCacheDevices, irDevices } = schema
/**
 * POST /api/ir/learn
 * Start IR learning session for a specific command
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('🎓 [IR LEARN API] Starting IR learning session')
  logger.info('   Timestamp:', { data: new Date().toISOString() })
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const { deviceId, globalCacheDeviceId, commandId, functionName } = bodyValidation.data

    if (!deviceId || !globalCacheDeviceId || !commandId || !functionName) {
      logger.info('❌ [IR LEARN API] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'Device ID, Global Cache Device ID, Command ID, and Function Name are required' },
        { status: 400 }
      )
    }

    logger.info('   Device ID:', deviceId)
    logger.info('   Global Cache Device ID:', globalCacheDeviceId)
    logger.info('   Command ID:', commandId)
    logger.info('   Function Name:', functionName)

    // Get Global Cache device
    const globalCacheDevice = await db.select()
      .from(globalCacheDevices)
      .where(eq(globalCacheDevices.id, globalCacheDeviceId as string))
      .limit(1)
      .get()

    if (!globalCacheDevice) {
      logger.info('❌ [IR LEARN API] Global Cache device not found')
      return NextResponse.json(
        { success: false, error: 'Global Cache device not found' },
        { status: 404 }
      )
    }

    logger.info('📡 [IR LEARN API] Global Cache device found')
    logger.info('   Name:', { data: globalCacheDevice.name })
    logger.info('   IP:', { data: globalCacheDevice.ipAddress })
    logger.info('   Port:', { data: globalCacheDevice.port })

    // Get the IR device to find the configured emitter port
    const irDevice = await db.select()
      .from(irDevices)
      .where(eq(irDevices.id, deviceId as string))
      .limit(1)
      .get()

    if (!irDevice) {
      logger.info('❌ [IR LEARN API] IR device not found')
      return NextResponse.json(
        { success: false, error: 'IR device not found' },
        { status: 404 }
      )
    }

    const emitterPort = irDevice.globalCachePortNumber || 1
    logger.info('   Emitter Port:', { data: emitterPort })

    // Start learning session
    const result = await startLearningSession(
      globalCacheDevice.ipAddress,
      globalCacheDevice.port
    )

    if (result.success && result.learnedCode) {
      logger.info('✅ [IR LEARN API] IR code learned successfully')
      logger.info('   Code length:', { data: result.learnedCode.length })

      // Fix the port in the learned code to match the configured emitter port
      // The IR learner reports the code with its own port (e.g., 2:1), but we need
      // to send to the emitter port (e.g., 1:1, 1:2, 1:3)
      let fixedCode = result.learnedCode
      const portMatch = result.learnedCode.match(/^sendir,(\d+):(\d+),/)
      if (portMatch) {
        const originalPort = `${portMatch[1]}:${portMatch[2]}`
        const targetPort = `1:${emitterPort}`
        fixedCode = result.learnedCode.replace(`sendir,${originalPort},`, `sendir,${targetPort},`)
        logger.info('   Port fix: ' + originalPort + ' -> ' + targetPort)
      }

      // Update the command with the fixed IR code
      const updatedCommand = await update(
        'irCommands',
        eq(schema.irCommands.id, commandId as string),
        {
          irCode: fixedCode,
          updatedAt: new Date().toISOString()
        }
      )

      logger.info('✅ [IR LEARN API] Command updated with learned code')
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      return NextResponse.json({
        success: true,
        status: 'IR code learned and saved successfully',
        learnedCode: result.learnedCode,
        command: updatedCommand
      })
    } else {
      logger.info('❌ [IR LEARN API] Failed to learn IR code')
      logger.info('   Error:', { data: result.error })
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      return NextResponse.json(
        { success: false, error: result.error || 'Failed to learn IR code' },
        { status: 500 }
      )
    }
  } catch (error) {
    logger.error('❌ [IR LEARN API] Error in learning API:', error)
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
    const MAX_BUFFER_SIZE = 64 * 1024 // 64KB max

    logger.info('🔌 [IR LEARN] Connecting to Global Cache device...')
    logger.info('   Address:', { data: `${ipAddress}:${port}` })

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        client.destroy()
        logger.info('⏱️  [IR LEARN] Learning session timeout')
        resolve({
          success: false,
          error: 'Learning timeout - no IR code received within 60 seconds. Please try again and press the remote button within 60 seconds.'
        })
      }
    }, timeout)

    client.on('connect', () => {
      logger.info('✅ [IR LEARN] Connected to Global Cache device')
      logger.info('📤 [IR LEARN] Sending get_IRL command')
      
      // Send get_IRL command to enable learning mode
      client.write('get_IRL\r')
    })

    client.on('data', (data) => {
      const response = data.toString()
      dataBuffer += response

      // Prevent unbounded buffer growth
      if (dataBuffer.length > MAX_BUFFER_SIZE) {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutId)
          logger.error('[IR-LEARN] Buffer overflow - exceeded 64KB limit')
          client.destroy()
          resolve({
            success: false,
            error: 'IR code too large or malformed data received'
          })
          return
        }
      }

      logger.info('📥 [IR LEARN] Received data:', { data: response.trim() })

      // Check for "IR Learner Enabled" response
      if (response.includes('IR Learner Enabled')) {
        learningEnabled = true
        logger.info('✅ [IR LEARN] IR Learner enabled - waiting for IR code...')
        logger.info('👉 [IR LEARN] Point your remote at the Global Cache device and press a button')
        return
      }

      // Check for "IR Learner Unavailable" response
      if (response.includes('IR Learner Unavailable')) {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutId)
          client.destroy()
          logger.info('❌ [IR LEARN] IR Learner unavailable')
          resolve({
            success: false,
            error: 'IR Learner unavailable - device may be configured for LED lighting or another mode'
          })
        }
        return
      }

      // Check if we received a learned IR code (starts with "sendir")
      if (learningEnabled && response.includes('sendir')) {
        // Only process complete lines (ending with \r)
        const lines = dataBuffer.split('\r')

        // Process all complete lines (all except last which might be incomplete)
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim()

          if (line.startsWith('sendir,')) {
            // Validate this is a COMPLETE IR code:
            // - Must end with a number (not a comma)
            // - Must have at least 6 comma-separated segments (valid IR code structure)
            const endsWithNumber = /,\d{3,}$/.test(line)  // At least 3 digits for final timing value
            const segmentCount = line.split(',').length

            if (endsWithNumber && segmentCount >= 6) {
              // Successfully captured COMPLETE IR code!
              if (!resolved) {
                resolved = true
                clearTimeout(timeoutId)

                logger.info('🎉 [IR LEARN] COMPLETE IR code learned successfully!')
                logger.info(`   Code length: ${line.length} characters`)
                logger.info(`   Segments: ${segmentCount}`)
                logger.info('   Code preview:', { data: line.substring(0, 100) + '...' })
                logger.info('   Code ending:', { data: line.slice(-50) })

                // Automatically stop learning
                client.write('stop_IRL\r')

                // Give it a moment to process stop command, then close
                setTimeout(() => {
                  client.destroy()
                }, 500)

                resolve({
                  success: true,
                  status: 'IR code learned successfully',
                  learnedCode: line
                })
              }
              break
            } else {
              logger.info(`⏳ [IR LEARN] Received incomplete IR code (${segmentCount} segments, ends: ${line.slice(-20)}), waiting for more data...`)
            }
          }
        }
      }
    })

    client.on('error', (error) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        logger.error('❌ [IR LEARN] Socket error:', { data: error.message })
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
        logger.info('🔌 [IR LEARN] Connection closed')
        
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
        logger.error('❌ [IR LEARN] Connection failed:', error)
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Connection failed'
        })
      }
    }
  })
}
