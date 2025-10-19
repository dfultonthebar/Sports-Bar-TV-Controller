
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ATLAS_MODELS } from '@/lib/atlas-models-config'
import { encryptPassword, decryptPassword } from '@/lib/atlas-auth'

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
    // Don't expose encrypted passwords in GET response
    const processorsWithCounts = processors.map(processor => {
      const counts = getModelCounts(processor.model)
      const { password, ...processorWithoutPassword } = processor
      return {
        ...processorWithoutPassword,
        inputs: counts.inputs,
        outputs: counts.outputs,
        hasCredentials: !!(processor.username && processor.password)
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
    const { name, model, ipAddress, port, zones, description, username, password } = data

    if (!name || !model || !ipAddress) {
      return NextResponse.json(
        { error: 'Name, model, and IP address are required' },
        { status: 400 }
      )
    }

    // Get model configuration for accurate counts
    const modelConfig = ATLAS_MODELS[model as keyof typeof ATLAS_MODELS]
    const calculatedZones = zones || modelConfig?.zones || (model.includes('AZM8') || model.includes('AZMP8') ? 8 : 4)
    
    // Prepare processor data
    const processorData: any = {
      name,
      model,
      ipAddress,
      port: port || 80,
      zones: calculatedZones,
      description,
      status: 'offline'
    }

    // Add credentials if provided
    if (username && password) {
      processorData.username = username
      processorData.password = encryptPassword(password)
    }

    const processor = await prisma.audioProcessor.create({
      data: processorData
    })

    // Auto-query hardware configuration if possible
    // This will populate the real sources and zones from the Atlas hardware
    try {
      console.log(`[Audio Processor API] Auto-querying hardware for processor ${processor.id}`)
      
      const queryResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/atlas/query-hardware`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processorId: processor.id })
      })
      
      if (queryResponse.ok) {
        const queryResult = await queryResponse.json()
        console.log(`[Audio Processor API] Hardware query successful:`, queryResult)
      } else {
        console.warn(`[Audio Processor API] Hardware query failed, will use model defaults`)
      }
    } catch (error) {
      console.warn('[Audio Processor API] Failed to auto-query hardware:', error)
      // Non-fatal - processor is still created, just using model defaults
    }

    // Return processor with calculated values from model config
    // Don't expose encrypted password
    const counts = getModelCounts(processor.model)
    const { password: encryptedPassword, ...processorWithoutPassword } = processor
    const processorWithCounts = {
      ...processorWithoutPassword,
      inputs: counts.inputs,
      outputs: counts.outputs,
      hasCredentials: !!(processor.username && processor.password)
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

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json()
    const { id, name, model, ipAddress, port, zones, description, username, password } = data

    if (!id) {
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: any = {
      name,
      model,
      ipAddress,
      port,
      zones,
      description
    }

    // Update credentials if provided
    if (username !== undefined) {
      updateData.username = username || null
    }
    if (password !== undefined && password !== '') {
      updateData.password = encryptPassword(password)
    }

    const processor = await prisma.audioProcessor.update({
      where: { id },
      data: updateData
    })

    // Return processor without exposing encrypted password
    const counts = getModelCounts(processor.model)
    const { password: encryptedPassword, ...processorWithoutPassword } = processor
    const processorWithCounts = {
      ...processorWithoutPassword,
      inputs: counts.inputs,
      outputs: counts.outputs,
      hasCredentials: !!(processor.username && processor.password)
    }

    return NextResponse.json({ processor: processorWithCounts })
  } catch (error) {
    console.error('Error updating audio processor:', error)
    return NextResponse.json(
      { error: 'Failed to update audio processor' },
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
