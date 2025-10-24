import { NextRequest, NextResponse } from 'next/server'
import { queryAtlasHardwareConfiguration, testAtlasConnection } from '@/lib/atlas-hardware-query'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { audioZones, audioGroups, audioProcessors } from '@/db/schema'
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
    const processor = await db
      .select()
      .from(audioProcessors)
      .where(eq(audioProcessors.id, processorId))
      .limit(1)
      .get()

    if (!processor) {
      return NextResponse.json({ error: 'Audio processor not found' }, { status: 404 })
    }

    // Use correct ports for Atlas communication
    // - HTTP port (default 80): For web interface and configuration discovery
    // - TCP port (default 5321): For JSON-RPC control commands
    const ipAddress = processor.ipAddress
    const httpPort = processor.port || 80
    const tcpPort = processor.tcpPort || 5321  // Changed default from 23 to 5321
    const username = processor.username || undefined
    const password = processor.password || undefined

    console.log(`[Query Hardware] Querying Atlas processor at ${ipAddress}`)
    console.log(`[Query Hardware] HTTP Port: ${httpPort}, TCP Port: ${tcpPort}`)

    // If testOnly, just test connection
    if (testOnly) {
      const connectionSuccess = await testAtlasConnection(ipAddress, tcpPort)
      return NextResponse.json({
        success: connectionSuccess,
        message: connectionSuccess 
          ? `Successfully connected to Atlas processor at ${ipAddress}:${tcpPort}` 
          : `Failed to connect to Atlas processor at ${ipAddress}:${tcpPort}`,
        ipAddress,
        httpPort,
        tcpPort
      })
    }

    // Query the hardware configuration
    let hardwareConfig
    try {
      hardwareConfig = await queryAtlasHardwareConfiguration(
        ipAddress, 
        tcpPort,     // TCP control port
        processor.model,
        httpPort,    // HTTP web interface port
        username,    // HTTP basic auth
        password     // HTTP basic auth
      )
    } catch (error) {
      console.error('[Query Hardware] Failed to query hardware:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to query Atlas hardware',
        details: error instanceof Error ? error.message : 'Unknown error',
        ipAddress,
        httpPort,
        tcpPort
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
      httpPort,
      tcpPort,
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
    await db
      .update(audioProcessors)
      .set({
        status: 'online',
        lastSeen: new Date().toISOString()
      })
      .where(eq(audioProcessors.id, processorId))
      .run()

    // Update or create zones in database using direct Drizzle ORM
    // This fixes the SQLite binding error by properly handling the composite key
    for (const zone of hardwareConfig.zones) {
      try {
        // Extract primitive values from Atlas response objects
        // This handles multiple data formats that Atlas might return
        const extractValue = (data: any, defaultValue: any = null) => {
          // Handle null/undefined
          if (data === null || data === undefined) {
            return defaultValue
          }
          
          // Handle arrays
          if (Array.isArray(data)) {
            // Empty array - return default
            if (data.length === 0) {
              return defaultValue
            }
            
            const firstItem = data[0]
            
            // Handle array of objects with Atlas response format
            if (typeof firstItem === 'object' && firstItem !== null) {
              // Try to extract value from common Atlas response fields
              if (firstItem.str !== undefined) return String(firstItem.str)
              if (firstItem.val !== undefined) return firstItem.val
              if (firstItem.pct !== undefined) return Math.round(firstItem.pct)
            }
            
            // Handle array of primitives
            if (typeof firstItem === 'string' || typeof firstItem === 'number' || typeof firstItem === 'boolean') {
              return firstItem
            }
            
            return defaultValue
          }
          
          // Handle objects (but not arrays)
          if (typeof data === 'object') {
            // If it's a nested object, try to extract a primitive value
            if (data.value !== undefined) {
              return extractValue(data.value, defaultValue)
            }
            if (data.str !== undefined) return String(data.str)
            if (data.val !== undefined) return data.val
            if (data.pct !== undefined) return Math.round(data.pct)
            
            // If we can't extract a primitive, return default
            console.warn(`[Query Hardware] Cannot extract primitive from object for zone ${zone.index}:`, JSON.stringify(data))
            return defaultValue
          }
          
          // Handle primitives (string, number, boolean)
          if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
            return data
          }
          
          // Fallback
          return defaultValue
        }

        const zoneName = extractValue(zone.name, `Zone ${zone.index + 1}`)
        const zoneVolume = extractValue(zone.volume, 50)
        const zoneMuted = zone.muted === true || zone.muted === 1
        const zoneSource = extractValue(zone.currentSource, -1)
        
        // Validate and sanitize all values to ensure SQLite compatibility
        // SQLite can only bind: numbers, strings, bigints, buffers, and null
        const sanitizedName = typeof zoneName === 'string' ? zoneName : 
                             typeof zoneName === 'number' ? String(zoneName) : 
                             `Zone ${zone.index + 1}`
        
        const sanitizedVolume = typeof zoneVolume === 'number' ? Math.round(zoneVolume) : 
                               typeof zoneVolume === 'string' ? parseInt(zoneVolume, 10) || 50 : 
                               50
        
        const sanitizedMuted = Boolean(zoneMuted)
        
        const sanitizedSource = zoneSource === null || zoneSource === undefined || zoneSource === -1 ? null :
                               typeof zoneSource === 'number' ? String(zoneSource) :
                               typeof zoneSource === 'string' ? zoneSource :
                               null
        
        console.log(`[Query Hardware] Zone ${zone.index} sanitized values:`, {
          name: sanitizedName,
          volume: sanitizedVolume,
          muted: sanitizedMuted,
          currentSource: sanitizedSource
        })
        
        // First, try to find existing zone by processorId and zoneNumber
        const existingZone = await db
          .select()
          .from(audioZones)
          .where(
            and(
              eq(audioZones.processorId, processorId),
              eq(audioZones.zoneNumber, zone.index)
            )
          )
          .limit(1)
          .get()

        const zoneData = {
          name: sanitizedName,
          volume: sanitizedVolume,
          muted: sanitizedMuted,
          currentSource: sanitizedSource,
          updatedAt: new Date().toISOString()
        }

        if (existingZone) {
          // Update existing zone
          await db
            .update(audioZones)
            .set(zoneData)
            .where(eq(audioZones.id, existingZone.id))
            .run()
        } else {
          // Create new zone
          await db
            .insert(audioZones)
            .values({
              processorId: processorId,
              zoneNumber: zone.index,
              name: sanitizedName,
              volume: sanitizedVolume,
              muted: sanitizedMuted,
              currentSource: sanitizedSource,
              enabled: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
            .run()
        }
        
        console.log(`[Query Hardware] Successfully saved zone ${zone.index}: ${sanitizedName}`)
      } catch (zoneError) {
        console.error(`[Query Hardware] Error upserting zone ${zone.index}:`, zoneError)
        // Continue with other zones even if one fails
      }
    }

    // Update or create groups in database
    for (const group of hardwareConfig.groups) {
      try {
        const groupName = typeof group.name === 'string' ? group.name : `Group ${group.index + 1}`
        const groupIsActive = Boolean(group.isActive)
        const groupGain = typeof group.gain === 'number' ? group.gain : -10
        const groupMuted = Boolean(group.muted)
        const groupSource = group.currentSource === null || group.currentSource === undefined || group.currentSource === -1 ? null :
                           typeof group.currentSource === 'number' ? String(group.currentSource) :
                           typeof group.currentSource === 'string' ? group.currentSource :
                           null
        
        console.log(`[Query Hardware] Group ${group.index} sanitized values:`, {
          name: groupName,
          isActive: groupIsActive,
          gain: groupGain,
          muted: groupMuted,
          currentSource: groupSource
        })
        
        // First, try to find existing group by processorId and groupNumber
        const existingGroup = await db
          .select()
          .from(audioGroups)
          .where(
            and(
              eq(audioGroups.processorId, processorId),
              eq(audioGroups.groupNumber, group.index)
            )
          )
          .limit(1)
          .get()

        const groupData = {
          name: groupName,
          isActive: groupIsActive,
          currentSource: groupSource,
          gain: groupGain,
          muted: groupMuted,
          updatedAt: new Date().toISOString()
        }

        if (existingGroup) {
          // Update existing group
          await db
            .update(audioGroups)
            .set(groupData)
            .where(eq(audioGroups.id, existingGroup.id))
            .run()
        } else {
          // Create new group
          await db
            .insert(audioGroups)
            .values({
              processorId: processorId,
              groupNumber: group.index,
              name: groupName,
              isActive: groupIsActive,
              currentSource: groupSource,
              gain: groupGain,
              muted: groupMuted,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
            .run()
        }
        
        console.log(`[Query Hardware] Successfully saved group ${group.index}: ${groupName} (Active: ${groupIsActive})`)
      } catch (groupError) {
        console.error(`[Query Hardware] Error upserting group ${group.index}:`, groupError)
        // Continue with other groups even if one fails
      }
    }

    console.log(`[Query Hardware] Successfully saved configuration for processor ${processorId}`)

    return NextResponse.json({
      success: true,
      message: 'Hardware configuration queried and saved successfully',
      configuration: {
        sources: hardwareConfig.totalSources,
        zones: hardwareConfig.totalZones,
        groups: hardwareConfig.totalGroups,
        queriedAt: hardwareConfig.queriedAt
      },
      inputs,
      outputs,
      ipAddress,
      httpPort,
      tcpPort
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
