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
import { db, schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import * as net from 'net'
import { atlasLogger } from '@/lib/atlas-logger'

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
  try {
    // Await params for Next.js 15+ compatibility
    const params = await context.params
    const processorId = params.id

    logger.api.request('GET', `/api/audio-processor/${processorId}/input-gain`, {})

    const processor = await db
      .select()
      .from(schema.audioProcessors)
      .where(eq(schema.audioProcessors.id, processorId))
      .limit(1)
      .catch((dbError) => {
        logger.api.error('[Input Gain API] Database query error:', dbError)
        throw new Error(`Database error: ${dbError.message}`)
      })

    if (!processor || processor.length === 0) {
      logger.api.error('[Input Gain API] Audio processor not found', { processorId })
      return NextResponse.json(
        { error: 'Audio processor not found' },
        { status: 404 }
      )
    }

    // Get gain settings from the processor
    const gainSettings = await getInputGainSettings(processor[0])

    logger.api.response('GET', `/api/audio-processor/${processorId}/input-gain`, {
      processorName: processor[0].name,
      settingsCount: gainSettings.length
    })

    return NextResponse.json({ 
      success: true,
      processor: {
        id: processor[0].id,
        name: processor[0].name,
        model: processor[0].model
      },
      gainSettings 
    })

  } catch (error) {
    logger.api.error('Error fetching input gain settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch input gain settings' },
      { status: 500 }
    )
  }
}

// POST: Set gain for specific input
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Await params for Next.js 15+ compatibility
    const params = await context.params
    const processorId = params.id
    const { inputNumber, gain, reason = 'manual_override' } = await request.json()

    logger.api.request('POST', `/api/audio-processor/${processorId}/input-gain`, { inputNumber, gain })

    if (inputNumber === undefined || gain === undefined) {
      return NextResponse.json(
        { error: 'Input number and gain value are required' },
        { status: 400 }
      )
    }

    const processor = await db
      .select()
      .from(schema.audioProcessors)
      .where(eq(schema.audioProcessors.id, processorId))
      .limit(1)
      .catch((dbError) => {
        logger.api.error('[Input Gain API] Database query error:', dbError)
        throw new Error(`Database error: ${dbError.message}`)
      })

    if (!processor || processor.length === 0) {
      logger.api.error('[Input Gain API] Audio processor not found', { processorId })
      return NextResponse.json(
        { error: 'Audio processor not found' },
        { status: 404 }
      )
    }

    // Validate gain range (-80 to 0 dB per Atlas protocol specification)
    // Reference: ATS006993-B-AZM4-AZM8-3rd-Party-Control.pdf, Section 6.0 Parameter List
    // SourceGain: Min Val = -80, Max Val = 0
    if (gain < -80 || gain > 0) {
      return NextResponse.json(
        { error: 'Gain must be between -80 and 0 dB' },
        { status: 400 }
      )
    }

    // Set the gain on the processor
    const result = await setInputGain(processor[0], inputNumber, gain)

    // Update AI gain configuration if it exists
    const aiConfig = await db
      .select()
      .from(schema.aiGainConfigurations)
      .where(
        and(
          eq(schema.aiGainConfigurations.processorId, processorId),
          eq(schema.aiGainConfigurations.inputNumber, inputNumber)
        )
      )
      .limit(1)
      .catch((dbError) => {
        logger.api.warn('[Input Gain API] Error fetching AI config (non-critical):', dbError)
        return []  // Continue even if AI config fetch fails
      })

    if (aiConfig && aiConfig.length > 0) {
      const config = aiConfig[0]
      const previousLevel = 0 // We don't track currentGain in the schema

      await db
        .update(schema.aiGainConfigurations)
        .set({
          lastAdjustment: new Date(),
          adjustmentCount: config.adjustmentCount + 1,
          updatedAt: new Date()
        })
        .where(eq(schema.aiGainConfigurations.id, config.id))

      // Log the adjustment
      await db
        .insert(schema.aiGainAdjustmentLogs)
        .values({
          configId: config.id,
          processorId: processorId,
          inputNumber: inputNumber,
          previousLevel: previousLevel,
          newLevel: gain,
          adjustment: gain - previousLevel,
          reason: reason
        })

      logger.api.info('[Input Gain API] AI gain configuration updated', { 
        configId: config.id,
        inputNumber,
        gain
      })
    }

    logger.api.response('POST', `/api/audio-processor/${processorId}/input-gain`, {
      inputNumber,
      gain,
      success: true
    })

    return NextResponse.json({ 
      success: true,
      inputNumber,
      gain,
      result,
      message: `Input ${inputNumber} gain set to ${gain}dB`
    })

  } catch (error) {
    logger.api.error('Error setting input gain:', error)
    return NextResponse.json(
      { error: 'Failed to set input gain' },
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

    atlasLogger.connectionAttempt(processor.ipAddress, 5321)

    // Timeout after 5 seconds (increased from 3)
    timeoutHandle = setTimeout(() => {
      atlasLogger.warn('TIMEOUT', 'Set gain operation timed out', { 
        inputNumber, 
        gain, 
        processor: processor.ipAddress 
      })
      client.destroy()
      reject(new Error('Set gain operation timed out after 5 seconds'))
    }, 5000)

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
          param: `SourceGain_${atlasIndex}`,  // Fixed: Use SourceGain_X with 0-based index
          val: gain
        }
      }

      atlasLogger.commandSent(command, processor.ipAddress)
      client.write(JSON.stringify(command) + '\r\n')
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
            
            // Check if response indicates success
            if (response.result === 'OK' || response.result || response.id === 1) {
              clearTimeout(timeoutHandle)
              client.end()
              resolve(response)
              return
            }
            
            // Check for error response
            if (response.error) {
              clearTimeout(timeoutHandle)
              client.end()
              reject(new Error(`Atlas error: ${JSON.stringify(response.error)}`))
              return
            }
          } catch (error) {
            atlasLogger.error('PARSING', 'Error parsing set gain response', { line, error })
          }
        }
      }
    })

    client.on('error', (error) => {
      clearTimeout(timeoutHandle)
      atlasLogger.connectionFailure(processor.ipAddress, 5321, error)
      reject(new Error(`Connection error: ${error.message}`))
    })

    client.on('close', () => {
      clearTimeout(timeoutHandle)
      atlasLogger.connectionClosed(processor.ipAddress, 5321)
      // If we got here without resolving, something went wrong
      if (responseBuffer && responseBuffer.trim()) {
        atlasLogger.warn('INCOMPLETE', 'Connection closed with incomplete response', { responseBuffer })
      }
    })
  })
}
