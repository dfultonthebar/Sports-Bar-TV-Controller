
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
import { aiGainConfigurations, audioInputMeters, audioProcessors } from '@/db/schema'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

// GET: Get AI gain control settings for all inputs
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params
    const processorId = params.id

    const processor = await prisma.audioProcessor.findUnique({
      where: { id: processorId },
      include: {
        inputMeters: {
          include: {
            aiGainConfig: true
          },
          orderBy: {
            inputNumber: 'asc'
          }
        }
      }
    })

    if (!processor) {
      return NextResponse.json(
        { error: 'Audio processor not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ 
      success: true,
      processor: {
        id: processor.id,
        name: processor.name,
        model: processor.model
      },
      inputMeters: processor.inputMeters
    })

  } catch (error) {
    console.error('Error fetching AI gain control settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI gain control settings' },
      { status: 500 }
    )
  }
}

// POST: Enable/disable AI control and configure settings for an input
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params
    const processorId = params.id
    const data = await request.json()
    const { 
      inputNumber, 
      aiEnabled, 
      inputType,
      targetLevel,
      fastModeThreshold,
      silenceThreshold,
      silenceDuration,
      fastModeStep,
      slowModeStep,
      minGain,
      maxGain
    } = data

    if (inputNumber === undefined) {
      return NextResponse.json(
        { error: 'Input number is required' },
        { status: 400 }
      )
    }

    // Validate input type
    if (inputType && !['mic', 'line'].includes(inputType)) {
      return NextResponse.json(
        { error: 'Input type must be "mic" or "line"' },
        { status: 400 }
      )
    }

    // Find or create the input meter
    let inputMeter = await db.select().from(audioInputMeters).where(eq(audioInputMeters.processorId, processorId)).limit(1).get()

    if (!inputMeter) {
      // Create input meter if it doesn't exist
      inputMeter = await prisma.audioInputMeter.create({
        data: {
          processorId: processorId,
          inputNumber: inputNumber,
          parameterName: `SourceMeter_${inputNumber}`,
          inputName: `Input ${inputNumber + 1}`,
          isActive: true
        }
      })
    }

    // Find or create AI gain configuration
    let aiConfig = await db.select().from(aiGainConfigurations).where(eq(aiGainConfigurations.processorId, processorId)).limit(1).get()

    const configData: any = {
      inputType: inputType || 'line',
      aiEnabled: aiEnabled !== undefined ? aiEnabled : false
    }

    // Add optional parameters if provided
    if (targetLevel !== undefined) configData.targetLevel = targetLevel
    if (fastModeThreshold !== undefined) configData.fastModeThreshold = fastModeThreshold
    if (silenceThreshold !== undefined) configData.silenceThreshold = silenceThreshold
    if (silenceDuration !== undefined) configData.silenceDuration = silenceDuration
    if (fastModeStep !== undefined) configData.fastModeStep = fastModeStep
    if (slowModeStep !== undefined) configData.slowModeStep = slowModeStep
    if (minGain !== undefined) configData.minGain = minGain
    if (maxGain !== undefined) configData.maxGain = maxGain

    if (aiConfig) {
      // Update existing configuration
      aiConfig = await prisma.aIGainConfiguration.update({
        where: { id: aiConfig.id },
        data: configData
      })
    } else {
      // Create new configuration
      aiConfig = await db.insert(aiGainConfigurations).values({
          inputMeterId: inputMeter.id,
          processorId: processorId,
          inputNumber: inputNumber,
          ...configData
        }).returning().get()
    }

    return NextResponse.json({ 
      success: true,
      aiConfig,
      message: `AI gain control ${aiEnabled ? 'enabled' : 'disabled'} for input ${inputNumber}`
    })

  } catch (error) {
    console.error('Error updating AI gain control settings:', error)
    return NextResponse.json(
      { error: 'Failed to update AI gain control settings' },
      { status: 500 }
    )
  }
}

// DELETE: Remove AI gain configuration for an input
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const processorId = context.params.id
    const { searchParams } = new URL(request.url)
    const inputNumber = parseInt(searchParams.get('inputNumber') || '')

    if (isNaN(inputNumber)) {
      return NextResponse.json(
        { error: 'Valid input number is required' },
        { status: 400 }
      )
    }

    const aiConfig = await db.select().from(aiGainConfigurations).where(eq(aiGainConfigurations.processorId, processorId)).limit(1).get()

    if (!aiConfig) {
      return NextResponse.json(
        { error: 'AI gain configuration not found' },
        { status: 404 }
      )
    }

    await db.delete(aiGainConfigurations).where(eq(aiGainConfigurations.id, aiConfig.id)).returning().get()

    return NextResponse.json({ 
      success: true,
      message: `AI gain configuration removed for input ${inputNumber}`
    })

  } catch (error) {
    console.error('Error deleting AI gain configuration:', error)
    return NextResponse.json(
      { error: 'Failed to delete AI gain configuration' },
      { status: 500 }
    )
  }
}
