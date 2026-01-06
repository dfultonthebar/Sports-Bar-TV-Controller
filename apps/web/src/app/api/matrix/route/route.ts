
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@sports-bar/logger'
import { routeMatrix } from '@/lib/matrix-control'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'


export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation - extend schema to accept source parameter
  const extendedSchema = z.object({
    input: z.union([z.string(), z.number()]),
    output: z.union([z.string(), z.number()]),
    source: z.enum(['bartender', 'ai_scheduler', 'manual', 'system']).optional().default('bartender'),
    bartenderId: z.string().optional(),
  })

  const bodyValidation = await validateRequestBody(request, extendedSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Security: use validated data
  const { data } = bodyValidation
  const { input, output, source, bartenderId } = data

  // Convert to numbers if strings
  const inputNum = typeof input === 'string' ? parseInt(input, 10) : input
  const outputNum = typeof output === 'string' ? parseInt(output, 10) : output

  try {

    // Validate input parameters
    if (!inputNum || !outputNum || inputNum < 1 || outputNum < 1 || inputNum > 32 || outputNum > 32) {
      return NextResponse.json(
        { error: 'Invalid input or output channel' },
        { status: 400 }
      )
    }

    // Use shared matrix routing logic
    const success = await routeMatrix(inputNum, outputNum)

    if (!success) {
      return NextResponse.json({
        error: `Failed to route input ${input} to output ${output}`,
        success: false
      }, { status: 500 })
    }

    // Track routing in MatrixRoute table and set manual override for bartender changes
    try {
      const now = new Date().toISOString()

      // Check if route exists
      const existingRoute = await db.select()
        .from(schema.matrixRoutes)
        .where(eq(schema.matrixRoutes.outputNum, outputNum))
        .limit(1)
        .get()

      // Calculate override duration for bartender changes
      let manualOverrideUntil: string | null = null
      if (source === 'bartender' || source === 'manual') {
        // Import smart override calculator to determine duration based on game
        const { calculateSmartOverrideDuration } = await import('@/lib/scheduler/smart-override')

        // Get the channel being played on this input
        const inputChannel = await db.select()
          .from(schema.inputCurrentChannels)
          .where(eq(schema.inputCurrentChannels.inputNum, inputNum))
          .limit(1)
          .get()

        if (inputChannel?.channelNumber) {
          const overrideResult = await calculateSmartOverrideDuration(inputChannel.channelNumber)
          manualOverrideUntil = new Date(Date.now() + overrideResult.durationMs).toISOString()

          logger.info(
            `[MATRIX_ROUTE] Bartender override set for output ${outputNum}: ` +
            `${overrideResult.durationMinutes} minutes (${overrideResult.reason})`
          )
        } else {
          // Default 4 hours if no channel info
          manualOverrideUntil = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
          logger.info(`[MATRIX_ROUTE] Bartender override set for output ${outputNum}: 4 hours (default)`)
        }
      }

      if (existingRoute) {
        // Update existing route
        await db.update(schema.matrixRoutes)
          .set({
            inputNum,
            updatedAt: now,
            ...(source === 'bartender' || source === 'manual' ? {
              manualOverrideUntil,
              lastManualChangeBy: bartenderId || 'bartender',
              lastManualChangeAt: now,
            } : {})
          })
          .where(eq(schema.matrixRoutes.outputNum, outputNum))
      } else {
        // Create new route
        await db.insert(schema.matrixRoutes)
          .values({
            inputNum,
            outputNum,
            isActive: true,
            createdAt: now,
            updatedAt: now,
            ...(source === 'bartender' || source === 'manual' ? {
              manualOverrideUntil,
              lastManualChangeBy: bartenderId || 'bartender',
              lastManualChangeAt: now,
            } : {})
          })
      }
    } catch (dbError: any) {
      logger.warn(`[MATRIX_ROUTE] Could not track route in database: ${dbError.message}`)
      // Don't fail the request if tracking fails
    }

    return NextResponse.json({
      success: true,
      message: `Successfully routed input ${input} to output ${output}`,
      command: `${input}X${output}.`,
      route: { input, output },
      source,
      overrideApplied: source === 'bartender' || source === 'manual'
    })

  } catch (error) {
    logger.error('Error routing signal:', error)
    return NextResponse.json(
      { error: 'Failed to route signal' },
      { status: 500 }
    )
  }
}
