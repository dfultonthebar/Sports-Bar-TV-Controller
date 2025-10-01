
/**
 * CEC Discovery Service
 * 
 * Automatically discovers TV brands connected to WolfPack matrix outputs
 * using CEC protocol queries (OSD name and vendor ID)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface CECDiscoveryResult {
  outputNumber: number
  label: string
  brand?: string
  model?: string
  cecAddress?: string
  success: boolean
  error?: string
}

/**
 * Parse OSD name to extract brand information
 * CEC devices typically return their manufacturer name in the OSD
 */
function parseBrandFromOSD(osdName: string): { brand: string; model: string } {
  const normalized = osdName.trim().toUpperCase()
  
  // Brand detection patterns
  const brandPatterns = [
    { pattern: /SONY/i, brand: 'Sony' },
    { pattern: /SAMSUNG/i, brand: 'Samsung' },
    { pattern: /LG/i, brand: 'LG' },
    { pattern: /TCL/i, brand: 'TCL' },
    { pattern: /VIZIO/i, brand: 'Vizio' },
    { pattern: /PANASONIC/i, brand: 'Panasonic' },
    { pattern: /PHILIPS/i, brand: 'Philips' },
    { pattern: /SHARP/i, brand: 'Sharp' },
    { pattern: /HISENSE/i, brand: 'Hisense' },
    { pattern: /TOSHIBA/i, brand: 'Toshiba' },
  ]
  
  for (const { pattern, brand } of brandPatterns) {
    if (pattern.test(normalized)) {
      return { brand, model: osdName.trim() }
    }
  }
  
  // If no brand detected, return the OSD name as both brand and model
  return { brand: 'Unknown', model: osdName.trim() }
}

/**
 * Query a single CEC device for its OSD name
 */
async function queryCECDevice(
  cecServerIP: string,
  cecPort: number,
  outputNumber: number,
  cecInputChannel: number
): Promise<{ osdName?: string; physicalAddress?: string; error?: string }> {
  try {
    // Route to the output first
    console.log(`[CEC Discovery] Routing to output ${outputNumber}...`)
    
    // Note: In production, this would call your matrix routing API
    // For now, we'll simulate the routing delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Query OSD name via CEC
    console.log(`[CEC Discovery] Querying CEC device on output ${outputNumber}...`)
    
    const response = await fetch(
      `http://${cecServerIP}:${cecPort}/api/command`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'osd', // Give OSD Name command
          target: outputNumber.toString(),
          timeout: 5000
        })
      }
    )
    
    if (!response.ok) {
      throw new Error(`CEC server returned ${response.status}`)
    }
    
    const data = await response.json()
    
    // Query physical address as well
    const addressResponse = await fetch(
      `http://${cecServerIP}:${cecPort}/api/command`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'pa', // Give Physical Address command
          target: outputNumber.toString(),
          timeout: 5000
        })
      }
    )
    
    let physicalAddress: string | undefined
    if (addressResponse.ok) {
      const addressData = await addressResponse.json()
      physicalAddress = addressData.physicalAddress || addressData.address
    }
    
    return {
      osdName: data.osdName || data.name,
      physicalAddress
    }
  } catch (error: any) {
    console.error(`[CEC Discovery] Error querying output ${outputNumber}:`, error)
    return { error: error.message }
  }
}

/**
 * Discover all TV brands connected to WolfPack outputs
 */
export async function discoverAllTVBrands(): Promise<CECDiscoveryResult[]> {
  try {
    // Get CEC configuration
    const cecConfig = await prisma.cECConfiguration.findFirst()
    if (!cecConfig || !cecConfig.isEnabled) {
      throw new Error('CEC is not enabled')
    }
    
    if (!cecConfig.cecInputChannel) {
      throw new Error('CEC input channel not configured')
    }
    
    // Get all active matrix outputs
    const outputs = await prisma.matrixOutput.findMany({
      where: {
        isActive: true,
        status: 'active'
      },
      orderBy: {
        channelNumber: 'asc'
      }
    })
    
    console.log(`[CEC Discovery] Starting discovery for ${outputs.length} outputs...`)
    
    const results: CECDiscoveryResult[] = []
    
    // Query each output sequentially to avoid conflicts
    for (const output of outputs) {
      console.log(`[CEC Discovery] Processing output ${output.channelNumber}: ${output.label}`)
      
      const deviceInfo = await queryCECDevice(
        cecConfig.cecServerIP,
        cecConfig.cecPort,
        output.channelNumber,
        cecConfig.cecInputChannel
      )
      
      if (deviceInfo.error) {
        results.push({
          outputNumber: output.channelNumber,
          label: output.label,
          success: false,
          error: deviceInfo.error
        })
        continue
      }
      
      if (deviceInfo.osdName) {
        const { brand, model } = parseBrandFromOSD(deviceInfo.osdName)
        
        // Update database with discovered information
        await prisma.matrixOutput.update({
          where: { id: output.id },
          data: {
            tvBrand: brand,
            tvModel: model,
            cecAddress: deviceInfo.physicalAddress,
            lastDiscovery: new Date()
          }
        })
        
        results.push({
          outputNumber: output.channelNumber,
          label: output.label,
          brand,
          model,
          cecAddress: deviceInfo.physicalAddress,
          success: true
        })
        
        console.log(`[CEC Discovery] Output ${output.channelNumber}: Detected ${brand} - ${model}`)
      } else {
        results.push({
          outputNumber: output.channelNumber,
          label: output.label,
          success: false,
          error: 'No OSD name returned'
        })
      }
      
      // Small delay between queries
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    console.log(`[CEC Discovery] Discovery complete. ${results.filter(r => r.success).length}/${results.length} devices detected.`)
    
    return results
  } catch (error: any) {
    console.error('[CEC Discovery] Fatal error:', error)
    throw error
  }
}

/**
 * Discover TV brand for a single output
 */
export async function discoverSingleTV(outputNumber: number): Promise<CECDiscoveryResult> {
  try {
    // Get CEC configuration
    const cecConfig = await prisma.cECConfiguration.findFirst()
    if (!cecConfig || !cecConfig.isEnabled) {
      throw new Error('CEC is not enabled')
    }
    
    if (!cecConfig.cecInputChannel) {
      throw new Error('CEC input channel not configured')
    }
    
    // Get the specific output
    const output = await prisma.matrixOutput.findFirst({
      where: {
        channelNumber: outputNumber,
        isActive: true
      }
    })
    
    if (!output) {
      throw new Error(`Output ${outputNumber} not found or not active`)
    }
    
    console.log(`[CEC Discovery] Discovering TV on output ${outputNumber}: ${output.label}`)
    
    const deviceInfo = await queryCECDevice(
      cecConfig.cecServerIP,
      cecConfig.cecPort,
      outputNumber,
      cecConfig.cecInputChannel
    )
    
    if (deviceInfo.error) {
      return {
        outputNumber,
        label: output.label,
        success: false,
        error: deviceInfo.error
      }
    }
    
    if (deviceInfo.osdName) {
      const { brand, model } = parseBrandFromOSD(deviceInfo.osdName)
      
      // Update database
      await prisma.matrixOutput.update({
        where: { id: output.id },
        data: {
          tvBrand: brand,
          tvModel: model,
          cecAddress: deviceInfo.physicalAddress,
          lastDiscovery: new Date()
        }
      })
      
      console.log(`[CEC Discovery] Output ${outputNumber}: Detected ${brand} - ${model}`)
      
      return {
        outputNumber,
        label: output.label,
        brand,
        model,
        cecAddress: deviceInfo.physicalAddress,
        success: true
      }
    }
    
    return {
      outputNumber,
      label: output.label,
      success: false,
      error: 'No OSD name returned'
    }
  } catch (error: any) {
    console.error(`[CEC Discovery] Error discovering output ${outputNumber}:`, error)
    throw error
  }
}

