import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    logger.api.request('GET', '/api/wolfpack/current-routings')
    
    // Get all active routings
    const routings = await db
      .select()
      .from(schema.wolfpackMatrixRoutings)
      .where(eq(schema.wolfpackMatrixRoutings.isActive, true))
      .all()

    logger.api.response('GET', '/api/wolfpack/current-routings', 200, { 
      count: routings.length 
    })

    return NextResponse.json({
      success: true,
      routings: routings.map(r => ({
        matrixOutputNumber: r.matrixOutputNumber,
        wolfpackInputNumber: r.wolfpackInputNumber,
        wolfpackInputLabel: r.wolfpackInputLabel,
        lastRouted: r.lastRouted
      }))
    })

  } catch (error) {
    logger.api.error('GET', '/api/wolfpack/current-routings', error)
    return NextResponse.json(
      { error: 'Failed to fetch current routings' },
      { status: 500 }
    )
  }
}
