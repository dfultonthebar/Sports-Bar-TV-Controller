import { NextRequest, NextResponse } from 'next/server'
import { queryAtlasHardwareConfiguration, testAtlasConnection } from '@/lib/atlas-hardware-query'
import { prisma } from '@/lib/db'
import fs from 'fs/promises'
import path from 'path'

const CONFIG_DIR = path.join(process.cwd(), 'data', 'atlas-configs')

/**
 * POST /api/atlas/query-hardware
 * Query the Atlas hardware for actual source and zone names
 * 
 * Body:
 * - processorId: The ID of the audio processor
 * - testOnly: If true, only test connection without saving (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const { processorId, testOnly } = await request.json()

    if (!processorId) {
      return NextResponse.json({ error: 'Processor ID is required' }, { status: 400 })
    }

    // Fetch the processor from database
    const processor = await prisma.audioProcessor.findUnique({
      where: { id: processorId }
    })

    if (!processor) {
      return NextResponse.json({ error: 'Audio processor not found' }, { status: 404 })
    }

    // Use tcpPort for Atlas communication (default 5321 for JSON-RPC 2.0)
    const ipAddress = processor.ipAddress
    const port = processor.tcpPort || 5321

    console.log(`[Query Hardware] Querying Atlas processor at ${ipAddress}:${port}`)

    // If testOnly, just test connection
    if (testOnly) {
      const connectionSuccess = await testAtlasConnection(ipAddress, port)
      return NextResponse.json({
        success: connectionSuccess,
        message: connectionSuccess 
          ? `Successfully connected to Atlas processor at ${ipAddress}:${port}` 
          : `Failed to connect to Atlas processor at ${ipAddress}:${port}`,
        ipAddress,
        port
      })
    }

    // Query the hardware configuration
    let hardwareConfig
    try {
      hardwareConfig = await queryAtlasHardwareConfiguration(ipAddress, port, processor.model)
    } catch (error) {
      console.error('[Query Hardware] Failed to query hardware:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to query Atlas hardware',
        details: error instanceof Error ? error.message : 'Unknown error',
        ipAddress,
        port
      }, { status: 500 })
    }

    // Convert hardware config to API format
    const inputs = hardwareConfig.sources.map(source => ({
      id: `source_${source.index}`,
      number: source.index + 1, // 1-based numbering for display
      name: source.name,
      type: 'atlas_configured',
      connector: 'Hardware',
      description: `Atlas configured source: ${source.name}`,
      parameterName: source.parameterName,
      isCustom: true,
      queriedFromHardware: true
    }))

    const outputs = hardwareConfig.zones.map(zone => ({
      id: `zone_${zone.index}`,
      number: zone.index + 1, // 1-based numbering for display
      name: zone.name,
      type: 'zone',
      connector: 'Hardware',
      description: `Atlas configured zone: ${zone.name}`,
      parameterName: zone.parameterName,
      currentSource: zone.currentSource,
      volume: zone.volume,
      muted: zone.muted,
      isCustom: true,
      queriedFromHardware: true
    }))

    // Save configuration to file
    const config = {
      processorId,
      ipAddress,
      port,
      model: processor.model,
      inputs,
      outputs,
      scenes: [],
      messages: [],
      queriedAt: hardwareConfig.queriedAt,
      source: 'hardware_query'
    }

    // Ensure config directory exists
    try {
      await fs.access(CONFIG_DIR)
    } catch {
      await fs.mkdir(CONFIG_DIR, { recursive: true })
    }

    const configPath = path.join(CONFIG_DIR, `${processorId}.json`)
    await fs.writeFile(configPath, JSON.stringify(config, null, 2))

    // Also save a backup with timestamp
    const backupPath = path.join(CONFIG_DIR, `${processorId}_backup_${Date.now()}.json`)
    await fs.writeFile(backupPath, JSON.stringify(config, null, 2))

    // Update processor status to online
    await prisma.audioProcessor.update({
      where: { id: processorId },
      data: {
        status: 'online',
        lastSeen: new Date()
      }
    })

    // Update or create zones in database
    for (const zone of hardwareConfig.zones) {
      await prisma.audioZone.upsert({
        where: {
          processorId_zoneNumber: {
            processorId: processorId,
            zoneNumber: zone.index
          }
        },
        update: {
          name: zone.name,
          volume: zone.volume || 50,
          muted: zone.muted || false,
          currentSource: zone.currentSource !== -1 ? String(zone.currentSource) : null
        },
        create: {
          processorId: processorId,
          zoneNumber: zone.index,
          name: zone.name,
          volume: zone.volume || 50,
          muted: zone.muted || false,
          currentSource: zone.currentSource !== -1 ? String(zone.currentSource) : null,
          enabled: true
        }
      })
    }

    console.log(`[Query Hardware] Successfully saved configuration for processor ${processorId}`)

    return NextResponse.json({
      success: true,
      message: 'Hardware configuration queried and saved successfully',
      configuration: {
        sources: hardwareConfig.totalSources,
        zones: hardwareConfig.totalZones,
        queriedAt: hardwareConfig.queriedAt
      },
      inputs,
      outputs,
      ipAddress,
      port
    })

  } catch (error) {
    console.error('[Query Hardware] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to query hardware configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET /api/atlas/query-hardware
 * Check if hardware configuration exists and when it was last queried
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const processorId = searchParams.get('processorId')

    if (!processorId) {
      return NextResponse.json({ error: 'Processor ID is required' }, { status: 400 })
    }

    const configPath = path.join(CONFIG_DIR, `${processorId}.json`)
    
    try {
      const configData = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(configData)
      
      return NextResponse.json({
        success: true,
        exists: true,
        queriedAt: config.queriedAt,
        source: config.source,
        sourcesCount: config.inputs?.length || 0,
        zonesCount: config.outputs?.length || 0
      })
    } catch (error) {
      return NextResponse.json({
        success: true,
        exists: false,
        message: 'No hardware configuration found. Click "Query Hardware" to fetch from Atlas.'
      })
    }

  } catch (error) {
    console.error('[Query Hardware] GET Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check hardware configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
