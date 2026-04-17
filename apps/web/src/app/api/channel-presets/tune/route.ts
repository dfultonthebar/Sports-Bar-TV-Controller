
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, or, update } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@sports-bar/logger'
import { schedulerLogger } from '@sports-bar/scheduler'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
import { operationLogger } from '@sports-bar/data'


type TuneLogEntry = {
  inputNum: number | null
  inputLabel: string | null
  deviceType: string
  deviceId: string | null
  cableBoxId: string | null
  channelNumber: string
  channelName: string | null
  presetId: string | null
  success: boolean
  errorMessage: string | null
  durationMs: number
  correlationId: string
}

async function appendTuneLog(entry: TuneLogEntry): Promise<void> {
  try {
    const { db } = await import('@/db')
    await db.insert(schema.channelTuneLogs).values({
      id: crypto.randomUUID(),
      inputNum: entry.inputNum ?? undefined,
      inputLabel: entry.inputLabel ?? undefined,
      deviceType: entry.deviceType,
      deviceId: entry.deviceId ?? undefined,
      cableBoxId: entry.cableBoxId ?? undefined,
      channelNumber: entry.channelNumber,
      channelName: entry.channelName ?? undefined,
      presetId: entry.presetId ?? undefined,
      triggeredBy: 'bartender',
      success: entry.success,
      errorMessage: entry.errorMessage ?? undefined,
      durationMs: entry.durationMs,
      correlationId: entry.correlationId,
      tunedAt: new Date().toISOString(),
    })
  } catch (logError) {
    logger.error('[TUNE API] Failed to append ChannelTuneLog entry:', logError)
  }
}

// POST /api/channel-presets/tune - Send channel change command
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const correlationId = schedulerLogger.generateCorrelationId()

  logger.info(`[TUNE API] ##########################################`)
  logger.info(`[TUNE API] POST /api/channel-presets/tune called [${correlationId}]`)

  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    logger.warn(`[TUNE API] Rate limit exceeded`)
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) {
    logger.error(`[TUNE API] Validation failed`)
    return bodyValidation.error
  }


  try {
    const { data: body } = bodyValidation
    logger.info(`[TUNE API] Request body: ${JSON.stringify(body)}`)
    let { channelNumber, deviceType, deviceIp, presetId, cableBoxId, directTVId, fireTVId, trackOnly } = body

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
    if (!['cable', 'directv', 'firetv'].includes(deviceTypeStr)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid deviceType. Must be "cable", "directv", or "firetv"'
        },
        { status: 400 }
      )
    }

    const fireTVIdStr = fireTVId ? String(fireTVId) : undefined

    let result: any = { success: false }

    // trackOnly mode: skip the actual tune, just update channel tracking below
    if (trackOnly) {
      result = { success: true, message: 'Track-only mode — channel tracking updated without tuning' }
    } else if (deviceTypeStr === 'firetv') {
      // Fire TV routing: channelNumber carries the streaming app name (e.g.
      // "Prime Video", "Apple TV+"). Look up the Fire TV's IP + the app's
      // package/activity and launch via the streaming manager.
      if (!fireTVIdStr) {
        result = { success: false, error: 'fireTVId is required for firetv tune' }
      } else {
        try {
          const { db } = await import('@/db')
          const ftRow = await db.select().from(schema.fireTVDevices)
            .where(eq(schema.fireTVDevices.id, fireTVIdStr)).get()
          if (!ftRow?.ipAddress) {
            result = { success: false, error: `Fire TV device not found: ${fireTVIdStr}` }
          } else {
            // Match the app name ("Prime Video", "Apple TV+") to the streaming-
            // apps database by name (substring, case-insensitive). streamingManager
            // expects the DB id (e.g. "amazon-prime"), not the package name.
            const { STREAMING_APPS_DATABASE } = await import('@sports-bar/streaming')
            const target = channelNumberStr.toLowerCase().replace(/[\s+]/g, '')
            const app = STREAMING_APPS_DATABASE.find((a: any) => {
              const name = a.name.toLowerCase().replace(/[\s+]/g, '')
              return name.includes(target) || target.includes(name)
            })
            if (!app) {
              result = { success: false, error: `Unknown streaming app: ${channelNumberStr}` }
            } else {
              const { streamingManager } = await import('@/services/streaming-service-manager')
              const ok = await streamingManager.launchApp(
                fireTVIdStr,
                ftRow.ipAddress,
                app.id,
                {},
                ftRow.port || 5555
              )
              result = ok
                ? { success: true, message: `Launched ${app.name} on ${ftRow.name}` }
                : { success: false, error: `Failed to launch ${app.name} on ${ftRow.name} — check ADB connection and app installation` }
            }
          }
        } catch (err: any) {
          logger.error(`[TUNE API] firetv launch error: ${err.message}`)
          result = { success: false, error: `firetv launch error: ${err.message}` }
        }
      }
    } else if (deviceTypeStr === 'directv') {
      // DirecTV uses IP control - need either deviceIp or directTVId to look up the IP
      let targetIp = deviceIpStr
      const directTVIdStr = directTVId ? String(directTVId) : undefined

      // If directTVId is provided but no IP, look up the IP from the database
      if (!targetIp && directTVIdStr) {
        try {
          const { getDirecTVDeviceById } = await import('@/lib/device-db')
          const direcTvDevice = await getDirecTVDeviceById(directTVIdStr)

          if (direcTvDevice?.ipAddress) {
            targetIp = direcTvDevice.ipAddress
            logger.info(`[TUNE API] Resolved DirecTV ID ${directTVIdStr} to IP ${targetIp}`)
          }
        } catch (dbError) {
          logger.error('[TUNE API] Could not load DirecTV device from database to resolve ID:', dbError)
        }
      }

      if (!targetIp) {
        return NextResponse.json(
          {
            success: false,
            error: 'Device IP address required for DirecTV control. Provide deviceIp or directTVId.'
          },
          { status: 400 }
        )
      }

      // Send DirecTV channel change command
      result = await sendDirecTVChannelChange(targetIp, channelNumberStr)
    } else if (deviceTypeStr === 'cable') {
      // Cable Box uses IR control via Global Cache
      result = await sendCableBoxChannelChange(channelNumberStr, cableBoxIdStr)
    }

    if (result.success) {
      const durationMs = Date.now() - startTime

      // Log successful tune to scheduler logs
      await schedulerLogger.log({
        correlationId,
        component: 'bartender-remote',
        operation: 'tune',
        level: 'info',
        message: `Tuned to channel ${channelNumberStr} on ${deviceTypeStr}`,
        channelNumber: channelNumberStr,
        deviceType: deviceTypeStr as 'cable' | 'directv' | 'firetv',
        deviceId: cableBoxIdStr || deviceIpStr || undefined,
        success: true,
        durationMs,
        metadata: {
          presetId: presetId || null,
          cableBoxId: cableBoxIdStr || null,
          deviceIp: deviceIpStr || null,
        }
      })

      // Track usage if presetId is provided (but not for manual entries)
      if (presetId && presetId !== 'manual') {
        try {
          // Get current preset to increment usage count
          const { findFirst } = await import('@/lib/db-helpers')
          const currentPreset = await findFirst('channelPresets', {
            where: eq(schema.channelPresets.id, presetId as string)
          })

          if (currentPreset) {
            await update('channelPresets', eq(schema.channelPresets.id, presetId as string), {
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

      // Variables captured from channel tracking, reused for ChannelTuneLog below
      let trackedInputNum: number | null = null
      let trackedInputLabel: string | null = null
      let trackedChannelName: string | null = null

      // Update current channel tracking for the input
      try {
        const { findFirst } = await import('@/lib/db-helpers')
        const { db } = await import('@/db')

        // Determine the input number and label
        let inputNum: number | null = null
        let inputLabel = 'Unknown'

        if (deviceTypeStr === 'cable') {
          // Find the cable box's matrix input
          const irDevice = cableBoxIdStr
            ? await db.select()
                .from(schema.irDevices)
                .where(and(
                  eq(schema.irDevices.id, cableBoxIdStr),
                  or(eq(schema.irDevices.deviceType, 'Cable Box'), eq(schema.irDevices.deviceType, 'CableBox'))
                ))
                .limit(1)
                .get()
            : await db.select()
                .from(schema.irDevices)
                .where(or(eq(schema.irDevices.deviceType, 'Cable Box'), eq(schema.irDevices.deviceType, 'CableBox')))
                .limit(1)
                .get()

          if (irDevice?.matrixInput) {
            inputNum = irDevice.matrixInput
            inputLabel = irDevice.matrixInputLabel || irDevice.name
          }
        } else if (deviceTypeStr === 'directv') {
          // For DirecTV, look up from database to get input channel
          const directTVIdForTracking = directTVId ? String(directTVId) : undefined
          try {
            const { getDirecTVDeviceById, getDirecTVDeviceByIp } = await import('@/lib/device-db')
            // Find device by ID first, then by IP
            const direcTvDevice = directTVIdForTracking
              ? await getDirecTVDeviceById(directTVIdForTracking)
              : deviceIpStr
                ? await getDirecTVDeviceByIp(deviceIpStr)
                : null

            if (direcTvDevice?.inputChannel) {
              inputNum = direcTvDevice.inputChannel
              inputLabel = direcTvDevice.name || 'DirecTV'
            }
          } catch (dbError) {
            logger.warn('[Channel Tracking] Could not load DirecTV devices from database:', dbError)
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

          // Calculate smart override duration based on game schedule
          const now = new Date()

          // Import smart override calculator
          const { calculateSmartOverrideDuration } = await import('@/lib/scheduler/smart-override')

          // Calculate intelligent override duration
          const overrideResult = await calculateSmartOverrideDuration(channelNumberStr)
          const manualOverrideUntil = new Date(now.getTime() + overrideResult.durationMs)

          // Log smart override details
          logger.info(`[SMART OVERRIDE] Channel ${channelNumberStr}: ${overrideResult.reason}`)
          logger.info(`[SMART OVERRIDE] Protection until ${manualOverrideUntil.toISOString()} (${overrideResult.durationMinutes} minutes)`)

          if (overrideResult.gameDetected && overrideResult.gameInfo) {
            logger.info(
              `[SMART OVERRIDE] Game: ${overrideResult.gameInfo.league} - ` +
              `${overrideResult.gameInfo.homeTeam} vs ${overrideResult.gameInfo.awayTeam} ` +
              `(Period ${overrideResult.gameInfo.period}, ${overrideResult.gameInfo.clock} remaining)`
            )
          }

          // Upsert the current channel info with manual override protection
          const existing = await findFirst('inputCurrentChannels', {
            where: eq(schema.inputCurrentChannels.inputNum, inputNum)
          })

          if (existing) {
            await update('inputCurrentChannels', eq(schema.inputCurrentChannels.id, existing.id), {
              channelNumber: channelNumberStr,
              channelName,
              presetId: (presetId && presetId !== 'manual') ? String(presetId) : null,
              lastTuned: now.toISOString(),
              updatedAt: now.toISOString(),
              // MANUAL OVERRIDE PROTECTION - Protect this input from scheduler for 2 hours
              manualOverrideUntil: manualOverrideUntil.toISOString(),
              lastManualChangeBy: 'bartender', // Could be enhanced with session tracking
              lastManualChangeAt: now.toISOString()
            })
          } else {
            await db.insert(schema.inputCurrentChannels).values({
              id: crypto.randomUUID(),
              inputNum,
              inputLabel,
              deviceType: deviceTypeStr,
              deviceId: cableBoxIdStr || deviceIpStr,
              channelNumber: channelNumberStr,
              channelName,
              presetId: (presetId && presetId !== 'manual') ? String(presetId) : null,
              lastTuned: now.toISOString(),
              updatedAt: now.toISOString(),
              // MANUAL OVERRIDE PROTECTION - Protect this input from scheduler for 2 hours
              manualOverrideUntil: manualOverrideUntil.toISOString(),
              lastManualChangeBy: 'bartender',
              lastManualChangeAt: now.toISOString()
            })
          }

          logger.info(`[MANUAL OVERRIDE] Input ${inputNum} protected until ${manualOverrideUntil.toISOString()} (${overrideResult.durationMinutes} minutes)`)

          logger.debug(`[Channel Tracking] Updated input ${inputNum} to channel ${channelNumberStr}${channelName ? ` (${channelName})` : ''}`)

          trackedInputNum = inputNum
          trackedInputLabel = inputLabel
          trackedChannelName = channelName
        }
      } catch (error) {
        logger.error('[Channel Tracking] Failed to update current channel:', error)
        // Don't fail the request if channel tracking fails
      }

      // Log successful operation for AI learning
      await operationLogger.logOperation({
        type: 'channel_change',
        device: cableBoxIdStr || deviceIpStr || deviceTypeStr,
        action: `Tuned to channel ${channelNumberStr}`,
        details: {
          channelNumber: channelNumberStr,
          deviceType: deviceTypeStr,
          presetId: presetId || null,
          channel: result.cableBoxName || 'Unknown',
        },
        user: 'bartender',
        success: true,
      })

      // Append to rolling tune history (success)
      await appendTuneLog({
        inputNum: trackedInputNum,
        inputLabel: trackedInputLabel,
        deviceType: deviceTypeStr,
        deviceId: cableBoxIdStr || deviceIpStr || null,
        cableBoxId: cableBoxIdStr || null,
        channelNumber: channelNumberStr,
        channelName: trackedChannelName,
        presetId: (presetId && presetId !== 'manual') ? String(presetId) : null,
        success: true,
        errorMessage: null,
        durationMs,
        correlationId,
      })

      return NextResponse.json({
        success: true,
        message: `Channel changed to ${channelNumber}`,
        deviceType,
        channelNumber
      })
    } else {
      const durationMs = Date.now() - startTime

      // Log failed tune to scheduler logs
      await schedulerLogger.log({
        correlationId,
        component: 'bartender-remote',
        operation: 'tune',
        level: 'error',
        message: `Failed to tune channel ${channelNumberStr} on ${deviceTypeStr}: ${result.error}`,
        channelNumber: channelNumberStr,
        deviceType: deviceTypeStr as 'cable' | 'directv' | 'firetv',
        deviceId: cableBoxIdStr || deviceIpStr || undefined,
        success: false,
        durationMs,
        errorMessage: result.error || 'Failed to change channel',
        metadata: {
          presetId: presetId || null,
          details: result.details,
        }
      })

      // Append to rolling tune history (failure)
      await appendTuneLog({
        inputNum: null,
        inputLabel: null,
        deviceType: deviceTypeStr,
        deviceId: cableBoxIdStr || deviceIpStr || null,
        cableBoxId: cableBoxIdStr || null,
        channelNumber: channelNumberStr,
        channelName: null,
        presetId: (presetId && presetId !== 'manual') ? String(presetId) : null,
        success: false,
        errorMessage: result.error || 'Failed to change channel',
        durationMs,
        correlationId,
      })

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
    const durationMs = Date.now() - startTime

    // Log exception to scheduler logs
    await schedulerLogger.log({
      correlationId,
      component: 'bartender-remote',
      operation: 'tune',
      level: 'error',
      message: `Tune exception: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
      durationMs,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
    })

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
    const baseUrl = `http://${deviceIp}:8080`

    // Use DirecTV's direct tune API - much cleaner than digit-by-digit
    // This avoids sending ENTER key which can trigger the INFO screen
    const tuneUrl = `${baseUrl}/tv/tune?major=${channelNumber}`

    logger.info(`[DIRECTV] Direct tuning to channel ${channelNumber} via ${tuneUrl}`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(tuneUrl, {
      method: 'GET',
      signal: controller.signal
    })

    clearTimeout(timeout)

    // DirecTV returns JSON with status info
    const responseText = await response.text()

    try {
      const jsonResponse = JSON.parse(responseText)

      // Check if DirecTV returned success in the JSON body
      if (jsonResponse.status && jsonResponse.status.code === 200) {
        logger.info(`[DIRECTV] Successfully tuned to channel ${channelNumber}`)
        return {
          success: true,
          message: `DirecTV tuned to channel ${channelNumber}`
        }
      } else {
        logger.error(`[DIRECTV] Tune failed - status: ${JSON.stringify(jsonResponse.status)}`)
        return {
          success: false,
          error: `DirecTV error: ${jsonResponse.status?.msg || 'Unknown error'}`,
          details: jsonResponse
        }
      }
    } catch (parseError) {
      // Not JSON - check HTTP status
      if (response.ok) {
        return {
          success: true,
          message: `DirecTV tuned to channel ${channelNumber}`
        }
      }
      throw new Error(`Unexpected response: ${responseText}`)
    }
  } catch (error: any) {
    logger.error('DirecTV channel change error:', error)

    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'DirecTV timeout - device may be offline',
        details: 'Request timed out after 5 seconds'
      }
    }

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
      .where(or(eq(schema.irDevices.deviceType, 'Cable Box'), eq(schema.irDevices.deviceType, 'CableBox')))
      .execute()

    if (irDevices.length === 0) {
      logger.warn('No cable boxes configured for IR control')
      return {
        success: false,
        error: 'No cable boxes configured',
        details: 'Please configure cable boxes as IR devices in admin panel'
      }
    }

    // Find the specific cable box device
    const targetDevice = cableBoxId
      ? irDevices.find(device => device.id === cableBoxId)
      : null

    if (!targetDevice) {
      logger.warn('[CHANNEL PRESET] Cable box not found or not specified', {
        cableBoxId,
        availableDevices: irDevices.map(d => ({ id: d.id, name: d.name, matrixInput: d.matrixInput }))
      })
      return {
        success: false,
        error: cableBoxId ? 'Cable box device not found' : 'Cable box ID not specified',
        details: cableBoxId
          ? `Cable box with ID ${cableBoxId} not found in system. Available cable boxes: ${irDevices.map(d => `${d.name} (${d.id})`).join(', ')}`
          : `Please select a specific cable box device to control. Available cable boxes: ${irDevices.map(d => `${d.name} (Input ${d.matrixInput})`).join(', ')}. Make sure to pass cableBoxId in the request.`
      }
    }

    logger.info('[CHANNEL PRESET] Using cable box', {
      deviceId: targetDevice.id,
      deviceName: targetDevice.name,
      matrixInput: targetDevice.matrixInput
    })

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

    logger.info(`[CHANNEL TUNE] ========================================`)
    logger.info(`[CHANNEL TUNE] Tuning ${targetDevice.name} to channel ${channelNumber} via IR`)
    logger.info(`[CHANNEL TUNE] Channel number type: ${typeof channelNumber}, value: "${channelNumber}", length: ${channelNumber.length}`)
    logger.info(`[CHANNEL TUNE] Sending ${channelNumber.length} digits: ${channelNumber.split('').join(', ')}`)

    // Pad channel number to 3 digits for Spectrum cable boxes
    // Single digit "6" → "006", double digit "27" → "027", triple "303" stays "303"
    // This prevents the cable box from waiting for more digits or misinterpreting
    const paddedChannel = channelNumber.padStart(3, '0')
    logger.info(`[CHANNEL TUNE] Padded channel: "${channelNumber}" → "${paddedChannel}"`)

    // Send each digit via IR
    const digits = paddedChannel.split('')
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
          // Replace the port/connector in the IR code with the device's actual port
          // IR codes are in format: sendir,MODULE:PORT,ID,...
          // e.g., sendir,1:1,1,... needs to become sendir,1:2,1,... for port 2
          let adjustedCode = command.irCode
          if (targetDevice.globalCachePortNumber) {
            adjustedCode = adjustedCode.replace(
              /^(sendir,\d+:)\d+/,
              `$1${targetDevice.globalCachePortNumber}`
            )
          }
          client.write(adjustedCode + '\r')
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
