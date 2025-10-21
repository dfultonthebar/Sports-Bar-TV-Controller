
import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, asc } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { findMany, create } from '@/lib/db-helpers'

export async function GET(request: NextRequest) {
  try {
    logger.api.request('GET', '/api/audio-processor/zones')
    
    const { searchParams } = new URL(request.url)
    const processorId = searchParams.get('processorId')

    if (!processorId) {
      logger.api.response('GET', '/api/audio-processor/zones', 400, { error: 'Missing processorId' })
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }

    const zones = await findMany('audioZones', {
      where: eq(schema.audioZones.processorId, processorId),
      orderBy: asc(schema.audioZones.zoneNumber)
    })

    logger.api.response('GET', '/api/audio-processor/zones', 200, { count: zones.length })
    return NextResponse.json({ zones })
  } catch (error) {
    logger.api.error('GET', '/api/audio-processor/zones', error)
    return NextResponse.json(
      { error: 'Failed to fetch audio zones' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    logger.api.request('POST', '/api/audio-processor/zones')
    
    const data = await request.json()
    const { processorId, zoneNumber, name, description, currentSource, volume, muted } = data

    if (!processorId || !zoneNumber || !name) {
      logger.api.response('POST', '/api/audio-processor/zones', 400, { error: 'Missing required fields' })
      return NextResponse.json(
        { error: 'Processor ID, zone number, and name are required' },
        { status: 400 }
      )
    }

    const zone = await create('audioZones', {
      processorId: processorId,
      zoneNumber,
      name,
      description,
      currentSource,
      volume: volume || 50,
      muted: muted || false,
      enabled: true
    })

    logger.api.response('POST', '/api/audio-processor/zones', 200, { zoneId: zone.id })
    return NextResponse.json({ zone })
  } catch (error) {
    logger.api.error('POST', '/api/audio-processor/zones', error)
    return NextResponse.json(
      { error: 'Failed to create audio zone' },
      { status: 500 }
    )
  }
}
