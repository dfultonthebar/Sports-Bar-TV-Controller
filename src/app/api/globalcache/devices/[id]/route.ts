import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/globalcache/devices/[id]
 * Get a specific Global Cache device
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const device = await prisma.globalCacheDevice.findUnique({
      where: { id: params.id },
      include: {
        ports: {
          orderBy: {
            portNumber: 'asc'
          }
        }
      }
    })

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      device
    })
  } catch (error) {
    console.error('Error fetching device:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch device' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/globalcache/devices/[id]
 * Delete a Global Cache device
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.globalCacheDevice.delete({
      where: { id: params.id }
    })

    console.log(`Global Cache device deleted: ${params.id}`)

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('Error deleting device:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete device' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/globalcache/devices/[id]
 * Update a Global Cache device
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, ipAddress, port, model } = body

    const device = await prisma.globalCacheDevice.update({
      where: { id: params.id },
      data: {
        name,
        ipAddress,
        port,
        model
      },
      include: {
        ports: true
      }
    })

    console.log(`Global Cache device updated: ${device.name}`)

    return NextResponse.json({
      success: true,
      device
    })
  } catch (error) {
    console.error('Error updating device:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update device' },
      { status: 500 }
    )
  }
}
