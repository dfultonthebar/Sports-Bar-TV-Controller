
import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and, asc } from 'drizzle-orm'
import { logger } from '@/lib/logger'


export async function GET() {
  try {
    logger.api.request('GET', '/api/matrix/outputs-schedule', {})

    // Get the active matrix configuration
    const activeConfigs = await db
      .select()
      .from(schema.matrixConfigurations)
      .where(eq(schema.matrixConfigurations.isActive, true))
      .limit(1)

    if (!activeConfigs || activeConfigs.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No active matrix configuration found'
      }, { status: 404 })
    }

    const activeConfig = activeConfigs[0]

    // Get outputs for this configuration
    const outputs = await db
      .select()
      .from(schema.matrixOutputs)
      .where(
        and(
          eq(schema.matrixOutputs.configId, activeConfig.id),
          eq(schema.matrixOutputs.status, 'active')
        )
      )
      .orderBy(asc(schema.matrixOutputs.channelNumber))

    // Get outputs with daily turn-on/off settings
    const dailyTurnOnOutputs = outputs.filter(o => o.dailyTurnOn)
    const dailyTurnOffOutputs = outputs.filter(o => o.dailyTurnOff)
    const availableOutputs = outputs.filter(o => !o.dailyTurnOn && !o.dailyTurnOff)

    logger.api.response('GET', '/api/matrix/outputs-schedule', {
      outputCount: outputs.length,
      dailyTurnOnCount: dailyTurnOnOutputs.length,
      dailyTurnOffCount: dailyTurnOffOutputs.length
    })

    return NextResponse.json({
      success: true,
      outputs,
      dailyTurnOnOutputs,
      dailyTurnOffOutputs,
      availableOutputs,
      configName: activeConfig.name
    })
  } catch (error: any) {
    logger.api.error('Error fetching outputs for schedule:', error)
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to fetch outputs'
    }, { status: 500 })
  }
}

// Update an output's daily turn-on/off settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { outputId, dailyTurnOn, dailyTurnOff } = body

    logger.api.request('PUT', '/api/matrix/outputs-schedule', { outputId })

    if (!outputId) {
      return NextResponse.json({
        success: false,
        message: 'Output ID is required'
      }, { status: 400 })
    }

    const updateData: any = {
      updatedAt: new Date()
    }
    
    if (dailyTurnOn !== undefined) updateData.dailyTurnOn = dailyTurnOn
    if (dailyTurnOff !== undefined) updateData.dailyTurnOff = dailyTurnOff

    const updated = await db
      .update(schema.matrixOutputs)
      .set(updateData)
      .where(eq(schema.matrixOutputs.id, outputId))
      .returning()

    logger.api.response('PUT', '/api/matrix/outputs-schedule', { 
      success: true,
      outputId
    })

    return NextResponse.json({
      success: true,
      output: updated[0]
    })
  } catch (error: any) {
    logger.api.error('Error updating output schedule settings:', error)
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to update output'
    }, { status: 500 })
  }
}
