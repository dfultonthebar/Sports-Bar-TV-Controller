import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { wolfpackMultiViewCards } from '@/db/schema'
import { logger } from '@sports-bar/logger'
import { v4 as uuidv4 } from 'uuid'
import { getAvailablePorts } from '@sports-bar/multiview'

// GET - List all multi-view cards and available serial ports
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const listPorts = searchParams.get('listPorts') === 'true'

    if (listPorts) {
      // Return available serial ports for UI dropdown
      const ports = await getAvailablePorts()
      return NextResponse.json({
        success: true,
        ports
      })
    }

    // Return all multi-view cards
    const cards = await db.select().from(wolfpackMultiViewCards)

    return NextResponse.json({
      success: true,
      cards: cards.map(c => ({
        id: c.id,
        name: c.name,
        startSlot: c.startSlot,
        endSlot: c.endSlot,
        serialPort: c.serialPort,
        baudRate: c.baudRate,
        currentMode: c.currentMode,
        inputAssignments: c.inputAssignments ? JSON.parse(c.inputAssignments) : null,
        status: c.status || 'unknown',
        lastSeen: c.lastSeen,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }))
    })
  } catch (error: any) {
    logger.error('[MULTIVIEW API] Failed to fetch cards:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST - Create a new multi-view card
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { name, startSlot, serialPort, baudRate, inputAssignments } = body

    if (!name || startSlot === undefined || !serialPort) {
      return NextResponse.json(
        { success: false, error: 'Name, startSlot, and serialPort are required' },
        { status: 400 }
      )
    }

    // Calculate endSlot (always 4 consecutive slots)
    const endSlot = startSlot + 3

    // Validate slot range
    if (startSlot < 1 || endSlot > 36) {
      return NextResponse.json(
        { success: false, error: 'Invalid slot range. Must be within 1-36.' },
        { status: 400 }
      )
    }

    const id = uuidv4()
    const now = new Date().toISOString()

    await db.insert(wolfpackMultiViewCards).values({
      id,
      name,
      startSlot,
      endSlot,
      serialPort,
      baudRate: baudRate || 115200,
      currentMode: 0, // Start with single window mode
      inputAssignments: inputAssignments ? JSON.stringify(inputAssignments) : null,
      status: 'unknown',
      createdAt: now,
      updatedAt: now
    })

    logger.info(`[MULTIVIEW API] Created multi-view card: ${name} (slots ${startSlot}-${endSlot}, ${serialPort})`)

    return NextResponse.json({
      success: true,
      id,
      message: 'Multi-view card created successfully'
    })
  } catch (error: any) {
    logger.error('[MULTIVIEW API] Failed to create card:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
