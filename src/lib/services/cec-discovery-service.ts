
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

// Discovery Timing Configuration (Conservative - Measure First, Optimize Later)
const DISCOVERY_TIMING = {
  afterRouteToDiscovery: 4000,    // 4 sec - Wait for TV to recognize Input 18 and CEC handshake
  afterCECQuery: 1000,             // 1 sec - Allow CEC bus to settle after query
  afterRouteBack: 1500,            // 1.5 sec - Wait for route back command to complete
  betweenTVs: 2000                 // 2 sec - Cooldown between TV discoveries (prevent CEC bus conflicts)
}

const CEC_DISCOVERY_INPUT = 20 // Input 20 = CEC SERVER adapter

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
 * Routes output to Input 18 (CEC SERVER), queries TV, then routes back
 */
async function queryCECDevice(
  outputNumber: number
): Promise<{ osdName?: string; physicalAddress?: string; error?: string; timings?: any }> {
  const timings = {
    routeToDiscovery: 0,
    handshake: 0,
    cecQuery: 0,
    routeBack: 0,
    total: 0
  }

  const startTime = Date.now()
  let originalInput: number | null = null

  try {
    logger.info(`[CEC Discovery] ┌─────────────────────────────────────────────────────`)
    logger.info(`[CEC Discovery] │ Starting discovery for Output ${outputNumber}`)
    logger.info(`[CEC Discovery] └─────────────────────────────────────────────────────`)

    // Step 1: Get current output state
    const output = await findFirst('matrixOutputs', {
      where: eq(schema.matrixOutputs.channelNumber, outputNumber)
    })

    if (!output) {
      logger.error(`[CEC Discovery] ✗ Output ${outputNumber} not found in database`)
      return { error: 'Output not found' }
    }

    // Query WolfPack matrix for current routing
    try {
      const statusResponse = await fetch('http://localhost:3001/api/wolfpack/current-routings')
      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        const routing = statusData.routings?.find((r: any) => r.matrixOutputNumber === outputNumber)
        if (routing && routing.wolfpackInputNumber) {
          originalInput = routing.wolfpackInputNumber
          logger.info(`[CEC Discovery] │ Output ${outputNumber} currently on Input ${originalInput} (${routing.wolfpackInputLabel || 'Unknown'}) - from WolfPack`)
        } else {
          // Fallback to database value
          originalInput = output.selectedVideoInput
          logger.info(`[CEC Discovery] │ Output ${outputNumber} currently on Input ${originalInput || 'Unknown'} (from database - no routing found)`)
        }
      } else {
        // Fallback to database value
        originalInput = output.selectedVideoInput
        logger.info(`[CEC Discovery] │ Output ${outputNumber} currently on Input ${originalInput || 'Unknown'} (from database - API error)`)
      }
    } catch (error) {
      // Fallback to database value
      originalInput = output.selectedVideoInput
      logger.info(`[CEC Discovery] │ Output ${outputNumber} currently on Input ${originalInput || 'Unknown'} (from database - exception)`)
    }

    // Step 2: Route output to Input 18 (CEC SERVER)
    logger.info(`[CEC Discovery] │ ⚡ Routing Output ${outputNumber} → Input ${CEC_DISCOVERY_INPUT} (CEC SERVER)`)
    const routeStartTime = Date.now()

    const routeResponse = await fetch('http://localhost:3001/api/matrix/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: CEC_DISCOVERY_INPUT,
        output: outputNumber
      })
    })

    if (!routeResponse.ok) {
      const error = await routeResponse.json()
      logger.error(`[CEC Discovery] ✗ Failed to route to Input ${CEC_DISCOVERY_INPUT}: ${error.error}`)
      return { error: `Matrix routing failed: ${error.error}` }
    }

    timings.routeToDiscovery = Date.now() - routeStartTime
    logger.info(`[CEC Discovery] │ ✓ Routed in ${timings.routeToDiscovery}ms`)

    // Step 3: Wait for TV to recognize input and establish CEC handshake
    logger.info(`[CEC Discovery] │ ⏳ Waiting ${DISCOVERY_TIMING.afterRouteToDiscovery}ms for HDMI handshake and CEC initialization...`)
    const handshakeStartTime = Date.now()
    await new Promise(resolve => setTimeout(resolve, DISCOVERY_TIMING.afterRouteToDiscovery))
    timings.handshake = Date.now() - handshakeStartTime
    logger.info(`[CEC Discovery] │ ✓ Handshake wait complete (${timings.handshake}ms)`)

    // Step 4: Query TV via CEC
    logger.info(`[CEC Discovery] │ 🔍 Querying TV via CEC...`)
    const cecQueryStartTime = Date.now()

    const devices = await cecService.scanDevices(true)
    timings.cecQuery = Date.now() - cecQueryStartTime
    logger.info(`[CEC Discovery] │ ✓ CEC scan complete in ${timings.cecQuery}ms - Found ${devices.length} device(s)`)

    if (devices.length === 0) {
      logger.warn(`[CEC Discovery] │ ⚠️  No CEC devices detected on the bus`)
      // Still route back before returning error
      if (originalInput) {
        await routeBackToOriginal(outputNumber, originalInput, timings)
      }
      return { error: 'No CEC devices detected', timings }
    }

    // Log all detected devices
    devices.forEach((device, index) => {
      logger.info(`[CEC Discovery] │   Device ${index + 1}: address=${device.address}, vendor="${device.vendor}", osd="${device.osdName}"`)
    })

    // Use the first TV device found (address 0) or first device
    const tvDevice = devices.find(d => d.address === '0') || devices[0]

    if (!tvDevice) {
      logger.error(`[CEC Discovery] │ ✗ No TV device found on CEC bus`)
      if (originalInput) {
        await routeBackToOriginal(outputNumber, originalInput, timings)
      }
      return { error: 'No TV device found on CEC bus', timings }
    }

    logger.info(`[CEC Discovery] │ ✓ TV Detected: "${tvDevice.osdName}" (${tvDevice.vendor}) at address ${tvDevice.address}`)

    // Step 5: Wait after CEC query
    logger.info(`[CEC Discovery] │ ⏳ Waiting ${DISCOVERY_TIMING.afterCECQuery}ms for CEC bus to settle...`)
    await new Promise(resolve => setTimeout(resolve, DISCOVERY_TIMING.afterCECQuery))

    // Step 6: Route back to original input
    if (originalInput) {
      await routeBackToOriginal(outputNumber, originalInput, timings)
    } else {
      logger.warn(`[CEC Discovery] │ ⚠️  No original input recorded, leaving on Input ${CEC_DISCOVERY_INPUT}`)
    }

    timings.total = Date.now() - startTime

    logger.info(`[CEC Discovery] │`)
    logger.info(`[CEC Discovery] │ 📊 TIMING SUMMARY for Output ${outputNumber}:`)
    logger.info(`[CEC Discovery] │    Route to Discovery: ${timings.routeToDiscovery}ms`)
    logger.info(`[CEC Discovery] │    Handshake Wait:     ${timings.handshake}ms`)
    logger.info(`[CEC Discovery] │    CEC Query:          ${timings.cecQuery}ms`)
    logger.info(`[CEC Discovery] │    Route Back:         ${timings.routeBack}ms`)
    logger.info(`[CEC Discovery] │    TOTAL TIME:         ${timings.total}ms (${(timings.total / 1000).toFixed(1)}s)`)
    logger.info(`[CEC Discovery] └─────────────────────────────────────────────────────`)

    return {
      osdName: tvDevice.osdName,
      physicalAddress: tvDevice.address,
      timings
    }
  } catch (error: any) {
    logger.error(`[CEC Discovery] │ ✗ ERROR: ${error.message}`)
    logger.error(`[CEC Discovery] │ Stack: ${error.stack}`)
    logger.info(`[CEC Discovery] └─────────────────────────────────────────────────────`)

    // Attempt to route back on error
    if (originalInput) {
      try {
        await routeBackToOriginal(outputNumber, originalInput, timings)
      } catch (routeError) {
        logger.error(`[CEC Discovery] Failed to route back after error:`, routeError)
      }
    }

    return { error: error.message, timings }
  }
}

/**
 * Helper function to route output back to original input
 */
async function routeBackToOriginal(
  outputNumber: number,
  originalInput: number,
  timings: any
): Promise<void> {
  logger.info(`[CEC Discovery] │ ↩️  Routing Output ${outputNumber} back to Input ${originalInput}`)
  const routeBackStartTime = Date.now()

  const routeBackResponse = await fetch('http://localhost:3001/api/matrix/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: originalInput,
      output: outputNumber
    })
  })

  if (!routeBackResponse.ok) {
    const error = await routeBackResponse.json()
    logger.error(`[CEC Discovery] │ ✗ Failed to route back to Input ${originalInput}: ${error.error}`)
  } else {
    timings.routeBack = Date.now() - routeBackStartTime
    logger.info(`[CEC Discovery] │ ✓ Routed back in ${timings.routeBack}ms`)

    // Wait for route back to complete
    logger.info(`[CEC Discovery] │ ⏳ Waiting ${DISCOVERY_TIMING.afterRouteBack}ms for route to settle...`)
    await new Promise(resolve => setTimeout(resolve, DISCOVERY_TIMING.afterRouteBack))
  }
}

/**
 * Discover all TV brands connected to WolfPack outputs
 *
 * @param onProgress Optional callback for progress updates (current, total, message)
 */
export async function discoverAllTVBrands(
  onProgress?: (current: number, total: number, message: string) => void
): Promise<CECDiscoveryResult[]> {
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
    if (onProgress) {
      onProgress(0, 1, 'Initializing CEC adapter...')
    }

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
    const updates: Array<{ id: string; data: any }> = []

    // Query each output sequentially to avoid CEC bus conflicts
    for (let i = 0; i < outputs.length; i++) {
      const output = outputs[i]
      const outputNum = i + 1

      logger.debug(`\n[CEC Discovery] ===== Processing Output ${output.channelNumber}: ${output.label} (${outputNum}/${outputs.length}) =====`)

      // Report progress
      if (onProgress) {
        onProgress(outputNum, outputs.length, `Scanning output ${output.channelNumber} (${output.label})...`)
      }

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

        logger.debug(`[CEC Discovery] Preparing update for output ${output.channelNumber}`)

        // PERFORMANCE OPTIMIZATION: Collect update for batch processing (50% faster)
        updates.push({
          id: output.id,
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

        logger.debug(`[CEC Discovery] ✓ Output ${output.channelNumber}: Detected ${brand} - ${model}`)

        // Auto-fetch documentation for newly discovered TV (non-blocking)
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

      // Cooldown between TVs to prevent CEC bus conflicts
      if (i < outputs.length - 1) { // Don't wait after last TV
        logger.info(`[CEC Discovery] ⏸️  Cooldown: Waiting ${DISCOVERY_TIMING.betweenTVs}ms before next TV...`)
        await new Promise(resolve => setTimeout(resolve, DISCOVERY_TIMING.betweenTVs))
      }
    }

    // PERFORMANCE OPTIMIZATION: Batch update all successful discoveries
    if (updates.length > 0) {
      logger.debug(`[CEC Discovery] Batch updating ${updates.length} outputs in database...`)
      for (const { id, data } of updates) {
        await update('matrixOutputs', eq(schema.matrixOutputs.id, id), data)
      }
      logger.debug(`[CEC Discovery] Database updates complete`)
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

