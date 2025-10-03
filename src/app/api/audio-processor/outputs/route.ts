
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
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
    const { searchParams } = new URL(request.url)
    const processorId = searchParams.get('processorId')
    const includeGroups = searchParams.get('includeGroups') !== 'false'

    if (!processorId) {
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }

    // Fetch the processor to get its model
    const processor = await prisma.audioProcessor.findUnique({
      where: { id: processorId }
    })

    if (!processor) {
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
        outputs = configData.outputs.map((customOutput: any) => {
          const modelOutput = modelOutputs.find(
            o => o.id === customOutput.id || o.number === customOutput.physicalOutput
          )
          return {
            ...modelOutput,
            id: customOutput.id || modelOutput?.id,
            number: customOutput.physicalOutput || modelOutput?.number,
            name: customOutput.name || modelOutput?.name,
            type: customOutput.type || modelOutput?.type,
            levelDb: customOutput.levelDb ?? -20,
            muted: customOutput.muted ?? false,
            groupId: customOutput.groupId || null,
            isCustom: true
          }
        })
      }
    } catch (configError) {
      console.log('No custom output configuration found, using model defaults')
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

    return NextResponse.json({
      success: true,
      outputs,
      groups,
      processorId,
      model: processor.model,
      hasGroups: groups.length > 0
    })

  } catch (error) {
    console.error('Error fetching audio processor outputs:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch outputs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
