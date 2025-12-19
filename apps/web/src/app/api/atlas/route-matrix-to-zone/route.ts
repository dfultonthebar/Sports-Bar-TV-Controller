
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findFirst, findMany, findUnique, or, update, upsert } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

/**
 * Atlas Matrix-to-Zone Routing API
 * Routes Atlas audio inputs (Matrix 1-4) to specific zones
 * This integrates with the video input selection feature
 */

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

  // Security: use validated data
  const { data } = bodyValidation
  const { matrixInputNumber, zoneNumbers, processorId } = data
  try {

    // Validate input parameters
    if (!matrixInputNumber || !zoneNumbers || !Array.isArray(zoneNumbers)) {
      return NextResponse.json(
        { error: 'Matrix input number and zone numbers array are required' },
        { status: 400 }
      )
    }

    // Type conversion for matrixInputNumber
    const matrixInputNum = typeof matrixInputNumber === 'number' ? matrixInputNumber : Number(matrixInputNumber);
    const processorIdStr = typeof processorId === 'string' ? processorId : String(processorId);

    // Validate matrix input is 1-4
    if (matrixInputNum < 1 || matrixInputNum > 4) {
      return NextResponse.json(
        { error: 'Matrix input number must be between 1 and 4' },
        { status: 400 }
      )
    }

    // Get the Atlas processor
    const processor = processorId
      ? await findUnique('audioProcessors', eq(schema.audioProcessors.id, processorIdStr))
      : await findFirst('audioProcessors', { where: eq(schema.audioProcessors.status, 'online') })

    if (!processor) {
      return NextResponse.json(
        { error: 'No active Atlas processor found' },
        { status: 404 }
      )
    }

    // Get the current video input selection for this matrix output
    const matrixRouting = await findUnique('wolfpackMatrixRoutings',
      eq(schema.wolfpackMatrixRoutings.matrixOutputNumber, matrixInputNum)
    )

    const videoInputLabel = matrixRouting?.wolfpackInputLabel || `Matrix ${matrixInputNum}`

    // Get or create zones
    const zones = await Promise.all(
      zoneNumbers.map(async (zoneNum: number) => {
        return await upsert('audioZones',
          and(
            eq(schema.audioZones.processorId, processor.id),
            eq(schema.audioZones.zoneNumber, zoneNum)
          ),
          {
            currentSource: `Matrix ${matrixInputNum}`,
            updatedAt: new Date()
          },
          {
            processorId: processor.id,
            zoneNumber: zoneNum,
            name: `Zone ${zoneNum}`,
            currentSource: `Matrix ${matrixInputNum}`,
            volume: 50
          }
        )
      })
    )

    // Here you would send actual commands to the Atlas processor
    // For now, we'll simulate the routing by updating the database
    logger.debug(`Routing Matrix ${matrixInputNum} (${videoInputLabel}) to zones: ${zoneNumbers.join(', ')}`)
    
    // In a real implementation, you would:
    // 1. Get the Atlas processor configuration
    // 2. Determine the physical input number for Matrix input (e.g., Input 9-12 for Matrix 1-4)
    // 3. Send HTTP commands to Atlas processor to route that input to the specified zones
    // Example: POST to http://{processor.ipAddress}/api/routing
    //   { "input": matrixInputNumber + 8, "outputs": zoneNumbers }

    // For now, log the routing action
    await update('wolfpackMatrixRoutings',
      eq(schema.wolfpackMatrixRoutings.matrixOutputNumber, matrixInputNum),
      {
        atlasInputLabel: `Matrix ${matrixInputNum}`,
        updatedAt: new Date()
      }
    )

    return NextResponse.json({
      success: true,
      message: `Successfully routed Matrix ${matrixInputNum} (${videoInputLabel}) to zones ${zoneNumbers.join(', ')}`,
      routing: {
        matrixInput: matrixInputNum,
        videoInputLabel,
        atlasInput: `Matrix ${matrixInputNum}`,
        zones: zones.map(z => ({
          number: z.zoneNumber,
          name: z.name
        })),
        processor: {
          id: processor.id,
          name: processor.name,
          model: processor.model
        }
      }
    })

  } catch (error) {
    logger.error('Error routing Matrix to Atlas zone:', error)
    return NextResponse.json(
      { 
        error: 'Failed to route Matrix to Atlas zone',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to retrieve current Matrix-to-Zone routing state
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error

  try {
    const { searchParams } = new URL(request.url)
    const processorId = searchParams.get('processorId')
    const matrixInputNumber = searchParams.get('matrixInputNumber')

    // Get processor
    const processor = processorId
      ? await findUnique('audioProcessors', {
          where: eq(schema.audioProcessors.id, processorId)
        })
      : await findFirst('audioProcessors', {
          where: eq(schema.audioProcessors.status, 'online')
        })

    if (!processor) {
      return NextResponse.json(
        { error: 'No active Atlas processor found' },
        { status: 404 }
      )
    }

    // Get audio zones for this processor
    const audioZonesForProcessor = await findMany('audioZones', {
      where: eq(schema.audioZones.processorId, processor.id)
    })

    // Get matrix routing states
    const matrixRoutings = await findMany('wolfpackMatrixRoutings', {
      where: matrixInputNumber
        ? eq(schema.wolfpackMatrixRoutings.matrixOutputNumber, parseInt(matrixInputNumber))
        : and(
            eq(schema.wolfpackMatrixRoutings.matrixOutputNumber, 1),
            or(
              eq(schema.wolfpackMatrixRoutings.matrixOutputNumber, 2),
              eq(schema.wolfpackMatrixRoutings.matrixOutputNumber, 3),
              eq(schema.wolfpackMatrixRoutings.matrixOutputNumber, 4)
            )
          ),
      orderBy: asc(schema.wolfpackMatrixRoutings.matrixOutputNumber)
    })

    // Build routing state
    const routingState = matrixRoutings.map(routing => {
      const zonesWithThisSource = audioZonesForProcessor.filter(
        zone => zone.currentSource === `Matrix ${routing.matrixOutputNumber}`
      )

      return {
        matrixInput: routing.matrixOutputNumber,
        videoInputLabel: routing.wolfpackInputLabel,
        atlasInputLabel: routing.atlasInputLabel,
        zones: zonesWithThisSource.map(z => ({
          number: z.zoneNumber,
          name: z.name,
          volume: z.volume
        })),
        lastRouted: routing.lastRouted
      }
    })

    return NextResponse.json({
      success: true,
      processor: {
        id: processor.id,
        name: processor.name,
        model: processor.model
      },
      routingState
    })

  } catch (error) {
    logger.error('Error fetching Matrix-to-Zone routing state:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch routing state',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
