
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
  
  console.log(`[CEC Discovery] Parsing OSD name: "${osdName}" (normalized: "${normalized}")`)
  
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
      console.log(`[CEC Discovery] Brand detected: ${brand}`)
      return { brand, model: osdName.trim() }
    }
  }
  
  console.log(`[CEC Discovery] No brand pattern matched, returning Unknown`)
  return { brand: 'Unknown', model: osdName.trim() }
}

/**
 * Ensure CEC configuration exists with safe defaults
 */
async function ensureCECConfiguration() {
  console.log('[CEC Discovery] Checking CEC configuration...')
  
  let cecConfig = await prisma.cECConfiguration.findFirst()
  
  if (!cecConfig) {
    console.log('[CEC Discovery] No CEC configuration found, creating default configuration')
    cecConfig = await prisma.cECConfiguration.create({
      data: {
        isEnabled: false,
        cecInputChannel: null,
        usbDevicePath: '/dev/ttyACM0',
        powerOnDelay: 2000,
        powerOffDelay: 1000,
      }
    })
    console.log('[CEC Discovery] Default CEC configuration created (disabled)')
  } else {
    console.log(`[CEC Discovery] CEC configuration found: isEnabled=${cecConfig.isEnabled}, device=${cecConfig.usbDevicePath}`)
  }
  
  return cecConfig
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
    console.log(`[CEC Discovery] Found ${devices.length} CEC devices`)
    
    if (devices.length === 0) {
      console.warn('[CEC Discovery] No CEC devices detected on the bus')
      return { error: 'No CEC devices detected' }
    }
    
    // Log all detected devices
    devices.forEach((device, index) => {
      console.log(`[CEC Discovery] Device ${index + 1}: address=${device.address}, vendor=${device.vendor}, osdName="${device.osdName}"`)
    })
    
    // For now, we'll use the first TV device found (address 0)
    // In the future, this could be enhanced to map specific outputs to specific CEC addresses
    const tvDevice = devices.find(d => d.address === '0') || devices[0]
    
    if (!tvDevice) {
      console.error('[CEC Discovery] No TV device found on CEC bus')
      return { error: 'No TV device found on CEC bus' }
    }
    
    console.log(`[CEC Discovery] Using device: ${tvDevice.osdName} (${tvDevice.vendor}) at address ${tvDevice.address}`)
    
    return {
      osdName: tvDevice.osdName,
      physicalAddress: tvDevice.address
    }
  } catch (error: any) {
    console.error(`[CEC Discovery] Error querying output ${outputNumber}:`, error.message)
    console.error(`[CEC Discovery] Error stack:`, error.stack)
    return { error: error.message }
  }
}

/**
 * Discover all TV brands connected to WolfPack outputs
 */
export async function discoverAllTVBrands(): Promise<CECDiscoveryResult[]> {
  try {
    console.log('[CEC Discovery] ========== Starting Full Discovery ==========')
    
    // Ensure CEC configuration exists
    const cecConfig = await ensureCECConfiguration()
    
    if (!cecConfig.isEnabled) {
      console.warn('[CEC Discovery] CEC is not enabled in configuration')
      throw new Error('CEC is not enabled. Please enable CEC in the configuration settings.')
    }
    
    console.log(`[CEC Discovery] CEC enabled, using device: ${cecConfig.usbDevicePath}`)
    
    // Initialize CEC adapter
    console.log('[CEC Discovery] Initializing CEC adapter...')
    const initResult = await cecService.initialize()
    
    if (!initResult.success) {
      console.error(`[CEC Discovery] Failed to initialize CEC adapter: ${initResult.message}`)
      throw new Error(initResult.message)
    }
    
    console.log(`[CEC Discovery] CEC adapter initialized successfully: ${initResult.adapters.join(', ')}`)
    
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
    
    console.log(`[CEC Discovery] Found ${outputs.length} active matrix outputs to scan`)
    outputs.forEach(output => {
      console.log(`[CEC Discovery]   - Output ${output.channelNumber}: ${output.label}`)
    })
    
    const results: CECDiscoveryResult[] = []
    
    // Query each output sequentially to avoid conflicts
    for (const output of outputs) {
      console.log(`\n[CEC Discovery] ===== Processing Output ${output.channelNumber}: ${output.label} =====`)
      
      const deviceInfo = await queryCECDevice(output.channelNumber)
      
      if (deviceInfo.error) {
        console.error(`[CEC Discovery] Failed for output ${output.channelNumber}: ${deviceInfo.error}`)
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
        
        console.log(`[CEC Discovery] Updating database for output ${output.channelNumber}`)
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
        
        console.log(`[CEC Discovery] ✓ Output ${output.channelNumber}: Detected ${brand} - ${model}`)
        
        // Auto-fetch documentation for newly discovered TV
        if (brand !== 'Unknown') {
          console.log(`[CEC Discovery] Scheduling auto-fetch documentation for ${brand} ${model}`)
          autoFetchDocumentation(brand, model, output.channelNumber)
            .catch(error => {
              console.error(`[CEC Discovery] Error auto-fetching docs for ${brand} ${model}:`, error.message)
            })
        }
      } else {
        console.warn(`[CEC Discovery] No OSD name returned for output ${output.channelNumber}`)
        results.push({
          outputNumber: output.channelNumber,
          label: output.label,
          success: false,
          error: 'No OSD name returned'
        })
      }
      
      // Small delay between queries
      console.log('[CEC Discovery] Waiting 1 second before next query...')
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    const successCount = results.filter(r => r.success).length
    console.log(`\n[CEC Discovery] ========== Discovery Complete ==========`)
    console.log(`[CEC Discovery] Total outputs scanned: ${results.length}`)
    console.log(`[CEC Discovery] Successfully detected: ${successCount}`)
    console.log(`[CEC Discovery] Failed: ${results.length - successCount}`)
    
    return results
  } catch (error: any) {
    console.error('[CEC Discovery] ========== Fatal Error ==========')
    console.error('[CEC Discovery] Error:', error.message)
    console.error('[CEC Discovery] Stack:', error.stack)
    throw error
  }
}

/**
 * Discover TV brand for a single output
 */
export async function discoverSingleTV(outputNumber: number): Promise<CECDiscoveryResult> {
  try {
    console.log(`[CEC Discovery] ========== Starting Single Discovery for Output ${outputNumber} ==========`)
    
    // Ensure CEC configuration exists
    const cecConfig = await ensureCECConfiguration()
    
    if (!cecConfig.isEnabled) {
      console.warn('[CEC Discovery] CEC is not enabled in configuration')
      throw new Error('CEC is not enabled. Please enable CEC in the configuration settings.')
    }
    
    console.log(`[CEC Discovery] CEC enabled, using device: ${cecConfig.usbDevicePath}`)
    
    // Initialize CEC adapter
    console.log('[CEC Discovery] Initializing CEC adapter...')
    const initResult = await cecService.initialize()
    
    if (!initResult.success) {
      console.error(`[CEC Discovery] Failed to initialize CEC adapter: ${initResult.message}`)
      throw new Error(initResult.message)
    }
    
    console.log(`[CEC Discovery] CEC adapter initialized: ${initResult.adapters.join(', ')}`)
    
    // Get the specific output
    const output = await prisma.matrixOutput.findFirst({
      where: {
        channelNumber: outputNumber,
        isActive: true
      }
    })
    
    if (!output) {
      const errorMsg = `Output ${outputNumber} not found or not active`
      console.error(`[CEC Discovery] ${errorMsg}`)
      throw new Error(errorMsg)
    }
    
    console.log(`[CEC Discovery] Found output: ${output.label}`)
    console.log(`[CEC Discovery] Querying CEC device...`)
    
    const deviceInfo = await queryCECDevice(outputNumber)
    
    if (deviceInfo.error) {
      console.error(`[CEC Discovery] Query failed: ${deviceInfo.error}`)
      return {
        outputNumber,
        label: output.label,
        success: false,
        error: deviceInfo.error
      }
    }
    
    if (deviceInfo.osdName) {
      const { brand, model } = parseBrandFromOSD(deviceInfo.osdName)
      
      console.log(`[CEC Discovery] Updating database...`)
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
      
      console.log(`[CEC Discovery] ✓ Output ${outputNumber}: Detected ${brand} - ${model}`)
      
      // Auto-fetch documentation for newly discovered TV
      if (brand !== 'Unknown') {
        console.log(`[CEC Discovery] Scheduling auto-fetch documentation for ${brand} ${model}`)
        autoFetchDocumentation(brand, model, outputNumber)
          .catch(error => {
            console.error(`[CEC Discovery] Error auto-fetching docs for ${brand} ${model}:`, error.message)
          })
      }
      
      console.log(`[CEC Discovery] ========== Discovery Complete ==========`)
      
      return {
        outputNumber,
        label: output.label,
        brand,
        model,
        cecAddress: deviceInfo.physicalAddress,
        success: true
      }
    }
    
    console.warn(`[CEC Discovery] No OSD name returned`)
    return {
      outputNumber,
      label: output.label,
      success: false,
      error: 'No OSD name returned'
    }
  } catch (error: any) {
    console.error(`[CEC Discovery] ========== Fatal Error ==========`)
    console.error(`[CEC Discovery] Error for output ${outputNumber}:`, error.message)
    console.error(`[CEC Discovery] Stack:`, error.stack)
    throw error
  }
}

