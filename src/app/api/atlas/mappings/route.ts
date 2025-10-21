
/**
 * Atlas Mappings API Endpoint
 * 
 * GET /api/atlas/mappings?processorId=xxx - Get all mappings for a processor
 * POST /api/atlas/mappings - Create a new mapping
 * PUT /api/atlas/mappings - Update an existing mapping
 * DELETE /api/atlas/mappings?id=xxx - Delete a mapping
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/drizzle'
import { atlasMappings } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

// GET - Fetch all mappings for a processor
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const processorId = searchParams.get('processorId')
    const id = searchParams.get('id')

    if (id) {
      // Get single mapping by ID
      const mapping = await db.query.atlasMappings.findFirst({
        where: eq(atlasMappings.id, id)
      })

      if (!mapping) {
        return NextResponse.json(
          { success: false, error: 'Mapping not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        data: mapping
      })
    }

    if (!processorId) {
      return NextResponse.json(
        { success: false, error: 'processorId is required' },
        { status: 400 }
      )
    }

    const mappings = await db.query.atlasMappings.findMany({
      where: eq(atlasMappings.processorId, processorId),
      orderBy: (atlasMappings, { asc }) => [asc(atlasMappings.paramType), asc(atlasMappings.appKey)]
    })

    return NextResponse.json({
      success: true,
      data: mappings
    })
  } catch (error) {
    console.error('[Atlas Mappings GET] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch mappings' 
      },
      { status: 500 }
    )
  }
}

// POST - Create a new mapping
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      processorId,
      appKey,
      atlasParam,
      paramType,
      paramCategory,
      minValue,
      maxValue,
      minPercent,
      maxPercent,
      format = 'val',
      description,
      isReadOnly = false
    } = body

    // Validate required fields
    if (!processorId || !appKey || !atlasParam || !paramType || !paramCategory) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if mapping with same appKey already exists
    const existingMapping = await db.query.atlasMappings.findFirst({
      where: and(
        eq(atlasMappings.processorId, processorId),
        eq(atlasMappings.appKey, appKey)
      )
    })

    if (existingMapping) {
      return NextResponse.json(
        { success: false, error: `Mapping with appKey '${appKey}' already exists` },
        { status: 409 }
      )
    }

    // Create mapping
    const [newMapping] = await db.insert(atlasMappings).values({
      processorId,
      appKey,
      atlasParam,
      paramType,
      paramCategory,
      minValue,
      maxValue,
      minPercent,
      maxPercent,
      format,
      description,
      isReadOnly
    }).returning()

    return NextResponse.json({
      success: true,
      data: newMapping
    }, { status: 201 })
  } catch (error) {
    console.error('[Atlas Mappings POST] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create mapping' 
      },
      { status: 500 }
    )
  }
}

// PUT - Update an existing mapping
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      appKey,
      atlasParam,
      paramType,
      paramCategory,
      minValue,
      maxValue,
      minPercent,
      maxPercent,
      format,
      description,
      isReadOnly
    } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      )
    }

    // Check if mapping exists
    const existingMapping = await db.query.atlasMappings.findFirst({
      where: eq(atlasMappings.id, id)
    })

    if (!existingMapping) {
      return NextResponse.json(
        { success: false, error: 'Mapping not found' },
        { status: 404 }
      )
    }

    // Update mapping
    const updateData: any = {
      updatedAt: new Date().toISOString()
    }

    if (appKey !== undefined) updateData.appKey = appKey
    if (atlasParam !== undefined) updateData.atlasParam = atlasParam
    if (paramType !== undefined) updateData.paramType = paramType
    if (paramCategory !== undefined) updateData.paramCategory = paramCategory
    if (minValue !== undefined) updateData.minValue = minValue
    if (maxValue !== undefined) updateData.maxValue = maxValue
    if (minPercent !== undefined) updateData.minPercent = minPercent
    if (maxPercent !== undefined) updateData.maxPercent = maxPercent
    if (format !== undefined) updateData.format = format
    if (description !== undefined) updateData.description = description
    if (isReadOnly !== undefined) updateData.isReadOnly = isReadOnly

    const [updatedMapping] = await db.update(atlasMappings)
      .set(updateData)
      .where(eq(atlasMappings.id, id))
      .returning()

    return NextResponse.json({
      success: true,
      data: updatedMapping
    })
  } catch (error) {
    console.error('[Atlas Mappings PUT] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update mapping' 
      },
      { status: 500 }
    )
  }
}

// DELETE - Delete a mapping
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      )
    }

    // Check if mapping exists
    const existingMapping = await db.query.atlasMappings.findFirst({
      where: eq(atlasMappings.id, id)
    })

    if (!existingMapping) {
      return NextResponse.json(
        { success: false, error: 'Mapping not found' },
        { status: 404 }
      )
    }

    // Delete mapping
    await db.delete(atlasMappings)
      .where(eq(atlasMappings.id, id))

    return NextResponse.json({
      success: true,
      message: 'Mapping deleted successfully'
    })
  } catch (error) {
    console.error('[Atlas Mappings DELETE] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete mapping' 
      },
      { status: 500 }
    )
  }
}
