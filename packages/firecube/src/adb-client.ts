
// ADB Client for Fire TV Communication with Keep-Alive Support

import { exec } from 'child_process'
import { promisify } from 'util'

import { logger } from '@sports-bar/logger'
const execAsync = promisify(exec)

export interface ADBConnectionOptions {
  keepAliveInterval?: number // milliseconds
  connectionTimeout?: number // milliseconds
}

export class ADBClient {
  private ipAddress: string
  private port: number
  private deviceAddress: string
  private isConnected: boolean = false
  private keepAliveTimer: NodeJS.Timeout | null = null
  private options: ADBConnectionOptions
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private baseReconnectDelay: number = 1000

  constructor(ipAddress: string, port: number = 5555, options: ADBConnectionOptions = {}) {
    this.ipAddress = ipAddress
    this.port = port
    this.deviceAddress = `${ipAddress}:${port}`
    this.options = {
      keepAliveInterval: options.keepAliveInterval || 30000, // 30 seconds default
      connectionTimeout: options.connectionTimeout || 5000 // 5 seconds default
    }
    
    logger.info(`[ADB CLIENT] Initialized for ${this.deviceAddress}`)
    logger.info(`[ADB CLIENT] Keep-alive interval: ${this.options.keepAliveInterval}ms`)
  }

  async connect(): Promise<boolean> {
    try {
      logger.info(`[ADB CLIENT] Connecting to ${this.deviceAddress}...`)

      const connectCommand = `adb connect ${this.deviceAddress}`
      const { stdout, stderr } = await execAsync(connectCommand, {
        timeout: this.options.connectionTimeout
      })

      logger.info(`[ADB CLIENT] Connect stdout: ${stdout}`)
      if (stderr) logger.info(`[ADB CLIENT] Connect stderr: ${stderr}`)

      if (stdout.includes('connected') || stdout.includes('already connected')) {
        logger.info(`[ADB CLIENT] Connection result: SUCCESS`)
        this.isConnected = true
        this.reconnectAttempts = 0 // Reset reconnect counter on successful connection

        // Start keep-alive mechanism
        this.startKeepAlive()

        return true
      }

      logger.info(`[ADB CLIENT] Connection result: FAILED`)
      this.isConnected = false
      return false
    } catch (error: any) {
      logger.error(`[ADB CLIENT] Connection error:`, error.message)

      // Check if ADB command is not found
      if (error.message && (error.message.includes('adb') &&
          (error.message.includes('not found') ||
           error.message.includes('command not found')))) {
        throw new Error('ADB command-line tool not installed. Please install with: sudo apt-get install adb')
      }

      this.isConnected = false
      throw error
    }
  }

  /**
   * Start periodic keep-alive to maintain connection
   */
  private startKeepAlive(): void {
    // Clear any existing timer
    this.stopKeepAlive()
    
    logger.info(`[ADB CLIENT] Starting keep-alive for ${this.deviceAddress}`)
    
    let consecutiveFailures = 0
    const MAX_FAILURES_BEFORE_RECONNECT = 3
    
    this.keepAliveTimer = setInterval(async () => {
      try {
        // Send a lightweight command to keep connection alive
        await this.executeShellCommand('echo keepalive')
        logger.info(`[ADB CLIENT] Keep-alive ping successful for ${this.deviceAddress}`)

        // Reset failure counter on success
        consecutiveFailures = 0
      } catch (error: any) {
        consecutiveFailures++
        const errorMsg = error?.message || 'Unknown error'
        const stderr = error?.stderr || ''
        const fullError = stderr ? `${errorMsg} - ${stderr}` : errorMsg
        logger.error(`[ADB CLIENT] Keep-alive ping failed for ${this.deviceAddress} (failure ${consecutiveFailures}/${MAX_FAILURES_BEFORE_RECONNECT}): ${fullError}`)

        // Only attempt reconnection after multiple consecutive failures
        if (consecutiveFailures >= MAX_FAILURES_BEFORE_RECONNECT) {
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error(`[ADB CLIENT] Max reconnection attempts (${this.maxReconnectAttempts}) reached for ${this.deviceAddress}`)
            return // Stop trying
          }

          // Exponential backoff: 1s, 2s, 4s, 8s, 16s
          const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts)
          this.reconnectAttempts++

          logger.info(`[ADB CLIENT] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

          setTimeout(async () => {
            try {
              await this.connect()
              this.reconnectAttempts = 0 // Reset on success
              consecutiveFailures = 0
              logger.info(`[ADB CLIENT] Reconnection successful for ${this.deviceAddress}`)
            } catch (reconnectError: any) {
              const reconnectErrMsg = reconnectError?.message || 'Unknown error'
              logger.error(`[ADB CLIENT] Reconnection failed for ${this.deviceAddress}: ${reconnectErrMsg}`)
            }
          }, delay)
        }
      }
    }, this.options.keepAliveInterval)
  }

  /**
   * Stop keep-alive mechanism
   */
  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = null
      logger.info(`[ADB CLIENT] Stopped keep-alive for ${this.deviceAddress}`)
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.stopKeepAlive()

      logger.info(`[ADB CLIENT] Disconnecting from ${this.deviceAddress}...`)

      try {
        const disconnectCommand = `adb disconnect ${this.deviceAddress}`
        const { stdout, stderr } = await execAsync(disconnectCommand, { timeout: 5000 })

        // Log output but don't fail on errors
        if (stdout) logger.info(`[ADB CLIENT] Disconnect stdout: ${stdout.trim()}`)
        if (stderr) logger.info(`[ADB CLIENT] Disconnect stderr: ${stderr.trim()}`)

      } catch (disconnectError: any) {
        // Don't throw on disconnect errors - device might already be disconnected
        logger.info(`[ADB CLIENT] Disconnect command failed (device may already be disconnected): ${disconnectError.message}`)
      }

      // Always mark as disconnected regardless of command result
      this.isConnected = false
      logger.info(`[ADB CLIENT] Disconnected from ${this.deviceAddress}`)

    } catch (error) {
      logger.error(`[ADB CLIENT] Disconnect error:`, error)
      // Still mark as disconnected even if there's an error
      this.isConnected = false
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      logger.info(`[ADB CLIENT] Testing connection to ${this.deviceAddress}...`)
      
      // First, try to connect if not already connected
      if (!this.isConnected) {
        await this.connect()
      }
      
      // Test by getting device properties
      const result = await this.getDeviceProperty('ro.product.model')
      logger.info(`[ADB CLIENT] Test connection result: ${result ? 'SUCCESS' : 'FAILED'}`)
      
      return !!result
    } catch (error) {
      logger.error(`[ADB CLIENT] Test connection error:`, error)
      this.isConnected = false
      return false
    }
  }

  async getDeviceInfo(): Promise<{
    model?: string
    serialNumber?: string
    softwareVersion?: string
  }> {
    try {
      const model = await this.getDeviceProperty('ro.product.model')
      const serialNumber = await this.getDeviceProperty('ro.serialno')
      const softwareVersion = await this.getDeviceProperty('ro.build.version.release')
      
      return {
        model: model || undefined,
        serialNumber: serialNumber || undefined,
        softwareVersion: softwareVersion || undefined
      }
    } catch (error) {
      logger.error(`[ADB CLIENT] Get device info error:`, error)
      return {}
    }
  }

  async getDeviceProperty(property: string): Promise<string | null> {
    try {
      const command = `adb -s ${this.deviceAddress} shell getprop ${property}`
      const { stdout } = await execAsync(command, { timeout: 3000 })
      return stdout.trim() || null
    } catch (error) {
      logger.error(`[ADB CLIENT] Get property error:`, error)
      return null
    }
  }

  async executeShellCommand(command: string): Promise<string> {
    try {
      // Use -T flag (no TTY allocation) for faster execution - 2x speed improvement
      const adbCommand = `adb -s ${this.deviceAddress} shell -T "${command}"`
      const { stdout } = await execAsync(adbCommand, { timeout: 3000 })
      return stdout.trim()
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error'
      const stderr = error.stderr || ''
      const fullError = stderr ? `${errorMsg} - ${stderr}` : errorMsg
      logger.error(`[ADB CLIENT] Execute command error for ${this.deviceAddress}:`, fullError)
      throw error
    }
  }

  async sendKey(keyCode: number): Promise<string> {
    try {
      logger.info(`[ADB CLIENT] Sending key ${keyCode} to ${this.deviceAddress}`)
      return await this.executeShellCommand(`input keyevent ${keyCode}`)
    } catch (error) {
      logger.error(`[ADB CLIENT] Send key error:`, error)
      throw error
    }
  }

  async getInstalledPackages(): Promise<string[]> {
    try {
      logger.info(`[ADB CLIENT] Getting installed packages from ${this.deviceAddress}`)
      const output = await this.executeShellCommand('pm list packages')
      const packages = output
        .split('\n')
        .filter(line => line.startsWith('package:'))
        .map(line => line.replace('package:', '').trim())
      
      logger.info(`[ADB CLIENT] Found ${packages.length} installed packages`)
      return packages
    } catch (error) {
      logger.error(`[ADB CLIENT] Get installed packages error:`, error)
      throw error
    }
  }

  async isAppInstalled(packageName: string): Promise<boolean> {
    try {
      logger.info(`[ADB CLIENT] Checking if ${packageName} is installed on ${this.deviceAddress}`)
      const packages = await this.getInstalledPackages()
      const isInstalled = packages.includes(packageName)
      logger.info(`[ADB CLIENT] ${packageName} is ${isInstalled ? 'INSTALLED' : 'NOT INSTALLED'}`)
      return isInstalled
    } catch (error) {
      logger.error(`[ADB CLIENT] Check app installed error:`, error)
      return false
    }
  }

  async getCurrentApp(): Promise<{ packageName: string; activityName: string } | null> {
    try {
      logger.info(`[ADB CLIENT] Getting current app on ${this.deviceAddress}`)
      const output = await this.executeShellCommand('dumpsys window windows | grep -E "mCurrentFocus"')
      
      // Parse output like: mCurrentFocus=Window{abc123 u0 com.amazon.tv.launcher/com.amazon.tv.launcher.ui.HomeActivity}
      const match = output.match(/([a-zA-Z0-9._]+)\/([a-zA-Z0-9._]+)/)
      
      if (match) {
        return {
          packageName: match[1],
          activityName: match[2]
        }
      }
      
      return null
    } catch (error) {
      logger.error(`[ADB CLIENT] Get current app error:`, error)
      return null
    }
  }

  async launchApp(packageName: string): Promise<string> {
    try {
      logger.info(`[ADB CLIENT] Launching app ${packageName} on ${this.deviceAddress}`)
      return await this.executeShellCommand(`monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`)
    } catch (error) {
      logger.error(`[ADB CLIENT] Launch app error:`, error)
      throw error
    }
  }

  async launchAppWithIntent(packageName: string, activityName?: string): Promise<string> {
    try {
      logger.info(`[ADB CLIENT] Launching app with intent: ${packageName}${activityName ? '/' + activityName : ''} on ${this.deviceAddress}`)
      
      if (activityName) {
        // Launch specific activity
        return await this.executeShellCommand(`am start -n ${packageName}/${activityName}`)
      } else {
        // Launch main launcher activity
        return await this.executeShellCommand(`am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER ${packageName}`)
      }
    } catch (error) {
      logger.error(`[ADB CLIENT] Launch app with intent error:`, error)
      throw error
    }
  }

  async launchAppWithDeepLink(deepLink: string): Promise<string> {
    try {
      logger.info(`[ADB CLIENT] Launching app with deep link: ${deepLink} on ${this.deviceAddress}`)
      return await this.executeShellCommand(`am start -a android.intent.action.VIEW -d "${deepLink}"`)
    } catch (error) {
      logger.error(`[ADB CLIENT] Launch app with deep link error:`, error)
      throw error
    }
  }

  async stopApp(packageName: string): Promise<string> {
    try {
      logger.info(`[ADB CLIENT] Stopping app ${packageName} on ${this.deviceAddress}`)
      return await this.executeShellCommand(`am force-stop ${packageName}`)
    } catch (error) {
      logger.error(`[ADB CLIENT] Stop app error:`, error)
      throw error
    }
  }

  async wakeDevice(): Promise<string> {
    try {
      logger.info(`[ADB CLIENT] Waking device ${this.deviceAddress}`)
      // Send power button if screen is off
      await this.sendKey(26) // KEYCODE_POWER
      // Wait a moment then send home to ensure device is awake
      await new Promise(resolve => setTimeout(resolve, 500))
      await this.sendKey(3) // KEYCODE_HOME
      return 'Device woken'
    } catch (error) {
      logger.error(`[ADB CLIENT] Wake device error:`, error)
      throw error
    }
  }

  async keepAwake(enabled: boolean): Promise<string> {
    try {
      logger.info(`[ADB CLIENT] Setting stay awake to ${enabled} on ${this.deviceAddress}`)
      const value = enabled ? '1' : '0'
      return await this.executeShellCommand(`settings put global stay_on_while_plugged_in ${value}`)
    } catch (error) {
      logger.error(`[ADB CLIENT] Keep awake error:`, error)
      throw error
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected
  }

  /**
   * Cleanup method to be called when done with the client
   */
  cleanup(): void {
    this.stopKeepAlive()
  }
}
