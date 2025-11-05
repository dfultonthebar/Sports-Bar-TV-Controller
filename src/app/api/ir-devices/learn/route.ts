/**
 * IR Learning API
 *
 * POST /api/ir-devices/learn
 * Learn IR codes from a physical remote control using Global Cache iTach
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError, isValidationSuccess} from '@/lib/validation'
import { db } from '@/db'
import { irDevices } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Store active learning sessions
const learningSessions = new Map<string, any>()

// Validation schema
const LearnRequestSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required'),
  command: z.string().min(1, 'Command name is required'),
  iTachAddress: z.string().ip('Valid IP address required').default('192.168.1.100'),
  portNumber: z.number().int().min(1).max(3).default(1), // IR port on iTach (1-3)
  timeout: z.number().int().min(1000).max(30000).default(10000), // 10 second default
})

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Input validation
  const bodyValidation = await validateRequestBody(request, LearnRequestSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  try {
    const { data } = bodyValidation
    const { deviceId, command, iTachAddress, portNumber, timeout } = data
    // Verify device exists
    const device = await db.query.irDevices.findFirst({
      where: eq(irDevices.id, deviceId),
    })

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    logger.info(`[IR Learning] Starting learning session for ${device.name} - command: ${command}`)

    // Start learning session
    const result = await startLearningSession(
      deviceId,
      command,
      iTachAddress,
      portNumber,
      timeout
    )

    if (result.success && result.irCode) {
      // Save learned code to device
      const existingCodes = device.irCodes ? JSON.parse(device.irCodes) : {}
      existingCodes[command] = result.irCode

      await db
        .update(irDevices)
        .set({
          irCodes: JSON.stringify(existingCodes),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(irDevices.id, deviceId))

      logger.info(`[IR Learning] Successfully learned and saved code for ${command}`)

      return NextResponse.json({
        success: true,
        message: `Successfully learned IR code for ${command}`,
        command,
        irCode: result.irCode,
        deviceId,
        deviceName: device.name,
      })
    } else if (result.waiting) {
      return NextResponse.json({
        success: true,
        waiting: true,
        message: result.message || 'Waiting for button press...',
        sessionId: result.sessionId,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to learn IR code',
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    logger.error('[IR Learning] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    )
  }
}

/**
 * Start an IR learning session with the iTach device
 */
async function startLearningSession(
  deviceId: string,
  command: string,
  iTachAddress: string,
  portNumber: number,
  timeout: number
): Promise<{
  success: boolean
  irCode?: string
  waiting?: boolean
  sessionId?: string
  message?: string
  error?: string
}> {
  const net = await import('net')

  return new Promise((resolve) => {
    const sessionId = `${deviceId}-${command}-${Date.now()}`
    let socket: any = null
    let isResolved = false
    let timeoutHandle: NodeJS.Timeout

    // Close any existing session for this device/command
    const existingSession = learningSessions.get(`${deviceId}-${command}`)
    if (existingSession?.socket) {
      try {
        existingSession.socket.destroy()
      } catch (e) {
        // Ignore errors when closing old session
      }
      learningSessions.delete(`${deviceId}-${command}`)
    }

    // Create new socket connection
    socket = new net.Socket()

    // Timeout handler
    timeoutHandle = setTimeout(() => {
      if (!isResolved) {
        isResolved = true
        if (socket) socket.destroy()
        learningSessions.delete(`${deviceId}-${command}`)
        logger.warn(`[IR Learning] Timeout waiting for button press (${command})`)
        resolve({
          success: false,
          error: 'Timeout waiting for button press. Please try again.',
        })
      }
    }, timeout)

    // Connect to iTach
    socket.connect(4998, iTachAddress, () => {
      logger.info(`[IR Learning] Connected to iTach at ${iTachAddress}:4998`)

      // Send learning command for specific port
      // Format: get_IRL,<module>:<port>
      const learningCommand = `get_IRL,1:${portNumber}\r`
      socket.write(learningCommand)

      logger.info(`[IR Learning] Sent learning command: ${learningCommand.trim()}`)
    })

    // Handle data from iTach
    socket.on('data', (data: Buffer) => {
      const response = data.toString().trim()
      logger.info(`[IR Learning] iTach response: ${response}`)

      if (response.includes('IR Learner Enabled')) {
        // Learning mode activated - waiting for button press
        logger.info('[IR Learning] IR Learner enabled, waiting for button press...')

        // Store session for potential cancellation
        learningSessions.set(`${deviceId}-${command}`, { socket, sessionId })

        // Don't resolve yet - wait for actual IR code
      } else if (response.includes('IR Learner Unavailable')) {
        // Learning mode not available
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeoutHandle)
          socket.destroy()
          learningSessions.delete(`${deviceId}-${command}`)
          resolve({
            success: false,
            error: 'IR Learner unavailable. Device may be in LED mode or port is busy.',
          })
        }
      } else if (response.startsWith('sendir,')) {
        // Successfully captured IR code!
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeoutHandle)
          socket.destroy()
          learningSessions.delete(`${deviceId}-${command}`)
          logger.info(`[IR Learning] Successfully captured IR code: ${response.substring(0, 50)}...`)
          resolve({
            success: true,
            irCode: response,
          })
        }
      } else if (response.includes('completeir')) {
        // Complete IR format - convert to sendir
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeoutHandle)
          socket.destroy()
          learningSessions.delete(`${deviceId}-${command}`)
          logger.info(`[IR Learning] Captured completeir format, converting...`)
          resolve({
            success: true,
            irCode: response,
          })
        }
      }
    })

    // Handle errors
    socket.on('error', (err: Error) => {
      logger.error('[IR Learning] Socket error:', { data: err })
      if (!isResolved) {
        isResolved = true
        clearTimeout(timeoutHandle)
        learningSessions.delete(`${deviceId}-${command}`)
        resolve({
          success: false,
          error: `Connection error: ${err.message}`,
        })
      }
    })

    // Handle socket close
    socket.on('close', () => {
      logger.info('[IR Learning] Socket closed')
      if (!isResolved) {
        isResolved = true
        clearTimeout(timeoutHandle)
        learningSessions.delete(`${deviceId}-${command}`)
        resolve({
          success: false,
          error: 'Connection closed unexpectedly',
        })
      }
    })
  })
}

/**
 * GET /api/ir-devices/learn
 * Check learning session status
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) {
    return NextResponse.json({
      success: true,
      activeSessions: learningSessions.size,
      sessions: Array.from(learningSessions.keys()),
    })
  }

  // Check if session exists
  let found = false
  for (const [key, session] of learningSessions.entries()) {
    if (session.sessionId === sessionId) {
      found = true
      break
    }
  }

  return NextResponse.json({
    success: true,
    active: found,
    sessionId,
  })
}

/**
 * DELETE /api/ir-devices/learn
 * Cancel an active learning session
 */
export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const bodyValidation = await validateRequestBody(
    request,
    z.object({
      deviceId: z.string(),
      command: z.string(),
    })
  )
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { data } = bodyValidation

  const { deviceId, command } = data
  const sessionKey = `${deviceId}-${command}`
  const session = learningSessions.get(sessionKey)

  if (session?.socket) {
    try {
      session.socket.destroy()
      learningSessions.delete(sessionKey)
      logger.info(`[IR Learning] Cancelled session for ${deviceId} - ${command}`)
      return NextResponse.json({
        success: true,
        message: 'Learning session cancelled',
      })
    } catch (error: any) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to cancel session: ${error.message}`,
        },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({
    success: false,
    error: 'No active learning session found',
  }, { status: 404 })
}
