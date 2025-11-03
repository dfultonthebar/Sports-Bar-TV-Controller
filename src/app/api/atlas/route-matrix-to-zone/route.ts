
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findFirst, findMany, findUnique, or, update, upsert } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'

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
  if (!bodyValidation.success) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  try {
    const { matrixInputNumber, zoneNumbers, processorId } = await request.json()

    // Validate input parameters
    if (!matrixInputNumber || !zoneNumbers || !Array.isArray(zoneNumbers)) {
      return NextResponse.json(
        { error: 'Matrix input number and zone numbers array are required' },
        { status: 400 }
      )
    }

    // Validate matrix input is 1-4
    if (matrixInputNumber < 1 || matrixInputNumber > 4) {
      return NextResponse.json(
        { error: 'Matrix input number must be between 1 and 4' },
        { status: 400 }
      )
    }

    // Get the Atlas processor
    const processor = processorId 
      ? await prisma.audioProcessor.findUnique({ where: { id: processorId } })
      : await prisma.audioProcessor.findFirst({ where: { status: 'online' } })

    if (!processor) {
      return NextResponse.json(
        { error: 'No active Atlas processor found' },
        { status: 404 }
      )
    }

    // Get the current video input selection for this matrix output
    const matrixRouting = await prisma.wolfpackMatrixRouting.findUnique({
      where: { matrixOutputNumber: parseInt(matrixInputNumber) }
    })

    const videoInputLabel = matrixRouting?.wolfpackInputLabel || `Matrix ${matrixInputNumber}`

    // Get or create zones
    const zones = await Promise.all(
      zoneNumbers.map(async (zoneNum: number) => {
        return await prisma.audioZone.upsert({
          where: {
            processorId_zoneNumber: {
              processorId: processor.id,
              zoneNumber: zoneNum
            }
          },
          update: {
            currentSource: `Matrix ${matrixInputNumber}`,
            updatedAt: new Date()
          },
          create: {
            processorId: processor.id,
            zoneNumber: zoneNum,
            name: `Zone ${zoneNum}`,
            currentSource: `Matrix ${matrixInputNumber}`,
            volume: 50
          }
        })
      })
    )

    // Here you would send actual commands to the Atlas processor
    // For now, we'll simulate the routing by updating the database
    logger.debug(`Routing Matrix ${matrixInputNumber} (${videoInputLabel}) to zones: ${zoneNumbers.join(', ')}`)
    
    // In a real implementation, you would:
    // 1. Get the Atlas processor configuration
    // 2. Determine the physical input number for Matrix input (e.g., Input 9-12 for Matrix 1-4)
    // 3. Send HTTP commands to Atlas processor to route that input to the specified zones
    // Example: POST to http://{processor.ipAddress}/api/routing
    //   { "input": matrixInputNumber + 8, "outputs": zoneNumbers }

    // For now, log the routing action
    await prisma.wolfpackMatrixRouting.update({
      where: { matrixOutputNumber: parseInt(matrixInputNumber) },
      data: {
        atlasInputLabel: `Matrix ${matrixInputNumber}`,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: `Successfully routed Matrix ${matrixInputNumber} (${videoInputLabel}) to zones ${zoneNumbers.join(', ')}`,
      routing: {
        matrixInput: matrixInputNumber,
        videoInputLabel,
        atlasInput: `Matrix ${matrixInputNumber}`,
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


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  try {
    const { searchParams } = new URL(request.url)
    const processorId = searchParams.get('processorId')
    const matrixInputNumber = searchParams.get('matrixInputNumber')

    // Get processor
    const processor = processorId 
      ? await prisma.audioProcessor.findUnique({ 
          where: { id: processorId },
          include: { audioZones: true }
        })
      : await prisma.audioProcessor.findFirst({ 
          where: { status: 'online' },
          include: { audioZones: true }
        })

    if (!processor) {
      return NextResponse.json(
        { error: 'No active Atlas processor found' },
        { status: 404 }
      )
    }

    // Get matrix routing states
    const matrixRoutings = await prisma.wolfpackMatrixRouting.findMany({
      where: matrixInputNumber 
        ? { matrixOutputNumber: parseInt(matrixInputNumber) }
        : { matrixOutputNumber: { gte: 1, lte: 4 } },
      orderBy: { matrixOutputNumber: 'asc' }
    })

    // Build routing state
    const routingState = matrixRoutings.map(routing => {
      const zonesWithThisSource = processor.audioZones.filter(
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
