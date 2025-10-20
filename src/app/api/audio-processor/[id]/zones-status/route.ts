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
import { prisma } from '@/lib/db'
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

    // Verify database connection is available
    if (!prisma) {
      console.error('[Zones Status API] Database client is not initialized')
      return NextResponse.json(
        { error: 'Database connection error. Please check server configuration.' },
        { status: 500 }
      )
    }

    const processor = await prisma.audioProcessor.findUnique({
      where: { id: processorId }
    }).catch((dbError) => {
      console.error('[Zones Status API] Database query error:', dbError)
      throw new Error(`Database error: ${dbError.message}`)
    })

    if (!processor) {
      return NextResponse.json(
        { error: 'Audio processor not found' },
        { status: 404 }
      )
    }

    console.log(`[Zones Status API] Querying hardware configuration for ${processor.name} at ${processor.ipAddress}`)

    // Query the actual hardware configuration
    const hardwareConfig = await queryAtlasHardwareConfiguration(
      processor.ipAddress,
      processor.tcpPort || 5321, // Use tcpPort instead of port
      processor.model
    )

    // Format the response with zones including their current sources
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
      isActive: true
    }))

    // Format sources for dropdown selection
    const sources = hardwareConfig.sources.map(source => ({
      id: `source_${source.index}`,
      sourceNumber: source.index + 1, // Convert to 1-based for UI display
      atlasIndex: source.index, // Keep 0-based for Atlas protocol
      name: source.name,
      parameterName: source.parameterName
    }))

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
    console.error('[Zones Status API] Error fetching zones status:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch zones status from Atlas processor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
