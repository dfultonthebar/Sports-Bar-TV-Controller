
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, or, update } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'


// POST /api/channel-presets/tune - Send channel change command
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    const { data: body } = bodyValidation
    let { channelNumber, deviceType, deviceIp, presetId, cableBoxId } = body

    // If presetId is provided but channelNumber/deviceType are missing, fetch the preset
    if (presetId && presetId !== 'manual' && (!channelNumber || !deviceType)) {
      const { findFirst } = await import('@/lib/db-helpers')
      const preset = await findFirst('channelPresets', {
        where: eq(schema.channelPresets.id, String(presetId))
      })

      if (!preset) {
        return NextResponse.json(
          {
            success: false,
            error: 'Preset not found'
          },
          { status: 404 }
        )
      }

      // Extract channel and device info from preset
      channelNumber = preset.channelNumber
      deviceType = preset.deviceType
    }

    // Convert unknown types to strings
    const channelNumberStr = String(channelNumber)
    const deviceTypeStr = String(deviceType)
    const deviceIpStr = deviceIp ? String(deviceIp) : undefined
    const cableBoxIdStr = cableBoxId ? String(cableBoxId) : undefined

    // Validate required fields
    if (!channelNumberStr || !deviceTypeStr) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: channelNumber, deviceType (or presetId)'
        },
        { status: 400 }
      )
    }

    // Validate deviceType
    if (!['cable', 'directv'].includes(deviceTypeStr)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid deviceType. Must be "cable" or "directv"' 
        },
        { status: 400 }
      )
    }

    let result: any = { success: false }

    if (deviceTypeStr === 'directv') {
      // DirecTV uses IP control
      if (!deviceIpStr) {
        return NextResponse.json(
          {
            success: false,
            error: 'Device IP address required for DirecTV control'
          },
          { status: 400 }
        )
      }

      // Send DirecTV channel change command
      result = await sendDirecTVChannelChange(deviceIpStr, channelNumberStr)
    } else if (deviceTypeStr === 'cable') {
      // Cable Box uses IR control via Global Cache
      result = await sendCableBoxChannelChange(channelNumberStr, cableBoxIdStr)
    }

    if (result.success) {
      // Track usage if presetId is provided (but not for manual entries)
      if (presetId && presetId !== 'manual') {
        try {
          // Get current preset to increment usage count
          const { findFirst } = await import('@/lib/db-helpers')
          const currentPreset = await findFirst('channelPresets', {
            where: eq(schema.channelPresets.id, presetId as string)
          })

          if (currentPreset) {
            await update('channelPresets', presetId, {
              usageCount: currentPreset.usageCount + 1,
              lastUsed: new Date().toISOString()
            })
            logger.debug(`[Usage Tracking] Preset ${presetId} usage recorded`)
          }
        } catch (error) {
          logger.error('[Usage Tracking] Failed to update preset usage:', error)
          // Don't fail the request if usage tracking fails
        }
      }

      // Update current channel tracking for the input
      try {
        const { findFirst } = await import('@/lib/db-helpers')
        const { db } = await import('@/db')

        // Determine the input number and label
        let inputNum: number | null = null
        let inputLabel = 'Unknown'

        if (deviceTypeStr === 'cable' && cableBoxIdStr) {
          // Find the specific cable box's matrix input
          const irDevice = await db.select()
            .from(schema.irDevices)
            .where(and(
              eq(schema.irDevices.id, cableBoxIdStr),
              eq(schema.irDevices.deviceType, 'Cable Box')
            ))
            .limit(1)
            .get()

          if (irDevice?.matrixInput) {
            inputNum = irDevice.matrixInput
            inputLabel = irDevice.matrixInputLabel || irDevice.name
          }
        } else if (deviceTypeStr === 'directv' && deviceIpStr) {
          // For DirecTV, try to load from JSON file to get input channel
          try {
            const { readFile } = await import('fs/promises')
            const { join } = await import('path')
            const direcTvData = JSON.parse(
              await readFile(join(process.cwd(), 'data', 'directv-devices.json'), 'utf8')
            )
            const direcTvDevice = direcTvData.devices?.find((d: any) => d.ipAddress === deviceIpStr)

            if (direcTvDevice?.inputChannel) {
              inputNum = direcTvDevice.inputChannel
              inputLabel = direcTvDevice.name || 'DirecTV'
            }
          } catch (fileError) {
            logger.warn('[Channel Tracking] Could not load DirecTV devices:', fileError)
          }
        }

        if (inputNum) {
          // Get channel name from preset if available
          let channelName: string | null = null
          if (presetId && presetId !== 'manual') {
            const preset = await findFirst('channelPresets', {
              where: eq(schema.channelPresets.id, presetId as string)
            })
            if (preset) {
              channelName = preset.name
            }
          }

          // Upsert the current channel info
          const existing = await findFirst('inputCurrentChannels', {
            where: eq(schema.inputCurrentChannels.inputNum, inputNum)
          })

          if (existing) {
            await update('inputCurrentChannels', existing.id, {
              channelNumber: channelNumberStr,
              channelName,
              presetId: (presetId && presetId !== 'manual') ? String(presetId) : null,
              lastTuned: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
          } else {
            await db.insert(schema.inputCurrentChannels).values({
              id: crypto.randomUUID(),
              inputNum,
              inputLabel,
              deviceType: deviceTypeStr,
              channelNumber: channelNumberStr,
              channelName,
              presetId: (presetId && presetId !== 'manual') ? String(presetId) : null,
              lastTuned: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
          }

          logger.debug(`[Channel Tracking] Updated input ${inputNum} to channel ${channelNumberStr}${channelName ? ` (${channelName})` : ''}`)
        }
      } catch (error) {
        logger.error('[Channel Tracking] Failed to update current channel:', error)
        // Don't fail the request if channel tracking fails
      }

      return NextResponse.json({
        success: true,
        message: `Channel changed to ${channelNumber}`,
        deviceType,
        channelNumber
      })
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Failed to change channel',
          details: result.details
        },
        { status: 500 }
      )
    }
  } catch (error) {
    logger.error('Error tuning channel:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to tune channel',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Helper function to send DirecTV channel change via IP
async function sendDirecTVChannelChange(deviceIp: string, channelNumber: string) {
  try {
    const digits = channelNumber.split('')
    const baseUrl = `http://${deviceIp}:8080`

    // Send each digit with a small delay
    for (const digit of digits) {
      const response = await fetch(`${baseUrl}/remote/processKey?key=${digit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to send digit ${digit}`)
      }

      // Small delay between digits
      await new Promise(resolve => setTimeout(resolve, 250))
    }

    // Send ENTER key to confirm
    await new Promise(resolve => setTimeout(resolve, 100))
    const enterResponse = await fetch(`${baseUrl}/remote/processKey?key=enter`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!enterResponse.ok) {
      throw new Error('Failed to send ENTER key')
    }

    return { 
      success: true, 
      message: `DirecTV tuned to channel ${channelNumber}` 
    }
  } catch (error) {
    logger.error('DirecTV channel change error:', error)
    return { 
      success: false, 
      error: 'Failed to change DirecTV channel',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Helper function to send Cable Box channel change via IR
async function sendCableBoxChannelChange(channelNumber: string, cableBoxId?: string) {
  try {
    const { db } = await import('@/db')
    const { eq } = await import('drizzle-orm')

    // Get all IR cable box devices
    const irDevices = await db
      .select()
      .from(schema.irDevices)
      .where(eq(schema.irDevices.deviceType, 'Cable Box'))
      .execute()

    if (irDevices.length === 0) {
      logger.warn('No cable boxes configured for IR control')
      return {
        success: false,
        error: 'No cable boxes configured',
        details: 'Please configure cable boxes as IR devices in admin panel'
      }
    }

    // Use specified cable box or default to first one
    const targetDevice = cableBoxId
      ? irDevices.find(device => device.id === cableBoxId) || irDevices[0]
      : irDevices[0]

    // Get the Global Cache device
    const gcDevice = targetDevice.globalCacheDeviceId
      ? await db.select().from(schema.globalCacheDevices).where(eq(schema.globalCacheDevices.id, targetDevice.globalCacheDeviceId)).limit(1).get()
      : null

    if (!gcDevice) {
      return {
        success: false,
        error: 'Global Cache device not configured for cable box',
        details: 'Please configure Global Cache device in admin panel'
      }
    }

    // Get learned IR commands for this device
    const commands = await db.select()
      .from(schema.irCommands)
      .where(eq(schema.irCommands.deviceId, targetDevice.id))
      .all()

    if (commands.length === 0) {
      return {
        success: false,
        error: 'No IR commands learned for this cable box',
        details: 'Please learn IR commands first'
      }
    }

    // Create command lookup
    const commandLookup: Record<string, string> = {}
    commands.forEach(cmd => {
      if (cmd.irCode && cmd.irCode !== 'PLACEHOLDER') {
        commandLookup[cmd.functionName] = cmd.irCode
      }
    })

    logger.info(`[CHANNEL TUNE] Tuning ${targetDevice.name} to channel ${channelNumber} via IR`)
    logger.info(`[CHANNEL TUNE] Sending ${channelNumber.length} digits: ${channelNumber.split('').join(', ')}`)

    // Send each digit via IR
    const digits = channelNumber.split('')
    let digitsSent = 0

    for (const digit of digits) {
      const irCode = commandLookup[digit]

      if (!irCode) {
        logger.error(`[CHANNEL TUNE] IR code not learned for digit "${digit}"`)
        throw new Error(`IR code not learned for digit ${digit}`)
      }

      logger.info(`[CHANNEL TUNE] Sending digit ${digitsSent + 1}/${digits.length}: "${digit}"`)

      // Get IR command for this digit
      const command = commands.find(cmd => cmd.functionName === digit)
      if (!command || !command.irCode) {
        logger.error(`[CHANNEL TUNE] No IR code found for digit "${digit}"`)
        throw new Error(`No IR code found for digit ${digit}`)
      }

      // Send IR command directly via Global Cache
      const net = await import('net')
      const sendResult = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        const client = new net.Socket()
        let resolved = false
        const timeout = 10000

        const timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true
            client.destroy()
            resolve({ success: false, error: 'Connection timeout' })
          }
        }, timeout)

        client.on('connect', () => {
          client.write(command.irCode + '\r')
        })

        client.on('data', (data) => {
          const response = data.toString()
          if (response.includes('completeir') || response.includes('busyIR')) {
            if (!resolved) {
              resolved = true
              clearTimeout(timeoutId)
              client.destroy()
              resolve({ success: true })
            }
          }
          if (response.includes('ERR')) {
            if (!resolved) {
              resolved = true
              clearTimeout(timeoutId)
              client.destroy()
              resolve({ success: false, error: response.trim() })
            }
          }
        })

        client.on('error', (error) => {
          if (!resolved) {
            resolved = true
            clearTimeout(timeoutId)
            resolve({ success: false, error: error.message })
          }
        })

        client.on('close', () => {
          if (!resolved) {
            resolved = true
            clearTimeout(timeoutId)
            resolve({ success: true })
          }
        })

        try {
          client.connect(gcDevice.port, gcDevice.ipAddress)
        } catch (error) {
          if (!resolved) {
            resolved = true
            clearTimeout(timeoutId)
            resolve({ success: false, error: error instanceof Error ? error.message : 'Connection failed' })
          }
        }
      })

      if (!sendResult.success) {
        logger.error(`[CHANNEL TUNE] Failed to send digit "${digit}": ${sendResult.error}`)
        throw new Error(`Failed to send digit ${digit}: ${sendResult.error}`)
      }

      digitsSent++
      logger.info(`[CHANNEL TUNE] Successfully sent digit "${digit}" (${digitsSent}/${digits.length})`)

      // Delay between digits - reduced to prevent cable box auto-tuning on partial input
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    logger.info(`[CHANNEL TUNE] All ${digitsSent} digits sent successfully for channel ${channelNumber}`)

    return {
      success: true,
      message: `${targetDevice.name} tuned to channel ${channelNumber} via IR`,
      cableBoxName: targetDevice.name
    }
  } catch (error) {
    logger.error('Cable Box IR channel change error:', error)
    return {
      success: false,
      error: 'Failed to change Cable Box channel via IR',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
