import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { matrixConfigurations, matrixInputs, matrixOutputs, testLogs } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import * as net from 'net'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
// TCP command with timeout
async function sendTCPCommand(
  ipAddress: string,
  port: number,
  command: string,
  timeoutMs: number = 10000
): Promise<{ success: boolean; response?: string; error?: string }> {
  return new Promise((resolve) => {
    let responseReceived = false
    let response = ''
    
    const client = net.createConnection({ port, host: ipAddress }, () => {
      const commandWithLineEnding = command + '\r\n'
      client.write(commandWithLineEnding)
    })
    
    client.setTimeout(timeoutMs)
    
    client.on('data', (data) => {
      response += data.toString()
      
      if (response.includes('OK') || response.includes('ERR') || response.includes('Error')) {
        responseReceived = true
        client.end()
        
        if (response.includes('OK')) {
          resolve({ success: true, response: response.trim() })
        } else {
          resolve({ success: false, error: `Command failed: ${response.trim()}`, response: response.trim() })
        }
      }
    })
    
    client.on('timeout', () => {
      client.destroy()
      resolve({ success: false, error: `Connection timeout after ${timeoutMs}ms` })
    })
    
    client.on('error', (err) => {
      client.destroy()
      resolve({ success: false, error: `TCP error: ${err.message}` })
    })
    
    client.on('close', () => {
      if (!responseReceived) {
        if (response.length > 0) {
          resolve({ success: true, response: response.trim() })
        } else {
          resolve({ success: false, error: 'Connection closed without response' })
        }
      }
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
  logger.info('🎛️ [WOLFPACK COMPREHENSIVE TEST] Starting')
  logger.info('Testing all active input/output combinations')
  logger.info('Timestamp:', { data: new Date().toISOString() })
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  try {
    logger.info('📂 [WOLFPACK] Loading configuration from database...')
    
    // Get the active matrix configuration
    const matrixConfigResults = await db
      .select()
      .from(matrixConfigurations)
      .where(eq(matrixConfigurations.isActive, true))
      .limit(1)
    
    const matrixConfig = matrixConfigResults[0]

    if (!matrixConfig) {
      logger.error('❌ [WOLFPACK] No active matrix configuration found')
      logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      const duration = Date.now() - startTime
      const errorLogResults = await db
        .insert(testLogs)
        .values({
          testType: 'wolfpack_switching',
          testName: 'Wolf Pack Comprehensive Switching Test',
          status: 'failed',
          errorMessage: 'No active matrix configuration found',
          duration: duration,
          response: null,
          command: null,
          inputChannel: null,
          outputChannel: null,
          metadata: null
        })
        .returning()
      
      const errorLog = errorLogResults[0]

      return NextResponse.json({ 
        success: false,
        error: 'No active matrix configuration found',
        testLogId: errorLog.id
      }, { status: 404 })
    }

    // Get active inputs and outputs for this configuration
    const inputs = await db
      .select()
      .from(matrixInputs)
      .where(and(
        eq(matrixInputs.configId, matrixConfig.id),
        eq(matrixInputs.isActive, true)
      ))
      .orderBy(asc(matrixInputs.channelNumber))

    const outputs = await db
      .select()
      .from(matrixOutputs)
      .where(and(
        eq(matrixOutputs.configId, matrixConfig.id),
        eq(matrixOutputs.isActive, true)
      ))
      .orderBy(asc(matrixOutputs.channelNumber))

    logger.info('✅ [WOLFPACK] Configuration loaded')
    logger.info('Configuration ID:', { data: matrixConfig.id })
    logger.info('Name:', { data: matrixConfig.name })
    logger.info('IP Address:', { data: matrixConfig.ipAddress })
    logger.info('TCP Port:', { data: matrixConfig.tcpPort })
    logger.info('Protocol:', { data: matrixConfig.protocol })
    logger.info('Active Inputs:', { data: inputs.length })
    logger.info('Active Outputs:', { data: outputs.length })
    logger.info('Total Tests:', { data: inputs.length * outputs.length })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const ipAddress = matrixConfig.ipAddress
    const port = matrixConfig.tcpPort || 5000

    logger.info('💾 [WOLFPACK] Creating test start log...')
    
    // Log test start
    const testStartLogResults = await db
      .insert(testLogs)
      .values({
        testType: 'wolfpack_switching',
        testName: 'Wolf Pack Comprehensive Switching Test',
        status: 'running',
        response: 'Test started',
        errorMessage: null,
        duration: 0,
        command: null,
        inputChannel: null,
        outputChannel: null,
        metadata: JSON.stringify({
          ipAddress,
          port,
          protocol: matrixConfig.protocol,
          totalInputs: inputs.length,
          totalOutputs: outputs.length,
          totalTests: inputs.length * outputs.length,
          startTime: new Date().toISOString()
        })
      })
      .returning()
    
    const testStartLog = testStartLogResults[0]
    
    logger.info('✅ [WOLFPACK] Test start log created')
    logger.info('Test Log ID:', { data: testStartLog.id })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Test all combinations
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('🔄 [WOLFPACK] Starting comprehensive test')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const testResults = []
    let passedTests = 0
    let failedTests = 0
    let testNumber = 0
    const totalTests = inputs.length * outputs.length

    for (const input of inputs) {
      for (const output of outputs) {
        testNumber++
        const testStart = Date.now()
        
        logger.info(`🧪 [WOLFPACK] Test ${testNumber}/${totalTests}: Input ${input.channelNumber} (${input.label}) → Output ${output.channelNumber} (${output.label})`)

        try {
          // Build command - Wolfpack format: {input}X{output}.
          const command = `${input.channelNumber}X${output.channelNumber}.`
          logger.info(`   Command: ${command}`)

          // Send command via TCP with 10 second timeout
          const switchResult = await sendTCPCommand(ipAddress, port, command, 10000)

          const duration = Date.now() - testStart

          if (switchResult.success) {
            logger.info(`   ✅ Success (${duration}ms)`)
            logger.info(`   Response: ${switchResult.response || 'N/A'}`)
            passedTests++
            
            // Log individual successful test
            const testLogResults = await db
              .insert(testLogs)
              .values({
                testType: 'wolfpack_switching',
                testName: `Switch: Input ${input.channelNumber} → Output ${output.channelNumber}`,
                status: 'success',
                command: command,
                inputChannel: input.channelNumber,
                outputChannel: output.channelNumber,
                response: switchResult.response || null,
                errorMessage: null,
                duration: duration,
                metadata: JSON.stringify({
                  ipAddress,
                  port,
                  inputLabel: input.label,
                  outputLabel: output.label,
                  testNumber,
                  totalTests
                })
              })
              .returning()
            
            const testLog = testLogResults[0]

            testResults.push({
              input: input.channelNumber,
              inputLabel: input.label,
              output: output.channelNumber,
              outputLabel: output.label,
              command: command,
              success: true,
              duration: duration,
              response: switchResult.response,
              error: null,
              testLogId: testLog.id
            })
          } else {
            logger.info(`   ❌ Failed (${duration}ms)`)
            logger.info(`   Error: ${switchResult.error || 'Unknown error'}`)
            failedTests++
            
            // Log individual failed test
            const testLogResults = await db
              .insert(testLogs)
              .values({
                testType: 'wolfpack_switching',
                testName: `Switch: Input ${input.channelNumber} → Output ${output.channelNumber}`,
                status: 'failed',
                command: command,
                inputChannel: input.channelNumber,
                outputChannel: output.channelNumber,
                response: switchResult.response || null,
                errorMessage: switchResult.error || 'Command failed',
                duration: duration,
                metadata: JSON.stringify({
                  ipAddress,
                  port,
                  inputLabel: input.label,
                  outputLabel: output.label,
                  testNumber,
                  totalTests
                })
              })
              .returning()
            
            const testLog = testLogResults[0]

            testResults.push({
              input: input.channelNumber,
              inputLabel: input.label,
              output: output.channelNumber,
              outputLabel: output.label,
              command: command,
              success: false,
              duration: duration,
              response: switchResult.response,
              error: switchResult.error || 'Command failed',
              testLogId: testLog.id
            })
          }

          // Small delay between tests to avoid overwhelming the device
          await new Promise(resolve => setTimeout(resolve, 100))

        } catch (error) {
          const duration = Date.now() - testStart
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          
          logger.info(`   ❌ Exception: ${errorMessage} (${duration}ms)`)
          failedTests++
          
          // Log individual error test
          const testLogResults = await db
            .insert(testLogs)
            .values({
              testType: 'wolfpack_switching',
              testName: `Switch: Input ${input.channelNumber} → Output ${output.channelNumber}`,
              status: 'error',
              command: `${input.channelNumber}X${output.channelNumber}.`,
              inputChannel: input.channelNumber,
              outputChannel: output.channelNumber,
              response: null,
              errorMessage: errorMessage,
              duration: duration,
              metadata: JSON.stringify({
                ipAddress,
                port,
                inputLabel: input.label,
                outputLabel: output.label,
                testNumber,
                totalTests,
                error: errorMessage
              })
            })
            .returning()
          
          const testLog = testLogResults[0]

          testResults.push({
            input: input.channelNumber,
            inputLabel: input.label,
            output: output.channelNumber,
            outputLabel: output.label,
            command: `${input.channelNumber}X${output.channelNumber}.`,
            success: false,
            duration: duration,
            response: null,
            error: errorMessage,
            testLogId: testLog.id
          })
        }
      }
    }

    const totalDuration = Date.now() - startTime
    const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0.0'

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('✅ [WOLFPACK COMPREHENSIVE TEST] Complete')
    logger.info('   Total Tests:', { data: totalTests })
    logger.info('   Passed:', { data: passedTests })
    logger.info('   Failed:', { data: failedTests })
    logger.info('   Success Rate:', { data: `${successRate}%` })
    logger.info('   Total Duration:', { data: `${totalDuration}ms` })
    logger.info('   Average per Test:', { data: `${(totalDuration / totalTests).toFixed(0)}ms` })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logger.info('💾 [WOLFPACK] Saving test completion log...')
    
    // Log test completion
    const testCompleteLogResults = await db
      .insert(testLogs)
      .values({
        testType: 'wolfpack_switching',
        testName: 'Wolf Pack Comprehensive Switching Test',
        status: failedTests === 0 ? 'success' : 'failed',
        response: `Completed ${totalTests} test(s)`,
        errorMessage: failedTests === 0 ? null : `${failedTests} test(s) failed`,
        duration: totalDuration,
        command: null,
        inputChannel: null,
        outputChannel: null,
        metadata: JSON.stringify({
          ipAddress,
          port,
          protocol: matrixConfig.protocol,
          totalTests,
          passedTests,
          failedTests,
          successRate: `${successRate}%`,
          averageDuration: `${(totalDuration / totalTests).toFixed(0)}ms`
        })
      })
      .returning()
    
    const testCompleteLog = testCompleteLogResults[0]

    logger.info('✅ [WOLFPACK] Test completion log saved')
    logger.info('Test Log ID:', { data: testCompleteLog.id })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json({
      success: failedTests === 0,
      totalTests,
      passedTests,
      failedTests,
      successRate: `${successRate}%`,
      duration: totalDuration,
      averageDuration: Math.round(totalDuration / totalTests),
      results: testResults,
      summary: `Passed ${passedTests}/${totalTests} tests`,
      testLogId: testCompleteLog.id,
      startLogId: testStartLog.id
    })

  } catch (error) {
    const duration = Date.now() - startTime
    
    logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.error('❌ [WOLFPACK COMPREHENSIVE TEST] Unexpected error')
    logger.error('Error:', { data: error instanceof Error ? error.message : 'Unknown error' })
    logger.error('Stack:', { data: error instanceof Error ? error.stack : 'N/A' })
    logger.error('Duration:', { data: `${duration}ms` })
    logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    try {
      const errorLogResults = await db
        .insert(testLogs)
        .values({
          testType: 'wolfpack_switching',
          testName: 'Wolf Pack Comprehensive Switching Test',
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
      logger.error('❌ [WOLFPACK] Failed to log error to database')
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
