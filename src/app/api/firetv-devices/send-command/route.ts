
import { NextRequest, NextResponse } from 'next/server'
import { FIRETV_COMMANDS, getAppLaunchCommand, isValidFireTVCommand } from '@/lib/firetv-utils'
import { ADBClient } from '@/lib/firecube/adb-client'

// Execute ADB command using direct ADB client
async function executeADBCommand(ip: string, port: number, command: string): Promise<{ success: boolean; message: string; data?: any }> {
  const timestamp = new Date().toISOString()
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`🎮 [FIRE CUBE] Executing command`)
  console.log(`   IP: ${ip}`)
  console.log(`   Port: ${port}`)
  console.log(`   Command: ${command}`)
  console.log(`   Timestamp: ${timestamp}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  try {
    // Create ADB client instance
    const adbClient = new ADBClient(ip, port)
    
    console.log(`[FIRE CUBE] Connecting to device...`)
    
    // Connect to device
    const connected = await adbClient.connect()
    
    if (!connected) {
      console.log(`[FIRE CUBE] ❌ Failed to connect to device`)
      return {
        success: false,
        message: 'Failed to connect to Fire TV device'
      }
    }
    
    console.log(`[FIRE CUBE] ✅ Connected, executing command...`)
    
    // Parse and execute command
    let result: string | boolean = ''
    let commandType = 'unknown'
    
    // Handle different command types
    if (command.startsWith('input keyevent')) {
      // Key event command
      const keyCode = command.replace('input keyevent', '').trim()
      result = await adbClient.sendKey(keyCode)
      commandType = 'keyevent'
    } else if (command.startsWith('monkey -p')) {
      // App launch command
      const packageMatch = command.match(/monkey -p ([\w.]+)/)
      if (packageMatch) {
        const packageName = packageMatch[1]
        result = await adbClient.launchApp(packageName)
        commandType = 'launch_app'
      }
    } else if (command.startsWith('am force-stop')) {
      // Stop app command
      const packageMatch = command.match(/am force-stop ([\w.]+)/)
      if (packageMatch) {
        const packageName = packageMatch[1]
        result = await adbClient.stopApp(packageName)
        commandType = 'stop_app'
      }
    } else {
      // Generic shell command
      result = await adbClient.shell(command)
      commandType = 'shell'
    }
    
    console.log(`[FIRE CUBE] ✅ Command executed successfully`)
    console.log(`[FIRE CUBE] Result:`, result)
    
    return {
      success: true,
      message: 'Fire TV command executed successfully',
      data: {
        command,
        commandType,
        result,
        device: `${ip}:${port}`,
        executedAt: timestamp,
        method: 'Direct ADB'
      }
    }
  } catch (error) {
    console.error(`[FIRE CUBE] ❌ Command execution error:`, error)
    
    let errorMessage = 'Unknown error'
    
    if (error instanceof Error) {
      errorMessage = error.message
      
      if (error.message.includes('adb') && error.message.includes('not found')) {
        errorMessage = 'ADB command-line tool not installed on server'
      } else if (error.name === 'AbortError') {
        errorMessage = 'Command timed out - device may be offline or ADB disabled'
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Connection refused - ADB may be disabled on device'
      } else if (error.message.includes('device offline')) {
        errorMessage = 'Fire TV device is offline or ADB is disabled'
      } else if (error.message.includes('unauthorized')) {
        errorMessage = 'ADB connection unauthorized - check device pairing'
      }
    }
    
    return {
      success: false,
      message: `Fire TV command failed: ${errorMessage}`,
      data: {
        command,
        error: errorMessage,
        device: `${ip}:${port}`,
        executedAt: timestamp
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { deviceId, command, ipAddress, port, appPackage } = await request.json()

    if (!deviceId || !ipAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters: deviceId and ipAddress are required' },
        { status: 400 }
      )
    }

    let finalCommand: string
    let originalCommand = command

    // Handle app launch commands
    if (appPackage) {
      finalCommand = getAppLaunchCommand(appPackage)
      originalCommand = `LAUNCH_APP:${appPackage}`
    } 
    // Handle predefined commands
    else if (command && FIRETV_COMMANDS[command as keyof typeof FIRETV_COMMANDS]) {
      finalCommand = FIRETV_COMMANDS[command as keyof typeof FIRETV_COMMANDS]
    } 
    // Handle raw ADB commands
    else if (command && isValidFireTVCommand(command)) {
      finalCommand = command
    } 
    else {
      return NextResponse.json(
        { error: `Command '${command}' not supported for Fire TV` },
        { status: 400 }
      )
    }

    // Use provided port or default to 5555 (ADB)
    const targetPort = port || 5555

    console.log(`[FIRE CUBE] Sending Fire TV command: ${originalCommand} -> ${finalCommand} to ${ipAddress}:${targetPort}`)

    // Execute command using direct ADB client
    const result = await executeADBCommand(ipAddress, targetPort, finalCommand)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        deviceId,
        command: finalCommand,
        originalCommand,
        sentAt: new Date().toISOString(),
        data: result.data
      })
    } else {
      return NextResponse.json(
        { 
          error: result.message,
          success: false,
          deviceId,
          command: finalCommand,
          originalCommand,
          suggestions: [
            'Ensure ADB debugging is enabled on the Fire TV device',
            'Go to Settings → My Fire TV → Developer Options → ADB Debugging → ON',
            'Check if the device is connected to the same network',
            'Verify the IP address and port are correct',
            'Install ADB on server if not already installed: sudo apt-get install adb',
            'Try restarting the Fire TV device'
          ]
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('[FIRE CUBE] Fire TV Command API Error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to send Fire TV command',
        success: false 
      },
      { status: 500 }
    )
  }
}

