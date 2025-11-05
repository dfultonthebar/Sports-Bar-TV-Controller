
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
        where: eq(schema.channelPresets.id, presetId)
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

    // Validate required fields
    if (!channelNumber || !deviceType) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: channelNumber, deviceType (or presetId)'
        },
        { status: 400 }
      )
    }

    // Validate deviceType
    if (!['cable', 'directv'].includes(deviceType)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid deviceType. Must be "cable" or "directv"' 
        },
        { status: 400 }
      )
    }

    let result: any = { success: false }

    if (deviceType === 'directv') {
      // DirecTV uses IP control
      if (!deviceIp) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Device IP address required for DirecTV control' 
          },
          { status: 400 }
        )
      }

      // Send DirecTV channel change command
      result = await sendDirecTVChannelChange(deviceIp, channelNumber)
    } else if (deviceType === 'cable') {
      // Cable Box uses IR control via Global Cache
      result = await sendCableBoxChannelChange(channelNumber, cableBoxId)
    }

    if (result.success) {
      // Track usage if presetId is provided (but not for manual entries)
      if (presetId && presetId !== 'manual') {
        try {
          // Get current preset to increment usage count
          const { findFirst } = await import('@/lib/db-helpers')
          const currentPreset = await findFirst('channelPresets', {
            where: eq(schema.channelPresets.id, presetId)
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
      .where(eq(schema.irDevices.deviceType, 'cable_box'))
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

    logger.debug(`Tuning ${targetDevice.name} to channel ${channelNumber} via IR`)

    // Send each digit via IR, then send ENTER
    const digits = channelNumber.split('')

    for (const digit of digits) {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ir-devices/send-command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: targetDevice.id,
          command: digit,
          iTachAddress: targetDevice.globalCacheDeviceId
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to send digit ${digit}`)
      }

      // Small delay between digits
      await new Promise(resolve => setTimeout(resolve, 250))
    }

    // Send ENTER to confirm channel
    await new Promise(resolve => setTimeout(resolve, 100))
    const enterResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ir-devices/send-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: targetDevice.id,
        command: 'OK',
        iTachAddress: targetDevice.globalCacheDeviceId
      })
    })

    if (!enterResponse.ok) {
      throw new Error('Failed to send ENTER command')
    }

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
