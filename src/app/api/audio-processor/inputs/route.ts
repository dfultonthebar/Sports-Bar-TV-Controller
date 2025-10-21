export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { findUnique } from '@/lib/db-helpers'
import { getAvailableInputs } from '@/lib/atlas-models-config'

/**
 * GET /api/audio-processor/inputs
 * Fetch available inputs for an Atlas audio processor
 * 
 * Query params:
 * - processorId: The ID of the audio processor
 */
export async function GET(request: NextRequest) {
  try {
    logger.api.request('GET', '/api/audio-processor/inputs')
    
    const { searchParams } = new URL(request.url)
    const processorId = searchParams.get('processorId')

    if (!processorId) {
      logger.api.response('GET', '/api/audio-processor/inputs', 400, { error: 'Missing processorId' })
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }

    // Fetch the processor to get its model
    const processor = await findUnique('audioProcessors', eq(schema.audioProcessors.id, processorId))

    if (!processor) {
      logger.api.response('GET', '/api/audio-processor/inputs', 404, { error: 'Processor not found' })
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
        logger.api.response('GET', '/api/audio-processor/inputs', 200, { count: mergedInputs.length })

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
    logger.api.response('GET', '/api/audio-processor/inputs', 200, { count: inputs.length })
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
    logger.api.error('GET', '/api/audio-processor/inputs', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch inputs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
