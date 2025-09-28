import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const config = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true },
      include: {
        inputs: {
          orderBy: { channelNumber: 'asc' }
        },
        outputs: {
          orderBy: { channelNumber: 'asc' }
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
        configs: [],
        config: null,
        inputs: [],
        outputs: []
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

    // Save or update matrix configuration
    const savedConfig = await prisma.matrixConfiguration.upsert({
      where: { id: config.id || '' },
      update: {
        name: config.name,
        ipAddress: config.ipAddress,
        tcpPort: config.tcpPort,
        udpPort: config.udpPort,
        protocol: config.protocol,
        isActive: config.isActive
      },
      create: {
        name: config.name,
        ipAddress: config.ipAddress,
        tcpPort: config.tcpPort,
        udpPort: config.udpPort,
        protocol: config.protocol,
        isActive: config.isActive
      }
    })

    // Clear existing inputs and outputs for this config
    if (savedConfig.id) {
      await prisma.matrixInput.deleteMany({
        where: { configId: savedConfig.id }
      })
      await prisma.matrixOutput.deleteMany({
        where: { configId: savedConfig.id }
      })
    }

    // Save inputs
    if (inputs?.length > 0 && savedConfig.id) {
      await prisma.matrixInput.createMany({
        data: inputs.map((input: any) => ({
          configId: savedConfig.id,
          channelNumber: input.channelNumber,
          label: input.label,
          inputType: input.inputType,
          isActive: input.isActive,
          status: input.status || 'active'
        }))
      })
    }

    // Save outputs
    if (outputs?.length > 0 && savedConfig.id) {
      await prisma.matrixOutput.createMany({
        data: outputs.map((output: any) => ({
          configId: savedConfig.id,
          channelNumber: output.channelNumber,
          label: output.label,
          resolution: output.resolution,
          isActive: output.isActive,
          status: output.status || 'active',
          audioOutput: output.audioOutput || ''
        }))
      })
    }

    return NextResponse.json({ 
      success: true, 
      config: savedConfig 
    })
  } catch (error) {
    console.error('Error saving matrix configuration:', error)
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
  }
}
