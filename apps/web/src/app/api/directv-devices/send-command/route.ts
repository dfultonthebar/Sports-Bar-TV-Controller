
import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

import { logger } from '@/lib/logger'
// Enhanced DirecTV command mappings
// DirecTV SHEF API expects lowercase keys without KEY_ prefix
const DIRECTV_COMMANDS = {
  // Power Commands
  'POWER': 'power',
  'POWER_ON': 'poweron',
  'POWER_OFF': 'poweroff',

  // Navigation
  'UP': 'up',
  'DOWN': 'down',
  'LEFT': 'left',
  'RIGHT': 'right',
  'OK': 'select',
  'SELECT': 'select',
  'BACK': 'back',
  'EXIT': 'exit',

  // Channel Control
  'CH_UP': 'chanup',
  'CH_DOWN': 'chandown',
  'CHANUP': 'chanup',
  'CHANDOWN': 'chandown',
  'LAST': 'prev',
  'PREV': 'prev',
  'ENTER': 'enter',

  // Volume Control
  'VOL_UP': 'volumeup',
  'VOL_DOWN': 'volumedown',
  'VOLUMEUP': 'volumeup',
  'VOLUMEDOWN': 'volumedown',
  'MUTE': 'mute',

  // Guide & Menu
  'GUIDE': 'guide',
  'MENU': 'menu',
  'INFO': 'info',
  'LIST': 'list',

  // Numbers
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',

  // DVR Controls
  'PLAY': 'play',
  'PAUSE': 'pause',
  'STOP': 'stop',
  'REWIND': 'rew',
  'REW': 'rew',
  'FAST_FORWARD': 'ffwd',
  'FFWD': 'ffwd',
  'RECORD': 'record',
  'SKIP_BACK': 'replay',
  'REPLAY': 'replay',
  'SKIP_FORWARD': 'advance',
  'ADVANCE': 'advance',

  // DirecTV Specific
  'ACTIVE': 'active',
  'FORMAT': 'format',
  'YELLOW': 'yellow',
  'BLUE': 'blue',
  'RED': 'red',
  'GREEN': 'green',
  'DASH': 'dash'
}

async function sendDirecTVCommand(ip: string, port: number, command: string, retryCount: number = 0): Promise<{ success: boolean; message: string; data?: any }> {
  const maxRetries = 2

  try {
    // DirecTV uses HTTP GET requests to /remote/processKey
    // The SHEF API expects lowercase keys without the KEY_ prefix
    const url = `http://${ip}:${port}/remote/processKey?key=${command}`

    logger.info(`Sending DirecTV command to: ${url} (attempt ${retryCount + 1}/${maxRetries + 1})`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 seconds - allows for network latency during rapid commands

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Sports-Bar-Controller/1.0',
        'Accept': '*/*'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const responseText = await response.text()
      logger.info(`DirecTV response: ${response.status} - ${responseText}`)

      return {
        success: true,
        message: `DirecTV command ${command} sent successfully`,
        data: { status: response.status, response: responseText }
      }
    } else {
      // Get response body for better error diagnostics
      const responseBody = await response.text().catch(() => '')

      // Handle 403 Forbidden - could be multiple reasons
      if (response.status === 403) {
        logger.error(`DirecTV 403 error. Response body: ${responseBody}`)

        // Try to determine the actual cause
        let errorMsg = `HTTP 403 Forbidden from ${ip}:${port}. `

        // Check if it's really SHEF/External Access issue
        if (responseBody.toLowerCase().includes('external') ||
            responseBody.toLowerCase().includes('access') ||
            responseBody.toLowerCase().includes('disabled')) {
          errorMsg += `External Device Access appears to be disabled. ` +
                     `To enable: Press MENU → Settings & Help → Settings → ` +
                     `Whole-Home → External Device → Enable "External Access", then RESTART the receiver.`
        } else {
          // Generic 403 - could be network/firewall/auth issue
          errorMsg += `Access forbidden. This could be due to:\n` +
                     `1. Wrong IP address (verify receiver IP: ${ip})\n` +
                     `2. Firewall blocking the connection\n` +
                     `3. Receiver not fully restarted after enabling External Access\n` +
                     `4. Network routing issue\n\n` +
                     `Try: Power cycle the receiver completely (unplug for 30 seconds)`
        }

        throw new Error(errorMsg)
      } else if (response.status === 404) {
        throw new Error(
          `HTTP 404: SHEF API endpoint not found at ${ip}:${port}. ` +
          `Verify: 1) Correct IP address, 2) Receiver supports network control, 3) Using port ${port}`
        )
      } else if (response.status === 500 || response.status === 503) {
        // Server errors - might be transient, retry
        if (retryCount < maxRetries) {
          logger.info(`Server error ${response.status}, retrying immediately...`)
          return sendDirecTVCommand(ip, port, command, retryCount + 1)
        }
        throw new Error(`HTTP ${response.status}: DirecTV receiver error - ${response.statusText}`)
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}${responseBody ? ` - ${responseBody}` : ''}`)
      }
    }
  } catch (error) {
    logger.error('DirecTV command error:', error)

    let errorMessage = 'Unknown error'

    if (error instanceof Error) {
      // Don't modify errors that are already formatted from HTTP responses
      if (error.message.startsWith('HTTP')) {
        throw error
      }

      if (error.name === 'AbortError') {
        errorMessage = `Request timed out - DirecTV receiver at ${ip}:${port} not responding. ` +
                      `Check: 1) Device is powered on, 2) IP address is correct, 3) Network connectivity`
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = `Connection refused by ${ip}:${port}. ` +
                      `Check: 1) Receiver is powered on, 2) Correct IP address, 3) Port ${port} is correct (usually 8080)`
      } else if (error.message.includes('ENETUNREACH') || error.message.includes('EHOSTUNREACH')) {
        errorMessage = `Network unreachable - cannot reach ${ip}:${port}. ` +
                      `Check: 1) Receiver and server on same network, 2) No firewall blocking, 3) Correct IP address`
      } else if (error.message.includes('ETIMEDOUT')) {
        errorMessage = `Connection timed out to ${ip}:${port}. ` +
                      `Check: 1) Device is online, 2) Network connectivity, 3) Firewall settings`
      } else if (error.message.includes('fetch failed')) {
        // Generic fetch failure - could be network issue
        if (retryCount < maxRetries) {
          logger.info(`Fetch failed, retrying immediately...`)
          return sendDirecTVCommand(ip, port, command, retryCount + 1)
        }
        errorMessage = `Failed to connect to ${ip}:${port}. ` +
                      `Verify: 1) Receiver IP address is ${ip}, 2) Receiver is powered on, 3) Network connection`
      } else {
        errorMessage = error.message
      }
    }

    return {
      success: false,
      message: `DirecTV command failed: ${errorMessage}`
    }
  }
}

// Validation schema for DirecTV command
const directvSendCommandSchema = z.object({
  deviceId: ValidationSchemas.deviceId,
  command: z.string().min(1).max(50, 'Command must be less than 50 characters'),
  ipAddress: ValidationSchemas.ipAddress,
  port: ValidationSchemas.port.default(8080)
})

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Validate request body
    const validation = await validateRequestBody(request, directvSendCommandSchema)
    if (isValidationError(validation)) return validation.error

    const { data } = validation

    const { deviceId, command, ipAddress, port } = data
    // Validate and map the command
    const mappedCommand = DIRECTV_COMMANDS[command as keyof typeof DIRECTV_COMMANDS]
    if (!mappedCommand) {
      return NextResponse.json(
        { error: `Command '${command}' not supported for DirecTV` },
        { status: 400 }
      )
    }

    // Use provided port or default to 8080
    const targetPort = port || 8080

    logger.info(`Sending DirecTV command: ${command} -> ${mappedCommand} to ${ipAddress}:${targetPort}`)

    // Send the command
    const result = await sendDirecTVCommand(ipAddress, targetPort, mappedCommand)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        deviceId,
        command: mappedCommand,
        originalCommand: command,
        sentAt: new Date().toISOString(),
        data: result.data
      })
    } else {
      return NextResponse.json(
        { 
          error: result.message,
          success: false,
          deviceId,
          command: mappedCommand,
          originalCommand: command
        },
        { status: 500 }
      )
    }

  } catch (error) {
    logger.error('DirecTV Command API Error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to send DirecTV command',
        success: false 
      },
      { status: 500 }
    )
  }
}
