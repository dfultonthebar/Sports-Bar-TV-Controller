import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { wolfpackMultiViewCards } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

// GET - Get a single multi-view card
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [card] = await db.select().from(wolfpackMultiViewCards).where(eq(wolfpackMultiViewCards.id, id))

    if (!card) {
      return NextResponse.json(
        { success: false, error: 'Multi-view card not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      card: {
        ...card,
        inputAssignments: card.inputAssignments ? JSON.parse(card.inputAssignments) : null
      }
    })
  } catch (error: any) {
    logger.error('[MULTIVIEW API] Failed to fetch card:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// PUT - Update a multi-view card
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const { name, startSlot, serialPort, baudRate, inputAssignments } = body

    const updateData: any = {
      updatedAt: new Date().toISOString()
    }

    if (name !== undefined) updateData.name = name
    if (serialPort !== undefined) updateData.serialPort = serialPort
    if (baudRate !== undefined) updateData.baudRate = baudRate
    if (inputAssignments !== undefined) {
      updateData.inputAssignments = inputAssignments ? JSON.stringify(inputAssignments) : null
    }

    // If startSlot changed, recalculate endSlot
    if (startSlot !== undefined) {
      if (startSlot < 1 || startSlot + 3 > 36) {
        return NextResponse.json(
          { success: false, error: 'Invalid slot range. Must be within 1-36.' },
          { status: 400 }
        )
      }
      updateData.startSlot = startSlot
      updateData.endSlot = startSlot + 3
    }

    await db.update(wolfpackMultiViewCards)
      .set(updateData)
      .where(eq(wolfpackMultiViewCards.id, id))

    logger.info(`[MULTIVIEW API] Updated multi-view card: ${id}`)

    return NextResponse.json({
      success: true,
      message: 'Multi-view card updated successfully'
    })
  } catch (error: any) {
    logger.error('[MULTIVIEW API] Failed to update card:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Delete a multi-view card
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await db.delete(wolfpackMultiViewCards).where(eq(wolfpackMultiViewCards.id, id))

    logger.info(`[MULTIVIEW API] Deleted multi-view card: ${id}`)

    return NextResponse.json({
      success: true,
      message: 'Multi-view card deleted successfully'
    })
  } catch (error: any) {
    logger.error('[MULTIVIEW API] Failed to delete card:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
