export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
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
    const { searchParams } = new URL(request.url)
    const processorId = searchParams.get('processorId')

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
        const customInputs = configData.inputs.map((customInput: any) => {
          const modelInput = inputs.find(i => i.id === customInput.id || i.number === customInput.physicalInput)
          return {
            ...modelInput,
            ...customInput,
            isCustom: true
          }
        })

        return NextResponse.json({
          success: true,
          inputs: customInputs,
          processorId,
          model: processor.model
        })
      }
    } catch (configError) {
      console.log('No custom input configuration found, using model defaults')
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
    console.error('Error fetching audio processor inputs:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch inputs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
