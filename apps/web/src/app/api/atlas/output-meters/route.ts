import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { atlasMeterManager } from '@/lib/atlas-meter-manager'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateQueryParams, isValidationError } from '@/lib/validation'
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  try {
    const searchParams = request.nextUrl.searchParams
    const processorIp = searchParams.get('processorIp')
    const showGroups = searchParams.get('showGroups') === 'true'

    if (!processorIp) {
      return NextResponse.json(
        { success: false, error: 'Processor IP is required' },
        { status: 400 }
      )
    }

    // Ensure we're subscribed to meters for this processor
    if (!atlasMeterManager.isSubscribed(processorIp)) {
      logger.info(`[OUTPUT METERS] Subscribing to meters for ${processorIp}...`)
      await atlasMeterManager.subscribeToMeters(
        `processor-${processorIp}`,
        processorIp,
        14, // input count
        8,  // output count
        8   // group count
      )
    }

    // Get cached meter values (instant response!)
    let meters = atlasMeterManager.getOutputMeters(processorIp, 8)

    // Add group meters if requested
    if (showGroups) {
      const groupMeters = atlasMeterManager.getGroupMeters(processorIp, 8)
      meters = [...meters, ...groupMeters]
    }

    // Get zone names using the SHARED client from client manager
    // This reuses the existing connection instead of creating a new one
    const { getAtlasClient, releaseAtlasClient } = await import('@/lib/atlas-client-manager')
    const client = await getAtlasClient(
      `processor-${processorIp}`,
      {
        ipAddress: processorIp,
        tcpPort: 5321,
        timeout: 5000
      }
    )

    const zoneNamePromises = []
    const zoneMutePromises = []

    for (let i = 0; i < 8; i++) {
      zoneNamePromises.push(
        client.sendCommand({
          method: 'get',
          param: `ZoneName_${i}`,
          format: 'str'
        }).catch(() => null)
      )
      zoneMutePromises.push(
        client.sendCommand({
          method: 'get',
          param: `ZoneMute_${i}`,
          format: 'val'
        }).catch(() => null)
      )
    }

    const [zoneNameResults, zoneMuteResults] = await Promise.all([
      Promise.all(zoneNamePromises),
      Promise.all(zoneMutePromises)
    ])

    // Don't disconnect - this is a shared persistent client
    // Just release our reference so it can be cleaned up later if idle
    releaseAtlasClient(processorIp, 5321)

    // Add names and mute state to meter data
    const metersWithNames = meters.map((meter) => {
      let name = meter.name
      let muted = meter.muted

      if (meter.type === 'output' && zoneNameResults[meter.index]?.result) {
        const nameResult = zoneNameResults[meter.index].result
        if (Array.isArray(nameResult)) {
          name = nameResult[0]?.str || name
        }
        const muteResult = zoneMuteResults[meter.index]?.result
        if (Array.isArray(muteResult)) {
          muted = muteResult[0]?.val === 1
        }
      }

      return {
        ...meter,
        name,
        muted
      }
    })

    return NextResponse.json({
      success: true,
      meters: metersWithNames,
      timestamp: Date.now()
    })
  } catch (error) {
    logger.error('Error fetching output meters:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch output meters' 
      },
      { status: 500 }
    )
  }
}
