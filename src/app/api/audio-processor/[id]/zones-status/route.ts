/**
 * Atlas Zones Status API
 * 
 * Fetches real-time zone status from the Atlas processor including:
 * - Zone names (as configured in Atlas)
 * - Current source assignments
 * - Volume levels
 * - Mute states
 * 
 * Uses the atlas-hardware-query service to query the actual hardware.
 */

import { NextRequest, NextResponse } from 'next/server'
import { findFirst, eq } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { queryAtlasHardwareConfiguration } from '@/lib/atlas-hardware-query'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Await params for Next.js 15+ compatibility
    const params = await context.params
    const processorId = params.id

    logger.api.request('GET', `/api/audio-processor/${processorId}/zones-status`)

    // Use Drizzle ORM with db-helpers for proper field mapping
    const processor = await findFirst('audioProcessors', {
      where: eq(schema.audioProcessors.id, processorId)
    })

    if (!processor) {
      logger.api.response('GET', `/api/audio-processor/${processorId}/zones-status`, 404)
      return NextResponse.json(
        { error: 'Audio processor not found' },
        { status: 404 }
      )
    }

    // Ensure port values are properly defined
    const tcpPort = processor.tcpPort ?? 5321
    const httpPort = processor.port ?? 80
    
    logger.atlas.info('Querying hardware configuration', {
      processorName: processor.name,
      ipAddress: processor.ipAddress,
      tcpPort: tcpPort,
      httpPort: httpPort
    })

    // Query the actual hardware configuration
    const hardwareConfig = await queryAtlasHardwareConfiguration(
      processor.ipAddress,
      tcpPort, // TCP control port (JSON-RPC)
      processor.model,
      httpPort, // HTTP port for configuration discovery
      processor.username || undefined, // HTTP basic auth username
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

    // Format the response with zones including their current sources
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
        isActive: true
      }
    })

    // Format sources for dropdown selection
    const sources = hardwareConfig.sources.map(source => ({
      id: `source_${source.index}`,
      sourceNumber: source.index + 1, // Convert to 1-based for UI display
      atlasIndex: source.index, // Keep 0-based for Atlas protocol
      name: extractStringValue(source.name, `Source ${source.index + 1}`),
      parameterName: source.parameterName
    }))

    logger.api.response('GET', `/api/audio-processor/${processor.id}/zones-status`, 200, {
      zonesCount: zonesWithStatus.length,
      sourcesCount: sources.length
    })

    return NextResponse.json({
      success: true,
      processor: {
        id: processor.id,
        name: processor.name,
        model: processor.model,
        ipAddress: processor.ipAddress
      },
      zones: zonesWithStatus,
      sources: sources,
      queriedAt: hardwareConfig.queriedAt
    })

  } catch (error) {
    const params = await context.params
    logger.api.error('GET', `/api/audio-processor/${params.id}/zones-status`, error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch zones status from Atlas processor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
