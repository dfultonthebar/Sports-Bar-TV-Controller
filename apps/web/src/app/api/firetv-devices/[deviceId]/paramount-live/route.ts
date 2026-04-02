/**
 * Paramount+ Live TV Launch API
 *
 * Automates launching Paramount+ Live TV on a Fire TV device:
 * 1. Deep link to Paramount+ live TV
 * 2. Wait for profile picker
 * 3. Auto-select first profile via DPAD_CENTER
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { connectionManager } from '@/services/firetv-connection-manager'
import { getFireTVDeviceById } from '@/lib/device-db'
import { logger } from '@sports-bar/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const { deviceId } = await params

  try {
    logger.info(`[FIRETV API] Paramount+ Live TV launch requested for device ${deviceId}`)

    // Look up device info from database
    const device = await getFireTVDeviceById(deviceId)

    if (!device) {
      return NextResponse.json({
        success: false,
        error: 'Device not found'
      }, { status: 404 })
    }

    // Get or create connection for this device
    const client = await connectionManager.getOrCreateConnection(
      deviceId,
      device.ipAddress,
      device.port || 5555
    )

    // Execute the Paramount+ Live TV launch sequence
    const result = await client.launchParamountLiveTV()

    logger.info(`[FIRETV API] Paramount+ Live TV launched successfully on ${deviceId}`)

    return NextResponse.json({
      success: true,
      message: 'Paramount+ Live TV launch sequence completed',
      data: {
        deviceId,
        deviceAddress: `${device.ipAddress}:${device.port || 5555}`,
        result,
        note: 'Live TV stream should begin playing within ~8 seconds'
      }
    })

  } catch (error: any) {
    logger.error(`[FIRETV API] Paramount+ Live TV launch error for ${deviceId}:`, error)

    let errorMessage = 'Failed to launch Paramount+ Live TV'

    if (error.message && error.message.includes('timeout')) {
      errorMessage = 'Command execution timeout - device may be unresponsive'
    } else if (error.message && error.message.includes('refused')) {
      errorMessage = 'Connection refused - check ADB debugging is enabled'
    } else if (error.message && error.message.includes('not found') || error.message?.includes('not installed')) {
      errorMessage = 'Paramount+ may not be installed on this device'
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: error.message
    }, { status: 500 })
  }
}
