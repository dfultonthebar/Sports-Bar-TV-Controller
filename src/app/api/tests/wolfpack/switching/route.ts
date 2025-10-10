
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

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

    // First verify connection
    try {
      const connectionTest = await fetch(`http://${ipAddress}:${port}/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })

      if (!connectionTest.ok) {
        const duration = Date.now() - startTime
        const errorLog = await prisma.testLog.create({
          data: {
            testType: 'wolfpack_switching',
            testName: 'Wolf Pack Switching Test',
            status: 'failed',
            errorMessage: 'Cannot connect to Wolf Pack matrix',
            duration: duration,
            response: null,
            command: null,
            inputChannel: null,
            outputChannel: null,
            metadata: JSON.stringify({
              ipAddress,
              port,
              connectionStatus: connectionTest.status
            })
          }
        })

        return NextResponse.json({
          success: false,
          error: 'Cannot connect to Wolf Pack matrix',
          testLogId: errorLog.id
        }, { status: 503 })
      }
    } catch (connectionError) {
      const duration = Date.now() - startTime
      const errorLog = await prisma.testLog.create({
        data: {
          testType: 'wolfpack_switching',
          testName: 'Wolf Pack Switching Test',
          status: 'failed',
          errorMessage: connectionError instanceof Error ? connectionError.message : 'Connection failed',
          duration: duration,
          response: null,
          command: null,
          inputChannel: null,
          outputChannel: null,
          metadata: JSON.stringify({
            ipAddress,
            port,
            error: connectionError instanceof Error ? connectionError.message : 'Unknown error'
          })
        }
      })

      return NextResponse.json({
        success: false,
        error: 'Failed to connect to Wolf Pack matrix',
        details: connectionError instanceof Error ? connectionError.message : 'Unknown error',
        testLogId: errorLog.id
      }, { status: 503 })
    }

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
          startTime: new Date().toISOString()
        })
      }
    })

    // Perform switching tests
    const testResults = []
    const testInput = 1
    const testOutput = 1
    const testCommand = `${testInput}X${testOutput}.`

    try {
      // Send switching command
      const switchResponse = await fetch(`http://${ipAddress}:${port}/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: testCommand }),
        signal: AbortSignal.timeout(5000)
      })

      const switchSuccess = switchResponse.ok
      const duration = Date.now() - startTime

      // Log individual test
      const testLog = await prisma.testLog.create({
        data: {
          testType: 'wolfpack_switching',
          testName: `Switch Test: Input ${testInput} to Output ${testOutput}`,
          status: switchSuccess ? 'success' : 'failed',
          command: testCommand,
          inputChannel: testInput,
          outputChannel: testOutput,
          response: switchSuccess ? 'Switch command executed' : 'Switch command failed',
          errorMessage: switchSuccess ? null : `HTTP ${switchResponse.status}`,
          duration: duration,
          metadata: JSON.stringify({
            ipAddress,
            port,
            httpStatus: switchResponse.status
          })
        }
      })

      testResults.push({
        input: testInput,
        output: testOutput,
        command: testCommand,
        success: switchSuccess,
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
        status: allSuccess ? 'success' : 'partial',
        response: `Completed ${testResults.length} test(s)`,
        errorMessage: allSuccess ? null : 'Some tests failed',
        duration: totalDuration,
        command: null,
        inputChannel: null,
        outputChannel: null,
        metadata: JSON.stringify({
          ipAddress,
          port,
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
