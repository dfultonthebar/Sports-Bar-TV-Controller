/**
 * CEC Client - Direct control of Pulse-Eight CEC adapters via cec-client
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { logger } from './logger'
import { enhancedLogger } from './enhanced-logger'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

const execPromise = promisify(exec)

/**
 * Log CEC command to database for analytics
 */
async function logCECCommand(command: string, address: number | 'all', response: CECResponse, startTime: number) {
  try {
    const now = new Date().toISOString()
    const responseTime = Date.now() - startTime

    // Get the TV power CEC device ID
    const tvPowerDevice = await db.select()
      .from(schema.cecDevices)
      .where(eq(schema.cecDevices.deviceType, 'tv_power'))
      .limit(1)
      .get()

    if (!tvPowerDevice) {
      logger.debug('No TV power CEC device found for logging')
      return
    }

    // Log to CECCommandLog table for CEC-specific analytics
    await db.insert(schema.cecCommandLogs).values({
      id: randomUUID(),
      cecDeviceId: tvPowerDevice.id,
      command: `${command} ${address}`,
      cecCode: command,
      params: JSON.stringify({
        address,
        deviceResponded: response.deviceResponded,
        powerStatus: response.powerStatus
      }),
      success: response.success ? 1 : 0,
      responseTime,
      errorMessage: response.error || null,
      timestamp: now
    }).run()

    // Log to enhanced-logger for System Admin analytics
    await enhancedLogger.log({
      level: response.success ? 'info' : 'error',
      category: 'cec',
      source: 'cec-client',
      action: command,
      message: `CEC ${command} command to address ${address} ${response.success ? 'succeeded' : 'failed'}`,
      details: {
        address,
        deviceResponded: response.deviceResponded,
        powerStatus: response.powerStatus,
        errorMessage: response.error
      },
      deviceType: 'tv',
      deviceId: tvPowerDevice.id,
      success: response.success,
      duration: responseTime,
      errorStack: response.error
    })
  } catch (error) {
    // Don't throw - logging is secondary to command execution
    logger.error('Failed to log CEC command:', error)
  }
}

export interface CECCommandOptions {
  devicePath?: string  // e.g., /dev/ttyACM0
  deviceNumber?: number // e.g., 1 for -d 1
  timeout?: number // milliseconds
}

export interface CECResponse {
  success: boolean
  deviceResponded: boolean
  output: string
  powerStatus?: string
  error?: string
}

/**
 * Send a CEC command using cec-client with detailed response
 */
export async function sendCECCommandDetailed(
  command: string,
  address: number | 'all' = 0,
  options: CECCommandOptions = {}
): Promise<CECResponse> {
  const {
    deviceNumber = 1,
    timeout = 15000
  } = options

  const startTime = Date.now()

  try {
    const target = address === 'all' ? 'F' : address.toString(16).toUpperCase()
    const cecClientCommand = `echo '${command} ${target}' | cec-client -s -d ${deviceNumber}`

    logger.debug(`Executing CEC command: ${cecClientCommand}`)

    const { stdout, stderr } = await execPromise(cecClientCommand, {
      timeout,
      encoding: 'utf8'
    })

    logger.debug(`CEC stdout: ${stdout}`)
    if (stderr) {
      logger.debug(`CEC stderr: ${stderr}`)
    }

    // Parse output for device responses
    const deviceResponded =
      stdout.includes('TRAFFIC') ||        // Traffic on CEC bus
      stdout.includes('>> ') ||             // Outgoing command
      stdout.includes('<< ') ||             // Incoming response
      stdout.includes('power status:') ||   // Power status response
      stdout.includes('waiting for input')  // Command sent successfully

    // Extract power status if present
    let powerStatus: string | undefined
    const powerMatch = stdout.match(/power status:\s+(\w+)/)
    if (powerMatch) {
      powerStatus = powerMatch[1]
    }

    const response: CECResponse = {
      success: true,
      deviceResponded,
      output: stdout,
      powerStatus
    }

    // Log to database for analytics
    await logCECCommand(command, address, response, startTime)

    return response
  } catch (error: any) {
    logger.error(`CEC command failed: ${error.message}`)

    // Even on timeout, check if there was partial output
    const partialOutput = error.stdout || ''
    const deviceResponded = partialOutput.includes('TRAFFIC') || partialOutput.includes('<<')

    const response: CECResponse = {
      success: false,
      deviceResponded,
      output: partialOutput,
      error: error.message
    }

    // Log failure to database
    await logCECCommand(command, address, response, startTime)

    return response
  }
}

/**
 * Send a CEC command using cec-client (simple boolean return)
 */
export async function sendCECCommand(
  command: string,
  address: number | 'all' = 0,
  options: CECCommandOptions = {}
): Promise<boolean> {
  const result = await sendCECCommandDetailed(command, address, options)
  return result.success
}

/**
 * Power on a TV or all TVs
 */
export async function powerOn(address: number | 'all' = 0, options?: CECCommandOptions): Promise<boolean> {
  return await sendCECCommand('on', address, options)
}

/**
 * Power off (standby) a TV or all TVs
 */
export async function powerOff(address: number | 'all' = 0, options?: CECCommandOptions): Promise<boolean> {
  return await sendCECCommand('standby', address, options)
}

/**
 * Set volume up
 */
export async function volumeUp(address: number = 5, options?: CECCommandOptions): Promise<boolean> {
  return await sendCECCommand('volup', address, options)
}

/**
 * Set volume down
 */
export async function volumeDown(address: number = 5, options?: CECCommandOptions): Promise<boolean> {
  return await sendCECCommand('voldown', address, options)
}

/**
 * Mute/unmute
 */
export async function mute(address: number = 5, options?: CECCommandOptions): Promise<boolean> {
  return await sendCECCommand('mute', address, options)
}

/**
 * Get CEC device status
 */
export async function getStatus(options: CECCommandOptions = {}): Promise<any> {
  const { deviceNumber = 1, timeout = 5000 } = options

  try {
    const command = `echo 'scan' | cec-client -s -d ${deviceNumber}`
    logger.debug(`Scanning CEC devices: ${command}`)

    const { stdout } = await execPromise(command, { timeout, encoding: 'utf8' })

    // Parse the scan output
    const devices: any[] = []
    const lines = stdout.split('\n')

    for (const line of lines) {
      if (line.includes('device #')) {
        const match = line.match(/device #(\d+): (.+)/)
        if (match) {
          devices.push({
            address: match[1],
            info: match[2]
          })
        }
      }
    }

    return {
      success: true,
      devices,
      raw: stdout
    }
  } catch (error: any) {
    logger.error(`CEC scan failed: ${error.message}`)
    return {
      success: false,
      error: error.message
    }
  }
}
