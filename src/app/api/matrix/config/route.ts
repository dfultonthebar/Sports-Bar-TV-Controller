import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, or } from 'drizzle-orm'
import { db, schema } from '@/db'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Find active configuration
    const config = await db.select()
      .from(schema.matrixConfigurations)
      .where(eq(schema.matrixConfigurations.isActive, true))
      .limit(1)
      .get()
    
    if (config) {
      // Get inputs for this configuration
      const inputs = await db.select()
        .from(schema.matrixInputs)
        .where(eq(schema.matrixInputs.configId, config.id))
        .orderBy(asc(schema.matrixInputs.channelNumber))
        .all()
      
      // Get outputs for this configuration
      const outputs = await db.select()
        .from(schema.matrixOutputs)
        .where(eq(schema.matrixOutputs.configId, config.id))
        .orderBy(asc(schema.matrixOutputs.channelNumber))
        .all()
      
      // Return format expected by Bartender Remote
      return NextResponse.json({
        configs: [{ ...config, inputs, outputs }],
        config: { ...config, inputs, outputs },
        inputs,
        outputs
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
    logger.error('Error loading matrix configuration:', error)
    return NextResponse.json({ error: 'Failed to load configuration' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Security: use validated data
  const { config, inputs, outputs } = bodyValidation.data

  try {

    // Validate required fields
    if (!config.name || !config.ipAddress) {
      return NextResponse.json({ 
        error: 'Missing required fields: name and ipAddress are required' 
      }, { status: 400 })
    }

    // Generate ID if not provided
    const configId = config.id || randomUUID()
    const now = new Date().toISOString()

    // Use transaction to ensure atomicity
    const result = await db.transaction(async (tx) => {
      // First, deactivate all other configurations if this one is active
      if (config.isActive !== false) {
        const allConfigs = await tx.select()
          .from(schema.matrixConfigurations)
          .where(eq(schema.matrixConfigurations.isActive, true))
          .all()
        
        for (const cfg of allConfigs) {
          if (cfg.id !== configId) {
            await tx.update(schema.matrixConfigurations)
              .set({ isActive: false, updatedAt: now })
              .where(eq(schema.matrixConfigurations.id, cfg.id))
              .run()
          }
        }
      }

      // Check if configuration exists
      const existingConfig = await tx.select()
        .from(schema.matrixConfigurations)
        .where(eq(schema.matrixConfigurations.id, configId))
        .limit(1)
        .get()

      let savedConfig
      if (existingConfig) {
        // Update existing configuration
        await tx.update(schema.matrixConfigurations)
          .set({
            name: config.name,
            ipAddress: config.ipAddress,
            tcpPort: config.tcpPort || 23,
            udpPort: config.udpPort || 4000,
            protocol: config.protocol || 'TCP',
            isActive: config.isActive !== false,
            cecInputChannel: config.cecInputChannel || null,
            updatedAt: now
          })
          .where(eq(schema.matrixConfigurations.id, configId))
          .run()
        
        savedConfig = await tx.select()
          .from(schema.matrixConfigurations)
          .where(eq(schema.matrixConfigurations.id, configId))
          .limit(1)
          .get()
      } else {
        // Create new configuration
        savedConfig = await tx.insert(schema.matrixConfigurations)
          .values({
            id: configId,
            name: config.name,
            ipAddress: config.ipAddress,
            tcpPort: config.tcpPort || 23,
            udpPort: config.udpPort || 4000,
            protocol: config.protocol || 'TCP',
            isActive: config.isActive !== false,
            cecInputChannel: config.cecInputChannel || null,
            createdAt: now,
            updatedAt: now
          })
          .returning()
          .get()
      }

      // Get existing outputs to preserve CEC discovery data
      const existingOutputs = await tx.select()
        .from(schema.matrixOutputs)
        .where(eq(schema.matrixOutputs.configId, savedConfig.id))
        .all()

      // Create a map of existing outputs by channel number to preserve CEC data
      const existingOutputMap = new Map(
        existingOutputs.map(o => [o.channelNumber, o])
      )

      // Clear existing inputs and outputs for this config
      await tx.delete(schema.matrixInputs)
        .where(eq(schema.matrixInputs.configId, savedConfig.id))
        .run()

      await tx.delete(schema.matrixOutputs)
        .where(eq(schema.matrixOutputs.configId, savedConfig.id))
        .run()

      // Save inputs - only fields that exist in actual database
      if (inputs?.length > 0) {
        for (const input of inputs) {
          await tx.insert(schema.matrixInputs)
            .values({
              id: randomUUID(),
              configId: savedConfig.id,
              channelNumber: input.channelNumber,
              label: input.label || `Input ${input.channelNumber}`,
              inputType: input.inputType || 'HDMI',
              deviceType: input.deviceType || 'Other',
              isActive: input.isActive !== false,
              status: input.status || 'active',
              powerOn: input.powerOn || false,
              isCecPort: input.isCecPort || false,
              createdAt: now,
              updatedAt: now
            })
            .run()
        }
      }

      // Save outputs - preserve CEC discovery data from existing records
      if (outputs?.length > 0) {
        for (const output of outputs) {
          const existing = existingOutputMap.get(output.channelNumber)

          await tx.insert(schema.matrixOutputs)
            .values({
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
              dailyTurnOff: true,
              // Preserve CEC discovery data from existing record, or use new data if provided
              tvBrand: output.tvBrand || existing?.tvBrand || null,
              tvModel: output.tvModel || existing?.tvModel || null,
              cecAddress: output.cecAddress || existing?.cecAddress || null,
              lastDiscovery: existing?.lastDiscovery || null,
              createdAt: now,
              updatedAt: now
            })
            .run()
        }
      }

      return savedConfig
    })

    logger.debug(`Configuration saved successfully: ${result.name} (${result.id})`)
    logger.debug(`- Inputs saved: ${inputs?.length || 0}`)
    logger.debug(`- Outputs saved: ${outputs?.length || 0}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Configuration saved successfully',
      config: result,
      inputCount: inputs?.length || 0,
      outputCount: outputs?.length || 0
    })
  } catch (error) {
    logger.error('Error saving matrix configuration:', error)
    
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json({ 
      error: 'Failed to save configuration',
      details: errorMessage
    }, { status: 500 })
  }
}
