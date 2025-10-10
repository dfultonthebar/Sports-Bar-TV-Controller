import { NextRequest, NextResponse } from 'next/server'
import prisma from "@/lib/prisma"
import { randomUUID } from 'crypto'

export async function GET() {
  try {
    const config = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true },
      include: {
        MatrixInput: {
          orderBy: { channelNumber: 'asc' }
        },
        MatrixOutput: {
          orderBy: { channelNumber: 'asc' }
        }
      }
    })
    
    if (config) {
      // Return format expected by Bartender Remote
      return NextResponse.json({
        configs: [config],
        config,
        inputs: config.MatrixInput,
        outputs: config.MatrixOutput
      })
    } else {
      return NextResponse.json({
        configs: [] as any[],
        config: null,
        inputs: [] as any[],
        outputs: [] as any[]
      })
    }
  } catch (error) {
    console.error('Error loading matrix configuration:', error)
    return NextResponse.json({ error: 'Failed to load configuration' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { config, inputs, outputs } = await request.json()

    // Validate required fields
    if (!config.name || !config.ipAddress) {
      return NextResponse.json({ 
        error: 'Missing required fields: name and ipAddress are required' 
      }, { status: 400 })
    }

    // Generate ID if not provided
    const configId = config.id || randomUUID()

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // First, deactivate all other configurations if this one is active
      if (config.isActive !== false) {
        await tx.matrixConfiguration.updateMany({
          where: { 
            id: { not: configId }
          },
          data: { isActive: false }
        })
      }

      // Save or update matrix configuration
      const savedConfig = await tx.matrixConfiguration.upsert({
        where: { id: configId },
        update: {
          name: config.name,
          ipAddress: config.ipAddress,
          tcpPort: config.tcpPort || 23,
          udpPort: config.udpPort || 4000,
          protocol: config.protocol || 'TCP',
          isActive: config.isActive !== false, // Default to true
          cecInputChannel: config.cecInputChannel || null,
          updatedAt: new Date()
        },
        create: {
          id: configId,
          name: config.name,
          ipAddress: config.ipAddress,
          tcpPort: config.tcpPort || 23,
          udpPort: config.udpPort || 4000,
          protocol: config.protocol || 'TCP',
          isActive: config.isActive !== false, // Default to true
          cecInputChannel: config.cecInputChannel || null
        }
      })

      // Clear existing inputs and outputs for this config
      await tx.matrixInput.deleteMany({
        where: { configId: savedConfig.id }
      })
      await tx.matrixOutput.deleteMany({
        where: { configId: savedConfig.id }
      })

      // Save inputs
      if (inputs?.length > 0) {
        await tx.matrixInput.createMany({
          data: inputs.map((input: any) => ({
            id: randomUUID(),
            configId: savedConfig.id,
            channelNumber: input.channelNumber,
            label: input.label || `Input ${input.channelNumber}`,
            inputType: input.inputType || 'HDMI',
            deviceType: input.deviceType || 'Other',
            isActive: input.isActive !== false, // Default to true
            status: input.status || 'active',
            powerOn: input.powerOn || false,
            isCecPort: input.isCecPort || false,
            createdAt: new Date(),
            updatedAt: new Date()
          }))
        })
      }

      // Save outputs
      if (outputs?.length > 0) {
        await tx.matrixOutput.createMany({
          data: outputs.map((output: any) => ({
            id: randomUUID(),
            configId: savedConfig.id,
            channelNumber: output.channelNumber,
            label: output.label || `Output ${output.channelNumber}`,
            resolution: output.resolution || '1080p',
            isActive: output.isActive !== false, // Default to true
            status: output.status || 'active',
            audioOutput: output.audioOutput || null,
            powerOn: output.powerOn || false,
            dailyTurnOn: output.dailyTurnOn !== false, // Default to true
            dailyTurnOff: output.dailyTurnOff !== false, // Default to true
            isMatrixOutput: output.isMatrixOutput !== false, // Default to true
            createdAt: new Date(),
            updatedAt: new Date()
          }))
        })
      }

      return savedConfig
    })

    console.log(`Configuration saved successfully: ${result.name} (${result.id})`)
    console.log(`- Inputs saved: ${inputs?.length || 0}`)
    console.log(`- Outputs saved: ${outputs?.length || 0}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Configuration saved successfully',
      config: result,
      inputCount: inputs?.length || 0,
      outputCount: outputs?.length || 0
    })
  } catch (error) {
    console.error('Error saving matrix configuration:', error)
    
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json({ 
      error: 'Failed to save configuration',
      details: errorMessage
    }, { status: 500 })
  }
}
