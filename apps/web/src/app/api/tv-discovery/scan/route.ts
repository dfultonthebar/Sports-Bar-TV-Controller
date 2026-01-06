import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateQueryParams, ValidationSchemas, z } from '@/lib/validation'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * TV Network Discovery Scan API
 *
 * Triggers a network scan to discover IP-controlled TVs (Roku, Samsung, LG, etc.)
 * Scans specified IP range on specified ports to detect network TVs
 */

interface DiscoveredTV {
  ipAddress: string
  brand: string
  model?: string
  port: number
  macAddress?: string
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Validate query parameters
  const queryValidation = validateQueryParams(request, ValidationSchemas.tvNetworkScan)
  if (!queryValidation.success) return queryValidation.error

  const { ipRange, ports, timeout } = queryValidation.data

  try {
    logger.info('[TV-DISCOVERY] Starting network scan', { ipRange, ports, timeout })

    // Parse IP range if provided, otherwise use default local network
    const startIP = ipRange ? ipRange.split('-')[0].trim() : '192.168.1.1'
    const endIP = ipRange ? ipRange.split('-')[1].trim() : '192.168.1.254'

    // Extract network portion and host range
    const startParts = startIP.split('.').map(Number)
    const endParts = endIP.split('.').map(Number)

    if (startParts.length !== 4 || endParts.length !== 4) {
      return NextResponse.json(
        { success: false, error: 'Invalid IP range format' },
        { status: 400 }
      )
    }

    // Validate same network
    if (startParts[0] !== endParts[0] || startParts[1] !== endParts[1] || startParts[2] !== endParts[2]) {
      return NextResponse.json(
        { success: false, error: 'IP range must be within same /24 subnet' },
        { status: 400 }
      )
    }

    const discoveredDevices: DiscoveredTV[] = []
    const scanPromises: Promise<void>[] = []

    // Scan each IP in range
    for (let hostNum = startParts[3]; hostNum <= endParts[3]; hostNum++) {
      const ipAddress = `${startParts[0]}.${startParts[1]}.${startParts[2]}.${hostNum}`

      // Check each port
      for (const port of ports) {
        scanPromises.push(
          scanDevice(ipAddress, port, timeout).then((device) => {
            if (device) {
              discoveredDevices.push(device)
            }
          }).catch((err) => {
            // Silently ignore scan errors for individual IPs
            logger.debug(`[TV-DISCOVERY] Scan failed for ${ipAddress}:${port}`, err)
          })
        )
      }
    }

    // Wait for all scans to complete (with overall timeout)
    const scanTimeout = Math.min(timeout * 10, 60000) // Max 60 seconds total
    await Promise.race([
      Promise.all(scanPromises),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Scan timeout')), scanTimeout))
    ]).catch((err) => {
      logger.warn('[TV-DISCOVERY] Scan timeout reached, returning partial results')
    })

    logger.info(`[TV-DISCOVERY] Scan complete. Found ${discoveredDevices.length} devices`)

    // Save discovered devices to database
    const savedDevices = []
    for (const device of discoveredDevices) {
      try {
        // Check if device already exists
        const existing = await db.select()
          .from(schema.networkTVDevices)
          .where(eq(schema.networkTVDevices.ipAddress, device.ipAddress))
          .limit(1)

        if (existing.length > 0) {
          // Update existing device
          await db.update(schema.networkTVDevices)
            .set({
              status: 'online',
              lastSeen: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
            .where(eq(schema.networkTVDevices.id, existing[0].id))

          savedDevices.push({ ...existing[0], status: 'online' })
        } else {
          // Create new device
          const [newDevice] = await db.insert(schema.networkTVDevices)
            .values({
              ipAddress: device.ipAddress,
              brand: device.brand,
              model: device.model,
              port: device.port,
              macAddress: device.macAddress,
              status: 'online',
              lastSeen: new Date().toISOString()
            })
            .returning()

          savedDevices.push(newDevice)
        }
      } catch (dbError: any) {
        logger.error(`[TV-DISCOVERY] Failed to save device ${device.ipAddress}:`, dbError)
      }
    }

    return NextResponse.json({
      success: true,
      devicesFound: discoveredDevices.length,
      devices: savedDevices,
      message: `Scan complete. Found ${discoveredDevices.length} TV(s)`
    })

  } catch (error: any) {
    logger.error('[TV-DISCOVERY] Scan error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Network scan failed' },
      { status: 500 }
    )
  }
}

/**
 * Scan a single device for TV capabilities
 */
async function scanDevice(ipAddress: string, port: number, timeout: number): Promise<DiscoveredTV | null> {
  // Try to detect Roku TV (ECP protocol on port 8060)
  if (port === 8060) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(`http://${ipAddress}:${port}/query/device-info`, {
        method: 'GET',
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const xmlText = await response.text()

        // Parse basic info from XML (simple extraction)
        const modelMatch = xmlText.match(/<model-name>(.*?)<\/model-name>/)
        const serialMatch = xmlText.match(/<serial-number>(.*?)<\/serial-number>/)

        logger.info(`[TV-DISCOVERY] Roku TV found at ${ipAddress}:${port}`)

        return {
          ipAddress,
          brand: 'roku',
          model: modelMatch ? modelMatch[1] : undefined,
          port,
          macAddress: serialMatch ? serialMatch[1] : undefined
        }
      }
    } catch (err) {
      // Not a Roku or unreachable
      return null
    }
  }

  // TODO: Add detection for Samsung, LG, Sony, etc. on their respective ports
  // Samsung SmartView: 8001, 8002
  // LG WebOS: 3000, 3001
  // Sony Bravia: 80

  return null
}
