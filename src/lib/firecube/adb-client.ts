
// ADB Client for Fire TV Communication with Keep-Alive Support

import { exec } from 'child_process'
import { promisify } from 'util'

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

  constructor(ipAddress: string, port: number = 5555, options: ADBConnectionOptions = {}) {
    this.ipAddress = ipAddress
    this.port = port
    this.deviceAddress = `${ipAddress}:${port}`
    this.options = {
      keepAliveInterval: options.keepAliveInterval || 30000, // 30 seconds default
      connectionTimeout: options.connectionTimeout || 5000 // 5 seconds default
    }
    
    console.log(`[ADB CLIENT] Initialized for ${this.deviceAddress}`)
    console.log(`[ADB CLIENT] Keep-alive interval: ${this.options.keepAliveInterval}ms`)
  }

  async connect(): Promise<boolean> {
    try {
      console.log(`[ADB CLIENT] Connecting to ${this.deviceAddress}...`)
      
      const connectCommand = `adb connect ${this.deviceAddress}`
      const { stdout, stderr } = await execAsync(connectCommand, {
        timeout: this.options.connectionTimeout
      })
      
      console.log(`[ADB CLIENT] Connect stdout: ${stdout}`)
      if (stderr) console.log(`[ADB CLIENT] Connect stderr: ${stderr}`)
      
      if (stdout.includes('connected') || stdout.includes('already connected')) {
        console.log(`[ADB CLIENT] Connection result: SUCCESS`)
        this.isConnected = true
        
        // Start keep-alive mechanism
        this.startKeepAlive()
        
        return true
      }
      
      console.log(`[ADB CLIENT] Connection result: FAILED`)
      this.isConnected = false
      return false
    } catch (error: any) {
      console.error(`[ADB CLIENT] Connection error:`, error.message)
      
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
    
    console.log(`[ADB CLIENT] Starting keep-alive for ${this.deviceAddress}`)
    
    let consecutiveFailures = 0
    const MAX_FAILURES_BEFORE_RECONNECT = 3
    
    this.keepAliveTimer = setInterval(async () => {
      try {
        // Send a lightweight command to keep connection alive
        await this.executeShellCommand('echo keepalive')
        console.log(`[ADB CLIENT] Keep-alive ping successful for ${this.deviceAddress}`)
        
        // Reset failure counter on success
        consecutiveFailures = 0
      } catch (error) {
        consecutiveFailures++
        console.error(`[ADB CLIENT] Keep-alive ping failed for ${this.deviceAddress} (failure ${consecutiveFailures}/${MAX_FAILURES_BEFORE_RECONNECT}):`, error)
        
        // Only attempt reconnection after multiple consecutive failures
        if (consecutiveFailures >= MAX_FAILURES_BEFORE_RECONNECT) {
          console.log(`[ADB CLIENT] Attempting reconnection for ${this.deviceAddress} after ${consecutiveFailures} failures`)
          
          try {
            await this.connect()
            consecutiveFailures = 0 // Reset on successful reconnection
          } catch (reconnectError) {
            console.error(`[ADB CLIENT] Reconnection failed for ${this.deviceAddress}`)
            // Don't reset counter - let health monitor handle this
          }
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
      console.log(`[ADB CLIENT] Stopped keep-alive for ${this.deviceAddress}`)
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.stopKeepAlive()

      console.log(`[ADB CLIENT] Disconnecting from ${this.deviceAddress}...`)

      try {
        const disconnectCommand = `adb disconnect ${this.deviceAddress}`
        const { stdout, stderr } = await execAsync(disconnectCommand, { timeout: 5000 })

        // Log output but don't fail on errors
        if (stdout) console.log(`[ADB CLIENT] Disconnect stdout: ${stdout.trim()}`)
        if (stderr) console.log(`[ADB CLIENT] Disconnect stderr: ${stderr.trim()}`)

      } catch (disconnectError: any) {
        // Don't throw on disconnect errors - device might already be disconnected
        console.log(`[ADB CLIENT] Disconnect command failed (device may already be disconnected): ${disconnectError.message}`)
      }

      // Always mark as disconnected regardless of command result
      this.isConnected = false
      console.log(`[ADB CLIENT] Disconnected from ${this.deviceAddress}`)

    } catch (error) {
      console.error(`[ADB CLIENT] Disconnect error:`, error)
      // Still mark as disconnected even if there's an error
      this.isConnected = false
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log(`[ADB CLIENT] Testing connection to ${this.deviceAddress}...`)
      
      // First, try to connect if not already connected
      if (!this.isConnected) {
        await this.connect()
      }
      
      // Test by getting device properties
      const result = await this.getDeviceProperty('ro.product.model')
      console.log(`[ADB CLIENT] Test connection result: ${result ? 'SUCCESS' : 'FAILED'}`)
      
      return !!result
    } catch (error) {
      console.error(`[ADB CLIENT] Test connection error:`, error)
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
      console.error(`[ADB CLIENT] Get device info error:`, error)
      return {}
    }
  }

  async getDeviceProperty(property: string): Promise<string | null> {
    try {
      const command = `adb -s ${this.deviceAddress} shell getprop ${property}`
      const { stdout } = await execAsync(command, { timeout: 3000 })
      return stdout.trim() || null
    } catch (error) {
      console.error(`[ADB CLIENT] Get property error:`, error)
      return null
    }
  }

  async executeShellCommand(command: string): Promise<string> {
    try {
      const adbCommand = `adb -s ${this.deviceAddress} shell "${command}"`
      const { stdout } = await execAsync(adbCommand, { timeout: 10000 })
      return stdout.trim()
    } catch (error: any) {
      console.error(`[ADB CLIENT] Execute command error:`, error.message)
      throw error
    }
  }

  async sendKey(keyCode: number): Promise<string> {
    try {
      console.log(`[ADB CLIENT] Sending key ${keyCode} to ${this.deviceAddress}`)
      return await this.executeShellCommand(`input keyevent ${keyCode}`)
    } catch (error) {
      console.error(`[ADB CLIENT] Send key error:`, error)
      throw error
    }
  }

  async getInstalledPackages(): Promise<string[]> {
    try {
      console.log(`[ADB CLIENT] Getting installed packages from ${this.deviceAddress}`)
      const output = await this.executeShellCommand('pm list packages')
      const packages = output
        .split('\n')
        .filter(line => line.startsWith('package:'))
        .map(line => line.replace('package:', '').trim())
      
      console.log(`[ADB CLIENT] Found ${packages.length} installed packages`)
      return packages
    } catch (error) {
      console.error(`[ADB CLIENT] Get installed packages error:`, error)
      throw error
    }
  }

  async isAppInstalled(packageName: string): Promise<boolean> {
    try {
      console.log(`[ADB CLIENT] Checking if ${packageName} is installed on ${this.deviceAddress}`)
      const packages = await this.getInstalledPackages()
      const isInstalled = packages.includes(packageName)
      console.log(`[ADB CLIENT] ${packageName} is ${isInstalled ? 'INSTALLED' : 'NOT INSTALLED'}`)
      return isInstalled
    } catch (error) {
      console.error(`[ADB CLIENT] Check app installed error:`, error)
      return false
    }
  }

  async getCurrentApp(): Promise<{ packageName: string; activityName: string } | null> {
    try {
      console.log(`[ADB CLIENT] Getting current app on ${this.deviceAddress}`)
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
      console.error(`[ADB CLIENT] Get current app error:`, error)
      return null
    }
  }

  async launchApp(packageName: string): Promise<string> {
    try {
      console.log(`[ADB CLIENT] Launching app ${packageName} on ${this.deviceAddress}`)
      return await this.executeShellCommand(`monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`)
    } catch (error) {
      console.error(`[ADB CLIENT] Launch app error:`, error)
      throw error
    }
  }

  async launchAppWithIntent(packageName: string, activityName?: string): Promise<string> {
    try {
      console.log(`[ADB CLIENT] Launching app with intent: ${packageName}${activityName ? '/' + activityName : ''} on ${this.deviceAddress}`)
      
      if (activityName) {
        // Launch specific activity
        return await this.executeShellCommand(`am start -n ${packageName}/${activityName}`)
      } else {
        // Launch main launcher activity
        return await this.executeShellCommand(`am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER ${packageName}`)
      }
    } catch (error) {
      console.error(`[ADB CLIENT] Launch app with intent error:`, error)
      throw error
    }
  }

  async launchAppWithDeepLink(deepLink: string): Promise<string> {
    try {
      console.log(`[ADB CLIENT] Launching app with deep link: ${deepLink} on ${this.deviceAddress}`)
      return await this.executeShellCommand(`am start -a android.intent.action.VIEW -d "${deepLink}"`)
    } catch (error) {
      console.error(`[ADB CLIENT] Launch app with deep link error:`, error)
      throw error
    }
  }

  async stopApp(packageName: string): Promise<string> {
    try {
      console.log(`[ADB CLIENT] Stopping app ${packageName} on ${this.deviceAddress}`)
      return await this.executeShellCommand(`am force-stop ${packageName}`)
    } catch (error) {
      console.error(`[ADB CLIENT] Stop app error:`, error)
      throw error
    }
  }

  async wakeDevice(): Promise<string> {
    try {
      console.log(`[ADB CLIENT] Waking device ${this.deviceAddress}`)
      // Send power button if screen is off
      await this.sendKey(26) // KEYCODE_POWER
      // Wait a moment then send home to ensure device is awake
      await new Promise(resolve => setTimeout(resolve, 500))
      await this.sendKey(3) // KEYCODE_HOME
      return 'Device woken'
    } catch (error) {
      console.error(`[ADB CLIENT] Wake device error:`, error)
      throw error
    }
  }

  async keepAwake(enabled: boolean): Promise<string> {
    try {
      console.log(`[ADB CLIENT] Setting stay awake to ${enabled} on ${this.deviceAddress}`)
      const value = enabled ? '1' : '0'
      return await this.executeShellCommand(`settings put global stay_on_while_plugged_in ${value}`)
    } catch (error) {
      console.error(`[ADB CLIENT] Keep awake error:`, error)
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
