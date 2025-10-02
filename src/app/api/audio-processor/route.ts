
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ATLAS_MODELS } from '@/lib/atlas-models-config'

// Helper function to get input/output counts from model config
function getModelCounts(model: string) {
  const modelConfig = ATLAS_MODELS[model as keyof typeof ATLAS_MODELS]
  if (modelConfig) {
    return {
      inputs: modelConfig.inputs.length,
      outputs: modelConfig.outputs.length
    }
  }
  // Fallback for unknown models
  return {
    inputs: model.includes('AZM8') || model.includes('AZMP8') ? 10 : 6,
    outputs: model.includes('AZM8') || model.includes('AZMP8') ? 8 : 4
  }
}

export async function GET() {
  try {
    const processors = await prisma.audioProcessor.findMany({
      orderBy: { name: 'asc' }
    })
    
    // Add calculated inputs and outputs for each processor based on model config
    const processorsWithCounts = processors.map(processor => {
      const counts = getModelCounts(processor.model)
      return {
        ...processor,
        inputs: counts.inputs,
        outputs: counts.outputs
      }
    })
    
    return NextResponse.json({ processors: processorsWithCounts })
  } catch (error) {
    console.error('Error fetching audio processors:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audio processors' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { name, model, ipAddress, port, zones, description } = data

    if (!name || !model || !ipAddress) {
      return NextResponse.json(
        { error: 'Name, model, and IP address are required' },
        { status: 400 }
      )
    }

    // Get model configuration for accurate counts
    const modelConfig = ATLAS_MODELS[model as keyof typeof ATLAS_MODELS]
    const calculatedZones = zones || modelConfig?.zones || (model.includes('AZM8') || model.includes('AZMP8') ? 8 : 4)
    
    const processor = await prisma.audioProcessor.create({
      data: {
        name,
        model,
        ipAddress,
        port: port || 80,
        zones: calculatedZones,
        description,
        status: 'offline'
      }
    })

    // Return processor with calculated values from model config
    const counts = getModelCounts(processor.model)
    const processorWithCounts = {
      ...processor,
      inputs: counts.inputs,
      outputs: counts.outputs
    }

    return NextResponse.json({ processor: processorWithCounts })
  } catch (error) {
    console.error('Error creating audio processor:', error)
    return NextResponse.json(
      { error: 'Failed to create audio processor' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }

    await prisma.audioProcessor.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Processor deleted successfully' })
  } catch (error) {
    console.error('Error deleting audio processor:', error)
    return NextResponse.json(
      { error: 'Failed to delete audio processor' },
      { status: 500 }
    )
  }
}
