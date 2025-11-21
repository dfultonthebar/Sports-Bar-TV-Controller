import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateQueryParams, isValidationError } from '@/lib/validation'
import { atlasMeterManager } from '@/lib/atlas-meter-manager'

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

    if (!processorIp) {
      return NextResponse.json(
        { success: false, error: 'Processor IP is required' },
        { status: 400 }
      )
    }

    // Ensure we're subscribed to meters for this processor
    if (!atlasMeterManager.isSubscribed(processorIp)) {
      logger.info(`[INPUT METERS] Subscribing to meters for ${processorIp}...`)
      await atlasMeterManager.subscribeToMeters(
        `processor-${processorIp}`, // processor ID
        processorIp,
        14, // input count (AZMP8)
        8,  // output count
        8   // group count
      )
    }

    // Get cached meter values (instant response!)
    const meters = atlasMeterManager.getInputMeters(processorIp, 14)

    // Get source names using the SHARED client from client manager
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

    const namePromises = []
    for (let i = 0; i < 14; i++) {
      namePromises.push(
        client.sendCommand({
          method: 'get',
          param: `SourceName_${i}`,
          format: 'str'
        }).catch(() => null)
      )
    }

    const nameResults = await Promise.all(namePromises)

    // Don't disconnect - this is a shared persistent client
    // Just release our reference so it can be cleaned up later if idle
    releaseAtlasClient(processorIp, 5321)

    // Add names to meter data
    const metersWithNames = meters.map((meter, index) => {
      let name = `Input ${index + 1}`
      if (nameResults[index]?.result && Array.isArray(nameResults[index].result)) {
        name = nameResults[index].result[0]?.str || name
      }
      return {
        ...meter,
        name
      }
    })

    return NextResponse.json({
      success: true,
      meters: metersWithNames,
      timestamp: Date.now()
    })
  } catch (error) {
    logger.error('Error fetching input meters:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch input meters'
      },
      { status: 500 }
    )
  }
}
