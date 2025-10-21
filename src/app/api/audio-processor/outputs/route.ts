export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { findUnique } from '@/lib/db-helpers'
import { getAvailableOutputs } from '@/lib/atlas-models-config'

/**
 * GET /api/audio-processor/outputs
 * Fetch available outputs/zones for an Atlas audio processor
 * 
 * Query params:
 * - processorId: The ID of the audio processor
 * - includeGroups: Whether to detect and include zone groups (default: true)
 */
export async function GET(request: NextRequest) {
  try {
    logger.api.request('GET', '/api/audio-processor/outputs')
    
    const { searchParams } = new URL(request.url)
    const processorId = searchParams.get('processorId')
    const includeGroups = searchParams.get('includeGroups') !== 'false'

    if (!processorId) {
      logger.api.response('GET', '/api/audio-processor/outputs', 400, { error: 'Missing processorId' })
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }

    // Fetch the processor to get its model
    const processor = await findUnique('audioProcessors', eq(schema.audioProcessors.id, processorId))

    if (!processor) {
      logger.api.response('GET', '/api/audio-processor/outputs', 404, { error: 'Processor not found' })
      return NextResponse.json(
        { error: 'Audio processor not found' },
        { status: 404 }
      )
    }

    // Get available outputs from the model configuration
    const modelOutputs = getAvailableOutputs(processor.model)

    // Fetch any custom output configurations from Atlas config
    let outputs = modelOutputs.map(output => ({
      id: output.id,
      number: output.number,
      name: output.name,
      type: output.type,
      connector: output.connector,
      powerRating: output.powerRating,
      description: output.description,
      isCustom: false,
      levelDb: -20, // Default level
      muted: false,
      groupId: null as string | null
    }))

    try {
      const configResponse = await fetch(
        `${request.nextUrl.origin}/api/atlas/configuration?processorId=${processorId}`
      )
      const configData = await configResponse.json()

      if (configData.success && configData.outputs && configData.outputs.length > 0) {
        // Merge custom configurations with model defaults
        // Build a map of custom outputs for quick lookup
        const customOutputsMap = new Map(
          configData.outputs.map((output: any) => [output.id, output])
        )

        // Merge all model outputs with custom configurations where available
        outputs = modelOutputs.map(modelOutput => {
          const customOutput = customOutputsMap.get(modelOutput.id)
          
          if (customOutput) {
            // Merge custom configuration with model defaults
            return {
              ...modelOutput,
              id: customOutput.id || modelOutput.id,
              number: customOutput.physicalOutput || modelOutput.number,
              name: customOutput.name || modelOutput.name,
              type: customOutput.type || modelOutput.type,
              levelDb: customOutput.levelDb ?? -20,
              muted: customOutput.muted ?? false,
              groupId: customOutput.groupId || null,
              isCustom: true
            }
          } else {
            // Use model defaults
            return {
              id: modelOutput.id,
              number: modelOutput.number,
              name: modelOutput.name,
              type: modelOutput.type,
              connector: modelOutput.connector,
              powerRating: modelOutput.powerRating,
              description: modelOutput.description,
              isCustom: false,
              levelDb: -20,
              muted: false,
              groupId: null
            }
          }
        })

        logger.info(`Merged ${outputs.length} outputs (${configData.outputs.length} custom, ${modelOutputs.length} total)`)
      }
    } catch (configError) {
      logger.info('No custom output configuration found, using model defaults')
    }

    // Detect zone groups if requested
    let groups: any[] = []
    if (includeGroups) {
      const groupMap = new Map<string, any[]>()
      
      outputs.forEach(output => {
        if (output.groupId) {
          if (!groupMap.has(output.groupId)) {
            groupMap.set(output.groupId, [])
          }
          groupMap.get(output.groupId)!.push(output)
        }
      })

      // Create group objects
      groups = Array.from(groupMap.entries()).map(([groupId, groupOutputs]) => ({
        id: groupId,
        name: `Zone Group: ${groupOutputs.map(o => o.name).join(', ')}`,
        outputIds: groupOutputs.map(o => o.id),
        outputs: groupOutputs,
        levelDb: groupOutputs[0]?.levelDb ?? -20,
        muted: groupOutputs.every(o => o.muted)
      }))

      // Filter out grouped outputs from individual outputs list
      const groupedOutputIds = new Set(
        groups.flatMap(g => g.outputIds)
      )
      outputs = outputs.filter(o => !groupedOutputIds.has(o.id))
    }

    logger.api.response('GET', '/api/audio-processor/outputs', 200, { 
      outputCount: outputs.length, 
      groupCount: groups.length 
    })

    return NextResponse.json({
      success: true,
      outputs,
      groups,
      processorId,
      model: processor.model,
      hasGroups: groups.length > 0
    })

  } catch (error) {
    logger.api.error('GET', '/api/audio-processor/outputs', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch outputs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
