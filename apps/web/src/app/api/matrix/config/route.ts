import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, or } from 'drizzle-orm'
import { db, schema } from '@/db'
import { logger } from '@sports-bar/logger'
import { randomUUID } from 'crypto'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

/**
 * Returns true if the operator has declared this location as a
 * single-card chassis via `MATRIX_SINGLE_CARD=true` in .env.
 * Matches the opt-in semantics in scripts/verify-install.sh — when set,
 * outputOffset MUST be 0 or routing lands on wrong physical outputs.
 * See CLAUDE.md Gotcha #4.
 */
function readSingleCardEnv(): boolean {
  const raw = (process.env.MATRIX_SINGLE_CARD || '').toLowerCase().trim()
  return raw === 'true' || raw === '1' || raw === 'yes'
}

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

    // Surface env-declared single-card mode to the UI so the panel can
    // render a "MISMATCH" warning when outputOffset != 0 here. This mirrors
    // the verify-install.sh and instrumentation.ts checks.
    const singleCardModeEnabled = readSingleCardEnv()

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
        outputs,
        singleCardModeEnabled,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    } else {
      return NextResponse.json({
        configs: [] as any[],
        config: null,
        inputs: [] as any[],
        outputs: [] as any[],
        singleCardModeEnabled,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }
  } catch (error) {
    logger.error('Error loading matrix configuration:', error)
    return NextResponse.json({ error: 'Failed to load configuration' }, { status: 500 })
  }
}

/**
 * Narrow PATCH endpoint for MatrixConfigPanel — updates ONLY the
 * outputOffset field on a single MatrixConfiguration row. Intentionally
 * scoped: the existing POST does a full-record overwrite that would clobber
 * inputs/outputs if a caller missed loading them first. This PATCH is what
 * the "Fix to 0" button (and any future narrow editor) wires to.
 *
 * Validation:
 *  - body.id: required UUID-shaped string
 *  - body.outputOffset: required integer in [0, 256] (256 = 4-card 64x64
 *    upper bound; nothing in our fleet legitimately exceeds 64)
 *
 * CLAUDE.md Gotcha #4 — wrong offset silently misroutes every output.
 */
const patchSchema = z.object({
  id: z.string().min(8).max(64),
  outputOffset: z.number().int().min(0).max(256),
})

export async function PATCH(request: NextRequest) {
  // Admin-only — operators editing the routing offset can move every TV
  // to the wrong physical output. Same gating as auto-update settings.
  const authResult = await requireAuth(request, 'ADMIN', {
    auditAction: 'MATRIX_CONFIG_PATCH',
    auditResource: 'matrix-config',
  })
  if (!authResult.allowed) return authResult.response!

  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, patchSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { id, outputOffset } = bodyValidation.data

  try {
    const existing = await db.select()
      .from(schema.matrixConfigurations)
      .where(eq(schema.matrixConfigurations.id, id))
      .limit(1)
      .get()

    if (!existing) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    await db.update(schema.matrixConfigurations)
      .set({ outputOffset, updatedAt: now })
      .where(eq(schema.matrixConfigurations.id, id))
      .run()

    logger.info('[MATRIX-CONFIG] outputOffset updated', {
      data: {
        id,
        name: existing.name,
        model: existing.model,
        previousOffset: existing.outputOffset,
        newOffset: outputOffset,
        role: authResult.role,
        sessionId: authResult.sessionId,
      },
    })

    return NextResponse.json({
      success: true,
      id,
      outputOffset,
      previousOutputOffset: existing.outputOffset,
    })
  } catch (error) {
    logger.error('[MATRIX-CONFIG] Failed to update outputOffset:', error)
    return NextResponse.json({
      error: 'Failed to update outputOffset',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Security: use validated data
  const { data } = bodyValidation
  const { config, inputs, outputs } = data as any
  try {

    // Validate required fields
    if (!config || typeof config !== 'object' || !config.name || !config.ipAddress) {
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
            model: config.model || 'WP-36X36',
            ipAddress: config.ipAddress,
            tcpPort: config.tcpPort || 23,
            udpPort: config.udpPort || 4000,
            protocol: config.protocol || 'HTTP',
            inputCount: Array.isArray(inputs) ? inputs.length : 36,
            outputCount: Array.isArray(outputs) ? outputs.length : 36,
            isActive: config.isActive !== false,
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
            model: config.model || 'WP-36X36',
            ipAddress: config.ipAddress,
            tcpPort: config.tcpPort || 23,
            udpPort: config.udpPort || 4000,
            protocol: config.protocol || 'HTTP',
            inputCount: Array.isArray(inputs) ? inputs.length : 36,
            outputCount: Array.isArray(outputs) ? outputs.length : 36,
            isActive: config.isActive !== false,
            createdAt: now,
            updatedAt: now
          })
          .returning()
          .get()
      }

      // Get existing outputs to preserve TV brand/model data
      const existingOutputs = await tx.select()
        .from(schema.matrixOutputs)
        .where(eq(schema.matrixOutputs.configId, savedConfig.id))
        .all()

      // Create a map of existing outputs by channel number to preserve TV data
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
      if (inputs && Array.isArray(inputs) && inputs.length > 0) {
        for (const input of inputs as any[]) {
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
              createdAt: now,
              updatedAt: now
            })
            .run()
        }
      }

      // Save outputs - preserve CEC discovery data from existing records
      if (outputs && Array.isArray(outputs) && outputs.length > 0) {
        for (const output of outputs as any[]) {
          const existing = existingOutputMap.get(output.channelNumber) as {
            tvBrand?: string | null;
            tvModel?: string | null;
            lastDiscovery?: string | null;
          } | undefined

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
              // Preserve TV brand/model data from existing record, or use new data if provided
              tvBrand: output.tvBrand || existing?.tvBrand || null,
              tvModel: output.tvModel || existing?.tvModel || null,
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
    logger.debug(`- Inputs saved: ${Array.isArray(inputs) ? inputs.length : 0}`)
    logger.debug(`- Outputs saved: ${Array.isArray(outputs) ? outputs.length : 0}`)

    return NextResponse.json({
      success: true,
      message: 'Configuration saved successfully',
      config: result,
      inputCount: Array.isArray(inputs) ? inputs.length : 0,
      outputCount: Array.isArray(outputs) ? outputs.length : 0
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
