// Fire TV Send Command API - Execute commands with persistent connections

import { NextRequest, NextResponse } from 'next/server'
import { ADBClient } from '@/lib/firecube/adb-client'

// Store active connections for reuse (keep-alive)
const activeConnections = new Map<string, ADBClient>()

// Cleanup old connections after 5 minutes of inactivity
const CONNECTION_TIMEOUT = 5 * 60 * 1000

function getOrCreateClient(deviceAddress: string, ip: string, port: number): ADBClient {
  const existing = activeConnections.get(deviceAddress)
  
  if (existing && existing.getConnectionStatus()) {
    console.log(`[FIRE CUBE] Reusing existing connection for ${deviceAddress}`)
    return existing
  }
  
  // Create new client with keep-alive
  console.log(`[FIRE CUBE] Creating new connection for ${deviceAddress}`)
  const client = new ADBClient(ip, port, {
    keepAliveInterval: 30000, // 30 seconds
    connectionTimeout: 5000
  })
  
  activeConnections.set(deviceAddress, client)
  
  // Set timeout to cleanup inactive connections
  setTimeout(() => {
    const clientToCheck = activeConnections.get(deviceAddress)
    if (clientToCheck === client) {
      console.log(`[FIRE CUBE] Cleaning up inactive connection for ${deviceAddress}`)
      client.cleanup()
      activeConnections.delete(deviceAddress)
    }
  }, CONNECTION_TIMEOUT)
  
  return client
}

// Key code mappings for Fire TV
const KEY_CODES: Record<string, number> = {
  'UP': 19,
  'DOWN': 20,
  'LEFT': 21,
  'RIGHT': 22,
  'OK': 23,
  'SELECT': 23,
  'HOME': 3,
  'BACK': 4,
  'MENU': 82,
  'PLAY_PAUSE': 85,
  'PLAY': 126,
  'PAUSE': 127,
  'STOP': 86,
  'REWIND': 89,
  'FAST_FORWARD': 90,
  'NEXT': 87,
  'PREVIOUS': 88,
  'VOL_UP': 24,
  'VOL_DOWN': 25,
  'MUTE': 164,
  'POWER': 26,
  'SEARCH': 84
}

export async function POST(request: NextRequest) {
  let adbClient: ADBClient | null = null
  
  try {
    const { deviceId, command, appPackage, ipAddress, port } = await request.json()
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎮 [FIRE CUBE] Sending command')
    console.log(`   Device ID: ${deviceId}`)
    console.log(`   Command: ${command}`)
    console.log(`   Package: ${appPackage || 'N/A'}`)
    console.log(`   IP: ${ipAddress}:${port}`)
    console.log(`   Timestamp: ${new Date().toISOString()}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    if (!ipAddress || !port) {
      return NextResponse.json(
        { success: false, message: 'IP address and port are required' },
        { status: 400 }
      )
    }
    
    if (!command) {
      return NextResponse.json(
        { success: false, message: 'Command is required' },
        { status: 400 }
      )
    }
    
    const ip = ipAddress.trim()
    const devicePort = parseInt(port.toString())
    const deviceAddress = `${ip}:${devicePort}`
    
    // Get or create persistent connection
    adbClient = getOrCreateClient(deviceAddress, ip, devicePort)
    
    // Ensure connection is established
    if (!adbClient.getConnectionStatus()) {
      console.log('[FIRE CUBE] Establishing connection...')
      const connected = await adbClient.connect()
      
      if (!connected) {
        return NextResponse.json({
          success: false,
          message: 'Failed to connect to Fire TV device'
        }, { status: 500 })
      }
    }
    
    let result: string
    let commandType: string
    
    // Parse and execute command
    if (command === 'LAUNCH_APP' && appPackage) {
      console.log(`[FIRE CUBE] Launching app: ${appPackage}`)
      result = await adbClient.launchApp(appPackage)
      commandType = 'Launch App'
      
    } else if (command === 'STOP_APP' && appPackage) {
      console.log(`[FIRE CUBE] Stopping app: ${appPackage}`)
      result = await adbClient.stopApp(appPackage)
      commandType = 'Stop App'
      
    } else if (command === 'WAKE') {
      console.log('[FIRE CUBE] Waking device')
      result = await adbClient.wakeDevice()
      commandType = 'Wake Device'
      
    } else if (command === 'KEEP_AWAKE_ON') {
      console.log('[FIRE CUBE] Enabling stay awake')
      result = await adbClient.keepAwake(true)
      commandType = 'Enable Stay Awake'
      
    } else if (command === 'KEEP_AWAKE_OFF') {
      console.log('[FIRE CUBE] Disabling stay awake')
      result = await adbClient.keepAwake(false)
      commandType = 'Disable Stay Awake'
      
    } else if (KEY_CODES[command]) {
      console.log(`[FIRE CUBE] Sending key: ${command} (${KEY_CODES[command]})`)
      result = await adbClient.sendKey(KEY_CODES[command])
      commandType = `Key: ${command}`
      
    } else if (command.startsWith('input keyevent ')) {
      const keyCode = parseInt(command.replace('input keyevent ', ''))
      console.log(`[FIRE CUBE] Sending keyevent: ${keyCode}`)
      result = await adbClient.sendKey(keyCode)
      commandType = `Keyevent: ${keyCode}`
      
    } else if (command.startsWith('monkey -p ')) {
      const packageName = command.match(/monkey -p ([^\s]+)/)?.[1]
      if (packageName) {
        console.log(`[FIRE CUBE] Launching app via monkey: ${packageName}`)
        result = await adbClient.launchApp(packageName)
        commandType = `Launch: ${packageName}`
      } else {
        throw new Error('Invalid monkey command format')
      }
      
    } else {
      // Generic shell command
      console.log(`[FIRE CUBE] Executing shell command: ${command}`)
      result = await adbClient.executeShellCommand(command)
      commandType = 'Shell Command'
    }
    
    console.log('[FIRE CUBE] ✅ Command executed successfully')
    console.log(`[FIRE CUBE] Result: ${result}`)
    
    return NextResponse.json({
      success: true,
      message: `${commandType} executed successfully`,
      data: {
        command,
        result,
        deviceAddress,
        persistentConnection: true,
        keepAliveActive: true
      }
    })
    
  } catch (error: any) {
    console.error('[FIRE CUBE] ❌ Command execution error:', error)
    
    let errorMessage = 'Failed to execute command'
    
    if (error.message && error.message.includes('timeout')) {
      errorMessage = 'Command execution timeout'
    } else if (error.message && error.message.includes('refused')) {
      errorMessage = 'Connection refused'
    } else if (error.message && error.message.includes('unauthorized')) {
      errorMessage = 'Device unauthorized - please accept the ADB authorization prompt on the Fire TV'
    }
    
    return NextResponse.json({
      success: false,
      message: errorMessage,
      data: {
        error: error.message
      }
    }, { status: 500 })
  }
}

// Cleanup handler for graceful shutdown
process.on('SIGTERM', () => {
  console.log('[FIRE CUBE] Cleaning up all ADB connections...')
  activeConnections.forEach((client, address) => {
    console.log(`[FIRE CUBE] Cleaning up connection: ${address}`)
    client.cleanup()
  })
  activeConnections.clear()
})
