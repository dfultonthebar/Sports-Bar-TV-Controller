
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

    // Test connection to Wolf Pack matrix
    let connectionSuccess = false
    let responseMessage = ''
    let errorMessage: string | null = null

    try {
      // Attempt to connect to the Wolf Pack matrix
      const testResponse = await fetch(`http://${ipAddress}:${port}/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })

      if (testResponse.ok) {
        connectionSuccess = true
        responseMessage = 'Successfully connected to Wolf Pack matrix'
      } else {
        connectionSuccess = false
        errorMessage = `Connection failed with status: ${testResponse.status}`
        responseMessage = errorMessage
      }
    } catch (error) {
      connectionSuccess = false
      errorMessage = error instanceof Error ? error.message : 'Unknown connection error'
      responseMessage = `Failed to connect: ${errorMessage}`
    }

    const duration = Date.now() - startTime

    // Log the test result
    const testLog = await prisma.testLog.create({
      data: {
        testType: 'wolfpack_connection',
        testName: 'Wolf Pack Connection Test',
        status: connectionSuccess ? 'success' : 'failed',
        response: responseMessage,
        errorMessage: connectionSuccess ? null : errorMessage,
        duration: duration,
        command: null,
        inputChannel: null,
        outputChannel: null,
        metadata: JSON.stringify({
          ipAddress,
          port,
          timestamp: new Date().toISOString()
        })
      }
    })

    return NextResponse.json({
      success: connectionSuccess,
      message: responseMessage,
      testLogId: testLog.id,
      duration,
      details: {
        ipAddress,
        port,
        status: connectionSuccess ? 'connected' : 'disconnected'
      }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    
    // Always return valid JSON, even on error
    console.error('Error testing Wolf Pack connection:', error)
    
    try {
      const errorLog = await prisma.testLog.create({
        data: {
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
        }
      })

      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        testLogId: errorLog.id,
        duration
      }, { status: 500 })
    } catch (logError) {
      // If even logging fails, return a basic error response
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
