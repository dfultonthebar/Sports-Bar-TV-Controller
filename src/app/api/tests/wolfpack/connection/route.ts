import { NextRequest, NextResponse } from 'next/server'
import { Socket } from 'net'
import dgram from 'dgram'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Get the active matrix configuration
    const matrixConfig = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true }
    })

    if (!matrixConfig) {
      const errorLog = await prisma.testLog.create({
        data: {
          testType: 'wolfpack_connection',
          testName: 'Wolf Pack Connection Test',
          status: 'failed',
          errorMessage: 'No active matrix configuration found',
          duration: Date.now() - startTime,
        }
      })

      return NextResponse.json({ 
        success: false, 
        error: 'No active matrix configuration found',
        logId: errorLog.id
      })
    }

    const { ipAddress, tcpPort, udpPort, protocol } = matrixConfig
    const port = protocol === 'TCP' ? tcpPort : udpPort

    let connectionSuccess = false
    let responseMessage = ''
    let errorMessage = ''

    if (protocol === 'TCP') {
      // Test TCP connection
      const testTcpConnection = (): Promise<{ success: boolean; message: string }> => {
        return new Promise((resolve) => {
          const socket = new Socket()
          const timeout = setTimeout(() => {
            socket.destroy()
            resolve({ success: false, message: 'Connection timeout' })
          }, 5000)

          socket.connect(port, ipAddress, () => {
            clearTimeout(timeout)
            socket.destroy()
            resolve({ success: true, message: `Connected to ${ipAddress}:${port}` })
          })

          socket.on('error', (error) => {
            clearTimeout(timeout)
            resolve({ success: false, message: error.message })
          })
        })
      }

      const result = await testTcpConnection()
      connectionSuccess = result.success
      responseMessage = result.message
      if (!result.success) {
        errorMessage = result.message
      }
    } else {
      // Test UDP connection
      const testUdpConnection = (): Promise<{ success: boolean; message: string }> => {
        return new Promise((resolve) => {
          const client = dgram.createSocket('udp4')
          const testMessage = '1?.'
          
          const timeout = setTimeout(() => {
            client.close()
            resolve({ success: false, message: 'UDP send timeout' })
          }, 5000)

          client.send(testMessage, port, ipAddress, (error) => {
            clearTimeout(timeout)
            client.close()
            if (error) {
              resolve({ success: false, message: error.message })
            } else {
              resolve({ success: true, message: `UDP packet sent to ${ipAddress}:${port}` })
            }
          })
        })
      }

      const result = await testUdpConnection()
      connectionSuccess = result.success
      responseMessage = result.message
      if (!result.success) {
        errorMessage = result.message
      }
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
        duration,
        metadata: JSON.stringify({
          ipAddress,
          port,
          protocol,
          configId: matrixConfig.id
        })
      }
    })

    return NextResponse.json({ 
      success: connectionSuccess,
      message: responseMessage,
      config: { ipAddress, port, protocol },
      duration,
      logId: testLog.id,
      timestamp: new Date().toISOString()
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
          errorMessage: String(error),
          duration,
        }
      })
      
      return NextResponse.json({ 
        success: false, 
        error: String(error),
        logId: errorLog.id
      }, { status: 500 })
    } catch (logError) {
      console.error('Error logging test result:', logError)
      
      // Fallback response if even logging fails
      return NextResponse.json({ 
        success: false, 
        error: 'Internal server error',
        message: String(error)
      }, { status: 500 })
    }
  }
}
