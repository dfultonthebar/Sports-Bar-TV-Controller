import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import * as net from 'net'

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
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📡 [WOLFPACK SWITCHING] Sending TCP command')
    console.log('Target:', `${ipAddress}:${port}`)
    console.log('Command:', command)
    console.log('Timeout:', `${timeoutMs}ms`)
    console.log('Timestamp:', new Date().toISOString())
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    const client = net.createConnection({ port, host: ipAddress }, () => {
      console.log('✅ [WOLFPACK SWITCHING] TCP connection established')
      console.log('Sending command with line ending...')
      
      const commandWithLineEnding = command + '\r\n'
      client.write(commandWithLineEnding)
      
      console.log('📤 [WOLFPACK SWITCHING] Command sent, waiting for response...')
    })
    
    client.setTimeout(timeoutMs)
    
    client.on('data', (data) => {
      response += data.toString()
      console.log('📥 [WOLFPACK SWITCHING] Received data:', response)
      
      if (response.includes('OK') || response.includes('ERR') || response.includes('Error')) {
        responseReceived = true
        client.end()
        
        if (response.includes('OK')) {
          console.log('✅ [WOLFPACK SWITCHING] Command successful')
          console.log('Response:', response.trim())
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          resolve({ success: true, response: response.trim() })
        } else {
          console.error('❌ [WOLFPACK SWITCHING] Command failed')
          console.error('Response:', response.trim())
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          resolve({ success: false, error: `Command failed: ${response.trim()}`, response: response.trim() })
        }
      }
    })
    
    client.on('timeout', () => {
      console.error('❌ [WOLFPACK SWITCHING] Connection timeout')
      console.error('Timeout duration:', `${timeoutMs}ms`)
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      client.destroy()
      resolve({ success: false, error: `Connection timeout after ${timeoutMs}ms` })
    })
    
    client.on('error', (err) => {
      console.error('❌ [WOLFPACK SWITCHING] TCP connection error')
      console.error('Error:', err.message)
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      client.destroy()
      resolve({ success: false, error: `TCP error: ${err.message}` })
    })
    
    client.on('close', () => {
      if (!responseReceived) {
        if (response.length > 0) {
          console.log('✅ [WOLFPACK SWITCHING] Connection closed with response')
          console.log('Response:', response.trim())
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          resolve({ success: true, response: response.trim() })
        } else {
          console.error('❌ [WOLFPACK SWITCHING] Connection closed without response')
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          resolve({ success: false, error: 'Connection closed without response' })
        }
      }
    })
  })
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎛️ [WOLFPACK SWITCHING TEST] API endpoint called')
  console.log('Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  try {
    console.log('📂 [WOLFPACK SWITCHING TEST] Loading matrix configuration from database...')
    
    // Get the active matrix configuration
    const matrixConfig = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true }
    })

    if (!matrixConfig) {
      console.error('❌ [WOLFPACK SWITCHING TEST] No active matrix configuration found')
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      const duration = Date.now() - startTime
      const errorLog = await prisma.testLog.create({
        data: {
          testType: 'wolfpack_switching',
          testName: 'Wolf Pack Switching Test',
          status: 'failed',
          errorMessage: 'No active matrix configuration found',
          duration: duration,
          response: null,
          command: null,
          inputChannel: null,
          outputChannel: null,
          metadata: null
        }
      })

      return NextResponse.json({ 
        success: false,
        error: 'No active matrix configuration found',
        testLogId: errorLog.id
      }, { status: 404 })
    }

    console.log('✅ [WOLFPACK SWITCHING TEST] Configuration loaded')
    console.log('Configuration ID:', matrixConfig.id)
    console.log('Name:', matrixConfig.name)
    console.log('IP Address:', matrixConfig.ipAddress)
    console.log('TCP Port:', matrixConfig.tcpPort)
    console.log('Protocol:', matrixConfig.protocol)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const ipAddress = matrixConfig.ipAddress
    const port = matrixConfig.tcpPort || 5000

    console.log('💾 [WOLFPACK SWITCHING TEST] Creating test start log...')
    
    // Log test start
    const testStartLog = await prisma.testLog.create({
      data: {
        testType: 'wolfpack_switching',
        testName: 'Wolf Pack Switching Test',
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
          startTime: new Date().toISOString()
        })
      }
    })
    
    console.log('✅ [WOLFPACK SWITCHING TEST] Test start log created')
    console.log('Test Log ID:', testStartLog.id)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Perform switching test using TCP
    console.log('🔄 [WOLFPACK SWITCHING TEST] Starting switching test...')
    
    const testResults = []
    const testInput = 1
    const testOutput = 33 // Wolfpack matrix output (typically 33-36 for Matrix 1-4)
    const testCommand = `${testInput}X${testOutput}.`

    console.log('Test Parameters:')
    console.log('  Input:', testInput)
    console.log('  Output:', testOutput)
    console.log('  Command:', testCommand)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      console.log('📡 [WOLFPACK SWITCHING TEST] Sending switching command...')
      
      // Send switching command via TCP with 30 second timeout
      const switchResult = await sendTCPCommand(ipAddress, port, testCommand, 30000)

      const duration = Date.now() - startTime

      console.log('📊 [WOLFPACK SWITCHING TEST] Switch command completed')
      console.log('Success:', switchResult.success)
      console.log('Duration:', `${duration}ms`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      console.log('💾 [WOLFPACK SWITCHING TEST] Saving individual test result...')
      
      // Log individual test
      const testLog = await prisma.testLog.create({
        data: {
          testType: 'wolfpack_switching',
          testName: `Switch Test: Input ${testInput} to Output ${testOutput}`,
          status: switchResult.success ? 'success' : 'failed',
          command: testCommand,
          inputChannel: testInput,
          outputChannel: testOutput,
          response: switchResult.response || null,
          errorMessage: switchResult.success ? null : (switchResult.error || 'Unknown error'),
          duration: duration,
          metadata: JSON.stringify({
            ipAddress,
            port,
            protocol: matrixConfig.protocol
          })
        }
      })

      console.log('✅ [WOLFPACK SWITCHING TEST] Individual test result saved')
      console.log('Test Log ID:', testLog.id)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      testResults.push({
        input: testInput,
        output: testOutput,
        command: testCommand,
        success: switchResult.success,
        response: switchResult.response,
        error: switchResult.error,
        testLogId: testLog.id
      })

    } catch (switchError) {
      const duration = Date.now() - startTime
      const errorMessage = switchError instanceof Error ? switchError.message : 'Switch command failed'
      
      console.error('❌ [WOLFPACK SWITCHING TEST] Switch command exception')
      console.error('Error:', errorMessage)
      console.error('Duration:', `${duration}ms`)
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      const testLog = await prisma.testLog.create({
        data: {
          testType: 'wolfpack_switching',
          testName: `Switch Test: Input ${testInput} to Output ${testOutput}`,
          status: 'error',
          command: testCommand,
          inputChannel: testInput,
          outputChannel: testOutput,
          response: null,
          errorMessage: errorMessage,
          duration: duration,
          metadata: JSON.stringify({
            ipAddress,
            port,
            error: errorMessage
          })
        }
      })

      testResults.push({
        input: testInput,
        output: testOutput,
        command: testCommand,
        success: false,
        error: errorMessage,
        testLogId: testLog.id
      })
    }

    const totalDuration = Date.now() - startTime
    const allSuccess = testResults.every(r => r.success)

    console.log('📊 [WOLFPACK SWITCHING TEST] All tests completed')
    console.log('Total Tests:', testResults.length)
    console.log('Successful:', testResults.filter(r => r.success).length)
    console.log('Failed:', testResults.filter(r => !r.success).length)
    console.log('Total Duration:', `${totalDuration}ms`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    console.log('💾 [WOLFPACK SWITCHING TEST] Saving test completion log...')
    
    // Log test completion
    const testCompleteLog = await prisma.testLog.create({
      data: {
        testType: 'wolfpack_switching',
        testName: 'Wolf Pack Switching Test',
        status: allSuccess ? 'success' : 'failed',
        response: `Completed ${testResults.length} test(s)`,
        errorMessage: allSuccess ? null : 'Some tests failed',
        duration: totalDuration,
        command: null,
        inputChannel: null,
        outputChannel: null,
        metadata: JSON.stringify({
          ipAddress,
          port,
          protocol: matrixConfig.protocol,
          totalTests: testResults.length,
          successfulTests: testResults.filter(r => r.success).length,
          failedTests: testResults.filter(r => !r.success).length
        })
      }
    })

    console.log('✅ [WOLFPACK SWITCHING TEST] Test completion log saved')
    console.log('Test Log ID:', testCompleteLog.id)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json({
      success: allSuccess,
      message: `Switching test completed: ${testResults.filter(r => r.success).length}/${testResults.length} successful`,
      testLogId: testCompleteLog.id,
      startLogId: testStartLog.id,
      duration: totalDuration,
      results: testResults
    })

  } catch (error) {
    const duration = Date.now() - startTime
    
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('❌ [WOLFPACK SWITCHING TEST] Unexpected error occurred')
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error')
    console.error('Stack:', error instanceof Error ? error.stack : 'N/A')
    console.error('Duration:', `${duration}ms`)
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    try {
      const errorLog = await prisma.testLog.create({
        data: {
          testType: 'wolfpack_switching',
          testName: 'Wolf Pack Switching Test',
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
        }
      })

      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        testLogId: errorLog.id,
        duration
      }, { status: 500 })
    } catch (logError) {
      console.error('❌ [WOLFPACK SWITCHING TEST] Failed to log error to database')
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

