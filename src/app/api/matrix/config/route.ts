import { NextRequest, NextResponse } from 'next/server'
import prisma from "@/lib/prisma"
import { randomUUID } from 'crypto'

export async function GET() {
  try {
    const config = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true },
      include: {
        inputs: {
          orderBy: { channelNumber: 'asc' },
          select: {
            id: true,
            configId: true,
            channelNumber: true,
            label: true,
            inputType: true,
            deviceType: true,
            isActive: true,
            status: true,
            powerOn: true,
            isCecPort: true,
            createdAt: true,
            updatedAt: true
          }
        },
        outputs: {
          orderBy: { channelNumber: 'asc' },
          select: {
            id: true,
            configId: true,
            channelNumber: true,
            label: true,
            resolution: true,
            isActive: true,
            status: true,
            audioOutput: true,
            powerOn: true,
            createdAt: true,
            updatedAt: true
            // Exclude selectedVideoInput and videoInputLabel - they don't exist in database
          }
        }
      }
    })
    
    if (config) {
      // Return format expected by Bartender Remote
      return NextResponse.json({
        configs: [config],
        config,
        inputs: config.inputs,
        outputs: config.outputs
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

      // Save inputs - only fields that exist in actual database
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

      // Save outputs - only fields that exist in actual database
      // Database has: id, configId, channelNumber, label, resolution, isActive, status, 
      //               audioOutput, powerOn, createdAt, updatedAt, dailyTurnOn, dailyTurnOff
      //               selectedVideoInput, videoInputLabel, tvBrand, tvModel, cecAddress, lastDiscovery
      // Database does NOT have: isMatrixOutput (this was removed from schema)
      if (outputs?.length > 0) {
        const outputData = outputs.map((output: any) => ({
          id: randomUUID(),
          configId: savedConfig.id,
          channelNumber: output.channelNumber,
          label: output.label || `Output ${output.channelNumber}`,
          resolution: output.resolution || '1080p',
          isActive: output.isActive !== false, // Default to true
          status: output.status || 'active',
          audioOutput: output.audioOutput || null,
          powerOn: output.powerOn || false,
          dailyTurnOn: output.dailyTurnOn || false,
          dailyTurnOff: output.dailyTurnOff || false,
          selectedVideoInput: output.selectedVideoInput || null,
          videoInputLabel: output.videoInputLabel || null
        }))

        // Use Prisma's createMany for proper type safety
        await tx.matrixOutput.createMany({
          data: outputData
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
