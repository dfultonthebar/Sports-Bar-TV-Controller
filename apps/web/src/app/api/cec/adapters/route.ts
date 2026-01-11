/**
 * CEC Adapters Discovery API
 * GET /api/cec/adapters
 *
 * Lists all available Pulse-Eight CEC USB adapters
 */

import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { promises as fs } from 'fs'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'

const execAsync = promisify(exec)

export const dynamic = 'force-dynamic'

interface CECAdapter {
  path: string
  port: string
  vendor: string
  firmwareVersion?: string
  physicalAddress?: string
  available: boolean
}

/**
 * Discover CEC adapters using cec-client -l
 */
async function discoverCECAdapters(): Promise<CECAdapter[]> {
  const adapters: CECAdapter[] = []

  try {
    // Run cec-client -l to list adapters
    const { stdout } = await execAsync('cec-client -l 2>&1 || true', { timeout: 10000 })

    logger.debug(`[CEC ADAPTERS] cec-client -l output: ${stdout.substring(0, 200)}`)

    // Parse the output
    // Example output:
    // Found devices: 1
    //
    // device:              1
    // com port:            /dev/ttyACM0
    // vendor id:           2548
    // product id:          1002
    // firmware version:    9
    // physical address:    1.0.0.0

    const lines = stdout.split('\n')
    let currentAdapter: Partial<CECAdapter> | null = null

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed.startsWith('device:')) {
        // Start of new device entry
        if (currentAdapter?.path) {
          adapters.push({
            path: currentAdapter.path,
            port: currentAdapter.port || '',
            vendor: currentAdapter.vendor || 'Pulse-Eight',
            firmwareVersion: currentAdapter.firmwareVersion,
            physicalAddress: currentAdapter.physicalAddress,
            available: true,
          })
        }
        currentAdapter = {}
      } else if (trimmed.startsWith('com port:')) {
        const path = trimmed.replace('com port:', '').trim()
        if (currentAdapter) {
          currentAdapter.path = path
          currentAdapter.port = path
        }
      } else if (trimmed.startsWith('vendor id:')) {
        // Vendor ID 2548 is Pulse-Eight
        if (currentAdapter) {
          currentAdapter.vendor = 'Pulse-Eight'
        }
      } else if (trimmed.startsWith('firmware version:')) {
        const version = trimmed.replace('firmware version:', '').trim()
        if (currentAdapter) {
          currentAdapter.firmwareVersion = version
        }
      } else if (trimmed.startsWith('physical address:')) {
        const address = trimmed.replace('physical address:', '').trim()
        if (currentAdapter) {
          currentAdapter.physicalAddress = address
        }
      }
    }

    // Don't forget the last adapter
    if (currentAdapter?.path) {
      adapters.push({
        path: currentAdapter.path,
        port: currentAdapter.port || '',
        vendor: currentAdapter.vendor || 'Pulse-Eight',
        firmwareVersion: currentAdapter.firmwareVersion,
        physicalAddress: currentAdapter.physicalAddress,
        available: true,
      })
    }
  } catch (error: any) {
    logger.warn('[CEC ADAPTERS] Error running cec-client -l:', error.message)
  }

  // Also scan for ttyACM devices directly if cec-client found nothing
  if (adapters.length === 0) {
    try {
      const devDir = await fs.readdir('/dev')
      const cecDevices = devDir.filter(
        (d) => d.startsWith('ttyACM') || d.startsWith('ttyUSB')
      )

      for (const device of cecDevices) {
        const path = `/dev/${device}`
        adapters.push({
          path,
          port: path,
          vendor: 'Unknown (USB Serial)',
          available: true,
        })
      }
    } catch (error) {
      logger.warn('[CEC ADAPTERS] Error scanning /dev:', error)
    }
  }

  return adapters
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    logger.info('[CEC ADAPTERS] Discovering CEC adapters')

    const adapters = await discoverCECAdapters()

    logger.info(`[CEC ADAPTERS] Found ${adapters.length} adapter(s)`)

    return NextResponse.json({
      success: true,
      adapters,
      count: adapters.length,
    })
  } catch (error: any) {
    logger.error('[CEC ADAPTERS] Discovery error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to discover CEC adapters',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
