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
 * Start IR learning session with streaming status updates.
 * Returns a text/event-stream so the frontend gets real-time feedback:
 *   {"status":"connecting"}
 *   {"status":"ready"}        ← learner enabled, user should press button NOW
 *   {"status":"captured","learnedCode":"sendir,..."}
 *   {"status":"error","error":"..."}
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { deviceId, globalCacheDeviceId, commandId, functionName } = bodyValidation.data

  if (!deviceId || !globalCacheDeviceId || !commandId || !functionName) {
    return NextResponse.json(
      { success: false, error: 'Device ID, Global Cache Device ID, Command ID, and Function Name are required' },
      { status: 400 }
    )
  }

  // Pre-validate devices before starting the stream
  const globalCacheDevice = await db.select()
    .from(globalCacheDevices)
    .where(eq(globalCacheDevices.id, globalCacheDeviceId as string))
    .limit(1)
    .get()

  if (!globalCacheDevice) {
    return NextResponse.json({ success: false, error: 'Global Cache device not found' }, { status: 404 })
  }

  const irDevice = await db.select()
    .from(irDevices)
    .where(eq(irDevices.id, deviceId as string))
    .limit(1)
    .get()

  if (!irDevice) {
    return NextResponse.json({ success: false, error: 'IR device not found' }, { status: 404 })
  }

  const emitterPort = irDevice.globalCachePortNumber || 1

  logger.info('[IR LEARN] Starting streaming learn session for ' + functionName)

  // Return a streaming response
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      let closed = false
      const send = (data: Record<string, unknown>) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }
      const close = () => {
        if (closed) return
        closed = true
        try { controller.close() } catch {}
      }

      send({ status: 'connecting' })

      startLearningSessionStreaming(
        globalCacheDevice.ipAddress,
        globalCacheDevice.port,
        // onReady callback
        () => { send({ status: 'ready' }) },
        // onComplete callback
        async (result) => {
          try {
            if (result.success && result.learnedCode) {
              // Fix port
              let fixedCode = result.learnedCode
              const portMatch = fixedCode.match(/^sendir,(\d+):(\d+),/)
              if (portMatch) {
                const targetPort = `1:${emitterPort}`
                fixedCode = fixedCode.replace(`sendir,${portMatch[1]}:${portMatch[2]},`, `sendir,${targetPort},`)
              }

              // Trim excess repeats
              fixedCode = trimIRCodeRepeats(fixedCode)

              // Save to DB
              await update(
                'irCommands',
                eq(schema.irCommands.id, commandId as string),
                { irCode: fixedCode, updatedAt: new Date().toISOString() }
              )

              logger.info('[IR LEARN] Code saved: ' + fixedCode.length + ' chars')
              send({ status: 'captured', learnedCode: fixedCode })
            } else {
              send({ status: 'error', error: result.error || 'Failed to learn IR code' })
            }
          } catch (err) {
            logger.error('[IR LEARN] Error in onComplete:', err)
            send({ status: 'error', error: 'Failed to save learned code' })
          }
          close()
        }
      )
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

/**
 * Clean and trim a learned IR code for reliable iTach playback.
 *
 * Issues this fixes:
 * 1. Excess repeats: The learner captures every repetition when the user holds
 *    the button (3-4 bursts). The iTach has a 96 on/off pair limit.
 * 2. Garbage gap pairs: The learner sometimes inserts tiny mark values (e.g., 1,305)
 *    between bursts. These are timing artifacts, not real IR data, and cause ERR_1:1,008.
 *
 * Strategy: detect burst boundaries (lead-in pairs with mark+space > 150),
 * remove garbage inter-burst pairs, keep at most 3 bursts, and ensure the
 * trailing gap is long enough.
 */
function trimIRCodeRepeats(code: string): string {
  const parts = code.split(',')
  // Header: sendir,module:port,ID,freq,repeat,offset = 6 parts
  if (parts.length < 8) return code

  const header = parts.slice(0, 6)
  const data = parts.slice(6).map(Number)
  const pairCount = data.length / 2

  // Find burst boundaries: lead-in pairs where both mark and space > 150
  const burstStarts: number[] = []
  for (let i = 0; i < data.length - 1; i += 2) {
    if (data[i] > 150 && data[i + 1] > 150) {
      burstStarts.push(i)
    }
  }

  logger.info(`[IR TRIM] ${pairCount} pairs, ${burstStarts.length} bursts`)

  // Extract clean bursts (each burst = lead-in to just before next lead-in, minus garbage gaps)
  const cleanBursts: number[][] = []
  for (let b = 0; b < burstStarts.length; b++) {
    const start = burstStarts[b]
    const end = b + 1 < burstStarts.length ? burstStarts[b + 1] : data.length

    // Collect pairs for this burst, skipping garbage (mark < 5 = learner artifact)
    const burst: number[] = []
    for (let i = start; i < end - 1; i += 2) {
      if (data[i] >= 5) {
        burst.push(data[i], data[i + 1])
      } else {
        logger.info(`[IR TRIM] Removed garbage pair at index ${i}: ${data[i]},${data[i + 1]}`)
      }
    }
    cleanBursts.push(burst)
  }

  // Keep up to 3 bursts, staying under 90 pairs (safe margin below 96 limit)
  let result: number[] = []
  for (let b = 0; b < Math.min(cleanBursts.length, 3); b++) {
    if ((result.length + cleanBursts[b].length) / 2 > 90) break
    result = result.concat(cleanBursts[b])
  }

  // Must have at least 1 burst
  if (result.length === 0 && cleanBursts.length > 0) {
    result = cleanBursts[0].slice(0, 180) // Truncate single burst to 90 pairs
  }

  // Ensure trailing gap is long enough for clean signal termination
  if (result.length >= 2 && result[result.length - 1] < 4000) {
    result[result.length - 1] = 7000
  }

  const finalPairs = result.length / 2
  logger.info(`[IR TRIM] Result: ${finalPairs} pairs from ${cleanBursts.length} clean bursts`)

  return header.join(',') + ',' + result.join(',')
}

/**
 * Start IR learning session with streaming callbacks for real-time UI updates.
 */
function startLearningSessionStreaming(
  ipAddress: string,
  port: number,
  onReady: () => void,
  onComplete: (result: { success: boolean; learnedCode?: string; error?: string }) => void,
  timeout: number = 60000
): void {
  const client = new net.Socket()
  let dataBuffer = ''
  let resolved = false
  let learningEnabled = false
  const MAX_BUFFER_SIZE = 64 * 1024

  const timeoutId = setTimeout(() => {
    if (!resolved) {
      resolved = true
      client.destroy()
      onComplete({ success: false, error: 'Learning timeout - no IR code received within 60 seconds.' })
    }
  }, timeout)

  client.on('connect', () => {
    logger.info('[IR LEARN] Connected, sending get_IRL')
    client.write('get_IRL\r')
  })

  client.on('data', (data) => {
    const response = data.toString()
    dataBuffer += response

    if (dataBuffer.length > MAX_BUFFER_SIZE) {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        client.destroy()
        onComplete({ success: false, error: 'IR code too large or malformed data received' })
      }
      return
    }

    if (response.includes('IR Learner Enabled') && !learningEnabled) {
      learningEnabled = true
      logger.info('[IR LEARN] Learner enabled — notifying frontend')
      onReady()
      return
    }

    if (response.includes('IR Learner Unavailable')) {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        client.destroy()
        onComplete({ success: false, error: 'IR Learner unavailable - device may be in another mode' })
      }
      return
    }

    if (learningEnabled && dataBuffer.includes('sendir')) {
      const lines = dataBuffer.split('\r')
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim()
        if (line.startsWith('sendir,')) {
          const endsWithNumber = /,\d{3,}$/.test(line)
          const segmentCount = line.split(',').length
          if (endsWithNumber && segmentCount >= 6) {
            if (!resolved) {
              resolved = true
              clearTimeout(timeoutId)
              logger.info('[IR LEARN] Code captured: ' + segmentCount + ' segments')
              client.write('stop_IRL\r')
              setTimeout(() => client.destroy(), 200)
              onComplete({ success: true, learnedCode: line })
            }
            return
          }
        }
      }
    }
  })

  client.on('error', (error) => {
    if (!resolved) {
      resolved = true
      clearTimeout(timeoutId)
      onComplete({ success: false, error: `Connection error: ${error.message}` })
    }
  })

  client.on('close', () => {
    if (!resolved) {
      resolved = true
      clearTimeout(timeoutId)
      onComplete({ success: false, error: learningEnabled ? 'Connection closed before IR code was received' : 'Failed to enable IR learning mode' })
    }
  })

  try {
    client.connect(port, ipAddress)
  } catch (error) {
    if (!resolved) {
      resolved = true
      clearTimeout(timeoutId)
      onComplete({ success: false, error: error instanceof Error ? error.message : 'Connection failed' })
    }
  }
}

/**
 * Start IR learning session on Global Cache device (legacy non-streaming version)
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
      // IMPORTANT: Check dataBuffer (not response) since IR codes may arrive across multiple TCP chunks
      if (learningEnabled && dataBuffer.includes('sendir')) {
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

                logger.info('[IR LEARN] COMPLETE IR code learned successfully!')
                logger.info(`   Code length: ${line.length} characters`)
                logger.info(`   Segments: ${segmentCount}`)
                logger.info('   Code preview:', { data: line.substring(0, 100) + '...' })
                logger.info('   Code ending:', { data: line.slice(-50) })

                // Automatically stop learning
                client.write('stop_IRL\r')

                // Give it a moment to process stop command, then close
                setTimeout(() => {
                  client.destroy()
                }, 200)

                resolve({
                  success: true,
                  status: 'IR code learned successfully',
                  learnedCode: line
                })
              }
              break
            } else {
              logger.info(`[IR LEARN] Partial IR code (${segmentCount} segments, ends: ${line.slice(-20)}), waiting for more data...`)
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
