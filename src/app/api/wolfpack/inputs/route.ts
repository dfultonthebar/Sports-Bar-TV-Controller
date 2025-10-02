
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // Get active matrix configuration
    const config = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true },
      include: {
        inputs: {
          where: { isActive: true },
          orderBy: { channelNumber: 'asc' }
        }
      }
    })

    if (!config) {
      return NextResponse.json(
        { error: 'No active matrix configuration found' },
        { status: 404 }
      )
    }

    // Format inputs with current channel info
    const inputs = config.inputs.map(input => ({
      id: input.id,
      channelNumber: input.channelNumber,
      label: input.label,
      inputType: input.inputType,
      deviceType: input.deviceType,
      status: input.status,
      // In a real implementation, this would fetch live channel info from the device
      currentChannel: `Channel ${input.channelNumber}`,
      isActive: input.isActive
    }))

    return NextResponse.json({
      success: true,
      inputs,
      configId: config.id,
      configName: config.name
    })

  } catch (error) {
    console.error('Error fetching Wolfpack inputs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Wolfpack inputs' },
      { status: 500 }
    )
  }
}
