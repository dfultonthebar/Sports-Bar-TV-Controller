import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
// Converted to Drizzle ORM
import net from 'net'
import { globalCacheDevices } from '@/db/schema'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

/**
 * POST /api/globalcache/learn
 * Start IR learning on a Global Cache device
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = await request.json()
    const { deviceId } = body

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎓 [GLOBAL CACHE] Starting IR learning')
    console.log('   Device ID:', deviceId)
    console.log('   Timestamp:', new Date().toISOString())
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Validate required fields
    if (!deviceId) {
      console.log('❌ [GLOBAL CACHE] Error: Device ID is required')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      return NextResponse.json(
        { success: false, error: 'Device ID is required' },
        { status: 400 }
      )
    }

    // Get device from database
    const device = await db.select().from(globalCacheDevices).where(eq(globalCacheDevices.id, deviceId)).limit(1).get()

    if (!device) {
      console.log('❌ [GLOBAL CACHE] Error: Device not found')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    console.log('📡 [GLOBAL CACHE] Device found')
    console.log('   Name:', device.name)
    console.log('   IP:', device.ipAddress)
    console.log('   Port:', device.port)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Start learning session
    const result = await startLearningSession(device.ipAddress, device.port)

    if (result.success) {
      console.log('✅ [GLOBAL CACHE] Learning session started successfully')
      console.log('   Status:', result.status)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    } else {
      console.log('❌ [GLOBAL CACHE] Failed to start learning session')
      console.log('   Error:', result.error)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [GLOBAL CACHE] Error in learning API:', error)
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
 * DELETE /api/globalcache/learn
 * Stop IR learning on a Global Cache device
 */
export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = await request.json()
    const { deviceId } = body

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🛑 [GLOBAL CACHE] Stopping IR learning')
    console.log('   Device ID:', deviceId)
    console.log('   Timestamp:', new Date().toISOString())
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Validate required fields
    if (!deviceId) {
      console.log('❌ [GLOBAL CACHE] Error: Device ID is required')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      return NextResponse.json(
        { success: false, error: 'Device ID is required' },
        { status: 400 }
      )
    }

    // Get device from database
    const device = await db.select().from(globalCacheDevices).where(eq(globalCacheDevices.id, deviceId)).limit(1).get()

    if (!device) {
      console.log('❌ [GLOBAL CACHE] Error: Device not found')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    console.log('📡 [GLOBAL CACHE] Device found')
    console.log('   Name:', device.name)
    console.log('   IP:', device.ipAddress)
    console.log('   Port:', device.port)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Stop learning session
    const result = await stopLearningSession(device.ipAddress, device.port)

    if (result.success) {
      console.log('✅ [GLOBAL CACHE] Learning session stopped successfully')
      console.log('   Status:', result.status)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    } else {
      console.log('❌ [GLOBAL CACHE] Failed to stop learning session')
      console.log('   Error:', result.error)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [GLOBAL CACHE] Error stopping learning:', error)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to stop learning' 
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

    console.log('🔌 [GLOBAL CACHE] Connecting to device...')
    console.log('   Address:', `${ipAddress}:${port}`)

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        client.destroy()
        console.log('⏱️  [GLOBAL CACHE] Learning session timeout')
        resolve({
          success: false,
          error: 'Learning session timeout - no IR code received within 60 seconds'
        })
      }
    }, timeout)

    client.on('connect', () => {
      console.log('✅ [GLOBAL CACHE] Connected to device')
      console.log('📤 [GLOBAL CACHE] Sending get_IRL command')
      
      // Send get_IRL command to enable learning mode
      client.write('get_IRL\r')
    })

    client.on('data', (data) => {
      const response = data.toString()
      dataBuffer += response
      
      console.log('📥 [GLOBAL CACHE] Received data:', response.trim())

      // Check for "IR Learner Enabled" response
      if (response.includes('IR Learner Enabled')) {
        learningEnabled = true
        console.log('✅ [GLOBAL CACHE] IR Learner enabled - waiting for IR code...')
        console.log('👉 [GLOBAL CACHE] Point your remote at the Global Cache device and press a button')
        return
      }

      // Check for "IR Learner Unavailable" response (LED lighting configured)
      if (response.includes('IR Learner Unavailable')) {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutId)
          client.destroy()
          console.log('❌ [GLOBAL CACHE] IR Learner unavailable (device may be configured for LED lighting)')
          resolve({
            success: false,
            error: 'IR Learner unavailable - device may be configured for LED lighting'
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
            console.log('🎉 [GLOBAL CACHE] IR code learned successfully!')
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
        console.error('❌ [GLOBAL CACHE] Socket error:', error.message)
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
        console.log('🔌 [GLOBAL CACHE] Connection closed')
        
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
        console.error('❌ [GLOBAL CACHE] Connection failed:', error)
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Connection failed'
        })
      }
    }
  })
}

/**
 * Stop IR learning session on Global Cache device
 */
async function stopLearningSession(
  ipAddress: string,
  port: number,
  timeout: number = 5000
): Promise<{
  success: boolean
  status?: string
  error?: string
}> {
  return new Promise((resolve) => {
    const client = new net.Socket()
    let dataBuffer = ''
    let resolved = false

    console.log('🔌 [GLOBAL CACHE] Connecting to device to stop learning...')

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        client.destroy()
        console.log('⏱️  [GLOBAL CACHE] Stop learning timeout')
        resolve({
          success: false,
          error: 'Connection timeout'
        })
      }
    }, timeout)

    client.on('connect', () => {
      console.log('✅ [GLOBAL CACHE] Connected to device')
      console.log('📤 [GLOBAL CACHE] Sending stop_IRL command')
      
      // Send stop_IRL command to disable learning mode
      client.write('stop_IRL\r')
    })

    client.on('data', (data) => {
      const response = data.toString()
      dataBuffer += response
      
      console.log('📥 [GLOBAL CACHE] Received data:', response.trim())

      // Check for "IR Learner Disabled" response
      if (response.includes('IR Learner Disabled')) {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutId)
          console.log('✅ [GLOBAL CACHE] IR Learner disabled successfully')
          
          // Close connection
          setTimeout(() => {
            client.destroy()
          }, 100)
          
          resolve({
            success: true,
            status: 'IR Learner disabled'
          })
        }
      }
    })

    client.on('error', (error) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        console.error('❌ [GLOBAL CACHE] Socket error:', error.message)
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
        console.log('🔌 [GLOBAL CACHE] Connection closed')
        resolve({
          success: true,
          status: 'Connection closed (learning likely stopped)'
        })
      }
    })

    try {
      client.connect(port, ipAddress)
    } catch (error) {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        console.error('❌ [GLOBAL CACHE] Connection failed:', error)
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Connection failed'
        })
      }
    }
  })
}
