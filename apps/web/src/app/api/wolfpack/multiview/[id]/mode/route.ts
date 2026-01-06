import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { wolfpackMultiViewCards } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import {
  setMode,
  MultiViewMode,
  MultiViewCardConfig,
  MultiViewInputAssignments,
  MULTIVIEW_MODE_NAMES
} from '@sports-bar/multiview'

// POST - Change display mode on a multi-view card
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const { mode, inputAssignments } = body

    // Validate mode
    if (mode === undefined || mode < 0 || mode > 7) {
      return NextResponse.json(
        { success: false, error: 'Invalid mode. Must be 0-7.' },
        { status: 400 }
      )
    }

    // Get card from database
    const [card] = await db.select().from(wolfpackMultiViewCards).where(eq(wolfpackMultiViewCards.id, id))

    if (!card) {
      return NextResponse.json(
        { success: false, error: 'Multi-view card not found' },
        { status: 404 }
      )
    }

    // Build config for the service
    const config: MultiViewCardConfig = {
      id: card.id,
      name: card.name,
      startSlot: card.startSlot,
      endSlot: card.endSlot,
      serialPort: card.serialPort,
      baudRate: card.baudRate,
      currentMode: card.currentMode as MultiViewMode,
      inputAssignments: card.inputAssignments ? JSON.parse(card.inputAssignments) : null,
      status: card.status as 'online' | 'offline' | 'unknown'
    }

    // Determine input assignments to use
    const inputs: MultiViewInputAssignments | undefined = inputAssignments || config.inputAssignments || undefined

    logger.info(`[MULTIVIEW API] Setting ${card.name} to mode ${mode} (${MULTIVIEW_MODE_NAMES[mode as MultiViewMode]})`)

    // Send command to card
    const result = await setMode(config, mode as MultiViewMode, inputs)

    if (result.success) {
      // Update database with new mode and inputs
      const now = new Date().toISOString()
      await db.update(wolfpackMultiViewCards)
        .set({
          currentMode: mode,
          inputAssignments: inputs ? JSON.stringify(inputs) : card.inputAssignments,
          status: 'online',
          lastSeen: now,
          updatedAt: now
        })
        .where(eq(wolfpackMultiViewCards.id, id))
    } else {
      // Mark as offline if command failed
      await db.update(wolfpackMultiViewCards)
        .set({
          status: 'offline',
          updatedAt: new Date().toISOString()
        })
        .where(eq(wolfpackMultiViewCards.id, id))
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      mode,
      modeName: MULTIVIEW_MODE_NAMES[mode as MultiViewMode]
    })
  } catch (error: any) {
    logger.error('[MULTIVIEW API] Mode change failed:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
