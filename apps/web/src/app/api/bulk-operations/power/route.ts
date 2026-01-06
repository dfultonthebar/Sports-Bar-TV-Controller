import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, z } from '@/lib/validation'
import { logger } from '@sports-bar/logger'
import { promises as fs } from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'data', 'firetv-devices.json')

interface FireTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  deviceType: string
  isOnline: boolean
  lastSeen?: string
  location?: string
}

async function readDevices(): Promise<{ devices: FireTVDevice[] }> {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    logger.error('[BULK POWER] Error reading devices file:', error)
    return { devices: [] }
  }
}

const bulkPowerSchema = z.object({
  operation: z.enum(['on', 'off', 'cycle']),
  deviceTypes: z.array(z.enum(['firetv', 'tv', 'all'])).default(['all']),
  zoneFilter: z.string().optional(), // Filter by zone name
  delay: z.number().min(0).max(5000).default(500), // Delay between operations (ms)
})

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  // Validation
  const bodyValidation = await validateRequestBody(request, bulkPowerSchema)
  if (!bodyValidation.success) return bodyValidation.error

  const { operation, deviceTypes, zoneFilter, delay } = bodyValidation.data

  try {
    const results = {
      total: 0,
      successful: 0,
      failed: 0,
      devices: [] as any[],
    }

    // Get all devices based on filter
    const includeFireTV = deviceTypes.includes('all') || deviceTypes.includes('firetv')
    const includeTVs = deviceTypes.includes('all') || deviceTypes.includes('tv')

    // Process Fire TV devices
    if (includeFireTV) {
      const devicesData = await readDevices()
      const firetvDevices = devicesData.devices.filter(d => d.isOnline)

      logger.info(`[BULK POWER] Found ${firetvDevices.length} online Fire TV devices`)

      for (const device of firetvDevices) {
        if (zoneFilter && device.location !== zoneFilter) {
          logger.debug(`[BULK POWER] Skipping device ${device.name} - zone filter mismatch`)
          continue
        }

        results.total++
        try {
          // Map operation to Fire TV command
          let command = 'WAKE'
          if (operation === 'off') {
            command = 'POWER' // Power button press
          } else if (operation === 'cycle') {
            command = 'POWER' // Power cycle
          }

          logger.info(`[BULK POWER] Sending ${operation} command to ${device.name} (${device.ipAddress})`)

          // Send power command via Fire TV API
          const response = await fetch(`http://localhost:3001/api/firetv-devices/send-command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceId: device.id,
              command,
              ipAddress: device.ipAddress,
              port: 5555,
            }),
          })

          const data = await response.json()

          if (data.success) {
            results.successful++
            results.devices.push({
              id: device.id,
              name: device.name,
              status: 'success',
              type: 'firetv'
            })
            logger.info(`[BULK POWER] ✅ Successfully sent ${operation} to ${device.name}`)
          } else {
            results.failed++
            results.devices.push({
              id: device.id,
              name: device.name,
              status: 'failed',
              error: data.message || 'Command failed',
              type: 'firetv'
            })
            logger.error(`[BULK POWER] ❌ Failed to ${operation} device ${device.name}: ${data.message}`)
          }

          // Delay between operations to avoid overwhelming devices
          if (delay > 0 && results.total < firetvDevices.length) {
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        } catch (error: any) {
          results.failed++
          results.devices.push({
            id: device.id,
            name: device.name,
            status: 'error',
            error: error.message,
            type: 'firetv'
          })
          logger.error(`[BULK POWER] ❌ Error executing ${operation} on ${device.name}:`, error)
        }
      }
    }

    // TODO: Add TV power control via IR when needed
    if (includeTVs) {
      logger.info('[BULK POWER] TV power control not yet implemented')
      // Future: Add IR TV control here
    }

    const summary = `[BULK POWER] ${operation.toUpperCase()} completed: ${results.successful}/${results.total} successful, ${results.failed} failed`
    logger.info(summary)

    return NextResponse.json({
      success: true,
      data: results,
      message: summary,
    })
  } catch (error: any) {
    logger.error('[BULK POWER] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
