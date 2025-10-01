
// Unified TV Control Service - Combines CEC and IR with intelligent fallback

import { getBrandConfig, BrandTiming } from './tv-brands-config'
import { CECCommand, getCECCommandMapping } from './enhanced-cec-commands'

export interface TVDevice {
  id: string
  name: string
  brand: string
  outputNumber: number
  supportsCEC: boolean
  supportsIR: boolean
  ipAddress?: string
  irCodesetId?: string
  iTachAddress?: string
  iTachPort?: number
  preferredMethod: 'CEC' | 'IR' | 'AUTO'
}

export interface ControlResult {
  success: boolean
  method: 'CEC' | 'IR' | 'FALLBACK'
  message: string
  details?: any
  fallbackUsed?: boolean
  error?: string
}

export class UnifiedTVControl {
  private cecServerIP: string
  private cecServerPort: number
  private cecInputChannel: number
  private matrixIP: string
  private matrixPort: number
  private matrixProtocol: 'TCP' | 'UDP'

  constructor(config: {
    cecServerIP: string
    cecServerPort: number
    cecInputChannel: number
    matrixIP: string
    matrixPort: number
    matrixProtocol: 'TCP' | 'UDP'
  }) {
    this.cecServerIP = config.cecServerIP
    this.cecServerPort = config.cecServerPort
    this.cecInputChannel = config.cecInputChannel
    this.matrixIP = config.matrixIP
    this.matrixPort = config.matrixPort
    this.matrixProtocol = config.matrixProtocol
  }

  /**
   * Main control method with intelligent fallback
   */
  async controlTV(
    device: TVDevice,
    command: CECCommand | string,
    options?: {
      forceMethod?: 'CEC' | 'IR'
      retryCount?: number
      volume?: number
    }
  ): Promise<ControlResult> {
    const brandConfig = getBrandConfig(device.brand)
    const preferredMethod = options?.forceMethod || this.determineMethod(device, command, brandConfig)

    // Try preferred method first
    if (preferredMethod === 'CEC' && device.supportsCEC) {
      const cecResult = await this.sendCECCommand(device, command as CECCommand, brandConfig)
      
      if (cecResult.success) {
        return cecResult
      }

      // If CEC fails and IR is available, try IR fallback
      if (device.supportsIR) {
        console.log(`CEC failed for ${device.name}, attempting IR fallback`)
        const irResult = await this.sendIRCommand(device, command)
        return {
          ...irResult,
          method: 'FALLBACK',
          fallbackUsed: true,
          message: `CEC failed, used IR fallback: ${irResult.message}`
        }
      }

      return cecResult
    }

    if (preferredMethod === 'IR' && device.supportsIR) {
      const irResult = await this.sendIRCommand(device, command)
      
      if (irResult.success) {
        return irResult
      }

      // If IR fails and CEC is available, try CEC fallback
      if (device.supportsCEC) {
        console.log(`IR failed for ${device.name}, attempting CEC fallback`)
        const cecResult = await this.sendCECCommand(device, command as CECCommand, brandConfig)
        return {
          ...cecResult,
          method: 'FALLBACK',
          fallbackUsed: true,
          message: `IR failed, used CEC fallback: ${cecResult.message}`
        }
      }

      return irResult
    }

    return {
      success: false,
      method: preferredMethod,
      message: `No control method available for ${device.name}`,
      error: 'Device does not support requested control method'
    }
  }

  /**
   * Determine the best control method based on device, command, and brand
   */
  private determineMethod(
    device: TVDevice,
    command: CECCommand | string,
    brandConfig: BrandTiming
  ): 'CEC' | 'IR' {
    // Respect device preference if set
    if (device.preferredMethod === 'CEC' && device.supportsCEC) return 'CEC'
    if (device.preferredMethod === 'IR' && device.supportsIR) return 'IR'

    // Check brand-specific recommendations
    const brandPreference = brandConfig.preferredControlMethod

    // For volume commands, check if brand supports CEC volume
    if (['volume_up', 'volume_down', 'mute'].includes(command)) {
      if (!brandConfig.supportsCecVolumeControl && device.supportsIR) {
        return 'IR'
      }
    }

    // For power on, check if brand supports wake via CEC
    if (command === 'power_on' && !brandConfig.supportsWakeOnCec && device.supportsIR) {
      return 'IR'
    }

    // Follow brand preference
    if (brandPreference === 'CEC' && device.supportsCEC) return 'CEC'
    if (brandPreference === 'IR' && device.supportsIR) return 'IR'
    if (brandPreference === 'HYBRID') {
      // For hybrid, prefer CEC for power, IR for volume
      if (['volume_up', 'volume_down', 'mute'].includes(command) && device.supportsIR) {
        return 'IR'
      }
      if (device.supportsCEC) return 'CEC'
    }

    // Default: CEC if available, otherwise IR
    return device.supportsCEC ? 'CEC' : 'IR'
  }

  /**
   * Send CEC command with brand-specific timing
   */
  private async sendCECCommand(
    device: TVDevice,
    command: CECCommand,
    brandConfig: BrandTiming
  ): Promise<ControlResult> {
    try {
      // Get the appropriate delay for this command
      let delay = brandConfig.cecPowerOnDelay
      if (command === 'power_off' || command === 'standby') {
        delay = brandConfig.cecPowerOffDelay
      } else if (['volume_up', 'volume_down', 'mute'].includes(command)) {
        delay = brandConfig.cecVolumeDelay
      } else if (command.includes('source') || command === 'set_stream_path') {
        delay = brandConfig.cecInputSwitchDelay
      }

      // Step 1: Route CEC input to TV output via matrix
      const routeSuccess = await this.routeMatrix(this.cecInputChannel, device.outputNumber)
      if (!routeSuccess) {
        return {
          success: false,
          method: 'CEC',
          message: 'Failed to route CEC input to TV output',
          error: 'Matrix routing failed'
        }
      }

      // Step 2: Wait for brand-specific delay
      await this.sleep(delay)

      // Step 3: Send CEC command
      const commandMapping = getCECCommandMapping(command)
      if (!commandMapping) {
        return {
          success: false,
          method: 'CEC',
          message: `Unknown CEC command: ${command}`,
          error: 'Invalid command'
        }
      }

      const response = await fetch(`http://${this.cecServerIP}:${this.cecServerPort}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: commandMapping.opcode,
          targets: [`${device.outputNumber}`],
          broadcast: false
        })
      })

      if (response.ok) {
        return {
          success: true,
          method: 'CEC',
          message: `CEC command ${command} sent successfully to ${device.name}`,
          details: { command: commandMapping.opcode, delay }
        }
      } else {
        return {
          success: false,
          method: 'CEC',
          message: `CEC command failed: HTTP ${response.status}`,
          error: response.statusText
        }
      }
    } catch (error) {
      return {
        success: false,
        method: 'CEC',
        message: `CEC command error: ${error}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Send IR command via Global Cache iTach
   */
  private async sendIRCommand(
    device: TVDevice,
    command: string
  ): Promise<ControlResult> {
    try {
      if (!device.iTachAddress || !device.irCodesetId) {
        return {
          success: false,
          method: 'IR',
          message: 'IR control not configured for this device',
          error: 'Missing iTach address or codeset ID'
        }
      }

      const response = await fetch('/api/ir-devices/send-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id,
          command,
          iTachAddress: device.iTachAddress,
          iTachPort: device.iTachPort || 1,
          codesetId: device.irCodesetId
        })
      })

      const result = await response.json()

      if (result.success) {
        return {
          success: true,
          method: 'IR',
          message: `IR command ${command} sent successfully to ${device.name}`,
          details: result
        }
      } else {
        return {
          success: false,
          method: 'IR',
          message: `IR command failed: ${result.error}`,
          error: result.error
        }
      }
    } catch (error) {
      return {
        success: false,
        method: 'IR',
        message: `IR command error: ${error}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Route matrix input to output
   */
  private async routeMatrix(inputNum: number, outputNum: number): Promise<boolean> {
    try {
      const response = await fetch('/api/matrix/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: inputNum,
          output: outputNum
        })
      })
      return response.ok
    } catch (error) {
      console.error('Matrix routing error:', error)
      return false
    }
  }

  /**
   * Batch control multiple TVs
   */
  async controlMultipleTVs(
    devices: TVDevice[],
    command: CECCommand | string,
    options?: {
      sequential?: boolean
      delayBetween?: number
    }
  ): Promise<ControlResult[]> {
    const results: ControlResult[] = []

    if (options?.sequential) {
      // Sequential control
      for (const device of devices) {
        const result = await this.controlTV(device, command)
        results.push(result)
        
        if (options.delayBetween) {
          await this.sleep(options.delayBetween)
        }
      }
    } else {
      // Parallel control
      const promises = devices.map(device => this.controlTV(device, command))
      const parallelResults = await Promise.all(promises)
      results.push(...parallelResults)
    }

    return results
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
