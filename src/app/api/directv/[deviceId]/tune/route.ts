import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, ValidationSchemas, z } from '@/lib/validation'
import { logger } from '@/lib/logger'
import fs from 'fs/promises'
import path from 'path'

/**
 * DirecTV Channel Tune API
 *
 * Tunes a DirecTV receiver to a specific channel using the DirecTV HTTP API.
 * DirecTV Genie receivers expose an HTTP interface on port 8080.
 *
 * API Documentation: http://{receiver-ip}:8080/info/getOptions
 * Tune Command: http://{receiver-ip}:8080/tv/tune?major={channel}
 */

interface DirecTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  receiverType?: string
  isOnline?: boolean
}

export async function POST(
  request: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Validate request body
  const bodyValidation = await validateRequestBody(
    request,
    z.object({
      channel: z.number().int().min(1).max(9999)
    })
  )
  if (!bodyValidation.success) return bodyValidation.error

  const { channel } = bodyValidation.data
  const { deviceId } = params

  try {
    // Load DirecTV devices from JSON file
    const devicesPath = path.join(process.cwd(), 'data', 'directv-devices.json')
    const devicesJson = await fs.readFile(devicesPath, 'utf-8')
    const devicesData = JSON.parse(devicesJson)

    // Find device by ID
    const device = devicesData.devices.find((d: DirecTVDevice) => d.id === deviceId)

    if (!device) {
      logger.error(`[DIRECTV] Device not found: ${deviceId}`)
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    logger.info(`[DIRECTV] Tuning ${device.name} (${device.ipAddress}) to channel ${channel}`)

    // Send tune command to DirecTV receiver
    // DirecTV HTTP API: http://{ip}:8080/tv/tune?major={channel}
    const tuneUrl = `http://${device.ipAddress}:${device.port}/tv/tune?major=${channel}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    try {
      const response = await fetch(tuneUrl, {
        method: 'GET',
        signal: controller.signal
      })

      clearTimeout(timeout)

      // DirecTV receivers return JSON with status information
      // Note: They may return HTTP 501 but still succeed - check JSON body
      const responseText = await response.text()

      try {
        const jsonResponse = JSON.parse(responseText)

        // Check if DirecTV returned success in the JSON body
        if (jsonResponse.status && jsonResponse.status.code === 200) {
          logger.info(`[DIRECTV] Successfully tuned ${device.name} to channel ${channel}`)

          return NextResponse.json({
            success: true,
            message: `Tuned to channel ${channel}`,
            deviceId,
            deviceName: device.name,
            channel,
            ipAddress: device.ipAddress
          })
        } else {
          logger.error(`[DIRECTV] Tune failed - DirecTV status: ${JSON.stringify(jsonResponse.status)}`)
          return NextResponse.json(
            {
              success: false,
              error: `DirecTV receiver returned error: ${jsonResponse.status?.msg || 'Unknown error'}`,
              deviceId,
              channel
            },
            { status: 500 }
          )
        }
      } catch (parseError) {
        // Not JSON, log response and fail
        logger.error(`[DIRECTV] Unexpected response format: ${responseText}`)
        return NextResponse.json(
          {
            success: false,
            error: 'Unexpected response from DirecTV receiver',
            deviceId,
            channel
          },
          { status: 500 }
        )
      }

    } catch (fetchError: any) {
      clearTimeout(timeout)

      if (fetchError.name === 'AbortError') {
        logger.error(`[DIRECTV] Tune timeout for ${device.name}`)
        return NextResponse.json(
          {
            success: false,
            error: 'DirecTV receiver timeout - device may be offline',
            deviceId,
            channel
          },
          { status: 504 }
        )
      }

      logger.error(`[DIRECTV] Tune error for ${device.name}:`, fetchError)
      return NextResponse.json(
        {
          success: false,
          error: `Network error: ${fetchError.message}`,
          deviceId,
          channel
        },
        { status: 500 }
      )
    }

  } catch (error: any) {
    logger.error('[DIRECTV] Tune API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        deviceId,
        channel
      },
      { status: 500 }
    )
  }
}
