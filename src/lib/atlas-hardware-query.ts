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

import { logger } from '@/lib/logger'
export interface AtlasHardwareSource {
  index: number
  name: string
  parameterName: string // e.g., "SourceName_0"
  type?: string // Optional source type (e.g., 'HDMI', 'Analog', etc.)
}

export interface AtlasZoneOutput {
  index: number // Output index within the zone (0-based)
  name: string // e.g., "Main", "Sub", "Left", "Right"
  type: string // e.g., "main", "sub", "left", "right", "mono"
  volume?: number // 0-100 percentage
  parameterName?: string // e.g., "ZoneGain_0" for backward compatibility, or "AmpOutGain_0_0" for new format
}

export interface AtlasHardwareZone {
  index: number
  name: string
  parameterName: string // e.g., "ZoneName_0"
  currentSource?: number
  volume?: number // 0-100 percentage (for backward compatibility - represents main output or all outputs)
  muted?: boolean
  outputs?: AtlasZoneOutput[] // Array of amplifier outputs for this zone (empty or single item for simple zones)
}

export interface AtlasHardwareGroup {
  index: number
  name: string
  parameterName: string // e.g., "GroupName_0"
  isActive: boolean
  currentSource?: number
  gain?: number // in dB
  muted?: boolean
}

export interface AtlasHardwareConfig {
  ipAddress: string
  port: number
  model: string
  sources: AtlasHardwareSource[]
  zones: AtlasHardwareZone[]
  groups: AtlasHardwareGroup[]
  totalSources: number
  totalZones: number
  totalGroups: number
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
  
  logger.info(`[Atlas Query] Starting configuration discovery for ${ipAddress}`)
  logger.info(`[Atlas Query] HTTP Port: ${httpPort}, TCP Port: ${tcpPort}`)
  
  // STRATEGY 1: Try HTTP configuration discovery first
  try {
    logger.info(`[Atlas Query] Attempting HTTP configuration discovery...`)
    const httpClient = new AtlasHttpClient({
      ipAddress,
      port: httpPort,
      username,
      password,
      timeout: 10000
    })

    const discoveredConfig = await httpClient.discoverConfiguration()
    
    if (discoveredConfig.sources.length > 0 || discoveredConfig.zones.length > 0) {
      logger.info(`[Atlas Query] HTTP discovery successful!`)
      logger.info(`[Atlas Query] Found ${discoveredConfig.sources.length} sources and ${discoveredConfig.zones.length} zones`)

      // Now get real-time status via TCP for each zone
      const client = new AtlasTCPClient({ ipAddress, tcpPort: tcpPort, timeout: 10000 })
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

            // Query zone outputs (for multi-output zones like Mono+Sub, Stereo, etc.)
            const outputs = await queryZoneOutputs(client, zone.index, zone.name)

            zones.push({
              index: zone.index,
              name: zone.name,
              parameterName: zone.nameParam || `ZoneName_${zone.index}`,
              currentSource,
              volume,
              muted,
              outputs
            })
            
            await delay(50)
          } catch (error) {
            logger.error(`[Atlas Query] Error getting zone ${zone.index} status:`, error)
            zones.push({
              index: zone.index,
              name: zone.name,
              parameterName: zone.nameParam || `ZoneName_${zone.index}`,
              currentSource: -1,
              volume: 50,
              muted: false,
              outputs: [{
                index: 0,
                name: 'Main',
                type: 'mono',
                volume: 50,
                parameterName: `ZoneGain_${zone.index}`
              }]
            })
          }
        }

        // Query groups
        const groups = await queryGroups(client, 12)
        
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
          groups,
          totalSources: sources.length,
          totalZones: zones.length,
          totalGroups: groups.length,
          queriedAt: discoveredConfig.queriedAt
        }
      } catch (tcpError) {
        client.disconnect()
        logger.warn('[Atlas Query] TCP status query failed, using discovered config without real-time status')
        
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
          muted: false,
          outputs: [{
            index: 0,
            name: 'Main',
            type: 'mono',
            volume: 50,
            parameterName: `ZoneGain_${zone.index}`
          }]
        }))

        // Return empty groups array since we couldn't query them
        const groups: AtlasHardwareGroup[] = []

        return {
          ipAddress,
          port: tcpPort,
          model,
          sources,
          zones,
          groups,
          totalSources: sources.length,
          totalZones: zones.length,
          totalGroups: groups.length,
          queriedAt: discoveredConfig.queriedAt
        }
      }
    }
  } catch (httpError) {
    logger.warn('[Atlas Query] HTTP configuration discovery failed, falling back to TCP probing')
    logger.warn('[Atlas Query] HTTP Error:', httpError instanceof Error ? httpError.message : httpError)
  }

  // STRATEGY 2: Fall back to TCP probing
  const client = new AtlasTCPClient({ ipAddress, tcpPort: tcpPort, timeout: 10000, maxRetries: 5 })
  
  try {
    logger.info(`[Atlas Query] Connecting via TCP to ${ipAddress}:${tcpPort}...`)
    logger.info(`[Atlas Query] Using TCP port: ${tcpPort} (NOT ${httpPort})`)
    await client.connect()
    logger.info(`[Atlas Query] Connected successfully to ${ipAddress}:${tcpPort}`)

    // Determine number of sources and zones based on model
    const maxSources = getMaxSourcesForModel(model)
    const maxZones = getMaxZonesForModel(model)

    logger.info(`[Atlas Query] Querying ${maxSources} sources and ${maxZones} zones for model ${model}`)

    // Query all source names
    const sources: AtlasHardwareSource[] = []
    for (let i = 0; i < maxSources; i++) {
      try {
        const paramName = `SourceName_${i}`
        logger.info(`[Atlas Query] Querying ${paramName}...`)
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
          logger.info(`[Atlas Query] ✓ Source ${i}: ${sourceName}`)
        } else {
          logger.warn(`[Atlas Query] ✗ Failed to get ${paramName}: ${JSON.stringify(response)}`)
          // Still add source to list but with default name
          sources.push({
            index: i,
            name: `Source ${i + 1}`,
            parameterName: paramName
          })
        }
      } catch (error) {
        logger.error(`[Atlas Query] ✗ Error querying source ${i}:`, error instanceof Error ? error.message : error)
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

        // Query zone outputs (for multi-output zones like Mono+Sub, Stereo, etc.)
        const outputs = await queryZoneOutputs(client, i, zoneName)
        
        zones.push({
          index: i,
          name: zoneName,
          parameterName: paramName,
          currentSource,
          volume,
          muted,
          outputs
        })

        logger.info(`[Atlas Query] Zone ${i}: ${zoneName} (Source: ${currentSource}, Volume: ${volume}%, Muted: ${muted}, Outputs: ${outputs.length})`)
      } catch (error) {
        logger.error(`[Atlas Query] Error querying zone ${i}:`, error)
        // Add a placeholder zone
        zones.push({
          index: i,
          name: `Zone ${i + 1}`,
          parameterName: `ZoneName_${i}`,
          currentSource: -1,
          volume: 50,
          muted: false,
          outputs: [{
            index: 0,
            name: 'Main',
            type: 'mono',
            volume: 50,
            parameterName: `ZoneGain_${i}`
          }]
        })
      }
      
      // Small delay between queries
      await delay(100)
    }

    // Query groups
    const groups = await queryGroups(client, 12)

    const config: AtlasHardwareConfig = {
      ipAddress,
      port: tcpPort,
      model,
      sources,
      zones,
      groups,
      totalSources: sources.length,
      totalZones: zones.length,
      totalGroups: groups.length,
      queriedAt: new Date().toISOString()
    }

    logger.info(`[Atlas Query] Successfully queried hardware configuration:`, {
      data: {
        sources: config.totalSources,
        zones: config.totalZones,
        groups: config.totalGroups
      }
    })

    return config

  } catch (error) {
    logger.error('[Atlas Query] Fatal error during hardware query:', error)
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
 * Query zone outputs for a specific zone
 * 
 * This function attempts to discover if a zone has multiple amplifier outputs
 * (e.g., Mono+Sub, Stereo, etc.) and retrieves their individual gain settings.
 * 
 * Strategy:
 * 1. Try to get zone output configuration (ZoneOutputType, ZoneOutputCount, etc.)
 * 2. Fall back to probing common parameter patterns
 * 3. If no multiple outputs found, return single output using ZoneGain
 * 
 * @param client - Connected Atlas TCP client
 * @param zoneIndex - Zone index (0-based)
 * @param zoneName - Zone name for labeling
 */
async function queryZoneOutputs(
  client: AtlasTCPClient,
  zoneIndex: number,
  zoneName: string
): Promise<AtlasZoneOutput[]> {
  const outputs: AtlasZoneOutput[] = []
  
  try {
    // STRATEGY 1: Skip querying output count parameters as they're rarely supported
    // Most Atlas devices use simple single-output zones with ZoneGain_X
    // Multi-output zones are uncommon and would require specific configuration
    
    // STRATEGY 2: Just use the standard ZoneGain parameter
    // If multi-output support is needed in the future, it can be added with proper device detection
    
    const outputCount = 1 // Always use single output for now
    
    // STRATEGY 3: Fallback to single output using ZoneGain (always used for now)
    if (outputCount > 1) {
      // Try multiple output parameter patterns
      const paramPatterns = [
        (zIdx: number, outIdx: number) => `ZoneOutput${outIdx + 1}Gain_${zIdx}`,
        (zIdx: number, outIdx: number) => `AmpOutGain_${zIdx}_${outIdx}`,
        (zIdx: number, outIdx: number) => `ZoneAmp${outIdx}Gain_${zIdx}`,
        (zIdx: number, outIdx: number) => `Output${outIdx + 1}Gain_${zIdx}`
      ]
      
      for (let outIdx = 0; outIdx < outputCount; outIdx++) {
        let gainValue = 50 // Default
        let gainParam = `ZoneGain_${zoneIndex}` // Fallback
        
        // Try each parameter pattern
        for (const pattern of paramPatterns) {
          const paramName = pattern(zoneIndex, outIdx)
          try {
            const response = await client.getParameter(paramName, 'pct')
            if (response.success && response.data) {
              const value = extractValueFromResponse(response.data, 'pct')
              if (value !== null && value !== undefined) {
                gainValue = value
                gainParam = paramName
                logger.info(`[Atlas Query] Found output ${outIdx} gain for zone ${zoneIndex}: ${gainValue}% via ${paramName}`)
                break
              }
            }
          } catch (error) {
            continue
          }
        }
        
        // Determine output name and type based on index and count
        let outName = `Output ${outIdx + 1}`
        let outType = 'output'
        
        if (outputCount === 2) {
          if (outIdx === 0) {
            outName = 'Main'
            outType = 'main'
          } else {
            outName = 'Sub'
            outType = 'sub'
          }
        } else if (outputCount === 2 && zoneName.toLowerCase().includes('stereo')) {
          outName = outIdx === 0 ? 'Left' : 'Right'
          outType = outIdx === 0 ? 'left' : 'right'
        }
        
        outputs.push({
          index: outIdx,
          name: outName,
          type: outType,
          volume: gainValue,
          parameterName: gainParam
        })
        
        await delay(50) // Small delay between queries
      }
    }
    
    // STRATEGY 3: Fallback to single output using ZoneGain
    if (outputs.length === 0) {
      const response = await client.getParameter(`ZoneGain_${zoneIndex}`, 'pct')
      let gainValue = 50
      
      if (response.success && response.data) {
        const value = extractValueFromResponse(response.data, 'pct')
        if (value !== null && value !== undefined) {
          gainValue = value
        }
      }
      
      outputs.push({
        index: 0,
        name: 'Main',
        type: 'mono',
        volume: gainValue,
        parameterName: `ZoneGain_${zoneIndex}`
      })
    }
    
    return outputs
  } catch (error) {
    logger.error(`[Atlas Query] Error querying zone outputs for zone ${zoneIndex}:`, error)
    // Return single output as fallback
    return [{
      index: 0,
      name: 'Main',
      type: 'mono',
      volume: 50,
      parameterName: `ZoneGain_${zoneIndex}`
    }]
  }
}

/**
 * Query groups from Atlas processor
 * 
 * Groups are zone combinations that can be controlled together.
 * Each group has: name, active state, source, gain, and mute.
 * 
 * @param client - Connected Atlas TCP client
 * @param maxGroups - Maximum number of groups to query (default: 12)
 */
async function queryGroups(
  client: AtlasTCPClient,
  maxGroups: number = 12
): Promise<AtlasHardwareGroup[]> {
  const groups: AtlasHardwareGroup[] = []
  
  logger.info(`[Atlas Query] Querying ${maxGroups} groups...`)
  logger.info(`[Atlas Query] NOTE: Only GroupName_X and GroupActive_X parameters are supported by Atlas processor`)
  
  for (let i = 0; i < maxGroups; i++) {
    try {
      // Get group name
      const nameResponse = await client.getParameter(`GroupName_${i}`, 'str')
      let groupName = `Group ${i + 1}` // Default fallback
      
      if (nameResponse.success && nameResponse.data) {
        const name = extractValueFromResponse(nameResponse.data, 'str')
        if (name) groupName = name
      }

      // Get active state (combine toggle)
      const activeResponse = await client.getParameter(`GroupActive_${i}`, 'val')
      let isActive = false
      
      if (activeResponse.success && activeResponse.data) {
        const active = extractValueFromResponse(activeResponse.data, 'val')
        isActive = active === 1
      }
      
      // WORKAROUND: If GroupActive_X returns 0 but group has a custom name (not default "Group X"),
      // treat it as active. This handles cases where the Combine toggle is enabled in the web interface
      // but GroupActive_X still returns 0. Groups with custom names are considered intentionally configured.
      const hasCustomName = groupName !== `Group ${i + 1}`
      if (!isActive && hasCustomName) {
        logger.info(`[Atlas Query] Group ${i} (${groupName}) has custom name but GroupActive_${i}=0, treating as active`)
        isActive = true
      }

      // NOTE: GroupSource_X, GroupGain_X, and GroupMute_X are NOT supported by Atlas processor
      // Groups inherit these properties from their member zones
      // Using default/placeholder values for now
      const currentSource = -1  // Not available from Atlas
      const gain = 0             // Not available from Atlas
      const muted = false        // Not available from Atlas

      groups.push({
        index: i,
        name: groupName,
        parameterName: `GroupName_${i}`,
        isActive,
        currentSource,
        gain,
        muted
      })

      logger.info(`[Atlas Query] Group ${i}: ${groupName} (Active: ${isActive})`)
      
      await delay(100) // Small delay between queries
    } catch (error) {
      logger.error(`[Atlas Query] Error querying group ${i}:`, error)
      // Add a placeholder group
      groups.push({
        index: i,
        name: `Group ${i + 1}`,
        parameterName: `GroupName_${i}`,
        isActive: false,
        currentSource: -1,
        gain: -10,
        muted: false
      })
    }
  }
  
  return groups
}

/**
 * Extract value from Atlas response data
 * Handles different response formats from Atlas processor
 */
function extractValueFromResponse(data: any, format: 'val' | 'pct' | 'str'): any {
  if (data.method === 'getResp' && data.params) {
    return data.params[format]
  } else if (data.value !== undefined) {
    return data.value
  } else if (data.result && data.result[format] !== undefined) {
    return data.result[format]
  }
  return null
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
export async function testAtlasConnection(ipAddress: string, tcpPort: number = 5321): Promise<boolean> {
  const client = new AtlasTCPClient({ ipAddress, tcpPort: tcpPort, timeout: 10000, maxRetries: 3 })
  
  try {
    logger.info(`[Atlas Test] Testing connection to ${ipAddress}:${tcpPort}`)
    await client.connect()
    logger.info(`[Atlas Test] Connection successful to ${ipAddress}:${tcpPort}`)
    
    // Try to get a simple parameter to verify communication
    const response = await client.getParameter('KeepAlive', 'str')
    const success = response.success
    
    logger.info(`[Atlas Test] Communication test: ${success ? 'PASSED' : 'FAILED'}`)
    return success
  } catch (error) {
    logger.error('[Atlas Test] Connection failed:', error)
    return false
  } finally {
    client.disconnect()
  }
}
