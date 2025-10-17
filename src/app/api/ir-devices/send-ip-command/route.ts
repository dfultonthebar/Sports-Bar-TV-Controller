
import { NextRequest, NextResponse } from 'next/server'

// IP Control command mappings for different brands
// Note: DirecTV SHEF API expects plain key names without "KEY_" prefix
const IP_COMMAND_MAPPINGS = {
  'DirecTV': {
    'POWER': 'power',
    'POWER_ON': 'poweron',
    'POWER_OFF': 'poweroff',
    'CH_UP': 'chanup',
    'CH_DOWN': 'chandown',
    'VOL_UP': 'volumeup',
    'VOL_DOWN': 'volumedown',
    'MUTE': 'mute',
    'GUIDE': 'guide',
    'MENU': 'menu',
    'EXIT': 'exit',
    'INFO': 'info',
    'UP': 'up',
    'DOWN': 'down',
    'LEFT': 'left',
    'RIGHT': 'right',
    'OK': 'select',
    'PLAY': 'play',
    'PAUSE': 'pause',
    'STOP': 'stop',
    'REWIND': 'rew',
    'FAST_FORWARD': 'ffwd',
    'RECORD': 'record',
    '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
    '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
    'ENTER': 'enter',
    'LAST': 'prev'
  },
  'Apple TV': {
    'POWER': 'suspend',
    'UP': 'up',
    'DOWN': 'down',
    'LEFT': 'left',
    'RIGHT': 'right',
    'OK': 'select',
    'MENU': 'menu',
    'PLAY': 'play',
    'PAUSE': 'pause'
  },
  'Roku': {
    'POWER': 'keypress/Power',
    'UP': 'keypress/Up',
    'DOWN': 'keypress/Down',
    'LEFT': 'keypress/Left',
    'RIGHT': 'keypress/Right',
    'OK': 'keypress/Select',
    'MENU': 'keypress/Home',
    'PLAY': 'keypress/Play',
    'PAUSE': 'keypress/Play',
    'VOL_UP': 'keypress/VolumeUp',
    'VOL_DOWN': 'keypress/VolumeDown',
    'MUTE': 'keypress/VolumeMute'
  }
}

const DEFAULT_PORTS = {
  'DirecTV': 8080,
  'Apple TV': 3689,
  'Roku': 8060,
  'Amazon Fire TV': 55443,
  'Samsung': 8001,
  'LG': 3000,
  'Sony': 80
}

async function sendDirecTVCommand(ip: string, port: number, command: string): Promise<string> {
  try {
    const url = `http://${ip}:${port}/remote/processKey?key=${command}`
    const response = await fetch(url, {
      method: 'GET',
      timeout: 5000
    } as any)
    
    if (response.ok) {
      return `DirecTV command ${command} sent successfully`
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  } catch (error) {
    throw new Error(`DirecTV command failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

async function sendRokuCommand(ip: string, port: number, command: string): Promise<string> {
  try {
    const url = `http://${ip}:${port}/${command}`
    const response = await fetch(url, {
      method: 'POST',
      timeout: 5000
    } as any)
    
    if (response.ok) {
      return `Roku command ${command} sent successfully`
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  } catch (error) {
    throw new Error(`Roku command failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

async function sendAppleTVCommand(ip: string, port: number, command: string): Promise<string> {
  try {
    // Apple TV uses DACP (Digital Audio Control Protocol)
    const url = `http://${ip}:${port}/ctrl-int/1/${command}`
    const response = await fetch(url, {
      method: 'POST',
      timeout: 5000
    } as any)
    
    if (response.ok) {
      return `Apple TV command ${command} sent successfully`
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  } catch (error) {
    throw new Error(`Apple TV command failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

async function sendSamsungTVCommand(ip: string, port: number, command: string): Promise<string> {
  try {
    // Samsung Smart TV WebSocket or REST API command
    const keyMap: Record<string, string> = {
      'POWER': 'KEY_POWER',
      'VOL_UP': 'KEY_VOLUP',
      'VOL_DOWN': 'KEY_VOLDOWN',
      'MUTE': 'KEY_MUTE',
      'CH_UP': 'KEY_CHUP',
      'CH_DOWN': 'KEY_CHDOWN'
    }
    
    const mappedCommand = keyMap[command] || command
    const url = `http://${ip}:${port}/api/v2/channels/samsung.remote.control`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'ms.remote.control',
        params: {
          Cmd: 'Click',
          DataOfCmd: mappedCommand,
          TypeOfRemote: 'SendRemoteKey'
        }
      }),
      timeout: 5000
    } as any)
    
    if (response.ok) {
      return `Samsung TV command ${mappedCommand} sent successfully`
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  } catch (error) {
    throw new Error(`Samsung TV command failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { deviceId, command, deviceIpAddress, ipControlPort, brand } = await request.json()

    if (!deviceId || !command || !deviceIpAddress || !brand) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Determine the port to use
    const port = ipControlPort || DEFAULT_PORTS[brand as keyof typeof DEFAULT_PORTS] || 8080
    
    // Get the command mapping for this brand
    const commandMappings = IP_COMMAND_MAPPINGS[brand as keyof typeof IP_COMMAND_MAPPINGS]
    if (!commandMappings) {
      return NextResponse.json(
        { error: `IP control not supported for brand: ${brand}` },
        { status: 400 }
      )
    }

    const mappedCommand = commandMappings[command as keyof typeof commandMappings]
    if (!mappedCommand) {
      return NextResponse.json(
        { error: `Command ${command} not supported for ${brand}` },
        { status: 400 }
      )
    }

    let result: string

    // Send command based on device brand
    switch (brand) {
      case 'DirecTV':
        result = await sendDirecTVCommand(deviceIpAddress, port, mappedCommand)
        break
      case 'Roku':
        result = await sendRokuCommand(deviceIpAddress, port, mappedCommand)
        break
      case 'Apple TV':
        result = await sendAppleTVCommand(deviceIpAddress, port, mappedCommand)
        break
      case 'Samsung':
        result = await sendSamsungTVCommand(deviceIpAddress, port, mappedCommand)
        break
      default:
        // Generic HTTP GET/POST attempt
        try {
          const url = `http://${deviceIpAddress}:${port}/command/${mappedCommand}`
          const response = await fetch(url, {
            method: 'POST',
            timeout: 5000
          } as any)
          
          if (response.ok) {
            result = `Generic IP command ${mappedCommand} sent to ${brand}`
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
        } catch (error) {
          throw new Error(`Generic IP command failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    return NextResponse.json({
      success: true,
      message: result,
      deviceId,
      command: mappedCommand,
      sentAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('IP Command Error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to send IP command',
        success: false 
      },
      { status: 500 }
    )
  }
}
