export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
import { getAvailableInputs } from '@/lib/atlas-models-config'
import { audioProcessors } from '@/db/schema'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
/**
 * GET /api/audio-processor/inputs
 * Fetch available inputs for an Atlas audio processor
 * 
 * Query params:
 * - processorId: The ID of the audio processor
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error

  // Path parameter validation
  const resolvedParams = await params
  const paramsValidation = validatePathParams(resolvedParams, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error


  try {
    const { searchParams } = new URL(request.url)
    const processorId = searchParams.get('processorId')

    if (!processorId) {
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }

    // Fetch the processor to get its model
    const processor = await db.select().from(audioProcessors).where(eq(audioProcessors.id, processorId)).limit(1).get()

    if (!processor) {
      return NextResponse.json(
        { error: 'Audio processor not found' },
        { status: 404 }
      )
    }

    // Get available inputs from the model configuration
    const inputs = getAvailableInputs(processor.model)

    // Fetch any custom input configurations from Atlas config
    try {
      const configResponse = await fetch(
        `${request.nextUrl.origin}/api/atlas/configuration?processorId=${processorId}`
      )
      const configData = await configResponse.json()

      if (configData.success && configData.inputs && configData.inputs.length > 0) {
        // Merge custom configurations with model defaults
        // Build a map of custom inputs for quick lookup
        const customInputsMap = new Map(
          configData.inputs.map((input: any) => [input.id, input])
        )

        // Merge all model inputs with custom configurations where available
        const mergedInputs = inputs.map(modelInput => {
          const customInput = customInputsMap.get(modelInput.id)
          
          if (customInput) {
            // Merge custom configuration with model defaults
            return {
              ...modelInput,
              ...customInput,
              isCustom: true
            }
          } else {
            // Use model defaults
            return {
              id: modelInput.id,
              number: modelInput.number,
              name: modelInput.name,
              type: modelInput.type,
              connector: modelInput.connector,
              description: modelInput.description,
              priority: modelInput.priority,
              isCustom: false
            }
          }
        })

        logger.info(`Merged ${mergedInputs.length} inputs (${configData.inputs.length} custom, ${inputs.length} total)`)

        return NextResponse.json({
          success: true,
          inputs: mergedInputs,
          processorId,
          model: processor.model
        })
      }
    } catch (configError) {
      logger.info('No custom input configuration found, using model defaults')
    }

    // Return model default inputs
    return NextResponse.json({
      success: true,
      inputs: inputs.map(input => ({
        id: input.id,
        number: input.number,
        name: input.name,
        type: input.type,
        connector: input.connector,
        description: input.description,
        priority: input.priority,
        isCustom: false
      })),
      processorId,
      model: processor.model
    })

  } catch (error) {
    logger.error('Error fetching audio processor inputs:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch inputs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
