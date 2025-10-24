import { NextRequest, NextResponse } from 'next/server'
import { globalCachePorts } from '@/db/schema'
import { prisma } from '@/db/prisma-adapter'
import { db } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
// Converted to Drizzle ORM

/**
 * PUT /api/globalcache/ports/[id]
 * Update a Global Cache port assignment
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { assignedTo, assignedDeviceId, irCodeSet, enabled } = body

    const port = await db.update(globalCachePorts).set({
        assignedTo: assignedTo || null,
        assignedDeviceId: assignedDeviceId || null,
        irCodeSet: irCodeSet || null,
        enabled: enabled !== undefined ? enabled : undefined
      }).where(eq(globalCachePorts.id, params.id)).returning().get()

    console.log(`Global Cache port updated: Port ${port.portNumber} assigned to ${assignedTo || 'none'}`)

    return NextResponse.json({
      success: true,
      port
    })
  } catch (error) {
    console.error('Error updating port:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update port' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/globalcache/ports/[id]
 * Get a specific port
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const port = await prisma.globalCachePort.findUnique({
      where: { id: params.id },
      include: {
        device: true
      }
    })

    if (!port) {
      return NextResponse.json(
        { success: false, error: 'Port not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      port
    })
  } catch (error) {
    console.error('Error fetching port:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch port' },
      { status: 500 }
    )
  }
}
