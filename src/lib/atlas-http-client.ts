/**
 * Atlas HTTP Client for Configuration Discovery
 * 
 * The Atlas AZM4/AZM8 processors have a web interface on port 80 that provides
 * the Third Party Control Message Table. This table contains:
 * - All configured source/zone names
 * - Parameter names for each control
 * - Available scenes, messages, routines, etc.
 * 
 * This client queries the web interface to discover the processor configuration
 * before using TCP port 5321 for actual control commands.
 */

import axios, { AxiosInstance } from 'axios'
import * as cheerio from 'cheerio'
import { atlasLogger } from './atlas-logger'

export interface AtlasHttpConfig {
  ipAddress: string
  port?: number
  username?: string
  password?: string
  timeout?: number
}

export interface AtlasConfigSource {
  index: number
  name: string
  gainParam?: string
  meterParam?: string
  muteParam?: string
  nameParam?: string
}

export interface AtlasConfigZone {
  index: number
  name: string
  gainParam?: string
  meterParam?: string
  muteParam?: string
  nameParam?: string
  sourceParam?: string
  groupedParam?: string
}

export interface AtlasConfigScene {
  index: number
  name: string
  recallParam?: string
}

export interface AtlasConfigMessage {
  index: number
  name: string
  playParam?: string
}

export interface AtlasDiscoveredConfig {
  sources: AtlasConfigSource[]
  zones: AtlasConfigZone[]
  scenes: AtlasConfigScene[]
  messages: AtlasConfigMessage[]
  firmwareVersion?: string
  queriedAt: string
}

/**
 * Atlas HTTP Client for configuration discovery
 */
export class AtlasHttpClient {
  private client: AxiosInstance
  private readonly config: Required<AtlasHttpConfig>

  constructor(config: AtlasHttpConfig) {
    this.config = {
      ipAddress: config.ipAddress,
      port: config.port || 80,
      username: config.username || '',
      password: config.password || '',
      timeout: config.timeout || 10000
    }

    // Create axios instance with authentication
    this.client = axios.create({
      baseURL: `http://${this.config.ipAddress}:${this.config.port}`,
      timeout: this.config.timeout,
      auth: this.config.username ? {
        username: this.config.username,
        password: this.config.password
      } : undefined
    })
  }

  /**
   * Discover processor configuration from web interface
   * 
   * Strategy:
   * 1. Try to fetch the Third Party Control page
   * 2. Parse the Message Table to extract parameter mappings
   * 3. If HTML scraping fails, fall back to probing with TCP "get" commands
   */
  async discoverConfiguration(): Promise<AtlasDiscoveredConfig> {
    atlasLogger.info('HTTP_CONFIG', 'Starting configuration discovery', {
      ipAddress: this.config.ipAddress,
      port: this.config.port
    })

    try {
      // Try to get the Third Party Control page
      const messageTable = await this.fetchMessageTable()
      
      if (messageTable) {
        atlasLogger.info('HTTP_CONFIG', 'Successfully parsed message table', {
          sources: messageTable.sources.length,
          zones: messageTable.zones.length,
          scenes: messageTable.scenes.length
        })
        return messageTable
      }

      // Fallback: probe configuration using known parameter patterns
      atlasLogger.info('HTTP_CONFIG', 'Falling back to parameter probing')
      return await this.probeConfiguration()

    } catch (error) {
      atlasLogger.error('HTTP_CONFIG', 'Configuration discovery failed', error)
      throw new Error(`Failed to discover Atlas configuration: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Fetch and parse the Third Party Control Message Table
   */
  private async fetchMessageTable(): Promise<AtlasDiscoveredConfig | null> {
    try {
      // Atlas processors typically have the message table at this path
      // This is based on the PDF showing the web UI structure
      const possiblePaths = [
        '/settings/thirdparty',
        '/settings/third-party',
        '/settings/thirdpartycontrol',
        '/third-party-control',
        '/api/third-party/message-table',
        '/api/thirdparty/messagetable'
      ]

      for (const path of possiblePaths) {
        try {
          atlasLogger.info('HTTP_CONFIG', `Trying path: ${path}`)
          const response = await this.client.get(path)
          
          if (response.status === 200) {
            // Check if response is JSON
            if (typeof response.data === 'object') {
              return this.parseJsonMessageTable(response.data)
            }
            
            // Check if response is HTML
            if (typeof response.data === 'string' && response.data.includes('<')) {
              return this.parseHtmlMessageTable(response.data)
            }
          }
        } catch (error) {
          // Continue to next path
          atlasLogger.info('HTTP_CONFIG', `Path ${path} not found, trying next...`)
        }
      }

      atlasLogger.info('HTTP_CONFIG', 'No message table found via HTTP')
      return null

    } catch (error) {
      atlasLogger.error('HTTP_CONFIG', 'Error fetching message table', error)
      return null
    }
  }

  /**
   * Parse JSON message table response
   */
  private parseJsonMessageTable(data: any): AtlasDiscoveredConfig {
    const sources: AtlasConfigSource[] = []
    const zones: AtlasConfigZone[] = []
    const scenes: AtlasConfigScene[] = []
    const messages: AtlasConfigMessage[] = []

    // Parse sources
    if (data.sources && Array.isArray(data.sources)) {
      data.sources.forEach((source: any, index: number) => {
        sources.push({
          index,
          name: source.name || `Source ${index + 1}`,
          gainParam: source.gainParam || `SourceGain_${index}`,
          meterParam: source.meterParam || `SourceMeter_${index}`,
          muteParam: source.muteParam || `SourceMute_${index}`,
          nameParam: source.nameParam || `SourceName_${index}`
        })
      })
    }

    // Parse zones
    if (data.zones && Array.isArray(data.zones)) {
      data.zones.forEach((zone: any, index: number) => {
        zones.push({
          index,
          name: zone.name || `Zone ${index + 1}`,
          gainParam: zone.gainParam || `ZoneGain_${index}`,
          meterParam: zone.meterParam || `ZoneMeter_${index}`,
          muteParam: zone.muteParam || `ZoneMute_${index}`,
          nameParam: zone.nameParam || `ZoneName_${index}`,
          sourceParam: zone.sourceParam || `ZoneSource_${index}`,
          groupedParam: zone.groupedParam || `ZoneGrouped_${index}`
        })
      })
    }

    // Parse scenes
    if (data.scenes && Array.isArray(data.scenes)) {
      data.scenes.forEach((scene: any, index: number) => {
        scenes.push({
          index,
          name: scene.name || `Scene ${index + 1}`,
          recallParam: scene.recallParam || 'RecallScene'
        })
      })
    }

    // Parse messages
    if (data.messages && Array.isArray(data.messages)) {
      data.messages.forEach((message: any, index: number) => {
        messages.push({
          index,
          name: message.name || `Message ${index + 1}`,
          playParam: message.playParam || 'PlayMessage'
        })
      })
    }

    return {
      sources,
      zones,
      scenes,
      messages,
      firmwareVersion: data.firmwareVersion,
      queriedAt: new Date().toISOString()
    }
  }

  /**
   * Parse HTML message table page
   */
  private parseHtmlMessageTable(html: string): AtlasDiscoveredConfig {
    const $ = cheerio.load(html)
    const sources: AtlasConfigSource[] = []
    const zones: AtlasConfigZone[] = []
    const scenes: AtlasConfigScene[] = []
    const messages: AtlasConfigMessage[] = []

    // This parsing logic depends on the actual HTML structure
    // We'll implement a generic parser that looks for tables and parameter names

    // Look for tables with parameter information
    $('table').each((tableIndex, table) => {
      $(table).find('tr').each((rowIndex, row) => {
        const cells = $(row).find('td, th')
        
        if (cells.length > 0) {
          const firstCell = $(cells[0]).text().trim()
          
          // Check if this looks like a source/zone name
          if (rowIndex > 0 && firstCell) {
            // Extract parameter names from cells
            const gainParam = $(cells[1]).text().trim()
            const muteParam = $(cells[3]).text().trim()
            
            // Determine if this is a source or zone based on parameter prefix
            if (gainParam.startsWith('SourceGain_')) {
              const index = parseInt(gainParam.split('_')[1] || '0')
              sources.push({
                index,
                name: firstCell,
                gainParam,
                muteParam: muteParam.startsWith('SourceMute_') ? muteParam : undefined,
                nameParam: `SourceName_${index}`
              })
            } else if (gainParam.startsWith('ZoneGain_')) {
              const index = parseInt(gainParam.split('_')[1] || '0')
              zones.push({
                index,
                name: firstCell,
                gainParam,
                muteParam: muteParam.startsWith('ZoneMute_') ? muteParam : undefined,
                nameParam: `ZoneName_${index}`,
                sourceParam: `ZoneSource_${index}`
              })
            }
          }
        }
      })
    })

    return {
      sources,
      zones,
      scenes,
      messages,
      queriedAt: new Date().toISOString()
    }
  }

  /**
   * Probe configuration by testing known parameter patterns
   * This is used when HTTP scraping fails
   */
  private async probeConfiguration(): Promise<AtlasDiscoveredConfig> {
    // We'll need to use TCP to probe, so import the TCP client
    const { AtlasTCPClient } = await import('./atlasClient')
    
    const client = new AtlasTCPClient({
      ipAddress: this.config.ipAddress,
      tcpPort: 5321, // TCP control port (fixed: was 'port', should be 'tcpPort')
      timeout: 5000
    })

    try {
      await client.connect()
      
      const sources: AtlasConfigSource[] = []
      const zones: AtlasConfigZone[] = []
      
      // Probe for sources (typically 4-14 sources)
      for (let i = 0; i < 14; i++) {
        const response = await client.getParameter(`SourceName_${i}`, 'str')
        if (response.success && response.data?.result?.str) {
          sources.push({
            index: i,
            name: response.data.result.str,
            gainParam: `SourceGain_${i}`,
            meterParam: `SourceMeter_${i}`,
            muteParam: `SourceMute_${i}`,
            nameParam: `SourceName_${i}`
          })
        } else {
          // No more sources
          break
        }
        await this.delay(100)
      }

      // Probe for zones (typically 4-8 zones)
      for (let i = 0; i < 8; i++) {
        const response = await client.getParameter(`ZoneName_${i}`, 'str')
        if (response.success && response.data?.result?.str) {
          zones.push({
            index: i,
            name: response.data.result.str,
            gainParam: `ZoneGain_${i}`,
            meterParam: `ZoneMeter_${i}`,
            muteParam: `ZoneMute_${i}`,
            nameParam: `ZoneName_${i}`,
            sourceParam: `ZoneSource_${i}`,
            groupedParam: `ZoneGrouped_${i}`
          })
        } else {
          // No more zones
          break
        }
        await this.delay(100)
      }

      client.disconnect()

      return {
        sources,
        zones,
        scenes: [],
        messages: [],
        queriedAt: new Date().toISOString()
      }

    } catch (error) {
      client.disconnect()
      throw error
    }
  }

  /**
   * Test HTTP connection to processor
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/', { timeout: 5000 })
      return response.status === 200
    } catch (error) {
      atlasLogger.error('HTTP_TEST', 'Connection test failed', error)
      return false
    }
  }

  /**
   * Helper to add delay between requests
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Helper function to discover Atlas configuration
 */
export async function discoverAtlasConfiguration(
  ipAddress: string,
  port?: number,
  username?: string,
  password?: string
): Promise<AtlasDiscoveredConfig> {
  const client = new AtlasHttpClient({
    ipAddress,
    port,
    username,
    password
  })

  return await client.discoverConfiguration()
}
