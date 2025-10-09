
import { NextRequest, NextResponse } from 'next/server'
import prisma from "@/lib/prisma"


// PUT /api/channel-presets/[id] - Update a preset
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { name, channelNumber, deviceType, order, isActive } = body

    // Check if preset exists
    const existingPreset = await prisma.channelPreset.findUnique({
      where: { id }
    })

    if (!existingPreset) {
      return NextResponse.json(
        { success: false, error: 'Preset not found' },
        { status: 404 }
      )
    }

    // Build update data
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (channelNumber !== undefined) updateData.channelNumber = channelNumber
    if (deviceType !== undefined) {
      if (!['cable', 'directv'].includes(deviceType)) {
        return NextResponse.json(
          { success: false, error: 'Invalid deviceType' },
          { status: 400 }
        )
      }
      updateData.deviceType = deviceType
    }
    if (order !== undefined) updateData.order = order
    if (isActive !== undefined) updateData.isActive = isActive

    const preset = await prisma.channelPreset.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ 
      success: true, 
      preset 
    })
  } catch (error) {
    console.error('Error updating channel preset:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update channel preset',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/channel-presets/[id] - Delete a preset
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Check if preset exists
    const existingPreset = await prisma.channelPreset.findUnique({
      where: { id }
    })

    if (!existingPreset) {
      return NextResponse.json(
        { success: false, error: 'Preset not found' },
        { status: 404 }
      )
    }

    await prisma.channelPreset.delete({
      where: { id }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Preset deleted successfully' 
    })
  } catch (error) {
    console.error('Error deleting channel preset:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete channel preset',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
