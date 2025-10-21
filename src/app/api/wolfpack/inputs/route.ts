
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and, asc } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    logger.api.request('GET', '/api/wolfpack/inputs')
    
    // Get active matrix configuration
    const config = await db
      .select()
      .from(schema.matrixConfigurations)
      .where(eq(schema.matrixConfigurations.isActive, true))
      .limit(1)
      .get()

    if (!config) {
      logger.api.response('GET', '/api/wolfpack/inputs', 404, { error: 'No active config' })
      return NextResponse.json(
        { error: 'No active matrix configuration found' },
        { status: 404 }
      )
    }

    // Get active inputs for this configuration
    const inputs = await db
      .select()
      .from(schema.matrixInputs)
      .where(
        and(
          eq(schema.matrixInputs.configId, config.id),
          eq(schema.matrixInputs.isActive, true)
        )
      )
      .orderBy(asc(schema.matrixInputs.channelNumber))
      .all()

    // Format inputs with current channel info
    const formattedInputs = inputs.map(input => ({
      id: input.id,
      channelNumber: input.channelNumber,
      label: input.label,
      inputType: input.inputType,
      deviceType: input.deviceType,
      status: input.status,
      // In a real implementation, this would fetch live channel info from the device
      currentChannel: `Channel ${input.channelNumber}`,
      isActive: input.isActive
    }))

    logger.api.response('GET', '/api/wolfpack/inputs', 200, { 
      count: formattedInputs.length,
      configId: config.id 
    })

    return NextResponse.json({
      success: true,
      inputs: formattedInputs,
      configId: config.id,
      configName: config.name
    })

  } catch (error) {
    logger.api.error('GET', '/api/wolfpack/inputs', error)
    return NextResponse.json(
      { error: 'Failed to fetch Wolfpack inputs' },
      { status: 500 }
    )
  }
}
