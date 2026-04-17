/**
 * EverPass Test Connection API
 * POST /api/everpass-devices/test-connection
 *
 * Tests CEC adapter connectivity via cec-client
 */

import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'

const execAsync = promisify(exec)

export const dynamic = 'force-dynamic'

const testConnectionSchema = z.object({
  deviceId: z.string().min(1),
  cecDevicePath: z.string().regex(/^\/dev\/tty(ACM|USB)\d+$/, 'Invalid CEC device path'),
})

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const bodyValidation = await validateRequestBody(request, testConnectionSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { deviceId, cecDevicePath } = bodyValidation.data

  try {
    logger.info(`[EVERPASS API] Testing connection for device ${deviceId} at ${cecDevicePath}`)

    // Test CEC adapter by running cec-client with a simple scan command
    // The -s flag makes it single-shot, -d 1 sets debug level low
    const command = `echo "scan" | timeout 5 cec-client -s -d 1 ${cecDevicePath} 2>&1 || true`

    const { stdout, stderr } = await execAsync(command, { timeout: 10000 })

    // Check for successful connection indicators
    const isConnected =
      stdout.includes('connection opened') ||
      stdout.includes('CEC bus information') ||
      stdout.includes('device #') ||
      stdout.includes('logical address') ||
      stdout.includes('TRAFFIC')

    // Check for errors
    const hasError =
      stdout.includes('cannot open') ||
      stdout.includes('failed') ||
      stdout.includes('error') ||
      stdout.includes('No such file')

    if (hasError && !isConnected) {
      logger.warn(`[EVERPASS API] Connection test failed for ${cecDevicePath}: ${stdout}`)
      return NextResponse.json({
        success: false,
        connected: false,
        message: 'Failed to connect to CEC adapter',
        details: stdout.substring(0, 500),
      })
    }

    // Extract adapter info if available
    const adapterInfo = {
      path: cecDevicePath,
      detected: isConnected,
    }

    logger.info(`[EVERPASS API] Connection test result for ${cecDevicePath}: ${isConnected ? 'Connected' : 'Unknown'}`)

    return NextResponse.json({
      success: true,
      connected: isConnected,
      message: isConnected ? 'CEC adapter connected successfully' : 'CEC adapter may be connected',
      adapterInfo,
    })
  } catch (error: any) {
    logger.error(`[EVERPASS API] Test connection error for ${cecDevicePath}:`, error)

    // Check for timeout
    if (error.killed || error.signal === 'SIGTERM') {
      return NextResponse.json({
        success: false,
        connected: false,
        message: 'Connection test timed out',
        error: 'CEC adapter not responding',
      })
    }

    return NextResponse.json(
      {
        success: false,
        connected: false,
        message: 'Failed to test connection',
        error: error.message,
      },
      { status: 500 }
    )
  }
}
