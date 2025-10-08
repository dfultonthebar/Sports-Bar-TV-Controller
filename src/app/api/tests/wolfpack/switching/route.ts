
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { Socket } from 'net'
import dgram from 'dgram'

const prisma = new PrismaClient()

// Helper function to send Wolf Pack command
async function sendWolfPackCommand(
  command: string,
  ipAddress: string,
  port: number,
  protocol: string
): Promise<{ success: boolean; response?: string; error?: string }> {
  // Ensure command ends with period
  const wolfPackCommand = command.endsWith('.') ? command : command + '.'
  
  // Add carriage return and line feed for proper Telnet/TCP protocol
  const commandWithLineEnding = wolfPackCommand + '\r\n'

  console.log(`[DEBUG] Sending command: "${wolfPackCommand}" (with \\r\\n) to ${ipAddress}:${port}`)

  if (protocol === 'TCP') {
    return new Promise((resolve) => {
      const socket = new Socket()
      let response = ''
      let responseReceived = false
      
      const timeout = setTimeout(() => {
        if (!responseReceived) {
          console.log(`[DEBUG] Command timeout after 10s. Response so far: "${response}"`)
          socket.destroy()
          resolve({ success: false, error: `Command timeout (10000ms). No response received.` })
        }
      }, 10000)

      socket.connect(port, ipAddress, () => {
        console.log(`[DEBUG] TCP connected, sending: ${Buffer.from(commandWithLineEnding).toString('hex')}`)
        socket.write(commandWithLineEnding)
      })

      socket.on('data', (data) => {
        response += data.toString()
        console.log(`[DEBUG] Received data: "${data.toString()}" (hex: ${data.toString('hex')})`)
        console.log(`[DEBUG] Total response so far: "${response}"`)
        
        // Check for various response patterns
        // Some Wolfpack devices respond with just "OK\r\n", others with more verbose messages
        if (response.includes('OK') || response.includes('ERR') || response.includes('Error')) {
          responseReceived = true
          clearTimeout(timeout)
          socket.destroy()
          const success = response.includes('OK')
          console.log(`[DEBUG] Command ${success ? 'succeeded' : 'failed'}: "${response.trim()}"`)
          resolve({ success, response: response.trim() })
        }
        // Some devices might respond with just a newline or echo the command
        else if (response.length > wolfPackCommand.length + 10) {
          // If we've received substantial data but no OK/ERR, consider it a response
          responseReceived = true
          clearTimeout(timeout)
          socket.destroy()
          console.log(`[DEBUG] Received response without OK/ERR: "${response.trim()}"`)
          resolve({ success: true, response: response.trim() })
        }
      })

      socket.on('error', (error) => {
        clearTimeout(timeout)
        console.log(`[DEBUG] Socket error: ${error.message}`)
        resolve({ success: false, error: error.message })
      })

      socket.on('close', () => {
        if (!responseReceived) {
          clearTimeout(timeout)
          console.log(`[DEBUG] Socket closed without response. Data received: "${response}"`)
          // If socket closed but we got some data, consider it
          if (response.length > 0) {
            resolve({ success: true, response: response.trim() })
          }
        }
      })
    })
  } else {
    // UDP
    return new Promise((resolve) => {
      const client = dgram.createSocket('udp4')
      
      const timeout = setTimeout(() => {
        client.close()
        resolve({ success: false, error: 'UDP send timeout' })
      }, 5000)

      client.send(commandWithLineEnding, port, ipAddress, (error) => {
        clearTimeout(timeout)
        client.close()
        if (error) {
          resolve({ success: false, error: error.message })
        } else {
          resolve({ success: true, response: 'UDP command sent' })
        }
      })
    })
  }
}

export async function POST(request: NextRequest) {
  const overallStartTime = Date.now()
  
  try {
    // Get the active matrix configuration
    const matrixConfig = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true },
      include: {
        inputs: {
          where: { isActive: true },
          orderBy: { channelNumber: 'asc' }
        },
        outputs: {
          where: { isActive: true },
          orderBy: { channelNumber: 'asc' }
        }
      }
    })

    if (!matrixConfig) {
      const errorLog = await prisma.testLog.create({
        data: {
          testType: 'wolfpack_switching',
          testName: 'Wolf Pack Switching Test',
          status: 'failed',
          errorMessage: 'No active matrix configuration found',
          duration: Date.now() - overallStartTime,
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

    const activeInputs = matrixConfig.inputs
    const activeOutputs = matrixConfig.outputs

    if (activeInputs.length === 0) {
      const errorLog = await prisma.testLog.create({
        data: {
          testType: 'wolfpack_switching',
          testName: 'Wolf Pack Switching Test',
          status: 'failed',
          errorMessage: 'No active inputs configured',
          duration: Date.now() - overallStartTime,
        }
      })

      return NextResponse.json({ 
        success: false, 
        error: 'No active inputs configured',
        logId: errorLog.id
      })
    }

    if (activeOutputs.length === 0) {
      const errorLog = await prisma.testLog.create({
        data: {
          testType: 'wolfpack_switching',
          testName: 'Wolf Pack Switching Test',
          status: 'failed',
          errorMessage: 'No active outputs configured',
          duration: Date.now() - overallStartTime,
        }
      })

      return NextResponse.json({ 
        success: false, 
        error: 'No active outputs configured',
        logId: errorLog.id
      })
    }

    // Log test start
    const testStartLog = await prisma.testLog.create({
      data: {
        testType: 'wolfpack_switching',
        testName: 'Wolf Pack Switching Test - Started',
        status: 'running',
        duration: 0,
        metadata: JSON.stringify({
          ipAddress,
          port,
          protocol,
          totalInputs: activeInputs.length,
          totalOutputs: activeOutputs.length,
          totalTests: activeInputs.length * activeOutputs.length
        })
      }
    })

    const results: any[] = []
    let successCount = 0
    let failureCount = 0

    // Test each input to each output
    for (const input of activeInputs) {
      for (const output of activeOutputs) {
        const testStartTime = Date.now()
        
        // Wolf Pack command format: [input]X[output].
        // Example: 1X2. (route input 1 to output 2)
        // Note: Some models use 'V' instead of 'X', or '>' - check device manual
        const command = `${input.channelNumber}X${output.channelNumber}`
        
        const result = await sendWolfPackCommand(command, ipAddress, port, protocol)
        const duration = Date.now() - testStartTime

        const testLog = await prisma.testLog.create({
          data: {
            testType: 'wolfpack_switching',
            testName: `Switch Input ${input.channelNumber} to Output ${output.channelNumber}`,
            status: result.success ? 'success' : 'failed',
            inputChannel: input.channelNumber,
            outputChannel: output.channelNumber,
            command,
            response: result.response || null,
            errorMessage: result.error || null,
            duration,
            metadata: JSON.stringify({
              inputLabel: input.label,
              outputLabel: output.label,
              ipAddress,
              port,
              protocol
            })
          }
        })

        if (result.success) {
          successCount++
        } else {
          failureCount++
        }

        results.push({
          input: input.channelNumber,
          inputLabel: input.label,
          output: output.channelNumber,
          outputLabel: output.label,
          success: result.success,
          response: result.response,
          error: result.error,
          duration,
          logId: testLog.id
        })

        // Small delay between commands to avoid overwhelming the matrix
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    const totalDuration = Date.now() - overallStartTime

    // Log test completion
    const testCompleteLog = await prisma.testLog.create({
      data: {
        testType: 'wolfpack_switching',
        testName: 'Wolf Pack Switching Test - Completed',
        status: failureCount === 0 ? 'success' : 'partial',
        duration: totalDuration,
        metadata: JSON.stringify({
          totalTests: results.length,
          successCount,
          failureCount,
          successRate: ((successCount / results.length) * 100).toFixed(2) + '%'
        })
      }
    })

    return NextResponse.json({ 
      success: failureCount === 0,
      message: `Completed ${results.length} tests: ${successCount} succeeded, ${failureCount} failed`,
      summary: {
        totalTests: results.length,
        successCount,
        failureCount,
        successRate: ((successCount / results.length) * 100).toFixed(2) + '%',
        duration: totalDuration
      },
      results,
      logId: testCompleteLog.id,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    const duration = Date.now() - overallStartTime
    
    const errorLog = await prisma.testLog.create({
      data: {
        testType: 'wolfpack_switching',
        testName: 'Wolf Pack Switching Test',
        status: 'error',
        errorMessage: String(error),
        duration,
      }
    })

    console.error('Error running Wolf Pack switching test:', error)
    return NextResponse.json({ 
      success: false, 
      error: String(error),
      logId: errorLog.id
    }, { status: 500 })
  }
}
