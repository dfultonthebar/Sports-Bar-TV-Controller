
import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, desc, asc } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { findMany, upsert } from '@/lib/db-helpers'

export async function GET() {
  try {
    logger.api.request('GET', '/api/audio-processor/matrix-routing')
    
    // Get all Matrix routing configurations
    const routings = await findMany('wolfpackMatrixRoutings', {
      where: eq(schema.wolfpackMatrixRoutings.isActive, true),
      orderBy: asc(schema.wolfpackMatrixRoutings.matrixOutputNumber)
    })

    // Get recent routing history
    const recentStates = await findMany('wolfpackMatrixStates', {
      orderBy: desc(schema.wolfpackMatrixStates.routedAt),
      limit: 20
    })

    logger.api.response('GET', '/api/audio-processor/matrix-routing', 200, { 
      routingCount: routings.length,
      stateCount: recentStates.length 
    })

    return NextResponse.json({
      success: true,
      routings,
      recentStates
    })

  } catch (error) {
    logger.api.error('GET', '/api/audio-processor/matrix-routing', error)
    return NextResponse.json(
      { error: 'Failed to fetch Matrix routing state' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    logger.api.request('POST', '/api/audio-processor/matrix-routing')
    
    const { matrixOutputNumber, atlasInputLabel } = await request.json()

    if (!matrixOutputNumber) {
      logger.api.response('POST', '/api/audio-processor/matrix-routing', 400, { error: 'Missing matrixOutputNumber' })
      return NextResponse.json(
        { error: 'matrixOutputNumber is required' },
        { status: 400 }
      )
    }

    // Update or create Matrix routing configuration
    const routing = await upsert(
      'wolfpackMatrixRoutings',
      eq(schema.wolfpackMatrixRoutings.matrixOutputNumber, matrixOutputNumber),
      {
        // create data
        matrixOutputNumber,
        atlasInputLabel: atlasInputLabel || `Matrix ${matrixOutputNumber}`,
        isActive: true
      },
      {
        // update data
        atlasInputLabel: atlasInputLabel || `Matrix ${matrixOutputNumber}`,
        updatedAt: new Date().toISOString()
      }
    )

    logger.api.response('POST', '/api/audio-processor/matrix-routing', 200, { routingId: routing.id })

    return NextResponse.json({
      success: true,
      routing
    })

  } catch (error) {
    logger.api.error('POST', '/api/audio-processor/matrix-routing', error)
    return NextResponse.json(
      { error: 'Failed to update Matrix routing configuration' },
      { status: 500 }
    )
  }
}
