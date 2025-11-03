import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { irCommands, irDevices, globalCacheDevices } from '@/db/schema'
import net from 'net'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

/**
 * POST /api/ir/commands/send
 * Send an IR command via Global Cache device
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📤 [IR SEND] Sending IR command')
  console.log('   Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const body = await request.json()
    const { deviceId, commandId } = body

    if (!deviceId || !commandId) {
      console.log('❌ [IR SEND] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'Device ID and Command ID are required' },
        { status: 400 }
      )
    }

    console.log('   Device ID:', deviceId)
    console.log('   Command ID:', commandId)

    // Get the command
    const command = await db.select()
      .from(irCommands)
      .where(eq(irCommands.id, commandId))
      .limit(1)
      .get()

    if (!command) {
      console.log('❌ [IR SEND] Command not found')
      return NextResponse.json(
        { success: false, error: 'Command not found' },
        { status: 404 }
      )
    }

    console.log('   Function Name:', command.functionName)
    console.log('   IR Code length:', command.irCode.length)

    // Get the IR device
    const device = await db.select()
      .from(irDevices)
      .where(eq(irDevices.id, deviceId))
      .limit(1)
      .get()

    if (!device) {
      console.log('❌ [IR SEND] Device not found')
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    if (!device.globalCacheDeviceId) {
      console.log('❌ [IR SEND] Device not configured with Global Cache')
      return NextResponse.json(
        { success: false, error: 'Device is not configured with a Global Cache device' },
        { status: 400 }
      )
    }

    // Get the Global Cache device
    const globalCacheDevice = await db.select()
      .from(globalCacheDevices)
      .where(eq(globalCacheDevices.id, device.globalCacheDeviceId))
      .limit(1)
      .get()

    if (!globalCacheDevice) {
      console.log('❌ [IR SEND] Global Cache device not found')
      return NextResponse.json(
        { success: false, error: 'Global Cache device not found' },
        { status: 404 }
      )
    }

    console.log('📡 [IR SEND] Global Cache device found')
    console.log('   Name:', globalCacheDevice.name)
    console.log('   IP:', globalCacheDevice.ipAddress)
    console.log('   Port:', globalCacheDevice.port)

    // Send the IR command
    const result = await sendIRCommand(
      globalCacheDevice.ipAddress,
      globalCacheDevice.port,
      command.irCode
    )

    if (result.success) {
      console.log('✅ [IR SEND] Command sent successfully')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      return NextResponse.json({
        success: true,
        message: 'Command sent successfully'
      })
    } else {
      console.log('❌ [IR SEND] Failed to send command')
      console.log('   Error:', result.error)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('❌ [IR SEND] Error sending command:', error)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send command' 
      },
      { status: 500 }
    )
  }
}

/**
 * Send IR command to Global Cache device
 */
async function sendIRCommand(
  ipAddress: string,
  port: number,
  irCode: string,
  timeout: number = 5000
): Promise<{
  success: boolean
  error?: string
}> {
  return new Promise((resolve) => {
    const client = new net.Socket()
    let resolved = false

    console.log('🔌 [IR SEND] Connecting to Global Cache device...')
    console.log('   Address:', `${ipAddress}:${port}`)

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        client.destroy()
        console.log('⏱️  [IR SEND] Connection timeout')
        resolve({
          success: false,
          error: 'Connection timeout'
        })
      }
    }, timeout)

    client.on('connect', () => {
      console.log('✅ [IR SEND] Connected to Global Cache device')
      console.log('📤 [IR SEND] Sending IR command:', irCode.substring(0, 50) + '...')
      
      // Send the IR command
      client.write(irCode + '\r')
    })

    client.on('data', (data) => {
      const response = data.toString()
      console.log('📥 [IR SEND] Received response:', response.trim())

      // Check for successful completion
      if (response.includes('completeir') || response.includes('busyIR')) {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutId)
          client.destroy()
          console.log('✅ [IR SEND] Command sent successfully')
          resolve({
            success: true
          })
        }
      }

      // Check for error
      if (response.includes('ERR')) {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutId)
          client.destroy()
          console.log('❌ [IR SEND] Error response:', response.trim())
          resolve({
            success: false,
            error: 'Global Cache returned an error: ' + response.trim()
          })
        }
      }
    })

    client.on('error', (error) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        console.error('❌ [IR SEND] Socket error:', error.message)
        resolve({
          success: false,
          error: `Connection error: ${error.message}`
        })
      }
    })

    client.on('close', () => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        console.log('🔌 [IR SEND] Connection closed')
        resolve({
          success: true
        })
      }
    })

    try {
      client.connect(port, ipAddress)
    } catch (error) {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        console.error('❌ [IR SEND] Connection failed:', error)
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Connection failed'
        })
      }
    }
  })
}
