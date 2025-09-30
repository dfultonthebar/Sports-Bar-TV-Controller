
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const processors = await prisma.audioProcessor.findMany({
      orderBy: { name: 'asc' }
    })
    
    // Add calculated inputs and outputs for each processor
    const processorsWithCounts = processors.map(processor => ({
      ...processor,
      inputs: processor.model.includes('AZM8') ? 8 : 4,
      outputs: processor.zones
    }))
    
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

    // Calculate inputs and outputs based on model
    const calculatedZones = zones || (model.includes('AZM8') ? 8 : 4)
    const inputs = model.includes('AZM8') ? 8 : 4
    const outputs = calculatedZones

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

    // Return processor with calculated values for the frontend
    const processorWithCounts = {
      ...processor,
      inputs,
      outputs
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
