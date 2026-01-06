
import { NextRequest, NextResponse } from 'next/server'
import { findMany, findUnique, findFirst, create, update, updateMany, deleteRecord, upsert, count, eq, desc, asc, and, or, ne } from '@/lib/db-helpers'
import { schema } from '@/db'
import { db } from '@/db'
// Converted to Drizzle ORM
import * as net from 'net'
import { matrixConfigurations, testLogs } from '@/db/schema'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
// TCP connection test with timeout
async function testTCPConnection(
  ipAddress: string,
  port: number,
  timeoutMs: number = 5000
): Promise<{ success: boolean; response?: string; error?: string; duration: number }> {
  const startTime = Date.now()
  
  return new Promise((resolve) => {
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('🎛️ [WOLFPACK CONNECTION TEST] Starting TCP connection test')
    logger.info('Target:', { data: `${ipAddress}:${port}` })
    logger.info('Timeout:', { data: `${timeoutMs}ms` })
    logger.info('Timestamp:', { data: new Date().toISOString() })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    const client = net.createConnection({ port, host: ipAddress }, () => {
      const duration = Date.now() - startTime
      logger.info('✅ [WOLFPACK CONNECTION TEST] TCP connection established')
      logger.info('Duration:', { data: `${duration}ms` })
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
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
      logger.error('❌ [WOLFPACK CONNECTION TEST] Connection timeout')
      logger.error('Duration:', { data: `${duration}ms` })
      logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      client.destroy()
      resolve({ 
        success: false, 
        error: `Connection timeout after ${timeoutMs}ms`,
        duration 
      })
    })
    
    client.on('error', (err) => {
      const duration = Date.now() - startTime
      logger.error('❌ [WOLFPACK CONNECTION TEST] Connection error')
      logger.error('Error:', { data: err.message })
      logger.error('Duration:', { data: `${duration}ms` })
      logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
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


  // Input validation - allow empty body for test endpoints
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()).optional())
  if (isValidationError(bodyValidation)) return bodyValidation.error


  const startTime = Date.now()
  
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('🎛️ [WOLFPACK CONNECTION TEST] API endpoint called')
  logger.info('Timestamp:', { data: new Date().toISOString() })
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  try {
    logger.info('📂 [WOLFPACK CONNECTION TEST] Loading matrix configuration from database...')
    
    // Get the active matrix configuration
    const matrixConfigResults = await db.select().from(matrixConfigurations).where(eq(matrixConfigurations.isActive, true)).limit(1)
    const matrixConfig = matrixConfigResults[0]

    if (!matrixConfig) {
      logger.error('❌ [WOLFPACK CONNECTION TEST] No active matrix configuration found')
      logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
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

    logger.info('✅ [WOLFPACK CONNECTION TEST] Configuration loaded')
    logger.info('Configuration ID:', { data: matrixConfig.id })
    logger.info('Name:', { data: matrixConfig.name })
    logger.info('IP Address:', { data: matrixConfig.ipAddress })
    logger.info('TCP Port:', { data: matrixConfig.tcpPort })
    logger.info('Protocol:', { data: matrixConfig.protocol })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const ipAddress = matrixConfig.ipAddress
    const port = matrixConfig.tcpPort || 5000

    logger.info('🔌 [WOLFPACK CONNECTION TEST] Testing TCP connection...')
    
    // Test TCP connection to Wolf Pack matrix
    const connectionResult = await testTCPConnection(ipAddress, port, 5000)

    const duration = Date.now() - startTime

    logger.info('📊 [WOLFPACK CONNECTION TEST] Test completed')
    logger.info('Success:', { data: connectionResult.success })
    logger.info('Total Duration:', { data: `${duration}ms` })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Log the test result to database
    logger.info('💾 [WOLFPACK CONNECTION TEST] Saving test result to database...')

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

    logger.info('✅ [WOLFPACK CONNECTION TEST] Test result saved')
    logger.info('Test Log ID:', { data: testLog.id })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

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
    
    logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.error('❌ [WOLFPACK CONNECTION TEST] Unexpected error occurred')
    logger.error('Error:', { data: error instanceof Error ? error.message : 'Unknown error' })
    logger.error('Stack:', { data: error instanceof Error ? error.stack : 'N/A' })
    logger.error('Duration:', { data: `${duration}ms` })
    logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
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
      logger.error('❌ [WOLFPACK CONNECTION TEST] Failed to log error to database')
      logger.error('Log Error:', logError)
      logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      return NextResponse.json({
        success: false,
        error: 'Test failed and could not be logged',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration
      }, { status: 500 })
    }
  }
}
