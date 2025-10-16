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
  const startTime = Date.now()
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎛️ [WOLFPACK COMPREHENSIVE TEST] Starting')
  console.log('Testing all active input/output combinations')
  console.log('Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  try {
    console.log('📂 [WOLFPACK] Loading configuration from database...')
    
    // Get the active matrix configuration with inputs and outputs
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
      console.error('❌ [WOLFPACK] No active matrix configuration found')
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      const duration = Date.now() - startTime
      const errorLog = await prisma.testLog.create({
        data: {
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
        }
      })

      return NextResponse.json({ 
        success: false,
        error: 'No active matrix configuration found',
        testLogId: errorLog.id
      }, { status: 404 })
    }

    console.log('✅ [WOLFPACK] Configuration loaded')
    console.log('Configuration ID:', matrixConfig.id)
    console.log('Name:', matrixConfig.name)
    console.log('IP Address:', matrixConfig.ipAddress)
    console.log('TCP Port:', matrixConfig.tcpPort)
    console.log('Protocol:', matrixConfig.protocol)
    console.log('Active Inputs:', matrixConfig.inputs.length)
    console.log('Active Outputs:', matrixConfig.outputs.length)
    console.log('Total Tests:', matrixConfig.inputs.length * matrixConfig.outputs.length)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const ipAddress = matrixConfig.ipAddress
    const port = matrixConfig.tcpPort || 5000

    console.log('💾 [WOLFPACK] Creating test start log...')
    
    // Log test start
    const testStartLog = await prisma.testLog.create({
      data: {
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
          totalInputs: matrixConfig.inputs.length,
          totalOutputs: matrixConfig.outputs.length,
          totalTests: matrixConfig.inputs.length * matrixConfig.outputs.length,
          startTime: new Date().toISOString()
        })
      }
    })
    
    console.log('✅ [WOLFPACK] Test start log created')
    console.log('Test Log ID:', testStartLog.id)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Test all combinations
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔄 [WOLFPACK] Starting comprehensive test')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const testResults = []
    let passedTests = 0
    let failedTests = 0
    let testNumber = 0
    const totalTests = matrixConfig.inputs.length * matrixConfig.outputs.length

    for (const input of matrixConfig.inputs) {
      for (const output of matrixConfig.outputs) {
        testNumber++
        const testStart = Date.now()
        
        console.log(`🧪 [WOLFPACK] Test ${testNumber}/${totalTests}: Input ${input.channelNumber} (${input.label}) → Output ${output.channelNumber} (${output.label})`)

        try {
          // Build command - Wolfpack format: {input}X{output}.
          const command = `${input.channelNumber}X${output.channelNumber}.`
          console.log(`   Command: ${command}`)

          // Send command via TCP with 10 second timeout
          const switchResult = await sendTCPCommand(ipAddress, port, command, 10000)

          const duration = Date.now() - testStart

          if (switchResult.success) {
            console.log(`   ✅ Success (${duration}ms)`)
            console.log(`   Response: ${switchResult.response || 'N/A'}`)
            passedTests++
            
            // Log individual successful test
            const testLog = await prisma.testLog.create({
              data: {
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
              }
            })

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
            console.log(`   ❌ Failed (${duration}ms)`)
            console.log(`   Error: ${switchResult.error || 'Unknown error'}`)
            failedTests++
            
            // Log individual failed test
            const testLog = await prisma.testLog.create({
              data: {
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
              }
            })

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
          
          console.log(`   ❌ Exception: ${errorMessage} (${duration}ms)`)
          failedTests++
          
          // Log individual error test
          const testLog = await prisma.testLog.create({
            data: {
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
            }
          })

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

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ [WOLFPACK COMPREHENSIVE TEST] Complete')
    console.log('   Total Tests:', totalTests)
    console.log('   Passed:', passedTests)
    console.log('   Failed:', failedTests)
    console.log('   Success Rate:', `${successRate}%`)
    console.log('   Total Duration:', `${totalDuration}ms`)
    console.log('   Average per Test:', `${(totalDuration / totalTests).toFixed(0)}ms`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    console.log('💾 [WOLFPACK] Saving test completion log...')
    
    // Log test completion
    const testCompleteLog = await prisma.testLog.create({
      data: {
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
      }
    })

    console.log('✅ [WOLFPACK] Test completion log saved')
    console.log('Test Log ID:', testCompleteLog.id)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

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
    
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('❌ [WOLFPACK COMPREHENSIVE TEST] Unexpected error')
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error')
    console.error('Stack:', error instanceof Error ? error.stack : 'N/A')
    console.error('Duration:', `${duration}ms`)
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    try {
      const errorLog = await prisma.testLog.create({
        data: {
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
        }
      })

      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        testLogId: errorLog.id,
        duration
      }, { status: 500 })
    } catch (logError) {
      console.error('❌ [WOLFPACK] Failed to log error to database')
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
