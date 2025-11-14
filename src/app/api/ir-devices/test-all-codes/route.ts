import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { db, schema } from '@/db'
import { irDevices, globalCacheDevices, irCommands } from '@/db/schema'
import { eq } from 'drizzle-orm'
import net from 'net'

async function sendIRCode(iTachAddress: string, irCode: string): Promise<{ success: boolean; response?: string; error?: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let responseData = ''
    let isResolved = false

    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true
        socket.destroy()
        resolve({ success: false, error: 'Timeout' })
      }
    }, 2000)

    socket.connect(4998, iTachAddress, () => {
      socket.write(irCode + '\r')

      setTimeout(() => {
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          socket.destroy()
          resolve({ success: responseData.includes('completeir') || responseData === '', response: responseData || 'No response' })
        }
      }, 150)
    })

    socket.on('data', (data) => {
      responseData += data.toString()
      if (!isResolved) {
        isResolved = true
        clearTimeout(timeout)
        socket.destroy()

        const response = responseData.trim()
        if (response.startsWith('ERR')) {
          resolve({ success: false, error: response, response })
        } else {
          resolve({ success: true, response })
        }
      }
    })

    socket.on('error', (err) => {
      if (!isResolved) {
        isResolved = true
        clearTimeout(timeout)
        resolve({ success: false, error: err.message })
      }
    })

    socket.on('close', () => {
      if (!isResolved) {
        isResolved = true
        clearTimeout(timeout)
        resolve({ success: true, response: responseData || 'Connection closed' })
      }
    })
  })
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const bodyValidation = await validateRequestBody(request, z.object({
    deviceId: z.string(),
    port: z.number().optional()
  }))

  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { deviceId, port } = bodyValidation.data

  try {
    // Load IR device
    const device = await db.select().from(irDevices).where(eq(irDevices.id, deviceId)).limit(1).get()

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    // Load GlobalCache device
    const gcDevice = device.globalCacheDeviceId
      ? await db.select().from(globalCacheDevices).where(eq(globalCacheDevices.id, device.globalCacheDeviceId)).limit(1).get()
      : null

    if (!gcDevice) {
      return NextResponse.json({ error: 'GlobalCache device not configured' }, { status: 400 })
    }

    // Get IR commands from IRCommand table (new system)
    const commands = await db.select()
      .from(schema.irCommands)
      .where(eq(schema.irCommands.deviceId, deviceId))
      .all()

    if (commands.length === 0) {
      return NextResponse.json({ error: 'No IR codes learned' }, { status: 400 })
    }

    // Test each code
    const results = []

    for (const command of commands) {
      // Skip placeholder commands
      if (command.irCode === 'PLACEHOLDER') continue

      logger.info(`Testing ${command.functionName}: ${command.irCode.substring(0, 50)}...`)

      const result = await sendIRCode(gcDevice.ipAddress, command.irCode)

      results.push({
        command: command.functionName,
        code: command.irCode,
        success: result.success,
        response: result.response,
        error: result.error
      })

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    const successCount = results.filter(r => r.success).length
    const failedCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      device: device.name,
      globalCache: {
        name: gcDevice.name,
        ipAddress: gcDevice.ipAddress,
        port: port || device.globalCachePortNumber || 1
      },
      summary: {
        total: results.length,
        passed: successCount,
        failed: failedCount
      },
      results
    })

  } catch (error) {
    logger.error('Error testing IR codes:', error)
    return NextResponse.json({
      error: 'Failed to test IR codes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
