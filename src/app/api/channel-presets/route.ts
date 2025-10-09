
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'


// GET /api/channel-presets - Get all presets (optionally filtered by deviceType)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const deviceType = searchParams.get('deviceType')

    const where = deviceType ? { deviceType, isActive: true } : { isActive: true }

    const presets = await prisma.channelPreset.findMany({
      where,
      orderBy: [
        { order: 'asc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json({ 
      success: true, 
      presets 
    })
  } catch (error) {
    console.error('Error fetching channel presets:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch channel presets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST /api/channel-presets - Create a new preset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, channelNumber, deviceType, order } = body

    // Validate required fields
    if (!name || !channelNumber || !deviceType) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: name, channelNumber, deviceType' 
        },
        { status: 400 }
      )
    }

    // Validate deviceType
    if (!['cable', 'directv'].includes(deviceType)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid deviceType. Must be "cable" or "directv"' 
        },
        { status: 400 }
      )
    }

    // If no order specified, get the next available order number
    let presetOrder = order
    if (presetOrder === undefined || presetOrder === null) {
      const maxOrderPreset = await prisma.channelPreset.findFirst({
        where: { deviceType },
        orderBy: { order: 'desc' }
      })
      presetOrder = maxOrderPreset ? maxOrderPreset.order + 1 : 0
    }

    const preset = await prisma.channelPreset.create({
      data: {
        name,
        channelNumber,
        deviceType,
        order: presetOrder
      }
    })

    return NextResponse.json({ 
      success: true, 
      preset 
    })
  } catch (error) {
    console.error('Error creating channel preset:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create channel preset',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
