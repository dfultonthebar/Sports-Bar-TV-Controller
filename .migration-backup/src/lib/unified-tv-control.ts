
// Unified TV Control Service - Combines CEC and IR with intelligent fallback

import { getBrandConfig, BrandTiming } from './tv-brands-config'
import { CECCommand, getCECCommandMapping } from './enhanced-cec-commands'
import { routeMatrix as routeMatrixDirect } from './matrix-control'
import { powerOn, powerOff, volumeUp, volumeDown, mute, sendCECCommand as sendCECCommandDirect } from './cec-client'

import { logger } from '@/lib/logger'
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
  private cecInputChannel: number
  private cecDeviceNumber: number

  constructor(config: {
    cecInputChannel: number
    cecDeviceNumber?: number
  }) {
    this.cecInputChannel = config.cecInputChannel
    this.cecDeviceNumber = config.cecDeviceNumber || 1  // Default to device 1
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
        logger.info(`CEC failed for ${device.name}, attempting IR fallback`)
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
        logger.info(`IR failed for ${device.name}, attempting CEC fallback`)
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

      // Step 3: Send CEC command directly via cec-client
      let cecSuccess = false

      // Map commands to cec-client functions
      switch (command) {
        case 'power_on':
          cecSuccess = await powerOn(0, { deviceNumber: this.cecDeviceNumber })
          break
        case 'power_off':
        case 'standby':
          cecSuccess = await powerOff(0, { deviceNumber: this.cecDeviceNumber })
          break
        case 'volume_up':
          cecSuccess = await volumeUp(5, { deviceNumber: this.cecDeviceNumber })
          break
        case 'volume_down':
          cecSuccess = await volumeDown(5, { deviceNumber: this.cecDeviceNumber })
          break
        case 'mute':
          cecSuccess = await mute(5, { deviceNumber: this.cecDeviceNumber })
          break
        default:
          // For other commands, use the raw CEC command
          const commandMapping = getCECCommandMapping(command)
          if (commandMapping) {
            cecSuccess = await sendCECCommandDirect(commandMapping.opcode, 0, { deviceNumber: this.cecDeviceNumber })
          } else {
            return {
              success: false,
              method: 'CEC',
              message: `Unknown CEC command: ${command}`,
              error: 'Invalid command'
            }
          }
      }

      if (cecSuccess) {
        return {
          success: true,
          method: 'CEC',
          message: `CEC command ${command} sent successfully to ${device.name}`,
          details: { command, delay }
        }
      } else {
        return {
          success: false,
          method: 'CEC',
          message: `CEC command ${command} failed`,
          error: 'cec-client command failed'
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
    return await routeMatrixDirect(inputNum, outputNum)
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
