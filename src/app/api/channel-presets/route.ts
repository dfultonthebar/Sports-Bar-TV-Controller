
import { NextRequest, NextResponse } from 'next/server'
import { findMany, findFirst, create, eq, and, asc, desc } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'


// GET /api/channel-presets - Get all presets (optionally filtered by deviceType)
export async function GET(request: NextRequest) {
  logger.api.request('GET', '/api/channel-presets')
  
  try {
    const searchParams = request.nextUrl.searchParams
    const deviceType = searchParams.get('deviceType')

    const whereClause = deviceType 
      ? and(eq(schema.channelPresets.deviceType, deviceType), eq(schema.channelPresets.isActive, true))
      : eq(schema.channelPresets.isActive, true)

    const presets = await findMany('channelPresets', {
      where: whereClause,
      orderBy: [
        asc(schema.channelPresets.order),
        asc(schema.channelPresets.name)
      ]
    })

    logger.api.response('GET', '/api/channel-presets', 200, { count: presets.length })
    return NextResponse.json({ 
      success: true, 
      presets 
    })
  } catch (error) {
    logger.api.error('GET', '/api/channel-presets', error)
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
  logger.api.request('POST', '/api/channel-presets')
  
  try {
    const body = await request.json()
    const { name, channelNumber, deviceType, order } = body

    logger.debug('Creating channel preset', { name, channelNumber, deviceType, order })

    // Validate required fields
    if (!name || !channelNumber || !deviceType) {
      logger.api.response('POST', '/api/channel-presets', 400, { error: 'Missing required fields' })
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
      logger.api.response('POST', '/api/channel-presets', 400, { error: 'Invalid deviceType' })
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
      const maxOrderPreset = await findFirst('channelPresets', {
        where: eq(schema.channelPresets.deviceType, deviceType),
        orderBy: desc(schema.channelPresets.order)
      })
      presetOrder = maxOrderPreset ? maxOrderPreset.order + 1 : 0
    }

    const preset = await create('channelPresets', {
      name,
      channelNumber,
      deviceType,
      order: presetOrder
    })

    logger.api.response('POST', '/api/channel-presets', 201, { presetId: preset.id })
    return NextResponse.json({ 
      success: true, 
      preset 
    })
  } catch (error) {
    logger.api.error('POST', '/api/channel-presets', error)
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
