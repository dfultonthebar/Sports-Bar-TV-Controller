
import { NextRequest, NextResponse } from 'next/server'

// Enhanced DirecTV command mappings
const DIRECTV_COMMANDS = {
  // Power Commands
  'POWER': 'KEY_POWER',
  'POWER_ON': 'KEY_POWERON',
  'POWER_OFF': 'KEY_POWEROFF',
  
  // Navigation
  'UP': 'KEY_UP',
  'DOWN': 'KEY_DOWN',
  'LEFT': 'KEY_LEFT',
  'RIGHT': 'KEY_RIGHT',
  'OK': 'KEY_SELECT',
  'BACK': 'KEY_BACK',
  'EXIT': 'KEY_EXIT',
  
  // Channel Control
  'CH_UP': 'KEY_CHANUP',
  'CH_DOWN': 'KEY_CHANDOWN',
  'LAST': 'KEY_PREV',
  'ENTER': 'KEY_ENTER',
  
  // Volume Control
  'VOL_UP': 'KEY_VOLUMEUP',
  'VOL_DOWN': 'KEY_VOLUMEDOWN',
  'MUTE': 'KEY_MUTE',
  
  // Guide & Menu
  'GUIDE': 'KEY_GUIDE',
  'MENU': 'KEY_MENU',
  'INFO': 'KEY_INFO',
  'LIST': 'KEY_LIST',
  
  // Numbers
  '0': 'KEY_0', '1': 'KEY_1', '2': 'KEY_2', '3': 'KEY_3', '4': 'KEY_4',
  '5': 'KEY_5', '6': 'KEY_6', '7': 'KEY_7', '8': 'KEY_8', '9': 'KEY_9',
  
  // DVR Controls
  'PLAY': 'KEY_PLAY',
  'PAUSE': 'KEY_PAUSE',
  'STOP': 'KEY_STOP',
  'REWIND': 'KEY_REWIND',
  'FAST_FORWARD': 'KEY_FASTFORWARD',
  'RECORD': 'KEY_RECORD',
  'SKIP_BACK': 'KEY_REPLAY',
  'SKIP_FORWARD': 'KEY_ADVANCE',
  
  // DirecTV Specific
  'ACTIVE': 'KEY_ACTIVE',
  'FORMAT': 'KEY_FORMAT',
  'YELLOW': 'KEY_YELLOW',
  'BLUE': 'KEY_BLUE',
  'RED': 'KEY_RED',
  'GREEN': 'KEY_GREEN',
  'DASH': 'KEY_DASH'
}

async function sendDirecTVCommand(ip: string, port: number, command: string): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    // DirecTV uses HTTP GET requests to /remote/processKey
    const url = `http://${ip}:${port}/remote/processKey?key=${command}&hold=keyPress`
    
    console.log(`Sending DirecTV command to: ${url}`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Sports-Bar-Controller/1.0'
      },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (response.ok) {
      const responseText = await response.text()
      console.log(`DirecTV response: ${response.status} - ${responseText}`)
      
      return {
        success: true,
        message: `DirecTV command ${command} sent successfully`,
        data: { status: response.status, response: responseText }
      }
    } else {
      // Handle 403 Forbidden specifically - SHEF not enabled
      if (response.status === 403) {
        throw new Error(
          `HTTP 403: External Device Access is disabled on the DirecTV receiver. ` +
          `To enable: Press MENU on DirecTV remote → Settings & Help → Settings → ` +
          `Whole-Home → External Device → Enable "External Access". ` +
          `Then restart the receiver.`
        )
      } else if (response.status === 404) {
        throw new Error(
          `HTTP 404: SHEF API endpoint not found. Verify the receiver supports network control ` +
          `and is using the correct firmware version.`
        )
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    }
  } catch (error) {
    console.error('DirecTV command error:', error)
    
    let errorMessage = 'Unknown error'
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out - device may be offline'
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Connection refused - check IP address and ensure device is online'
      } else if (error.message.includes('ENETUNREACH')) {
        errorMessage = 'Network unreachable - check network connectivity'
      } else if (error.message.includes('ETIMEDOUT')) {
        errorMessage = 'Connection timed out - device may be offline'
      } else {
        errorMessage = error.message
      }
    }
    
    return {
      success: false,
      message: `DirecTV command failed: ${errorMessage}`
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { deviceId, command, ipAddress, port } = await request.json()

    if (!deviceId || !command || !ipAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters: deviceId, command, and ipAddress are required' },
        { status: 400 }
      )
    }

    // Validate and map the command
    const mappedCommand = DIRECTV_COMMANDS[command as keyof typeof DIRECTV_COMMANDS]
    if (!mappedCommand) {
      return NextResponse.json(
        { error: `Command '${command}' not supported for DirecTV` },
        { status: 400 }
      )
    }

    // Use provided port or default to 8080
    const targetPort = port || 8080

    console.log(`Sending DirecTV command: ${command} -> ${mappedCommand} to ${ipAddress}:${targetPort}`)

    // Send the command
    const result = await sendDirecTVCommand(ipAddress, targetPort, mappedCommand)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        deviceId,
        command: mappedCommand,
        originalCommand: command,
        sentAt: new Date().toISOString(),
        data: result.data
      })
    } else {
      return NextResponse.json(
        { 
          error: result.message,
          success: false,
          deviceId,
          command: mappedCommand,
          originalCommand: command
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('DirecTV Command API Error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to send DirecTV command',
        success: false 
      },
      { status: 500 }
    )
  }
}
