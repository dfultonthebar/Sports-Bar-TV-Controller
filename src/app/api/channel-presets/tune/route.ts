
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, or, update } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'


// POST /api/channel-presets/tune - Send channel change command
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = await request.json()
    const { channelNumber, deviceType, deviceIp, presetId, cableBoxId } = body

    // Validate required fields
    if (!channelNumber || !deviceType) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: channelNumber, deviceType' 
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
      // Cable Box uses CEC control via Pulse-Eight adapters
      result = await sendCableBoxChannelChange(channelNumber, cableBoxId)
    }

    if (result.success) {
      // Track usage if presetId is provided
      if (presetId) {
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

// Helper function to send Cable Box channel change via CEC
async function sendCableBoxChannelChange(channelNumber: string, cableBoxId?: string) {
  try {
    const { CableBoxCECService } = await import('@/lib/cable-box-cec-service')
    const cecService = CableBoxCECService.getInstance()

    // Get all cable boxes
    const cableBoxes = await cecService.getCableBoxes()

    if (cableBoxes.length === 0) {
      logger.warn('No cable boxes configured for CEC control')
      return {
        success: false,
        error: 'No cable boxes configured',
        details: 'Please configure cable boxes in device settings'
      }
    }

    // Use specified cable box or default to first one
    const targetBox = cableBoxId
      ? cableBoxes.find(box => box.id === cableBoxId) || cableBoxes[0]
      : cableBoxes[0]

    logger.debug(`Tuning ${targetBox.name} to channel ${channelNumber} via CEC`)

    // Send channel change command via CEC
    const result = await cecService.tuneChannel(targetBox.id, channelNumber)

    if (result.success) {
      return {
        success: true,
        message: `${targetBox.name} tuned to channel ${channelNumber} via CEC`,
        executionTime: result.executionTime,
        cableBoxName: targetBox.name
      }
    } else {
      return {
        success: false,
        error: result.error || 'Failed to change channel',
        details: `CEC command failed for ${targetBox.name}`
      }
    }
  } catch (error) {
    logger.error('Cable Box CEC channel change error:', error)
    return {
      success: false,
      error: 'Failed to change Cable Box channel via CEC',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
