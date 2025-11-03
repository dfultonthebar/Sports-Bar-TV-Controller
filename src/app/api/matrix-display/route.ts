export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findFirst, or } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'


/**
 * Matrix Display API - Provides inputs and outputs formatted in rows of 4
 * 
 * This API returns Wolfpack inputs and outputs organized in rows of 4 to match
 * the physical hardware layout where each Wolfpack card has 4 inputs OR 4 outputs.
 * 
 * Features:
 * - Groups inputs/outputs into rows of 4
 * - Adds card information (which physical card each group belongs to)
 * - Provides metadata for responsive grid display
 * - Supports filtering by active/inactive status
 */

interface DisplayRow {
  cardNumber: number
  items: any[]
  startChannel: number
  endChannel: number
}

interface MatrixDisplayResponse {
  inputs: {
    total: number
    rows: DisplayRow[]
    itemsPerRow: number
  }
  outputs: {
    total: number
    rows: DisplayRow[]
    itemsPerRow: number
  }
  metadata: {
    totalCards: number
    itemsPerCard: number
  }
}

export async function GET(request: NextRequest) {
  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  try {
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    
    // Get active matrix configuration
    const config = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true },
      include: {
        inputs: {
          where: includeInactive ? {} : { isActive: true },
          orderBy: { channelNumber: 'asc' }
        },
        outputs: {
          where: includeInactive ? {} : { isActive: true },
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

    const ITEMS_PER_ROW = 4 // Wolfpack cards have 4 inputs OR 4 outputs per card

    // Format inputs into rows of 4
    const inputRows: DisplayRow[] = []
    for (let i = 0; i < config.inputs.length; i += ITEMS_PER_ROW) {
      const rowItems = config.inputs.slice(i, i + ITEMS_PER_ROW)
      const cardNumber = Math.floor(i / ITEMS_PER_ROW) + 1
      
      inputRows.push({
        cardNumber,
        items: rowItems,
        startChannel: rowItems[0]?.channelNumber || 0,
        endChannel: rowItems[rowItems.length - 1]?.channelNumber || 0
      })
    }

    // Format outputs into rows of 4
    const outputRows: DisplayRow[] = []
    for (let i = 0; i < config.outputs.length; i += ITEMS_PER_ROW) {
      const rowItems = config.outputs.slice(i, i + ITEMS_PER_ROW)
      const cardNumber = Math.floor(i / ITEMS_PER_ROW) + 1
      
      outputRows.push({
        cardNumber,
        items: rowItems,
        startChannel: rowItems[0]?.channelNumber || 0,
        endChannel: rowItems[rowItems.length - 1]?.channelNumber || 0
      })
    }

    const response: MatrixDisplayResponse = {
      inputs: {
        total: config.inputs.length,
        rows: inputRows,
        itemsPerRow: ITEMS_PER_ROW
      },
      outputs: {
        total: config.outputs.length,
        rows: outputRows,
        itemsPerRow: ITEMS_PER_ROW
      },
      metadata: {
        totalCards: Math.max(inputRows.length, outputRows.length),
        itemsPerCard: ITEMS_PER_ROW
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Error fetching matrix display data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch matrix display data' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
