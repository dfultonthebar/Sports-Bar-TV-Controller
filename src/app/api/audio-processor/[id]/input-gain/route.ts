/**
 * Atlas Input Gain Control API
 * 
 * Implements proper Atlas third-party control protocol for input gain adjustment.
 * 
 * IMPORTANT: Atlas uses 0-based indexing for all parameters:
 * - UI displays Input 1, 2, 3... (1-based)
 * - Atlas protocol uses SourceGain_0, SourceGain_1, SourceGain_2... (0-based)
 * 
 * Protocol Reference: ATS006993-B-AZM4-AZM8-3rd-Party-Control.pdf
 * - Parameter: SourceGain_X (X = 0 to N-1)
 * - Range: -80 to 0 dB
 * - Format: val (value in dB)
 * - TCP Port: 5321
 * - Message terminator: \r\n
 */

import { NextRequest, NextResponse } from 'next/server'
import { findUnique, findFirst, update, create, eq } from '@/lib/db-helpers'
import { schema, db } from '@/db'
import * as net from 'net'
import { atlasLogger } from '@/lib/atlas-logger'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

// GET: Read current gain settings for all inputs
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Path parameter validation
  const params = await context.params
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error

  try {
    // Await params for Next.js 15+ compatibility
    const params = await context.params
    const processorId = params.id

    logger.api.request('GET', `/api/audio-processor/${processorId}/input-gain`)

    const processor = await findUnique('audioProcessors', eq(schema.audioProcessors.id, processorId))

    if (!processor) {
      logger.api.response('GET', `/api/audio-processor/${processorId}/input-gain`, 404)
      return NextResponse.json(
        { error: 'Audio processor not found' },
        { status: 404 }
      )
    }

    // Get gain settings from the processor
    const gainSettings = await getInputGainSettings(processor)

    logger.api.response('GET', `/api/audio-processor/${processorId}/input-gain`, 200, { 
      gainCount: gainSettings.length 
    })

    return NextResponse.json({ 
      success: true,
      processor: {
        id: processor.id,
        name: processor.name,
        model: processor.model
      },
      gainSettings 
    })

  } catch (error) {
    logger.api.error('GET', `/api/audio-processor/input-gain`, error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch input gain settings',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST: Set gain for specific input
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Path parameter validation
  const params = await context.params
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error


  // Declare processorId outside try block so it's accessible in catch
  let processorId = 'unknown'

  try {
    // Await params for Next.js 15+ compatibility
    const params = await context.params
    processorId = params.id

    // Use validated data
    const requestBody = bodyValidation.data
    const { inputNumber, gain, reason = 'manual_override' } = requestBody

    logger.api.request('POST', `/api/audio-processor/${processorId}/input-gain`, { 
      inputNumber, 
      gain, 
      reason 
    })

    // Validate required fields
    if (inputNumber === undefined || gain === undefined) {
      logger.api.response('POST', `/api/audio-processor/${processorId}/input-gain`, 400)
      atlasLogger.warn('INPUT_GAIN', 'Missing required fields', { inputNumber, gain })
      return NextResponse.json(
        { 
          error: 'Input number and gain value are required',
          received: { inputNumber, gain }
        },
        { status: 400 }
      )
    }

    // Validate input number
    if (typeof inputNumber !== 'number' || inputNumber < 1) {
      logger.api.response('POST', `/api/audio-processor/${processorId}/input-gain`, 400)
      atlasLogger.warn('INPUT_GAIN', 'Invalid input number', { inputNumber })
      return NextResponse.json(
        { 
          error: 'Input number must be a positive integer',
          received: inputNumber
        },
        { status: 400 }
      )
    }

    // Validate gain value
    if (typeof gain !== 'number' || isNaN(gain)) {
      logger.api.response('POST', `/api/audio-processor/${processorId}/input-gain`, 400)
      atlasLogger.warn('INPUT_GAIN', 'Invalid gain value', { gain })
      return NextResponse.json(
        { 
          error: 'Gain must be a valid number',
          received: gain
        },
        { status: 400 }
      )
    }

    // Get processor from database
    const processor = await findUnique('audioProcessors', eq(schema.audioProcessors.id, processorId))

    if (!processor) {
      logger.api.response('POST', `/api/audio-processor/${processorId}/input-gain`, 404)
      atlasLogger.warn('INPUT_GAIN', 'Audio processor not found', { processorId })
      return NextResponse.json(
        { 
          error: 'Audio processor not found',
          processorId 
        },
        { status: 404 }
      )
    }

    // Validate gain range (-80 to 0 dB per Atlas protocol specification)
    // Reference: ATS006993-B-AZM4-AZM8-3rd-Party-Control.pdf, Section 6.0 Parameter List
    // SourceGain: Min Val = -80, Max Val = 0
    if (gain < -80 || gain > 0) {
      logger.api.response('POST', `/api/audio-processor/${processorId}/input-gain`, 400, {
        error: 'Invalid gain range',
        gain,
        validRange: { min: -80, max: 0 }
      })
      atlasLogger.warn('INPUT_GAIN', 'Gain out of range', { 
        gain, 
        validRange: { min: -80, max: 0 } 
      })
      return NextResponse.json(
        { 
          error: 'Gain must be between -80 and 0 dB',
          received: gain,
          validRange: { min: -80, max: 0 }
        },
        { status: 400 }
      )
    }

    atlasLogger.info('INPUT_GAIN', `Setting input ${inputNumber} gain to ${gain} dB`, {
      processorId,
      ipAddress: processor.ipAddress,
      inputNumber,
      gain,
      reason
    })

    // Set the gain on the processor with timeout and error handling
    let result
    try {
      result = await setInputGain(processor, inputNumber, gain)
      atlasLogger.info('INPUT_GAIN', 'Successfully set gain on Atlas processor', {
        inputNumber,
        gain,
        result
      })
    } catch (gainError) {
      atlasLogger.error('INPUT_GAIN', 'Failed to communicate with Atlas processor', gainError)
      return NextResponse.json(
        { 
          error: 'Failed to communicate with Atlas processor',
          details: gainError instanceof Error ? gainError.message : 'Unknown error',
          processor: {
            id: processor.id,
            name: processor.name,
            ipAddress: processor.ipAddress
          }
        },
        { status: 500 }
      )
    }

    // Update AI gain configuration if it exists
    try {
      const aiConfigs = await db
        .select()
        .from(schema.aiGainConfigurations)
        .where(eq(schema.aiGainConfigurations.processorId, processorId))
        .all()
      
      const aiConfig = aiConfigs.find(config => config.inputNumber === inputNumber) as any

      if (aiConfig) {
        const previousGain = aiConfig.currentGain || 0

        await db
          .update(schema.aiGainConfigurations)
          .set({
            lastAdjustment: new Date().toISOString(),
            adjustmentCount: (aiConfig.adjustmentCount || 0) + 1,
            updatedAt: new Date().toISOString()
          })
          .where(eq(schema.aiGainConfigurations.id, aiConfig.id))

        // Log the adjustment
        await db.insert(schema.aiGainAdjustmentLogs).values({
          configId: aiConfig.id,
          processorId: processorId,
          inputNumber: inputNumber,
          previousLevel: previousGain,
          newLevel: gain,
          adjustment: gain - previousGain,
          reason: reason,
          timestamp: new Date().toISOString()
        })

        atlasLogger.info('INPUT_GAIN', 'Updated AI gain configuration', {
          inputNumber,
          previousGain,
          newGain: gain,
          gainChange: gain - previousGain
        })
      }
    } catch (dbError) {
      // Log but don't fail the request if AI config update fails
      atlasLogger.warn('INPUT_GAIN', 'Failed to update AI gain configuration', dbError)
    }

    logger.api.response('POST', `/api/audio-processor/${processorId}/input-gain`, 200, {
      success: true,
      inputNumber,
      gain
    })

    return NextResponse.json({ 
      success: true,
      inputNumber,
      gain,
      result,
      processor: {
        id: processor.id,
        name: processor.name,
        model: processor.model
      },
      message: `Input ${inputNumber} gain set to ${gain}dB`
    })

  } catch (error) {
    // Ensure we always return a valid JSON response
    logger.api.error('POST', `/api/audio-processor/${processorId}/input-gain`, error)
    atlasLogger.error('INPUT_GAIN', 'Unexpected error in POST handler', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    return NextResponse.json(
      { 
        error: 'Failed to set input gain',
        details: errorMessage,
        processorId,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    )
  }
}

// Helper function to get input gain settings from processor
async function getInputGainSettings(processor: any): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket()
    const gainSettings: any[] = []
    let responseBuffer = ''

    atlasLogger.connectionAttempt(processor.ipAddress, 5321)

    client.connect(5321, processor.ipAddress, () => {
      atlasLogger.connectionSuccess(processor.ipAddress, 5321)

      // Query gain for inputs (0-based indexing as per Atlas protocol)
      // AZMP8 has 10 inputs, AZMP4 has 4 inputs, AZM8 has 8 inputs
      const inputCount = processor.model.includes('AZMP8') ? 10 : 
                        processor.model.includes('AZMP4') ? 4 : 8

      // Atlas protocol uses 0-based indexing: SourceGain_0, SourceGain_1, etc.
      for (let i = 0; i < inputCount; i++) {
        const command = {
          jsonrpc: "2.0",
          id: i + 1,  // Response ID for tracking (1-based for easier mapping)
          method: "get",
          params: {
            param: `SourceGain_${i}`,  // Fixed: Use SourceGain_X with 0-based indexing
            fmt: "val"
          }
        }
        atlasLogger.commandSent(command, processor.ipAddress)
        client.write(JSON.stringify(command) + '\r\n')
      }
    })

    client.on('data', (data) => {
      responseBuffer += data.toString()
      
      // Process complete JSON responses (split by \r\n)
      const lines = responseBuffer.split('\r\n')
      responseBuffer = lines.pop() || '' // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line)
            atlasLogger.responseReceived(response, processor.ipAddress)
            
            if (response.result && response.id) {
              // Response ID is 1-based (for tracking), but Atlas index is 0-based
              const atlasIndex = response.id - 1
              gainSettings.push({
                inputNumber: response.id,  // Keep 1-based for UI display
                gain: parseFloat(response.result.val || response.result),
                parameterName: `SourceGain_${atlasIndex}`,  // Fixed: Use SourceGain_X
                atlasIndex: atlasIndex  // 0-based index for Atlas protocol
              })
            }
          } catch (error) {
            atlasLogger.error('PARSING', 'Error parsing gain response', { line, error })
          }
        }
      }

      // If we have all responses, close connection
      const inputCount = processor.model.includes('AZMP8') ? 10 : 
                        processor.model.includes('AZMP4') ? 4 : 8
      if (gainSettings.length >= inputCount) {
        client.end()
      }
    })

    client.on('close', () => {
      atlasLogger.connectionClosed(processor.ipAddress, 5321)
      resolve(gainSettings)
    })

    client.on('error', (error) => {
      atlasLogger.connectionFailure(processor.ipAddress, 5321, error)
      reject(error)
    })

    // Timeout after 5 seconds
    setTimeout(() => {
      client.end()
      resolve(gainSettings)
    }, 5000)
  })
}

// Helper function to set input gain on processor
async function setInputGain(processor: any, inputNumber: number, gain: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket()
    let responseBuffer = ''
    let timeoutHandle: NodeJS.Timeout
    let resolved = false // Track if promise has been resolved/rejected

    atlasLogger.connectionAttempt(processor.ipAddress, 5321)

    // Timeout after 7 seconds (increased for more reliable communication)
    timeoutHandle = setTimeout(() => {
      if (!resolved) {
        resolved = true
        atlasLogger.error('TIMEOUT', 'Set gain operation timed out', { 
          inputNumber, 
          gain, 
          processor: processor.ipAddress,
          responseBuffer: responseBuffer.substring(0, 200) // Log partial response if any
        })
        client.destroy()
        reject(new Error(`Set gain operation timed out after 7 seconds. Processor may be unresponsive.`))
      }
    }, 7000)

    client.connect(5321, processor.ipAddress, () => {
      atlasLogger.connectionSuccess(processor.ipAddress, 5321)
      atlasLogger.inputGainAdjustment(inputNumber, gain, processor.ipAddress)

      // Convert 1-based UI input number to 0-based Atlas index
      const atlasIndex = inputNumber - 1

      const command = {
        jsonrpc: "2.0",
        id: 1,
        method: "set",
        params: {
          param: `SourceGain_${atlasIndex}`,  // Use SourceGain_X with 0-based index
          val: gain
        }
      }

      atlasLogger.commandSent(command, processor.ipAddress)
      
      try {
        const commandStr = JSON.stringify(command) + '\r\n'
        client.write(commandStr, (writeError) => {
          if (writeError && !resolved) {
            resolved = true
            clearTimeout(timeoutHandle)
            atlasLogger.error('WRITE_ERROR', 'Failed to write command to socket', writeError)
            client.destroy()
            reject(new Error(`Failed to send command to processor: ${writeError.message}`))
          }
        })
      } catch (stringifyError) {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutHandle)
          atlasLogger.error('STRINGIFY_ERROR', 'Failed to stringify command', stringifyError)
          client.destroy()
          reject(new Error(`Failed to prepare command: ${stringifyError}`))
        }
      }
    })

    client.on('data', (data) => {
      responseBuffer += data.toString()
      
      atlasLogger.info('DATA_RECEIVED', 'Received data from Atlas processor', {
        dataLength: data.length,
        bufferLength: responseBuffer.length
      })
      
      // Process complete JSON responses (split by \r\n)
      const lines = responseBuffer.split('\r\n')
      responseBuffer = lines.pop() || '' // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line)
            atlasLogger.responseReceived(response, processor.ipAddress)
            
            // Check for error response first
            if (response.error) {
              if (!resolved) {
                resolved = true
                clearTimeout(timeoutHandle)
                client.end()
                const errorMsg = typeof response.error === 'object' 
                  ? JSON.stringify(response.error) 
                  : response.error
                reject(new Error(`Atlas processor error: ${errorMsg}`))
              }
              return
            }
            
            // Check if response indicates success
            // Atlas returns {"jsonrpc":"2.0","result":"OK","id":1} for successful set operations
            if (response.result === 'OK' || (response.result !== undefined && response.id === 1)) {
              if (!resolved) {
                resolved = true
                clearTimeout(timeoutHandle)
                atlasLogger.info('SUCCESS', 'Gain set successfully', {
                  inputNumber,
                  gain,
                  response
                })
                client.end()
                resolve(response)
              }
              return
            }
          } catch (parseError) {
            atlasLogger.error('PARSING', 'Error parsing set gain response', { 
              line: line.substring(0, 100), 
              error: parseError 
            })
          }
        }
      }
    })

    client.on('error', (error) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutHandle)
        atlasLogger.connectionFailure(processor.ipAddress, 5321, error)
        
        // Provide more helpful error messages
        let errorMsg = `Connection error: ${error.message}`
        if (error.message.includes('ECONNREFUSED')) {
          errorMsg = `Cannot connect to Atlas processor at ${processor.ipAddress}:5321. Is the processor powered on and connected to the network?`
        } else if (error.message.includes('ETIMEDOUT')) {
          errorMsg = `Connection to Atlas processor at ${processor.ipAddress}:5321 timed out. Check network connectivity.`
        } else if (error.message.includes('EHOSTUNREACH')) {
          errorMsg = `Atlas processor at ${processor.ipAddress}:5321 is unreachable. Check network configuration.`
        }
        
        reject(new Error(errorMsg))
      }
    })

    client.on('close', () => {
      if (!resolved) {
        clearTimeout(timeoutHandle)
        atlasLogger.connectionClosed(processor.ipAddress, 5321)
        
        // If we got here without resolving, check if we have a partial response
        if (responseBuffer && responseBuffer.trim()) {
          atlasLogger.warn('INCOMPLETE', 'Connection closed with incomplete response', { 
            responseBuffer: responseBuffer.substring(0, 200) 
          })
          resolved = true
          reject(new Error(`Connection closed unexpectedly. Partial response: ${responseBuffer.substring(0, 100)}`))
        } else {
          // Connection closed without any response
          resolved = true
          reject(new Error('Connection closed by Atlas processor without sending a response'))
        }
      }
    })
  })
}
