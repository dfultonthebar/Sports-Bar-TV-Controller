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

    // Format the response with zones including their current sources and outputs
    const zonesWithStatus = hardwareConfig.zones.map(zone => ({
      id: `zone_${zone.index}`,
      zoneNumber: zone.index + 1, // Convert to 1-based for UI display
      atlasIndex: zone.index, // Keep 0-based for Atlas protocol
      name: zone.name,
      currentSource: zone.currentSource,
      currentSourceName: zone.currentSource >= 0 
        ? hardwareConfig.sources[zone.currentSource]?.name || `Source ${zone.currentSource + 1}`
        : 'Not Set',
      volume: zone.volume || 50,
      isMuted: zone.muted || false,
      isActive: true,
      outputs: zone.outputs?.map(output => ({
        id: `output_${zone.index}_${output.index}`,
        outputNumber: output.index + 1, // Convert to 1-based for UI display
        atlasIndex: output.index, // Keep 0-based for Atlas protocol
        name: output.name,
        type: output.type,
        volume: output.volume || 50,
        parameterName: output.parameterName
      })) || [{
        id: `output_${zone.index}_0`,
        outputNumber: 1,
        atlasIndex: 0,
        name: 'Main',
        type: 'mono',
        volume: zone.volume || 50,
        parameterName: `ZoneGain_${zone.index}`
      }]
    }))

    // Format sources for dropdown selection
    const sources = hardwareConfig.sources.map(source => ({
      id: `source_${source.index}`,
      sourceNumber: source.index + 1, // Convert to 1-based for UI display
      atlasIndex: source.index, // Keep 0-based for Atlas protocol
      name: source.name,
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
