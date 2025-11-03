
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

const IR_DEVICES_FILE = join(process.cwd(), 'data', 'ir-devices.json')

// Common IR codes for testing (these would normally come from Global Cache IR Database)
const COMMON_IR_CODES: { [key: string]: string } = {
  'POWER': 'sendir,1:1,1,38000,1,1,347,173,22,22,22,22,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,65,22,22,22,22,22,22,22,65,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,22,22,1517',
  'CH_UP': 'sendir,1:1,2,38000,1,1,347,173,22,22,22,22,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,65,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,65,22,1517',
  'CH_DOWN': 'sendir,1:1,3,38000,1,1,347,173,22,22,22,22,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,65,22,22,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,1517',
  'VOL_UP': 'sendir,1:1,4,38000,1,1,347,173,22,22,22,22,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,65,22,22,22,22,22,22,22,65,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,1517',
  'VOL_DOWN': 'sendir,1:1,5,38000,1,1,347,173,22,22,22,22,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,65,22,22,22,65,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,1517',
  'MUTE': 'sendir,1:1,6,38000,1,1,347,173,22,22,22,22,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,65,22,22,22,22,22,65,22,65,22,22,22,22,22,22,22,22,22,65,22,65,22,22,22,22,22,65,22,65,22,65,22,65,22,1517',
  '1': 'sendir,1:1,7,38000,1,1,347,173,22,22,22,22,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,65,22,65,22,65,22,65,22,65,22,1517',
  '2': 'sendir,1:1,8,38000,1,1,347,173,22,22,22,22,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,65,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,65,22,65,22,65,22,65,22,65,22,1517',
  '3': 'sendir,1:1,9,38000,1,1,347,173,22,22,22,22,22,65,22,65,22,65,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,65,22,22,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,65,22,1517'
}

async function loadDevices() {
  try {
    const data = await readFile(IR_DEVICES_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    return { devices: [] as any[] }
  }
}

async function sendITachCommand(iTachAddress: string, command: string): Promise<boolean> {
  const net = await import('net')
  
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    let isResolved = false

    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true
        socket.destroy()
        reject(new Error('Connection timeout'))
      }
    }, 5000)

    socket.connect(4998, iTachAddress, () => {
      console.log(`Connected to iTach at ${iTachAddress}:4998`)
      socket.write(command + '\r')
    })

    socket.on('data', (data) => {
      console.log('iTach response:', data.toString())
      if (!isResolved) {
        isResolved = true
        clearTimeout(timeout)
        socket.end()
        resolve(true)
      }
    })

    socket.on('error', (err) => {
      console.error('iTach connection error:', err)
      if (!isResolved) {
        isResolved = true
        clearTimeout(timeout)
        reject(err)
      }
    })

    socket.on('close', () => {
      console.log('iTach connection closed')
      if (!isResolved) {
        isResolved = true
        clearTimeout(timeout)
        resolve(true)
      }
    })
  })
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { deviceId, command, iTachAddress } = await request.json()

    if (!deviceId || !command || !iTachAddress) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Load device information
    const data = await loadDevices()
    const device = data.devices.find((d: any) => d.id === deviceId)
    
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    // Get IR code for the command
    let irCode = COMMON_IR_CODES[command]
    
    if (!irCode) {
      return NextResponse.json({ error: `IR code not found for command: ${command}` }, { status: 404 })
    }

    // Modify the IR code to use the correct connector (1:1, 1:2, or 1:3)
    // For simplicity, we'll use connector 1:1 for all devices
    // In a real implementation, you might map devices to specific connectors
    
    try {
      await sendITachCommand(iTachAddress, irCode)
      
      return NextResponse.json({ 
        message: `Successfully sent ${command} to ${device.name}`,
        device: device.name,
        command,
        irCode
      })
    } catch (error) {
      console.error('Failed to send IR command:', error)
      return NextResponse.json({ 
        error: `Failed to communicate with iTach: ${error}` 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error sending IR command:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
