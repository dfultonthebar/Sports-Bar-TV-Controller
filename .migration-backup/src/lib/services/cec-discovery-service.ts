
/**
 * CEC Discovery Service
 * 
 * Automatically discovers TV brands connected to WolfPack matrix outputs
 * using CEC protocol queries via USB CEC adapter
 */

import { and, asc, create, desc, eq, findFirst, findMany, or, update } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { cecService } from '@/lib/cec-service'
import { autoFetchDocumentation } from '@/lib/tvDocs'

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
  
  logger.debug(`[CEC Discovery] Parsing OSD name: "${osdName}" (normalized: "${normalized}")`)
  
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
      logger.debug(`[CEC Discovery] Brand detected: ${brand}`)
      return { brand, model: osdName.trim() }
    }
  }
  
  logger.debug(`[CEC Discovery] No brand pattern matched, returning Unknown`)
  return { brand: 'Unknown', model: osdName.trim() }
}

/**
 * Ensure CEC configuration exists with safe defaults
 */
async function ensureCECConfiguration() {
  logger.debug('[CEC Discovery] Checking CEC configuration...')
  
  let cecConfig = await findFirst('cecConfigurations')
  
  if (!cecConfig) {
    logger.debug('[CEC Discovery] No CEC configuration found, creating default configuration')
    cecConfig = await create('cecConfigurations', {
        isEnabled: false,
        cecInputChannel: null,
        usbDevicePath: '/dev/ttyACM0',
        powerOnDelay: 2000,
        powerOffDelay: 1000,
      })
    logger.debug('[CEC Discovery] Default CEC configuration created (disabled)')
  } else {
    logger.debug(`[CEC Discovery] CEC configuration found: isEnabled=${cecConfig.isEnabled}, device=${cecConfig.usbDevicePath}`)
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
    logger.debug(`[CEC Discovery] Scanning CEC devices for output ${outputNumber}...`)
    
    // Scan for CEC devices using the USB adapter
    const devices = await cecService.scanDevices(true)
    logger.debug(`[CEC Discovery] Found ${devices.length} CEC devices`)
    
    if (devices.length === 0) {
      logger.warn('[CEC Discovery] No CEC devices detected on the bus')
      return { error: 'No CEC devices detected' }
    }
    
    // Log all detected devices
    devices.forEach((device, index) => {
      logger.debug(`[CEC Discovery] Device ${index + 1}: address=${device.address}, vendor=${device.vendor}, osdName="${device.osdName}"`)
    })
    
    // For now, we'll use the first TV device found (address 0)
    // In the future, this could be enhanced to map specific outputs to specific CEC addresses
    const tvDevice = devices.find(d => d.address === '0') || devices[0]
    
    if (!tvDevice) {
      logger.error('[CEC Discovery] No TV device found on CEC bus')
      return { error: 'No TV device found on CEC bus' }
    }
    
    logger.debug(`[CEC Discovery] Using device: ${tvDevice.osdName} (${tvDevice.vendor}) at address ${tvDevice.address}`)
    
    return {
      osdName: tvDevice.osdName,
      physicalAddress: tvDevice.address
    }
  } catch (error: any) {
    logger.error(`[CEC Discovery] Error querying output ${outputNumber}:`, error.message)
    logger.error(`[CEC Discovery] Error stack:`, error.stack)
    return { error: error.message }
  }
}

/**
 * Discover all TV brands connected to WolfPack outputs
 */
export async function discoverAllTVBrands(): Promise<CECDiscoveryResult[]> {
  try {
    logger.debug('[CEC Discovery] ========== Starting Full Discovery ==========')
    
    // Ensure CEC configuration exists
    const cecConfig = await ensureCECConfiguration()
    
    if (!cecConfig.isEnabled) {
      logger.warn('[CEC Discovery] CEC is not enabled in configuration')
      throw new Error('CEC is not enabled. Please enable CEC in the configuration settings.')
    }
    
    logger.debug(`[CEC Discovery] CEC enabled, using device: ${cecConfig.usbDevicePath}`)
    
    // Initialize CEC adapter
    logger.debug('[CEC Discovery] Initializing CEC adapter...')
    const initResult = await cecService.initialize()
    
    if (!initResult.success) {
      logger.error(`[CEC Discovery] Failed to initialize CEC adapter: ${initResult.message}`)
      throw new Error(initResult.message)
    }
    
    logger.debug(`[CEC Discovery] CEC adapter initialized successfully: ${initResult.adapters.join(', ')}`)
    
    // Get all active matrix outputs
    const outputs = await findMany('matrixOutputs', {
      where: and(
        eq(schema.matrixOutputs.isActive, true),
        eq(schema.matrixOutputs.status, 'active')
      ),
      orderBy: asc(schema.matrixOutputs.channelNumber)
    })
    
    logger.debug(`[CEC Discovery] Found ${outputs.length} active matrix outputs to scan`)
    outputs.forEach(output => {
      logger.debug(`[CEC Discovery]   - Output ${output.channelNumber}: ${output.label}`)
    })
    
    const results: CECDiscoveryResult[] = []
    
    // Query each output sequentially to avoid conflicts
    for (const output of outputs) {
      logger.debug(`\n[CEC Discovery] ===== Processing Output ${output.channelNumber}: ${output.label} =====`)
      
      const deviceInfo = await queryCECDevice(output.channelNumber)
      
      if (deviceInfo.error) {
        logger.error(`[CEC Discovery] Failed for output ${output.channelNumber}: ${deviceInfo.error}`)
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
        
        logger.debug(`[CEC Discovery] Updating database for output ${output.channelNumber}`)
        // Update database with discovered information
        await update('matrixOutputs', eq(schema.matrixOutputs.id, output.id), {
          tvBrand: brand,
          tvModel: model,
          cecAddress: deviceInfo.physicalAddress,
          lastDiscovery: new Date()
        })
        
        results.push({
          outputNumber: output.channelNumber,
          label: output.label,
          brand,
          model,
          cecAddress: deviceInfo.physicalAddress,
          success: true
        })
        
        logger.debug(`[CEC Discovery] ✓ Output ${output.channelNumber}: Detected ${brand} - ${model}`)
        
        // Auto-fetch documentation for newly discovered TV
        if (brand !== 'Unknown') {
          logger.debug(`[CEC Discovery] Scheduling auto-fetch documentation for ${brand} ${model}`)
          autoFetchDocumentation(brand, model, output.channelNumber)
            .catch(error => {
              logger.error(`[CEC Discovery] Error auto-fetching docs for ${brand} ${model}:`, error.message)
            })
        }
      } else {
        logger.warn(`[CEC Discovery] No OSD name returned for output ${output.channelNumber}`)
        results.push({
          outputNumber: output.channelNumber,
          label: output.label,
          success: false,
          error: 'No OSD name returned'
        })
      }
      
      // Small delay between queries
      logger.debug('[CEC Discovery] Waiting 1 second before next query...')
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    const successCount = results.filter(r => r.success).length
    logger.debug(`\n[CEC Discovery] ========== Discovery Complete ==========`)
    logger.debug(`[CEC Discovery] Total outputs scanned: ${results.length}`)
    logger.debug(`[CEC Discovery] Successfully detected: ${successCount}`)
    logger.debug(`[CEC Discovery] Failed: ${results.length - successCount}`)
    
    return results
  } catch (error: any) {
    logger.error('[CEC Discovery] ========== Fatal Error ==========')
    logger.error('[CEC Discovery] Error:', error.message)
    logger.error('[CEC Discovery] Stack:', error.stack)
    throw error
  }
}

/**
 * Discover TV brand for a single output
 */
export async function discoverSingleTV(outputNumber: number): Promise<CECDiscoveryResult> {
  try {
    logger.debug(`[CEC Discovery] ========== Starting Single Discovery for Output ${outputNumber} ==========`)
    
    // Ensure CEC configuration exists
    const cecConfig = await ensureCECConfiguration()
    
    if (!cecConfig.isEnabled) {
      logger.warn('[CEC Discovery] CEC is not enabled in configuration')
      throw new Error('CEC is not enabled. Please enable CEC in the configuration settings.')
    }
    
    logger.debug(`[CEC Discovery] CEC enabled, using device: ${cecConfig.usbDevicePath}`)
    
    // Initialize CEC adapter
    logger.debug('[CEC Discovery] Initializing CEC adapter...')
    const initResult = await cecService.initialize()
    
    if (!initResult.success) {
      logger.error(`[CEC Discovery] Failed to initialize CEC adapter: ${initResult.message}`)
      throw new Error(initResult.message)
    }
    
    logger.debug(`[CEC Discovery] CEC adapter initialized: ${initResult.adapters.join(', ')}`)
    
    // Get the specific output
    const output = await findFirst('matrixOutputs', {
      where: and(
        eq(schema.matrixOutputs.channelNumber, outputNumber),
        eq(schema.matrixOutputs.isActive, true)
      )
    })
    
    if (!output) {
      const errorMsg = `Output ${outputNumber} not found or not active`
      logger.error(`[CEC Discovery] ${errorMsg}`)
      throw new Error(errorMsg)
    }
    
    logger.debug(`[CEC Discovery] Found output: ${output.label}`)
    logger.debug(`[CEC Discovery] Querying CEC device...`)
    
    const deviceInfo = await queryCECDevice(outputNumber)
    
    if (deviceInfo.error) {
      logger.error(`[CEC Discovery] Query failed: ${deviceInfo.error}`)
      return {
        outputNumber,
        label: output.label,
        success: false,
        error: deviceInfo.error
      }
    }
    
    if (deviceInfo.osdName) {
      const { brand, model } = parseBrandFromOSD(deviceInfo.osdName)
      
      logger.debug(`[CEC Discovery] Updating database...`)
      // Update database
      await update('matrixOutputs', eq(schema.matrixOutputs.id, output.id), {
        tvBrand: brand,
        tvModel: model,
        cecAddress: deviceInfo.physicalAddress,
        lastDiscovery: new Date()
      })
      
      logger.debug(`[CEC Discovery] ✓ Output ${outputNumber}: Detected ${brand} - ${model}`)
      
      // Auto-fetch documentation for newly discovered TV
      if (brand !== 'Unknown') {
        logger.debug(`[CEC Discovery] Scheduling auto-fetch documentation for ${brand} ${model}`)
        autoFetchDocumentation(brand, model, outputNumber)
          .catch(error => {
            logger.error(`[CEC Discovery] Error auto-fetching docs for ${brand} ${model}:`, error.message)
          })
      }
      
      logger.debug(`[CEC Discovery] ========== Discovery Complete ==========`)
      
      return {
        outputNumber,
        label: output.label,
        brand,
        model,
        cecAddress: deviceInfo.physicalAddress,
        success: true
      }
    }
    
    logger.warn(`[CEC Discovery] No OSD name returned`)
    return {
      outputNumber,
      label: output.label,
      success: false,
      error: 'No OSD name returned'
    }
  } catch (error: any) {
    logger.error(`[CEC Discovery] ========== Fatal Error ==========`)
    logger.error(`[CEC Discovery] Error for output ${outputNumber}:`, error.message)
    logger.error(`[CEC Discovery] Stack:`, error.stack)
    throw error
  }
}

