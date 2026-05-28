

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { audioInputMeters } from '@/db/schema'
import { findMany, findUnique, findFirst, create, update, updateMany, deleteRecord, upsert, count, eq, desc, asc, and, or, ne } from '@/lib/db-helpers'
import { schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { atlasMeterManager } from '@/lib/atlas-meter-manager'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error

  try {
    const { searchParams } = new URL(request.url)
    const processorId = searchParams.get('processorId')

    if (!processorId) {
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }

    // v2.54.93: read live meters from atlasMeterManager (UDP cache) instead
    // of the never-populated audioInputMeters DB table. Mirrors the working
    // pattern at /api/atlas/input-meters. Subscribes to meters on first call
    // (lazy init, idempotent).
    //
    // Why: the DB-table-backed path was speculative infra that never had a
    // writer. Meter readings only exist in the in-memory atlasMeterManager
    // singleton (UDP port 3131 push from Atlas, cached per-processor IP).
    // The bartender UI calling this endpoint was getting empty arrays
    // forever, blocking sound-check meter visibility during live events
    // (e.g. 2026-05-27 acoustic band on Patio Band Input 4).
    const processor = await findFirst('audioProcessors', {
      where: eq(schema.audioProcessors.id, processorId)
    }) as any

    if (!processor) {
      return NextResponse.json({ error: 'Processor not found' }, { status: 404 })
    }

    // Only Atlas processors have live meters via UDP (Shure SLX-D etc are different)
    if (processor.processorType !== 'atlas') {
      return NextResponse.json({ inputMeters: [], note: 'Live meters only available for Atlas processors' })
    }

    const processorIp = processor.ipAddress
    const inputCount = processor.inputs || 14

    // Ensure subscription (lazy init, idempotent per atlasMeterManager.isSubscribed)
    if (!atlasMeterManager.isSubscribed(processorIp)) {
      logger.info(`[METER-STATUS] Subscribing to meters for ${processorIp}...`)
      await atlasMeterManager.subscribeToMeters(
        `processor-${processorIp}`,
        processorIp,
        inputCount,
        processor.outputs || 8,
        8 // groups
      )
    }

    const rawMeters = atlasMeterManager.getInputMeters(processorIp, inputCount)

    // v2.54.94: fetch Atlas source labels (SourceName_X) and overlay onto
    // meter data — bartender UI was showing generic "Input 1"..."Input 14"
    // instead of "Pavillion Band" / "MIC 1" / "Patio Band" etc. Mirrors
    // the working pattern at /api/atlas/input-meters lines 50-90 using the
    // shared persistent client (no new TCP connection).
    let nameResults: any[] = []
    try {
      const { getAtlasClient, releaseAtlasClient } = await import('@/lib/atlas-client-manager')
      const { HARDWARE_CONFIG } = await import('@/lib/hardware-config')
      const client = await getAtlasClient(
        `processor-${processorIp}`,
        { ipAddress: processorIp, tcpPort: HARDWARE_CONFIG.atlas.tcpPort, timeout: 5000 }
      )
      const namePromises = []
      for (let i = 0; i < inputCount; i++) {
        namePromises.push(
          client.sendCommand({ method: 'get', param: `SourceName_${i}`, format: 'str' })
            .catch(() => null)
        )
      }
      nameResults = await Promise.all(namePromises)
      releaseAtlasClient(processorIp, HARDWARE_CONFIG.atlas.tcpPort)
    } catch (e) {
      logger.warn('[METER-STATUS] Could not fetch Atlas source names, using generic labels', e)
    }

    // Adapt to the shape the bartender UI's existing component expects
    // (mimics the old DB-row shape with extra status indicators).
    const WARN = -20  // dB
    const DANGER = -3 // dB
    const metersWithStatus = rawMeters.map((m, idx) => {
      const currentLevel = m.level
      let status = 'normal'
      let statusColor = 'green'
      if (currentLevel > DANGER) {
        status = 'danger'
        statusColor = 'red'
      } else if (currentLevel > WARN) {
        status = 'warning'
        statusColor = 'yellow'
      }
      // Extract Atlas label (overlay onto meter); fall back to cached + generic
      let name = m.name || `Input ${m.index + 1}`
      const nr = nameResults[idx]
      if (nr?.result && Array.isArray(nr.result) && nr.result[0]?.str) {
        name = nr.result[0].str
      }
      return {
        id: `meter_${m.index}`,
        processorId,
        inputNumber: m.index + 1,
        name,
        currentLevel,
        peakLevel: m.peak,
        warningThreshold: WARN,
        dangerThreshold: DANGER,
        clipping: m.clipping,
        lastUpdate: new Date().toISOString(),
        status,
        statusColor,
        isStale: false,
        isReceiving: true
      }
    })

    return NextResponse.json({ inputMeters: metersWithStatus })
  } catch (error) {
    logger.error('Error fetching meter status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meter status' },
      { status: 500 }
    )
  }
}

// Reset peak levels for all meters
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.object({
    processorId: z.string()
  }))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  try {
    const { processorId } = bodyValidation.data

    if (!processorId) {
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }

    await updateMany('audioInputMeters',
      eq(schema.audioInputMeters.processorId, processorId),
      { peakLevel: -80.0 } // Reset to minimum
    )

    return NextResponse.json({ success: true, message: 'Peak levels reset' })
  } catch (error) {
    logger.error('Error resetting peak levels:', error)
    return NextResponse.json(
      { error: 'Failed to reset peak levels' },
      { status: 500 }
    )
  }
}

