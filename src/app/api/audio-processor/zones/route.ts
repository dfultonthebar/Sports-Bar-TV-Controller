
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { audioZones } from '@/db/schema'
import { findMany, findUnique, findFirst, create, update, updateMany, deleteRecord, upsert, count, eq, desc, asc, and, or, ne } from '@/lib/db-helpers'
import { schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  try {
    const { searchParams } = new URL(request.url)
    const processorId = searchParams.get('processorId')

    if (!processorId) {
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }

    const zones = await findMany('audioZones', {
      where: eq(schema.audioZones.processorId, processorId),
      orderBy: asc(schema.audioZones.zoneNumber),
      limit: 1000
    })

    return NextResponse.json({ zones })
  } catch (error) {
    logger.error('Error fetching audio zones:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audio zones' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  try {
    const data = await request.json()
    const { processorId, zoneNumber, name, description, currentSource, volume, muted } = data

    if (!processorId || !zoneNumber || !name) {
      return NextResponse.json(
        { error: 'Processor ID, zone number, and name are required' },
        { status: 400 }
      )
    }

    const zone = await db.insert(audioZones).values({
        processorId: processorId,
        zoneNumber,
        name,
        description,
        currentSource,
        volume: volume || 50,
        muted: muted || false,
        enabled: true
      }).returning().get()

    return NextResponse.json({ zone })
  } catch (error) {
    logger.error('Error creating audio zone:', error)
    return NextResponse.json(
      { error: 'Failed to create audio zone' },
      { status: 500 }
    )
  }
}
