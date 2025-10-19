
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import * as net from 'net'
import { atlasLogger } from '@/lib/atlas-logger'

interface RouteContext {
  params: {
    id: string
  }
}

// GET: Read current gain settings for all inputs
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const processorId = context.params.id

    const processor = await prisma.audioProcessor.findUnique({
      where: { id: processorId }
    })

    if (!processor) {
      return NextResponse.json(
        { error: 'Audio processor not found' },
        { status: 404 }
      )
    }

    // Get gain settings from the processor
    const gainSettings = await getInputGainSettings(processor)

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
    console.error('Error fetching input gain settings:', error)
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
    const processorId = context.params.id
    const { inputNumber, gain, reason = 'manual_override' } = await request.json()

    if (inputNumber === undefined || gain === undefined) {
      return NextResponse.json(
        { error: 'Input number and gain value are required' },
        { status: 400 }
      )
    }

    const processor = await prisma.audioProcessor.findUnique({
      where: { id: processorId }
    })

    if (!processor) {
      return NextResponse.json(
        { error: 'Audio processor not found' },
        { status: 404 }
      )
    }

    // Validate gain range (-20 to +20 dB)
    if (gain < -20 || gain > 20) {
      return NextResponse.json(
        { error: 'Gain must be between -20 and +20 dB' },
        { status: 400 }
      )
    }

    // Set the gain on the processor
    const result = await setInputGain(processor, inputNumber, gain)

    // Update AI gain configuration if it exists
    const aiConfig = await prisma.aIGainConfiguration.findFirst({
      where: {
        processorId: processorId,
        inputNumber: inputNumber
      }
    })

    if (aiConfig) {
      const previousGain = aiConfig.currentGain

      await prisma.aIGainConfiguration.update({
        where: { id: aiConfig.id },
        data: {
          currentGain: gain,
          lastAdjustment: new Date(),
          adjustmentCount: { increment: 1 }
        }
      })

      // Log the adjustment
      await prisma.aIGainAdjustmentLog.create({
        data: {
          configId: aiConfig.id,
          processorId: processorId,
          inputNumber: inputNumber,
          previousGain: previousGain,
          newGain: gain,
          gainChange: gain - previousGain,
          inputLevel: 0, // Will be updated by monitoring service
          targetLevel: aiConfig.targetLevel,
          adjustmentMode: 'manual',
          reason: reason,
          success: true
        }
      })
    }

    return NextResponse.json({ 
      success: true,
      inputNumber,
      gain,
      result,
      message: `Input ${inputNumber} gain set to ${gain}dB`
    })

  } catch (error) {
    console.error('Error setting input gain:', error)
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

      // Query gain for inputs 1-10 (AZMP8 has 10 inputs)
      const inputCount = processor.model.includes('AZMP8') ? 10 : 
                        processor.model.includes('AZMP4') ? 4 : 8

      for (let i = 1; i <= inputCount; i++) {
        const command = {
          jsonrpc: "2.0",
          id: i,
          method: "get",
          params: {
            param: `Input${i}Gain`,
            fmt: "val"
          }
        }
        atlasLogger.commandSent(command, processor.ipAddress)
        client.write(JSON.stringify(command) + '\r\n')  // Fixed: Use \r\n instead of \n
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
              gainSettings.push({
                inputNumber: response.id,
                gain: parseFloat(response.result.val),
                parameterName: `Input${response.id}Gain`
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

    atlasLogger.connectionAttempt(processor.ipAddress, 5321)

    client.connect(5321, processor.ipAddress, () => {
      atlasLogger.connectionSuccess(processor.ipAddress, 5321)
      atlasLogger.inputGainAdjustment(inputNumber, gain, processor.ipAddress)

      const command = {
        jsonrpc: "2.0",
        id: 1,
        method: "set",
        params: {
          param: `Input${inputNumber}Gain`,
          val: gain
        }
      }

      atlasLogger.commandSent(command, processor.ipAddress)
      client.write(JSON.stringify(command) + '\r\n')  // Fixed: Use \r\n instead of \n
    })

    client.on('data', (data) => {
      try {
        const response = JSON.parse(data.toString().trim())
        atlasLogger.responseReceived(response, processor.ipAddress)
        client.end()
        resolve(response)
      } catch (error) {
        atlasLogger.error('PARSING', 'Error parsing set gain response', error)
        client.end()
        reject(error)
      }
    })

    client.on('error', (error) => {
      atlasLogger.connectionFailure(processor.ipAddress, 5321, error)
      reject(error)
    })

    // Timeout after 3 seconds
    setTimeout(() => {
      atlasLogger.warn('TIMEOUT', 'Set gain operation timed out', { 
        inputNumber, 
        gain, 
        processor: processor.ipAddress 
      })
      client.end()
      reject(new Error('Set gain timeout'))
    }, 3000)
  })
}
