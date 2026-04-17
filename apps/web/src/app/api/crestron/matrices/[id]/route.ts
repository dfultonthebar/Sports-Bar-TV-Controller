import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { crestronMatrices } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

// GET - Get a single Crestron matrix
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [matrix] = await db.select().from(crestronMatrices).where(eq(crestronMatrices.id, id))

    if (!matrix) {
      return NextResponse.json(
        { success: false, error: 'Matrix not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      matrix
    })
  } catch (error: any) {
    logger.error('[CRESTRON API] Failed to fetch matrix:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// PUT - Update a Crestron matrix
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const { name, model, ipAddress, port, username, password, description, inputs, outputs } = body

    const updateData: any = {
      updatedAt: new Date().toISOString()
    }

    if (name !== undefined) updateData.name = name
    if (model !== undefined) updateData.model = model
    if (ipAddress !== undefined) updateData.ipAddress = ipAddress
    if (port !== undefined) updateData.port = port
    if (username !== undefined) updateData.username = username
    if (password !== undefined && password !== '') updateData.password = password
    if (description !== undefined) updateData.description = description
    if (inputs !== undefined) updateData.inputs = inputs
    if (outputs !== undefined) updateData.outputs = outputs

    await db.update(crestronMatrices)
      .set(updateData)
      .where(eq(crestronMatrices.id, id))

    logger.info(`[CRESTRON API] Updated matrix: ${id}`)

    return NextResponse.json({
      success: true,
      message: 'Matrix updated successfully'
    })
  } catch (error: any) {
    logger.error('[CRESTRON API] Failed to update matrix:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Delete a Crestron matrix
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await db.delete(crestronMatrices).where(eq(crestronMatrices.id, id))

    logger.info(`[CRESTRON API] Deleted matrix: ${id}`)

    return NextResponse.json({
      success: true,
      message: 'Matrix deleted successfully'
    })
  } catch (error: any) {
    logger.error('[CRESTRON API] Failed to delete matrix:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
