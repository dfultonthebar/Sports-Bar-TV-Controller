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
    
    const client = net.createConnection({ port, host: ipAddress }, () => {
      console.log(`TCP Connected to Wolfpack at ${ipAddress}:${port}`)
      const commandWithLineEnding = command + '\r\n'
      client.write(commandWithLineEnding)
    })
    
    client.setTimeout(timeoutMs)
    
    client.on('data', (data) => {
      response += data.toString()
      console.log(`Wolfpack TCP response: ${response}`)
      
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
      console.error(`TCP connection timeout after ${timeoutMs}ms`)
      client.destroy()
      resolve({ success: false, error: `Connection timeout after ${timeoutMs}ms` })
    })
    
    client.on('error', (err) => {
      console.error('TCP connection error:', err.message)
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
  const startTime = Date.now()
  
  try {
    // Get the active matrix configuration
    const matrixConfig = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true }
    })

    if (!matrixConfig) {
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

    const ipAddress = matrixConfig.ipAddress
    const port = matrixConfig.tcpPort || 5000

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

    // Perform switching test using TCP
    const testResults = []
    const testInput = 1
    const testOutput = 33 // Wolfpack matrix output (typically 33-36 for Matrix 1-4)
    const testCommand = `${testInput}X${testOutput}.`

    try {
      // Send switching command via TCP with 30 second timeout
      const switchResult = await sendTCPCommand(ipAddress, port, testCommand, 30000)

      const duration = Date.now() - startTime

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
    console.error('Error in Wolf Pack switching test:', error)
    
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
      console.error('Failed to log test error:', logError)
      return NextResponse.json({
        success: false,
        error: 'Test failed and could not be logged',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration
      }, { status: 500 })
    }
  }
}
