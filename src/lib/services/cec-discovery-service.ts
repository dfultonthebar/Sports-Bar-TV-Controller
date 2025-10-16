
/**
 * CEC Discovery Service
 * 
 * Automatically discovers TV brands connected to WolfPack matrix outputs
 * using CEC protocol queries via USB CEC adapter
 */

import { PrismaClient } from '@prisma/client'
import { cecService } from '@/lib/cec-service'
import { autoFetchDocumentation } from '@/lib/tvDocs'

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
 * Query a single CEC device for its OSD name using USB CEC adapter
 */
async function queryCECDevice(
  outputNumber: number
): Promise<{ osdName?: string; physicalAddress?: string; error?: string }> {
  try {
    console.log(`[CEC Discovery] Scanning CEC devices for output ${outputNumber}...`)
    
    // Scan for CEC devices using the USB adapter
    const devices = await cecService.scanDevices(true)
    
    if (devices.length === 0) {
      return { error: 'No CEC devices detected' }
    }
    
    // For now, we'll use the first TV device found (address 0)
    // In the future, this could be enhanced to map specific outputs to specific CEC addresses
    const tvDevice = devices.find(d => d.address === '0') || devices[0]
    
    if (!tvDevice) {
      return { error: 'No TV device found on CEC bus' }
    }
    
    console.log(`[CEC Discovery] Found device: ${tvDevice.osdName} (${tvDevice.vendor})`)
    
    return {
      osdName: tvDevice.osdName,
      physicalAddress: tvDevice.address
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
    
    // Initialize CEC adapter
    const initResult = await cecService.initialize()
    if (!initResult.success) {
      throw new Error(initResult.message)
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
    console.log(`[CEC Discovery] Using USB CEC adapter: ${initResult.adapters.join(', ')}`)
    
    const results: CECDiscoveryResult[] = []
    
    // Query each output sequentially to avoid conflicts
    for (const output of outputs) {
      console.log(`[CEC Discovery] Processing output ${output.channelNumber}: ${output.label}`)
      
      const deviceInfo = await queryCECDevice(output.channelNumber)
      
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
        
        // Auto-fetch documentation for newly discovered TV
        if (brand !== 'Unknown') {
          autoFetchDocumentation(brand, model, output.channelNumber)
            .catch(error => {
              console.error(`[CEC Discovery] Error auto-fetching docs for ${brand} ${model}:`, error)
            })
        }
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
    
    // Initialize CEC adapter
    const initResult = await cecService.initialize()
    if (!initResult.success) {
      throw new Error(initResult.message)
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
    console.log(`[CEC Discovery] Using USB CEC adapter: ${initResult.adapters.join(', ')}`)
    
    const deviceInfo = await queryCECDevice(outputNumber)
    
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
      
      // Auto-fetch documentation for newly discovered TV
      if (brand !== 'Unknown') {
        autoFetchDocumentation(brand, model, outputNumber)
          .catch(error => {
            console.error(`[CEC Discovery] Error auto-fetching docs for ${brand} ${model}:`, error)
          })
      }
      
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

