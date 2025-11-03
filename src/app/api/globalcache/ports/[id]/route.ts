import { NextRequest, NextResponse } from 'next/server'
import { globalCachePorts, globalCacheDevices } from '@/db/schema'
import { db, schema } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
import { findFirst, update } from '@/lib/db-helpers'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

/**
 * PUT /api/globalcache/ports/[id]
 * Update a Global Cache port assignment
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { assignedTo, assignedDeviceId, irCodeSet, enabled } = body

    const updateData: any = {}
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo || null
    if (assignedDeviceId !== undefined) updateData.assignedDeviceId = assignedDeviceId || null
    if (irCodeSet !== undefined) updateData.irCodeSet = irCodeSet || null
    if (enabled !== undefined) updateData.enabled = enabled

    const port = await update('globalCachePorts', eq(schema.globalCachePorts.id, id), updateData)

    if (!port) {
      return NextResponse.json(
        { success: false, error: 'Port not found' },
        { status: 404 }
      )
    }

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
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { id } = await params
    const port = await findFirst('globalCachePorts', {
      where: eq(schema.globalCachePorts.id, id)
    })

    if (!port) {
      return NextResponse.json(
        { success: false, error: 'Port not found' },
        { status: 404 }
      )
    }

    // Fetch the device for this port
    const device = await findFirst('globalCacheDevices', {
      where: eq(schema.globalCacheDevices.id, port.deviceId)
    })

    const portWithDevice = {
      ...port,
      device: device || null
    }

    return NextResponse.json({
      success: true,
      port: portWithDevice
    })
  } catch (error) {
    console.error('Error fetching port:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch port' },
      { status: 500 }
    )
  }
}
