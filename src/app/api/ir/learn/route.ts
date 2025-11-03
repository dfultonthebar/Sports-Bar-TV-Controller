import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { update } from '@/lib/db-helpers'
import { globalCacheDevices, irDevices, irCommands } from '@/db/schema'
import net from 'net'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

/**
 * POST /api/ir/learn
 * Start IR learning session for a specific command
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎓 [IR LEARN API] Starting IR learning session')
  console.log('   Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const body = await request.json()
    const { deviceId, globalCacheDeviceId, commandId, functionName } = body

    if (!deviceId || !globalCacheDeviceId || !commandId || !functionName) {
      console.log('❌ [IR LEARN API] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'Device ID, Global Cache Device ID, Command ID, and Function Name are required' },
        { status: 400 }
      )
    }

    console.log('   Device ID:', deviceId)
    console.log('   Global Cache Device ID:', globalCacheDeviceId)
    console.log('   Command ID:', commandId)
    console.log('   Function Name:', functionName)

    // Get Global Cache device
    const globalCacheDevice = await db.select()
      .from(globalCacheDevices)
      .where(eq(globalCacheDevices.id, globalCacheDeviceId))
      .limit(1)
      .get()

    if (!globalCacheDevice) {
      console.log('❌ [IR LEARN API] Global Cache device not found')
      return NextResponse.json(
        { success: false, error: 'Global Cache device not found' },
        { status: 404 }
      )
    }

    console.log('📡 [IR LEARN API] Global Cache device found')
    console.log('   Name:', globalCacheDevice.name)
    console.log('   IP:', globalCacheDevice.ipAddress)
    console.log('   Port:', globalCacheDevice.port)

    // Start learning session
    const result = await startLearningSession(
      globalCacheDevice.ipAddress,
      globalCacheDevice.port
    )

    if (result.success && result.learnedCode) {
      console.log('✅ [IR LEARN API] IR code learned successfully')
      console.log('   Code length:', result.learnedCode.length)

      // Update the command with the learned IR code
      const updatedCommand = await update(
        'irCommands',
        eq(schema.irCommands.id, commandId),
        {
          irCode: result.learnedCode,
          updatedAt: new Date().toISOString()
        }
      )

      console.log('✅ [IR LEARN API] Command updated with learned code')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      return NextResponse.json({
        success: true,
        status: 'IR code learned and saved successfully',
        learnedCode: result.learnedCode,
        command: updatedCommand
      })
    } else {
      console.log('❌ [IR LEARN API] Failed to learn IR code')
      console.log('   Error:', result.error)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      return NextResponse.json(
        { success: false, error: result.error || 'Failed to learn IR code' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('❌ [IR LEARN API] Error in learning API:', error)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to start learning' 
      },
      { status: 500 }
    )
  }
}

/**
 * Start IR learning session on Global Cache device
 */
async function startLearningSession(
  ipAddress: string,
  port: number,
  timeout: number = 60000 // 60 seconds timeout for learning
): Promise<{
  success: boolean
  status?: string
  learnedCode?: string
  error?: string
}> {
  return new Promise((resolve) => {
    const client = new net.Socket()
    let dataBuffer = ''
    let resolved = false
    let learningEnabled = false

    console.log('🔌 [IR LEARN] Connecting to Global Cache device...')
    console.log('   Address:', `${ipAddress}:${port}`)

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        client.destroy()
        console.log('⏱️  [IR LEARN] Learning session timeout')
        resolve({
          success: false,
          error: 'Learning timeout - no IR code received within 60 seconds. Please try again and press the remote button within 60 seconds.'
        })
      }
    }, timeout)

    client.on('connect', () => {
      console.log('✅ [IR LEARN] Connected to Global Cache device')
      console.log('📤 [IR LEARN] Sending get_IRL command')
      
      // Send get_IRL command to enable learning mode
      client.write('get_IRL\r')
    })

    client.on('data', (data) => {
      const response = data.toString()
      dataBuffer += response
      
      console.log('📥 [IR LEARN] Received data:', response.trim())

      // Check for "IR Learner Enabled" response
      if (response.includes('IR Learner Enabled')) {
        learningEnabled = true
        console.log('✅ [IR LEARN] IR Learner enabled - waiting for IR code...')
        console.log('👉 [IR LEARN] Point your remote at the Global Cache device and press a button')
        return
      }

      // Check for "IR Learner Unavailable" response
      if (response.includes('IR Learner Unavailable')) {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutId)
          client.destroy()
          console.log('❌ [IR LEARN] IR Learner unavailable')
          resolve({
            success: false,
            error: 'IR Learner unavailable - device may be configured for LED lighting or another mode'
          })
        }
        return
      }

      // Check if we received a learned IR code (starts with "sendir")
      if (learningEnabled && response.includes('sendir')) {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutId)
          
          // Extract the IR code
          const lines = dataBuffer.split('\r')
          const irCodeLine = lines.find(line => line.trim().startsWith('sendir'))
          
          if (irCodeLine) {
            const learnedCode = irCodeLine.trim()
            console.log('🎉 [IR LEARN] IR code learned successfully!')
            console.log('   Code length:', learnedCode.length, 'characters')
            console.log('   Code preview:', learnedCode.substring(0, 100) + '...')
            
            // Automatically stop learning
            client.write('stop_IRL\r')
            
            // Give it a moment to process stop command, then close
            setTimeout(() => {
              client.destroy()
            }, 500)
            
            resolve({
              success: true,
              status: 'IR code learned successfully',
              learnedCode
            })
          }
        }
      }
    })

    client.on('error', (error) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        console.error('❌ [IR LEARN] Socket error:', error.message)
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
        console.log('🔌 [IR LEARN] Connection closed')
        
        if (learningEnabled) {
          resolve({
            success: false,
            error: 'Connection closed before IR code was received'
          })
        } else {
          resolve({
            success: false,
            error: 'Failed to enable IR learning mode'
          })
        }
      }
    })

    try {
      client.connect(port, ipAddress)
    } catch (error) {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        console.error('❌ [IR LEARN] Connection failed:', error)
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Connection failed'
        })
      }
    }
  })
}
