/**
 * Atlas Hardware Query Service
 * 
 * Queries the Atlas AZMP8 hardware to retrieve:
 * - Actual source/input names (as configured in the Atlas web interface)
 * - Actual zone/output names (as configured in the Atlas web interface)
 * - Current zone status (source selection, volume, mute state)
 * 
 * Strategy:
 * 1. Try HTTP configuration discovery first (port 80 web interface)
 * 2. Fall back to TCP probing (port 5321) if HTTP fails
 * 
 * This replaces mock/model data with REAL hardware configuration.
 */

import { AtlasTCPClient } from './atlasClient'
import { AtlasHttpClient, discoverAtlasConfiguration } from './atlas-http-client'

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
 * 
 * @param ipAddress - IP address of the Atlas processor
 * @param tcpPort - TCP control port (default: 5321)
 * @param model - Processor model (e.g., 'AZMP8', 'AZM4')
 * @param httpPort - HTTP web interface port (default: 80)
 * @param username - HTTP basic auth username (optional)
 * @param password - HTTP basic auth password (optional)
 */
export async function queryAtlasHardwareConfiguration(
  ipAddress: string,
  tcpPort: number = 5321,  // Changed from 23 to 5321 (correct Atlas TCP port)
  model: string = 'AZMP8',
  httpPort: number = 80,
  username?: string,
  password?: string
): Promise<AtlasHardwareConfig> {
  
  console.log(`[Atlas Query] Starting configuration discovery for ${ipAddress}`)
  console.log(`[Atlas Query] HTTP Port: ${httpPort}, TCP Port: ${tcpPort}`)
  
  // STRATEGY 1: Try HTTP configuration discovery first
  try {
    console.log(`[Atlas Query] Attempting HTTP configuration discovery...`)
    const httpClient = new AtlasHttpClient({
      ipAddress,
      port: httpPort,
      username,
      password,
      timeout: 10000
    })

    const discoveredConfig = await httpClient.discoverConfiguration()
    
    if (discoveredConfig.sources.length > 0 || discoveredConfig.zones.length > 0) {
      console.log(`[Atlas Query] HTTP discovery successful!`)
      console.log(`[Atlas Query] Found ${discoveredConfig.sources.length} sources and ${discoveredConfig.zones.length} zones`)

      // Now get real-time status via TCP for each zone
      const client = new AtlasTCPClient({ ipAddress, port: tcpPort, timeout: 5000 })
      try {
        await client.connect()
        
        const zones: AtlasHardwareZone[] = []
        for (const zone of discoveredConfig.zones) {
          try {
            // Get current source
            const sourceResponse = await client.getParameter(`ZoneSource_${zone.index}`, 'val')
            let currentSource = -1
            if (sourceResponse.success && sourceResponse.data) {
              if (sourceResponse.data.method === 'getResp' && sourceResponse.data.params) {
                currentSource = sourceResponse.data.params.val ?? -1
              } else if (sourceResponse.data.value !== undefined) {
                currentSource = sourceResponse.data.value
              } else if (sourceResponse.data.result?.val !== undefined) {
                currentSource = sourceResponse.data.result.val
              }
            }

            // Get volume (as percentage)
            const volumeResponse = await client.getParameter(`ZoneGain_${zone.index}`, 'pct')
            let volume = 50
            if (volumeResponse.success && volumeResponse.data) {
              if (volumeResponse.data.method === 'getResp' && volumeResponse.data.params) {
                volume = volumeResponse.data.params.pct ?? 50
              } else if (volumeResponse.data.value !== undefined) {
                volume = volumeResponse.data.value
              } else if (volumeResponse.data.result?.pct !== undefined) {
                volume = volumeResponse.data.result.pct
              }
            }

            // Get mute state
            const muteResponse = await client.getParameter(`ZoneMute_${zone.index}`, 'val')
            let muted = false
            if (muteResponse.success && muteResponse.data) {
              if (muteResponse.data.method === 'getResp' && muteResponse.data.params) {
                muted = muteResponse.data.params.val === 1
              } else if (muteResponse.data.value !== undefined) {
                muted = muteResponse.data.value === 1
              } else if (muteResponse.data.result?.val !== undefined) {
                muted = muteResponse.data.result.val === 1
              }
            }

            zones.push({
              index: zone.index,
              name: zone.name,
              parameterName: zone.nameParam || `ZoneName_${zone.index}`,
              currentSource,
              volume,
              muted
            })
            
            await delay(50)
          } catch (error) {
            console.error(`[Atlas Query] Error getting zone ${zone.index} status:`, error)
            zones.push({
              index: zone.index,
              name: zone.name,
              parameterName: zone.nameParam || `ZoneName_${zone.index}`,
              currentSource: -1,
              volume: 50,
              muted: false
            })
          }
        }

        client.disconnect()

        const sources: AtlasHardwareSource[] = discoveredConfig.sources.map(source => ({
          index: source.index,
          name: source.name,
          parameterName: source.nameParam || `SourceName_${source.index}`
        }))

        return {
          ipAddress,
          port: tcpPort,
          model,
          sources,
          zones,
          totalSources: sources.length,
          totalZones: zones.length,
          queriedAt: discoveredConfig.queriedAt
        }
      } catch (tcpError) {
        client.disconnect()
        console.warn('[Atlas Query] TCP status query failed, using discovered config without real-time status')
        
        // Return configuration without real-time status
        const sources: AtlasHardwareSource[] = discoveredConfig.sources.map(source => ({
          index: source.index,
          name: source.name,
          parameterName: source.nameParam || `SourceName_${source.index}`
        }))

        const zones: AtlasHardwareZone[] = discoveredConfig.zones.map(zone => ({
          index: zone.index,
          name: zone.name,
          parameterName: zone.nameParam || `ZoneName_${zone.index}`,
          currentSource: -1,
          volume: 50,
          muted: false
        }))

        return {
          ipAddress,
          port: tcpPort,
          model,
          sources,
          zones,
          totalSources: sources.length,
          totalZones: zones.length,
          queriedAt: discoveredConfig.queriedAt
        }
      }
    }
  } catch (httpError) {
    console.warn('[Atlas Query] HTTP configuration discovery failed, falling back to TCP probing')
    console.warn('[Atlas Query] HTTP Error:', httpError instanceof Error ? httpError.message : httpError)
  }

  // STRATEGY 2: Fall back to TCP probing
  const client = new AtlasTCPClient({ ipAddress, port: tcpPort, timeout: 10000 })
  
  try {
    console.log(`[Atlas Query] Connecting via TCP to ${ipAddress}:${tcpPort}...`)
    console.log(`[Atlas Query] Using TCP port: ${tcpPort} (NOT ${httpPort})`)
    await client.connect()
    console.log(`[Atlas Query] Connected successfully to ${ipAddress}:${tcpPort}`)

    // Determine number of sources and zones based on model
    const maxSources = getMaxSourcesForModel(model)
    const maxZones = getMaxZonesForModel(model)

    console.log(`[Atlas Query] Querying ${maxSources} sources and ${maxZones} zones for model ${model}`)

    // Query all source names
    const sources: AtlasHardwareSource[] = []
    for (let i = 0; i < maxSources; i++) {
      try {
        const paramName = `SourceName_${i}`
        console.log(`[Atlas Query] Querying ${paramName}...`)
        const response = await client.getParameter(paramName, 'str')
        
        if (response.success && response.data) {
          // CRITICAL: GET responses use method "getResp" with "params"
          // Response format: {"jsonrpc":"2.0","method":"getResp","params":{"param":"SourceName_0","str":"Matrix 1 (M1)"}}
          let sourceName = `Source ${i + 1}` // Default fallback
          
          if (response.data.method === 'getResp' && response.data.params) {
            sourceName = response.data.params.str || response.data.params.val || sourceName
          } else if (response.data.value !== undefined) {
            // Use the extracted value from the client
            sourceName = response.data.value
          } else if (response.data.result) {
            // Fallback for old format
            const result = response.data.result
            sourceName = result.str || result.val || sourceName
          }
          
          sources.push({
            index: i,
            name: sourceName,
            parameterName: paramName
          })
          console.log(`[Atlas Query] ✓ Source ${i}: ${sourceName}`)
        } else {
          console.warn(`[Atlas Query] ✗ Failed to get ${paramName}: ${JSON.stringify(response)}`)
          // Still add source to list but with default name
          sources.push({
            index: i,
            name: `Source ${i + 1}`,
            parameterName: paramName
          })
        }
      } catch (error) {
        console.error(`[Atlas Query] ✗ Error querying source ${i}:`, error instanceof Error ? error.message : error)
        // Add a placeholder source
        sources.push({
          index: i,
          name: `Source ${i + 1}`,
          parameterName: `SourceName_${i}`
        })
      }
      
      // Small delay between queries to avoid overwhelming the device
      await delay(150)
    }

    // Query all zone names and current status
    const zones: AtlasHardwareZone[] = []
    for (let i = 0; i < maxZones; i++) {
      try {
        const paramName = `ZoneName_${i}`
        
        // Get zone name
        const nameResponse = await client.getParameter(paramName, 'str')
        let zoneName = `Zone ${i + 1}` // Default fallback
        
        if (nameResponse.success && nameResponse.data) {
          if (nameResponse.data.method === 'getResp' && nameResponse.data.params) {
            zoneName = nameResponse.data.params.str || zoneName
          } else if (nameResponse.data.value !== undefined) {
            zoneName = nameResponse.data.value
          } else if (nameResponse.data.result?.str) {
            zoneName = nameResponse.data.result.str
          }
        }

        // Get current source
        const sourceResponse = await client.getParameter(`ZoneSource_${i}`, 'val')
        let currentSource = -1
        
        if (sourceResponse.success && sourceResponse.data) {
          if (sourceResponse.data.method === 'getResp' && sourceResponse.data.params) {
            currentSource = sourceResponse.data.params.val ?? -1
          } else if (sourceResponse.data.value !== undefined) {
            currentSource = sourceResponse.data.value
          } else if (sourceResponse.data.result?.val !== undefined) {
            currentSource = sourceResponse.data.result.val
          }
        }

        // Get volume (as percentage)
        const volumeResponse = await client.getParameter(`ZoneGain_${i}`, 'pct')
        let volume = 50
        
        if (volumeResponse.success && volumeResponse.data) {
          if (volumeResponse.data.method === 'getResp' && volumeResponse.data.params) {
            volume = volumeResponse.data.params.pct ?? 50
          } else if (volumeResponse.data.value !== undefined) {
            volume = volumeResponse.data.value
          } else if (volumeResponse.data.result?.pct !== undefined) {
            volume = volumeResponse.data.result.pct
          }
        }

        // Get mute state
        const muteResponse = await client.getParameter(`ZoneMute_${i}`, 'val')
        let muted = false
        
        if (muteResponse.success && muteResponse.data) {
          if (muteResponse.data.method === 'getResp' && muteResponse.data.params) {
            muted = muteResponse.data.params.val === 1
          } else if (muteResponse.data.value !== undefined) {
            muted = muteResponse.data.value === 1
          } else if (muteResponse.data.result?.val !== undefined) {
            muted = muteResponse.data.result.val === 1
          }
        }

        zones.push({
          index: i,
          name: zoneName,
          parameterName: paramName,
          currentSource,
          volume,
          muted
        })

        console.log(`[Atlas Query] Zone ${i}: ${zoneName} (Source: ${currentSource}, Volume: ${volume}%, Muted: ${muted})`)
      } catch (error) {
        console.error(`[Atlas Query] Error querying zone ${i}:`, error)
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
      port: tcpPort,
      model,
      sources,
      zones,
      totalSources: sources.length,
      totalZones: zones.length,
      queriedAt: new Date().toISOString()
    }

    console.log(`[Atlas Query] Successfully queried hardware configuration:`, {
      sources: config.totalSources,
      zones: config.totalZones
    })

    return config

  } catch (error) {
    console.error('[Atlas Query] Fatal error during hardware query:', error)
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
    await client.connect()
    console.log(`[Atlas Test] Connection successful to ${ipAddress}:${port}`)
    
    // Try to get a simple parameter to verify communication
    const response = await client.getParameter('SourceName_0', 'str')
    const success = response.success
    
    console.log(`[Atlas Test] Communication test: ${success ? 'PASSED' : 'FAILED'}`)
    return success
  } catch (error) {
    console.error('[Atlas Test] Connection failed:', error)
    return false
  } finally {
    client.disconnect()
  }
}
