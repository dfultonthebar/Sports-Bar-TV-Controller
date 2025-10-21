import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, asc, not } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'

export async function GET() {
  try {
    logger.api.request('GET', '/api/matrix/config', {})

    const configs = await db
      .select()
      .from(schema.matrixConfigurations)
      .where(eq(schema.matrixConfigurations.isActive, true))
      .limit(1)
    
    if (configs && configs.length > 0) {
      const config = configs[0]

      // Get inputs for this config
      const inputs = await db
        .select({
          id: schema.matrixInputs.id,
          configId: schema.matrixInputs.configId,
          channelNumber: schema.matrixInputs.channelNumber,
          label: schema.matrixInputs.label,
          inputType: schema.matrixInputs.inputType,
          deviceType: schema.matrixInputs.deviceType,
          isActive: schema.matrixInputs.isActive,
          status: schema.matrixInputs.status,
          powerOn: schema.matrixInputs.powerOn,
          isCecPort: schema.matrixInputs.isCecPort,
          createdAt: schema.matrixInputs.createdAt,
          updatedAt: schema.matrixInputs.updatedAt
        })
        .from(schema.matrixInputs)
        .where(eq(schema.matrixInputs.configId, config.id))
        .orderBy(asc(schema.matrixInputs.channelNumber))

      // Get outputs for this config
      const outputs = await db
        .select({
          id: schema.matrixOutputs.id,
          configId: schema.matrixOutputs.configId,
          channelNumber: schema.matrixOutputs.channelNumber,
          label: schema.matrixOutputs.label,
          resolution: schema.matrixOutputs.resolution,
          isActive: schema.matrixOutputs.isActive,
          status: schema.matrixOutputs.status,
          audioOutput: schema.matrixOutputs.audioOutput,
          powerOn: schema.matrixOutputs.powerOn,
          createdAt: schema.matrixOutputs.createdAt,
          updatedAt: schema.matrixOutputs.updatedAt
        })
        .from(schema.matrixOutputs)
        .where(eq(schema.matrixOutputs.configId, config.id))
        .orderBy(asc(schema.matrixOutputs.channelNumber))

      const configWithRelations = {
        ...config,
        inputs,
        outputs
      }

      logger.api.response('GET', '/api/matrix/config', { 
        configName: config.name,
        inputCount: inputs.length,
        outputCount: outputs.length
      })

      // Return format expected by Bartender Remote
      return NextResponse.json({
        configs: [configWithRelations],
        config: configWithRelations,
        inputs,
        outputs
      })
    } else {
      logger.api.response('GET', '/api/matrix/config', { message: 'No active configuration' })
      return NextResponse.json({
        configs: [] as any[],
        config: null,
        inputs: [] as any[],
        outputs: [] as any[]
      })
    }
  } catch (error) {
    logger.api.error('Error loading matrix configuration:', error)
    return NextResponse.json({ error: 'Failed to load configuration' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { config, inputs, outputs } = await request.json()

    logger.api.request('POST', '/api/matrix/config', { configName: config?.name })

    // Validate required fields
    if (!config.name || !config.ipAddress) {
      return NextResponse.json({ 
        error: 'Missing required fields: name and ipAddress are required' 
      }, { status: 400 })
    }

    // Generate ID if not provided
    const configId = config.id || randomUUID()

    // Use transaction to ensure atomicity
    const result = await db.transaction(async (tx) => {
      // First, deactivate all other configurations if this one is active
      if (config.isActive !== false) {
        await tx
          .update(schema.matrixConfigurations)
          .set({ isActive: false })
          .where(not(eq(schema.matrixConfigurations.id, configId)))
      }

      // Check if config already exists
      const existingConfig = await tx
        .select()
        .from(schema.matrixConfigurations)
        .where(eq(schema.matrixConfigurations.id, configId))
        .limit(1)

      let savedConfig

      if (existingConfig && existingConfig.length > 0) {
        // Update existing configuration
        const updated = await tx
          .update(schema.matrixConfigurations)
          .set({
            name: config.name,
            ipAddress: config.ipAddress,
            tcpPort: config.tcpPort || 23,
            udpPort: config.udpPort || 4000,
            protocol: config.protocol || 'TCP',
            isActive: config.isActive !== false,
            cecInputChannel: config.cecInputChannel || null,
            updatedAt: new Date()
          })
          .where(eq(schema.matrixConfigurations.id, configId))
          .returning()
        
        savedConfig = updated[0]
      } else {
        // Create new configuration
        const created = await tx
          .insert(schema.matrixConfigurations)
          .values({
            id: configId,
            name: config.name,
            ipAddress: config.ipAddress,
            tcpPort: config.tcpPort || 23,
            udpPort: config.udpPort || 4000,
            protocol: config.protocol || 'TCP',
            isActive: config.isActive !== false,
            cecInputChannel: config.cecInputChannel || null
          })
          .returning()
        
        savedConfig = created[0]
      }

      // Clear existing inputs and outputs for this config
      await tx
        .delete(schema.matrixInputs)
        .where(eq(schema.matrixInputs.configId, savedConfig.id))

      await tx
        .delete(schema.matrixOutputs)
        .where(eq(schema.matrixOutputs.configId, savedConfig.id))

      // Save inputs
      if (inputs?.length > 0) {
        await tx
          .insert(schema.matrixInputs)
          .values(inputs.map((input: any) => ({
            id: randomUUID(),
            configId: savedConfig.id,
            channelNumber: input.channelNumber,
            label: input.label || `Input ${input.channelNumber}`,
            inputType: input.inputType || 'HDMI',
            deviceType: input.deviceType || 'Other',
            isActive: input.isActive !== false,
            status: input.status || 'active',
            powerOn: input.powerOn || false,
            isCecPort: input.isCecPort || false
          })))
      }

      // Save outputs
      if (outputs?.length > 0) {
        await tx
          .insert(schema.matrixOutputs)
          .values(outputs.map((output: any) => ({
            id: randomUUID(),
            configId: savedConfig.id,
            channelNumber: output.channelNumber,
            label: output.label || `Output ${output.channelNumber}`,
            resolution: output.resolution || '1080p',
            isActive: output.isActive !== false,
            status: output.status || 'active',
            audioOutput: output.audioOutput || null,
            powerOn: output.powerOn || false,
            dailyTurnOn: true,
            dailyTurnOff: true
          })))
      }

      return savedConfig
    })

    logger.api.info(`Configuration saved successfully: ${result.name}`, {
      configId: result.id,
      inputCount: inputs?.length || 0,
      outputCount: outputs?.length || 0
    })

    logger.api.response('POST', '/api/matrix/config', { 
      success: true,
      configName: result.name
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Configuration saved successfully',
      config: result,
      inputCount: inputs?.length || 0,
      outputCount: outputs?.length || 0
    })
  } catch (error) {
    logger.api.error('Error saving matrix configuration:', error)
    
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json({ 
      error: 'Failed to save configuration',
      details: errorMessage
    }, { status: 500 })
  }
}
