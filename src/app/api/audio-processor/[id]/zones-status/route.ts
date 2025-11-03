import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
import { queryAtlasHardwareConfiguration as queryAtlasHardware } from '@/lib/atlas-hardware-query'
import { audioProcessors } from '@/db/schema'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Path parameter validation
  const resolvedParams = await params
  const paramsValidation = validatePathParams(resolvedParams, z.object({ id: z.string().min(1) }))
  if (!paramsValidation.success) return paramsValidation.error


  try {
    const { id } = await params
    const processorId = id

    // Fetch processor from database
    const processor = await db.select().from(audioProcessors).where(eq(audioProcessors.id, processorId)).limit(1).get()

    if (!processor) {
      return NextResponse.json(
        { error: 'Audio processor not found' },
        { status: 404 }
      )
    }

    // Query the Atlas hardware for current configuration
    const hardwareConfig = await queryAtlasHardware(
      processor.ipAddress,
      processor.tcpPort || 5321,
      processor.model || 'AZMP8',  // Atlas processor model
      processor.port || 80,  // HTTP port
      processor.username || undefined,  // HTTP basic auth username
      processor.password || undefined  // HTTP basic auth password
    )

    /**
     * Helper function to extract string value from Atlas parameter response
     * Atlas may return values in format: [{param: "SourceName_0", str: "Matrix 1"}]
     */
    const extractStringValue = (value: any, defaultValue: string): string => {
      if (typeof value === 'string') {
        return value
      }
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0]
        if (typeof first === 'object' && first !== null) {
          return first.str || first.val || defaultValue
        }
      }
      if (typeof value === 'object' && value !== null) {
        return value.str || value.val || defaultValue
      }
      return defaultValue
    }

    /**
     * Helper function to extract numeric value from Atlas parameter response
     * Atlas may return values in format: [{param: "ZoneGain_0", pct: 100}] or [{param: "ZoneSource_0", val: -1}]
     */
    const extractNumericValue = (value: any, defaultValue: number): number => {
      if (typeof value === 'number') {
        return value
      }
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0]
        if (typeof first === 'object' && first !== null) {
          return first.pct ?? first.val ?? defaultValue
        }
      }
      if (typeof value === 'object' && value !== null) {
        return value.pct ?? value.val ?? defaultValue
      }
      return defaultValue
    }

    // Format the response with zones including their current sources and outputs
    const zonesWithStatus = hardwareConfig.zones.map(zone => {
      const zoneName = extractStringValue(zone.name, `Zone ${zone.index + 1}`)
      const currentSource = extractNumericValue(zone.currentSource, -1)
      const volume = extractNumericValue(zone.volume, 50)
      const isMuted = zone.muted || false

      return {
        id: `zone_${zone.index}`,
        zoneNumber: zone.index + 1, // Convert to 1-based for UI display
        atlasIndex: zone.index, // Keep 0-based for Atlas protocol
        name: zoneName,
        currentSource: currentSource,
        currentSourceName: currentSource >= 0 
          ? extractStringValue(hardwareConfig.sources[currentSource]?.name, `Source ${currentSource + 1}`)
          : 'Not Set',
        volume: volume,
        isMuted: isMuted,
        isActive: true,
        outputs: zone.outputs?.map(output => ({
          id: `output_${zone.index}_${output.index}`,
          outputNumber: output.index + 1, // Convert to 1-based for UI display
          atlasIndex: output.index, // Keep 0-based for Atlas protocol
          name: output.name,
          type: output.type,
          volume: extractNumericValue(output.volume, 50),
          parameterName: output.parameterName
        })) || [{
          id: `output_${zone.index}_0`,
          outputNumber: 1,
          atlasIndex: 0,
          name: 'Main',
          type: 'mono',
          volume: volume,
          parameterName: `ZoneGain_${zone.index}`
        }]
      }
    })

    // Format sources for dropdown selection
    const sources = hardwareConfig.sources.map(source => ({
      id: `source_${source.index}`,
      sourceNumber: source.index + 1,
      atlasIndex: source.index,
      name: extractStringValue(source.name, `Source ${source.index + 1}`),
      type: source.type || 'unknown'
    }))

    return NextResponse.json({
      success: true,
      zones: zonesWithStatus,
      sources: sources,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error fetching zones status:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch zones status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
