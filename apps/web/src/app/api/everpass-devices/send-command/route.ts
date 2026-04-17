/**
 * EverPass Send Command API
 * POST /api/everpass-devices/send-command
 *
 * Sends CEC commands to EverPass streaming box for navigation, playback, and power control
 */

import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import {
  getCECCodeForCommand,
  buildCECCommand,
  buildCECReleaseCommand,
  getCommandDisplayName,
  EVERPASS_COMMAND_CATEGORIES,
} from '@/lib/everpass-utils'

const execAsync = promisify(exec)

export const dynamic = 'force-dynamic'

// All supported commands
const supportedCommands = [
  // Navigation
  'up', 'down', 'left', 'right', 'select', 'exit',
  // Menu
  'root_menu', 'menu', 'setup_menu', 'contents_menu', 'guide', 'info',
  // Playback
  'play', 'pause', 'stop', 'rewind', 'fast_forward', 'skip_forward', 'skip_backward',
  // Power
  'power', 'power_on', 'power_off',
  // Volume (if passthrough)
  'volume_up', 'volume_down', 'mute',
  // Color buttons
  'f1_blue', 'f2_red', 'f3_green', 'f4_yellow',
]

const sendCommandSchema = z.object({
  deviceId: z.string().min(1),
  command: z.string().min(1),
  cecDevicePath: z.string().regex(/^\/dev\/tty(ACM|USB)\d+$/, 'Invalid CEC device path'),
})

// GET - Return available commands
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  return NextResponse.json({
    success: true,
    commands: supportedCommands,
    categories: EVERPASS_COMMAND_CATEGORIES,
  })
}

// POST - Send CEC command
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const bodyValidation = await validateRequestBody(request, sendCommandSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { deviceId, command, cecDevicePath } = bodyValidation.data

  // Normalize command name
  const normalizedCommand = command.toLowerCase().replace(/-/g, '_')

  // Handle 'menu' as alias for 'root_menu'
  const effectiveCommand = normalizedCommand === 'menu' ? 'root_menu' : normalizedCommand

  try {
    logger.info(`[EVERPASS API] Sending command "${effectiveCommand}" to device ${deviceId} at ${cecDevicePath}`)

    // Get CEC code for command
    const cecCode = getCECCodeForCommand(effectiveCommand)
    if (cecCode === undefined) {
      return NextResponse.json(
        {
          success: false,
          message: `Unknown command: ${command}`,
          availableCommands: supportedCommands,
        },
        { status: 400 }
      )
    }

    // Build CEC command strings
    const cecPressCommand = buildCECCommand(cecCode)
    const cecReleaseCommand = buildCECReleaseCommand()

    // Send key press followed by key release (standard CEC pattern)
    // Using timeout to prevent hanging if adapter is unresponsive
    const shellCommand = `(echo "${cecPressCommand}" && sleep 0.1 && echo "${cecReleaseCommand}") | timeout 3 cec-client -s -d 1 ${cecDevicePath} 2>&1 || true`

    const startTime = Date.now()
    const { stdout, stderr } = await execAsync(shellCommand, { timeout: 5000 })
    const duration = Date.now() - startTime

    // Check for success indicators
    const wasSuccessful =
      stdout.includes('TRAFFIC') ||
      stdout.includes('>> ') ||
      stdout.includes('waiting for input') ||
      stdout.includes('key pressed')

    // Check for errors
    const hasError =
      stdout.includes('cannot open') ||
      stdout.includes('failed') ||
      stdout.includes('No such file')

    if (hasError) {
      logger.warn(`[EVERPASS API] Command failed for ${cecDevicePath}: ${stdout}`)
      return NextResponse.json({
        success: false,
        message: `Failed to send command: ${getCommandDisplayName(effectiveCommand)}`,
        error: stdout.substring(0, 200),
        duration,
      })
    }

    logger.info(
      `[EVERPASS API] Command "${effectiveCommand}" sent successfully in ${duration}ms`
    )

    return NextResponse.json({
      success: true,
      message: `Sent: ${getCommandDisplayName(effectiveCommand)}`,
      command: effectiveCommand,
      cecCode: `0x${cecCode.toString(16).padStart(2, '0')}`,
      duration,
    })
  } catch (error: any) {
    logger.error(`[EVERPASS API] Send command error for ${cecDevicePath}:`, error)

    // Check for timeout
    if (error.killed || error.signal === 'SIGTERM') {
      return NextResponse.json({
        success: false,
        message: 'Command timed out',
        error: 'CEC adapter not responding',
      })
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to send command',
        error: error.message,
      },
      { status: 500 }
    )
  }
}
