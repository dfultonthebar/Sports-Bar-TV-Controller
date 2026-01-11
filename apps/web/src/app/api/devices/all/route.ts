/**
 * Combined Devices API
 * GET /api/devices/all - Returns all device data in a single request
 *
 * Performance optimization: Combines 5 separate API calls into 1
 * - Matrix inputs
 * - IR devices
 * - DirecTV devices
 * - Fire TV devices
 * - EverPass devices
 */

import { NextRequest, NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { promises as fs } from 'fs'
import path from 'path'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

const DIRECTV_DEVICES_FILE = path.join(process.cwd(), 'data', 'directv-devices.json')
const FIRETV_DEVICES_FILE = path.join(process.cwd(), 'data', 'firetv-devices.json')
const EVERPASS_DEVICES_FILE = path.join(process.cwd(), 'data', 'everpass-devices.json')

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const startTime = Date.now()

  try {
    // Run all queries in parallel for maximum performance
    const [matrixData, irDevicesData, direcTVData, fireTVData, everPassData] = await Promise.all([
      // Matrix config with inputs (combined query)
      loadMatrixConfig(),
      // IR devices from database
      loadIRDevices(),
      // DirecTV devices from JSON file
      loadDirecTVDevices(),
      // Fire TV devices from JSON file
      loadFireTVDevices(),
      // EverPass devices from JSON file
      loadEverPassDevices(),
    ])

    const duration = Date.now() - startTime
    logger.debug(`[DEVICES-ALL] Loaded all devices in ${duration}ms`)

    return NextResponse.json({
      success: true,
      data: {
        matrix: matrixData,
        irDevices: irDevicesData,
        direcTVDevices: direcTVData,
        fireTVDevices: fireTVData,
        everPassDevices: everPassData,
      },
      meta: {
        loadTimeMs: duration,
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error: any) {
    logger.error('[DEVICES-ALL] Error loading devices:', { error: error.message })
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

async function loadMatrixConfig() {
  try {
    // Get active config with inputs in a single transaction
    const config = await db.select()
      .from(schema.matrixConfigurations)
      .where(eq(schema.matrixConfigurations.isActive, true))
      .limit(1)
      .get()

    if (!config) {
      return { config: null, inputs: [], outputs: [] }
    }

    // Fetch inputs and outputs in parallel
    const [inputs, outputs] = await Promise.all([
      db.select()
        .from(schema.matrixInputs)
        .where(eq(schema.matrixInputs.configId, config.id))
        .orderBy(asc(schema.matrixInputs.channelNumber))
        .all(),
      db.select()
        .from(schema.matrixOutputs)
        .where(eq(schema.matrixOutputs.configId, config.id))
        .orderBy(asc(schema.matrixOutputs.channelNumber))
        .all(),
    ])

    return { config, inputs, outputs }
  } catch (error) {
    logger.error('[DEVICES-ALL] Error loading matrix config:', error)
    return { config: null, inputs: [], outputs: [] }
  }
}

async function loadIRDevices() {
  try {
    const devices = await db.query.irDevices.findMany()
    // Map matrixInput to inputChannel for frontend compatibility
    return devices.map(d => ({ ...d, inputChannel: d.matrixInput }))
  } catch (error) {
    logger.error('[DEVICES-ALL] Error loading IR devices:', error)
    return []
  }
}

async function loadDirecTVDevices() {
  try {
    const data = await fs.readFile(DIRECTV_DEVICES_FILE, 'utf8')
    const parsed = JSON.parse(data)
    return parsed.devices || []
  } catch (error) {
    // File might not exist yet, return empty array
    return []
  }
}

async function loadFireTVDevices() {
  try {
    const data = await fs.readFile(FIRETV_DEVICES_FILE, 'utf-8')
    const parsed = JSON.parse(data)
    return parsed.devices || []
  } catch (error) {
    // File might not exist yet, return empty array
    return []
  }
}

async function loadEverPassDevices() {
  try {
    const data = await fs.readFile(EVERPASS_DEVICES_FILE, 'utf-8')
    const parsed = JSON.parse(data)
    return parsed.devices || []
  } catch (error) {
    // File might not exist yet, return empty array
    return []
  }
}
