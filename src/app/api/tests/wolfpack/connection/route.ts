
import { NextRequest, NextResponse } from 'next/server'
import { findMany, findUnique, findFirst, create, update, updateMany, deleteRecord, upsert, count, eq, desc, asc, and, or, ne } from '@/lib/db-helpers'
import { schema } from '@/db'
import { db } from '@/db'
// Converted to Drizzle ORM
import * as net from 'net'
import { matrixConfigurations, testLogs } from '@/db/schema'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

// TCP connection test with timeout
async function testTCPConnection(
  ipAddress: string,
  port: number,
  timeoutMs: number = 5000
): Promise<{ success: boolean; response?: string; error?: string; duration: number }> {
  const startTime = Date.now()
  
  return new Promise((resolve) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎛️ [WOLFPACK CONNECTION TEST] Starting TCP connection test')
    console.log('Target:', `${ipAddress}:${port}`)
    console.log('Timeout:', `${timeoutMs}ms`)
    console.log('Timestamp:', new Date().toISOString())
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    const client = net.createConnection({ port, host: ipAddress }, () => {
      const duration = Date.now() - startTime
      console.log('✅ [WOLFPACK CONNECTION TEST] TCP connection established')
      console.log('Duration:', `${duration}ms`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      client.end()
      resolve({ 
        success: true, 
        response: `Successfully connected to Wolfpack matrix at ${ipAddress}:${port}`,
        duration 
      })
    })
    
    client.setTimeout(timeoutMs)
    
    client.on('timeout', () => {
      const duration = Date.now() - startTime
      console.error('❌ [WOLFPACK CONNECTION TEST] Connection timeout')
      console.error('Duration:', `${duration}ms`)
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      client.destroy()
      resolve({ 
        success: false, 
        error: `Connection timeout after ${timeoutMs}ms`,
        duration 
      })
    })
    
    client.on('error', (err) => {
      const duration = Date.now() - startTime
      console.error('❌ [WOLFPACK CONNECTION TEST] Connection error')
      console.error('Error:', err.message)
      console.error('Duration:', `${duration}ms`)
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      client.destroy()
      resolve({ 
        success: false, 
        error: `TCP connection error: ${err.message}`,
        duration 
      })
    })
  })
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const startTime = Date.now()
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎛️ [WOLFPACK CONNECTION TEST] API endpoint called')
  console.log('Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  try {
    console.log('📂 [WOLFPACK CONNECTION TEST] Loading matrix configuration from database...')
    
    // Get the active matrix configuration
    const matrixConfig = await db.select().from(matrixConfigurations).where(eq(matrixConfigurations.isActive, true)).limit(1).get()

    if (!matrixConfig) {
      console.error('❌ [WOLFPACK CONNECTION TEST] No active matrix configuration found')
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      const duration = Date.now() - startTime
      const errorLog = await db.insert(testLogs).values({
          testType: 'wolfpack_connection',
          testName: 'Wolf Pack Connection Test',
          status: 'failed',
          errorMessage: 'No active matrix configuration found',
          duration: duration,
          response: null,
          command: null,
          inputChannel: null,
          outputChannel: null,
          metadata: null
        }).returning().get()

      return NextResponse.json({ 
        success: false,
        error: 'No active matrix configuration found',
        testLogId: errorLog.id
      }, { status: 404 })
    }

    console.log('✅ [WOLFPACK CONNECTION TEST] Configuration loaded')
    console.log('Configuration ID:', matrixConfig.id)
    console.log('Name:', matrixConfig.name)
    console.log('IP Address:', matrixConfig.ipAddress)
    console.log('TCP Port:', matrixConfig.tcpPort)
    console.log('Protocol:', matrixConfig.protocol)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const ipAddress = matrixConfig.ipAddress
    const port = matrixConfig.tcpPort || 5000

    console.log('🔌 [WOLFPACK CONNECTION TEST] Testing TCP connection...')
    
    // Test TCP connection to Wolf Pack matrix
    const connectionResult = await testTCPConnection(ipAddress, port, 5000)

    const duration = Date.now() - startTime

    console.log('📊 [WOLFPACK CONNECTION TEST] Test completed')
    console.log('Success:', connectionResult.success)
    console.log('Total Duration:', `${duration}ms`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Log the test result to database
    console.log('💾 [WOLFPACK CONNECTION TEST] Saving test result to database...')

    const testLogResults = await db
      .insert(testLogs)
      .values({
        testType: 'wolfpack_connection',
        testName: 'Wolf Pack Connection Test',
        status: connectionResult.success ? 'success' : 'failed',
        response: connectionResult.response || null,
        errorMessage: connectionResult.success ? null : connectionResult.error,
        duration: duration,
        command: null,
        inputChannel: null,
        outputChannel: null,
        metadata: JSON.stringify({
          ipAddress,
          port,
          protocol: matrixConfig.protocol,
          configId: matrixConfig.id,
          configName: matrixConfig.name,
          timestamp: new Date().toISOString()
        })
      })
      .returning()

    const testLog = testLogResults[0]

    console.log('✅ [WOLFPACK CONNECTION TEST] Test result saved')
    console.log('Test Log ID:', testLog.id)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json({
      success: connectionResult.success,
      message: connectionResult.response || connectionResult.error || 'Connection test completed',
      testLogId: testLog.id,
      duration,
      config: {
        ipAddress,
        port,
        protocol: matrixConfig.protocol
      }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('❌ [WOLFPACK CONNECTION TEST] Unexpected error occurred')
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error')
    console.error('Stack:', error instanceof Error ? error.stack : 'N/A')
    console.error('Duration:', `${duration}ms`)
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    try {
      const errorLogResults = await db
        .insert(testLogs)
        .values({
          testType: 'wolfpack_connection',
          testName: 'Wolf Pack Connection Test',
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
          duration: duration,
          response: null,
          command: null,
          inputChannel: null,
          outputChannel: null,
          metadata: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
          })
        })
        .returning()

      const errorLog = errorLogResults[0]

      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        testLogId: errorLog.id,
        duration
      }, { status: 500 })
    } catch (logError) {
      console.error('❌ [WOLFPACK CONNECTION TEST] Failed to log error to database')
      console.error('Log Error:', logError)
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      return NextResponse.json({
        success: false,
        error: 'Test failed and could not be logged',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration
      }, { status: 500 })
    }
  }
}
