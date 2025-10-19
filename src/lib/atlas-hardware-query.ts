
/**
 * Atlas Hardware Query Service
 * 
 * Queries the Atlas AZMP8 hardware directly via TCP to retrieve:
 * - Actual source/input names (as configured in the Atlas web interface)
 * - Actual zone/output names (as configured in the Atlas web interface)
 * - Current zone status (source selection, volume, mute state)
 * 
 * This replaces mock/model data with REAL hardware configuration.
 */

import { AtlasTCPClient } from './atlasClient'
import { atlasLogger } from './atlas-logger'

export interface AtlasHardwareSource {
  index: number
  name: string
  parameterName: string // e.g., "SourceName_0"
}

export interface AtlasHardwareZone {
  index: number
  name: string
  parameterName: string // e.g., "ZoneName_0"
  currentSource?: number
  volume?: number // 0-100 percentage
  muted?: boolean
}

export interface AtlasHardwareConfig {
  ipAddress: string
  port: number
  model: string
  sources: AtlasHardwareSource[]
  zones: AtlasHardwareZone[]
  totalSources: number
  totalZones: number
  queriedAt: string
}

/**
 * Query the Atlas hardware for actual source and zone names
 */
export async function queryAtlasHardwareConfiguration(
  ipAddress: string,
  port: number = 5321,
  model: string = 'AZMP8'
): Promise<AtlasHardwareConfig> {
  const client = new AtlasTCPClient({ ipAddress, port })
  
  try {
    atlasLogger.info('HARDWARE_QUERY', `Starting hardware query for ${model} at ${ipAddress}:${port}`)
    await client.connect()

    // Determine number of sources and zones based on model
    const maxSources = getMaxSourcesForModel(model)
    const maxZones = getMaxZonesForModel(model)

    atlasLogger.info('HARDWARE_QUERY', `Querying ${maxSources} sources and ${maxZones} zones`)

    // Query all source names
    const sources: AtlasHardwareSource[] = []
    for (let i = 0; i < maxSources; i++) {
      try {
        const paramName = `SourceName_${i}`
        const response = await client.getParameter(paramName, 'str')
        
        if (response.success && response.data && response.data.result) {
          // JSON-RPC 2.0 response format: {"jsonrpc":"2.0","result":{"param":"SourceName_0","str":"Matrix 1 (M1)"},"id":N}
          const result = response.data.result
          const sourceName = result.str || result.val || `Source ${i + 1}`
          sources.push({
            index: i,
            name: sourceName,
            parameterName: paramName
          })
          atlasLogger.debug('HARDWARE_QUERY', `Source ${i}: ${sourceName}`)
        } else {
          atlasLogger.warn('HARDWARE_QUERY', `Failed to get ${paramName}`)
        }
      } catch (error) {
        atlasLogger.error('HARDWARE_QUERY', `Error querying source ${i}`, error)
        // Add a placeholder source
        sources.push({
          index: i,
          name: `Source ${i + 1}`,
          parameterName: `SourceName_${i}`
        })
      }
      
      // Small delay between queries to avoid overwhelming the device
      await delay(100)
    }

    // Query all zone names and current status
    const zones: AtlasHardwareZone[] = []
    for (let i = 0; i < maxZones; i++) {
      try {
        const paramName = `ZoneName_${i}`
        
        // Get zone name
        const nameResponse = await client.getParameter(paramName, 'str')
        const zoneName = nameResponse.success && nameResponse.data?.result?.str 
          ? nameResponse.data.result.str 
          : `Zone ${i + 1}`

        // Get current source
        const sourceResponse = await client.getParameter(`ZoneSource_${i}`, 'val')
        const currentSource = sourceResponse.success && sourceResponse.data?.result?.val !== undefined
          ? sourceResponse.data.result.val
          : -1

        // Get volume (as percentage)
        const volumeResponse = await client.getParameter(`ZoneGain_${i}`, 'pct')
        const volume = volumeResponse.success && volumeResponse.data?.result?.pct !== undefined
          ? volumeResponse.data.result.pct
          : 50

        // Get mute state
        const muteResponse = await client.getParameter(`ZoneMute_${i}`, 'val')
        const muted = muteResponse.success && muteResponse.data?.result?.val !== undefined
          ? muteResponse.data.result.val === 1
          : false

        zones.push({
          index: i,
          name: zoneName,
          parameterName: paramName,
          currentSource,
          volume,
          muted
        })

        atlasLogger.debug('HARDWARE_QUERY', `Zone ${i}: ${zoneName} (Source: ${currentSource}, Volume: ${volume}%, Muted: ${muted})`)
      } catch (error) {
        atlasLogger.error('HARDWARE_QUERY', `Error querying zone ${i}`, error)
        // Add a placeholder zone
        zones.push({
          index: i,
          name: `Zone ${i + 1}`,
          parameterName: `ZoneName_${i}`,
          currentSource: -1,
          volume: 50,
          muted: false
        })
      }
      
      // Small delay between queries
      await delay(100)
    }

    const config: AtlasHardwareConfig = {
      ipAddress,
      port,
      model,
      sources,
      zones,
      totalSources: sources.length,
      totalZones: zones.length,
      queriedAt: new Date().toISOString()
    }

    atlasLogger.info('HARDWARE_QUERY', `Successfully queried hardware configuration`, {
      sources: config.totalSources,
      zones: config.totalZones
    })

    return config

  } catch (error) {
    atlasLogger.error('HARDWARE_QUERY', 'Fatal error during hardware query', error)
    throw new Error(`Failed to query Atlas hardware: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    client.disconnect()
  }
}

/**
 * Get maximum number of sources for a given Atlas model
 */
function getMaxSourcesForModel(model: string): number {
  // Based on investigation report, AZMP8 has 9 sources (Matrix 1-4, Mic 1-2, Spotify, Party Room East/West)
  // AZM4/AZMP4: typically 6-10 sources
  // AZM8/AZMP8: typically 9-14 sources
  
  if (model.includes('AZMP8') || model.includes('AZM8')) {
    return 9 // Based on actual hardware investigation
  } else if (model.includes('AZMP4') || model.includes('AZM4')) {
    return 6
  }
  
  return 9 // Default to 9 for unknown models
}

/**
 * Get maximum number of zones for a given Atlas model
 */
function getMaxZonesForModel(model: string): number {
  // Based on investigation report, AZMP8 has 5 zones (Main Bar, Dining Room, Party Room West, Patio, Bathroom)
  
  if (model.includes('8')) {
    return 8 // AZM8/AZMP8 can have up to 8 zones
  } else if (model.includes('4')) {
    return 4 // AZM4/AZMP4 have 4 zones
  }
  
  return 5 // Default based on actual hardware
}

/**
 * Helper function to add delay between queries
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Validate that we can connect to the Atlas hardware
 */
export async function testAtlasConnection(ipAddress: string, port: number = 5321): Promise<boolean> {
  const client = new AtlasTCPClient({ ipAddress, port, timeout: 5000 })
  
  try {
    atlasLogger.info('CONNECTION_TEST', `Testing connection to ${ipAddress}:${port}`)
    await client.connect()
    
    // Try to get a simple parameter to verify communication
    const response = await client.getParameter('SourceName_0', 'str')
    const success = response.success
    
    atlasLogger.info('CONNECTION_TEST', `Communication test: ${success ? 'PASSED' : 'FAILED'}`)
    return success
  } catch (error) {
    atlasLogger.error('CONNECTION_TEST', 'Connection test failed', error)
    return false
  } finally {
    client.disconnect()
  }
}
