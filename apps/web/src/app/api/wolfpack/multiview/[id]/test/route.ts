import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { wolfpackMultiViewCards } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { testConnection } from '@sports-bar/multiview'

// POST - Test connection to a multi-view card
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get card from database
    const [card] = await db.select().from(wolfpackMultiViewCards).where(eq(wolfpackMultiViewCards.id, id))

    if (!card) {
      return NextResponse.json(
        { success: false, error: 'Multi-view card not found' },
        { status: 404 }
      )
    }

    logger.info(`[MULTIVIEW API] Testing connection to ${card.name} on ${card.serialPort}`)

    // Test serial connection
    const result = await testConnection(card.serialPort, card.baudRate)

    // Update status in database
    const now = new Date().toISOString()
    await db.update(wolfpackMultiViewCards)
      .set({
        status: result.success ? 'online' : 'offline',
        lastSeen: result.success ? now : card.lastSeen,
        updatedAt: now
      })
      .where(eq(wolfpackMultiViewCards.id, id))

    return NextResponse.json({
      success: result.success,
      message: result.message,
      serialPort: card.serialPort,
      baudRate: card.baudRate,
      response: result.response
    })
  } catch (error: any) {
    logger.error('[MULTIVIEW API] Connection test failed:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
