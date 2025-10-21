
import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and, desc, asc } from 'drizzle-orm'
import { logger } from '@/lib/logger'

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

    logger.api.request('GET', `/api/audio-processor/${processorId}/ai-gain-control`, {})

    // Find processor
    const processor = await db
      .select()
      .from(schema.audioProcessors)
      .where(eq(schema.audioProcessors.id, processorId))
      .limit(1)

    if (!processor || processor.length === 0) {
      logger.api.error('Audio processor not found', { processorId })
      return NextResponse.json(
        { error: 'Audio processor not found' },
        { status: 404 }
      )
    }

    // Get all input meters for this processor
    const inputMeters = await db
      .select()
      .from(schema.audioInputMeters)
      .where(eq(schema.audioInputMeters.processorId, processorId))
      .orderBy(asc(schema.audioInputMeters.inputNumber))

    // Get all AI gain configs for this processor
    const aiGainConfigs = await db
      .select()
      .from(schema.aiGainConfigurations)
      .where(eq(schema.aiGainConfigurations.processorId, processorId))

    // Combine the data
    const inputMetersWithConfig = inputMeters.map(meter => {
      const config = aiGainConfigs.find(c => c.inputNumber === meter.inputNumber)
      return {
        ...meter,
        aiGainConfig: config || null
      }
    })

    logger.api.response('GET', `/api/audio-processor/${processorId}/ai-gain-control`, { 
      processor: processor[0],
      inputCount: inputMetersWithConfig.length
    })

    return NextResponse.json({ 
      success: true,
      processor: {
        id: processor[0].id,
        name: processor[0].name,
        model: processor[0].model
      },
      inputMeters: inputMetersWithConfig
    })

  } catch (error) {
    logger.api.error('Error fetching AI gain control settings:', error)
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
      targetLevel,
      inputName
    } = data

    logger.api.request('POST', `/api/audio-processor/${processorId}/ai-gain-control`, { inputNumber, aiEnabled })

    if (inputNumber === undefined) {
      return NextResponse.json(
        { error: 'Input number is required' },
        { status: 400 }
      )
    }

    // Find or create the input meter
    let inputMeter = await db
      .select()
      .from(schema.audioInputMeters)
      .where(
        and(
          eq(schema.audioInputMeters.processorId, processorId),
          eq(schema.audioInputMeters.inputNumber, inputNumber)
        )
      )
      .limit(1)

    if (!inputMeter || inputMeter.length === 0) {
      // Create input meter if it doesn't exist
      const newMeter = await db
        .insert(schema.audioInputMeters)
        .values({
          processorId: processorId,
          inputNumber: inputNumber,
          inputName: inputName || `Input ${inputNumber + 1}`,
          level: 0,
          peak: 0,
          clipping: false
        })
        .returning()
      
      inputMeter = newMeter
    }

    // Find existing AI gain configuration
    const existingConfig = await db
      .select()
      .from(schema.aiGainConfigurations)
      .where(
        and(
          eq(schema.aiGainConfigurations.processorId, processorId),
          eq(schema.aiGainConfigurations.inputNumber, inputNumber)
        )
      )
      .limit(1)

    const configData: any = {
      processorId: processorId,
      inputNumber: inputNumber,
      inputName: inputName || `Input ${inputNumber + 1}`,
      enabled: aiEnabled !== undefined ? aiEnabled : false,
      targetLevel: targetLevel !== undefined ? targetLevel : -20,
      updatedAt: new Date()
    }

    let aiConfig

    if (existingConfig && existingConfig.length > 0) {
      // Update existing configuration
      const updated = await db
        .update(schema.aiGainConfigurations)
        .set(configData)
        .where(eq(schema.aiGainConfigurations.id, existingConfig[0].id))
        .returning()
      
      aiConfig = updated[0]
      logger.api.info('Updated AI gain configuration', { configId: aiConfig.id, inputNumber })
    } else {
      // Create new configuration
      const created = await db
        .insert(schema.aiGainConfigurations)
        .values(configData)
        .returning()
      
      aiConfig = created[0]
      logger.api.info('Created AI gain configuration', { configId: aiConfig.id, inputNumber })
    }

    logger.api.response('POST', `/api/audio-processor/${processorId}/ai-gain-control`, { 
      success: true,
      inputNumber,
      aiEnabled
    })

    return NextResponse.json({ 
      success: true,
      aiConfig,
      message: `AI gain control ${aiEnabled ? 'enabled' : 'disabled'} for input ${inputNumber}`
    })

  } catch (error) {
    logger.api.error('Error updating AI gain control settings:', error)
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
    const params = await context.params
    const processorId = params.id
    const { searchParams } = new URL(request.url)
    const inputNumber = parseInt(searchParams.get('inputNumber') || '')

    logger.api.request('DELETE', `/api/audio-processor/${processorId}/ai-gain-control`, { inputNumber })

    if (isNaN(inputNumber)) {
      return NextResponse.json(
        { error: 'Valid input number is required' },
        { status: 400 }
      )
    }

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

    if (!aiConfig || aiConfig.length === 0) {
      return NextResponse.json(
        { error: 'AI gain configuration not found' },
        { status: 404 }
      )
    }

    await db
      .delete(schema.aiGainConfigurations)
      .where(eq(schema.aiGainConfigurations.id, aiConfig[0].id))

    logger.api.response('DELETE', `/api/audio-processor/${processorId}/ai-gain-control`, { 
      success: true,
      inputNumber
    })

    return NextResponse.json({ 
      success: true,
      message: `AI gain configuration removed for input ${inputNumber}`
    })

  } catch (error) {
    logger.api.error('Error deleting AI gain configuration:', error)
    return NextResponse.json(
      { error: 'Failed to delete AI gain configuration' },
      { status: 500 }
    )
  }
}
