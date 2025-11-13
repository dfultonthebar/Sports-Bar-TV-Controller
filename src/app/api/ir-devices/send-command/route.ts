
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
const IR_DEVICES_FILE = join(process.cwd(), 'data', 'ir-devices.json')

// Common IR codes for testing (these would normally come from Global Cache IR Database)
const COMMON_IR_CODES: { [key: string]: string } = {
  'POWER': 'sendir,1:1,1,38000,1,1,347,173,22,22,22,22,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,65,22,22,22,22,22,22,22,65,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,22,22,1517',
  'CH_UP': 'sendir,1:1,2,38000,1,1,347,173,22,22,22,22,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,65,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,65,22,1517',
  'CH_DOWN': 'sendir,1:1,3,38000,1,1,347,173,22,22,22,22,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,65,22,22,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,1517',
  'VOL_UP': 'sendir,1:1,4,38000,1,1,347,173,22,22,22,22,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,65,22,22,22,22,22,22,22,65,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,1517',
  'VOL_DOWN': 'sendir,1:1,5,38000,1,1,347,173,22,22,22,22,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,65,22,22,22,65,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,1517',
  'MUTE': 'sendir,1:1,6,38000,1,1,347,173,22,22,22,22,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,65,22,22,22,22,22,65,22,65,22,22,22,22,22,22,22,22,22,65,22,65,22,22,22,22,22,65,22,65,22,65,22,65,22,1517',
  '1': 'sendir,1:1,7,38000,1,1,347,173,22,22,22,22,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,65,22,65,22,65,22,65,22,65,22,1517',
  '2': 'sendir,1:1,8,38000,1,1,347,173,22,22,22,22,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,65,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,65,22,65,22,65,22,65,22,1517',
  '3': 'sendir,1:1,9,38000,1,1,347,173,22,22,22,22,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,65,22,22,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,65,22,1517'
}

async function loadDevices() {
  try {
    const data = await readFile(IR_DEVICES_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    return { devices: [] as any[] }
  }
}

async function sendITachCommand(iTachAddress: string, command: string): Promise<boolean> {
  const net = await import('net')
  
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    let isResolved = false

    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true
        socket.destroy()
        reject(new Error('Connection timeout'))
      }
    }, 2000)

    socket.connect(4998, iTachAddress, () => {
      logger.info(`Connected to iTach at ${iTachAddress}:4998`)
      socket.write(command + '\r')

      // For IR commands, we can resolve quickly after sending
      // iTach usually responds within 100ms
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          socket.destroy()
          resolve(true)
        }
      }, 150)
    })

    socket.on('data', (data) => {
      logger.info('iTach response:', { data: data.toString() })
      if (!isResolved) {
        isResolved = true
        clearTimeout(timeout)
        socket.destroy()
        resolve(true)
      }
    })

    socket.on('error', (err) => {
      logger.error('iTach connection error:', { data: err })
      if (!isResolved) {
        isResolved = true
        clearTimeout(timeout)
        reject(err)
      }
    })

    socket.on('close', () => {
      logger.info('iTach connection closed')
      if (!isResolved) {
        isResolved = true
        clearTimeout(timeout)
        resolve(true)
      }
    })
  })
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    const { data } = bodyValidation
    const { deviceId, command, iTachAddress, isRawCode } = data

    // Type assertions for unknown values
    const deviceIdStr = String(deviceId)
    const commandStr = String(command)
    const iTachAddressStr = String(iTachAddress)

    if (!deviceIdStr || !commandStr || !iTachAddressStr ||
        iTachAddressStr === 'undefined' || iTachAddressStr === '' ||
        deviceIdStr === 'undefined' || commandStr === 'undefined') {
      return NextResponse.json({
        error: 'Missing required parameters',
        details: {
          deviceId: deviceIdStr || 'missing',
          command: commandStr || 'missing',
          iTachAddress: iTachAddressStr || 'missing'
        }
      }, { status: 400 })
    }

    // Load device information
    const deviceData = await loadDevices()
    const device = (deviceData.devices && Array.isArray(deviceData.devices)) ? deviceData.devices.find((d: any) => d.id === deviceIdStr) : null

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    let irCode: string

    // Check if this is a raw IR code or a command name
    if (isRawCode || (commandStr.startsWith('sendir,') || commandStr.startsWith('completeir,'))) {
      // This is already a raw IR code
      irCode = commandStr
      logger.info(`Sending raw IR code to ${device.name}`)
    } else {
      // Look up the command in common codes
      irCode = COMMON_IR_CODES[commandStr]

      if (!irCode) {
        return NextResponse.json({ error: `IR code not found for command: ${commandStr}` }, { status: 404 })
      }
      logger.info(`Sending command '${commandStr}' to ${device.name}`)
    }

    // Modify the IR code to use the correct connector if needed
    // For learned codes, they already have the correct module:port
    // For common codes, we might need to adjust

    try {
      await sendITachCommand(iTachAddressStr, irCode)

      return NextResponse.json({
        success: true,
        message: `Successfully sent ${isRawCode ? 'IR code' : commandStr} to ${device.name}`,
        device: device.name,
        command: isRawCode ? 'raw_ir_code' : commandStr,
      })
    } catch (error) {
      logger.error('Failed to send IR command:', error)
      return NextResponse.json({
        error: `Failed to communicate with iTach: ${error}`
      }, { status: 500 })
    }

  } catch (error) {
    logger.error('Error sending IR command:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
