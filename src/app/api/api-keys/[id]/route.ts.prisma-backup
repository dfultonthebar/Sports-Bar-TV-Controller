
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
import { encrypt } from '@/lib/encryption'
import { apiKeys } from '@/db/schema'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { name, provider, keyValue, description, isActive } = await request.json()

    const updateData: any = {
      name,
      provider,
      description,
      isActive,
    }

    // Only update the key value if provided
    if (keyValue) {
      updateData.keyValue = encrypt(keyValue)
    }

    const apiKey = await prisma.apiKey.update({
      where: { id: params.id },
      data: updateData,
    })

    // Return without the actual key value
    const { keyValue: _, ...safeApiKey } = apiKey
    return NextResponse.json({ apiKey: safeApiKey })
  } catch (error) {
    console.error('Error updating API key:', error)
    return NextResponse.json(
      { error: 'Failed to update API key' }, 
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.apiKey.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'API key deleted successfully' })
  } catch (error) {
    console.error('Error deleting API key:', error)
    return NextResponse.json(
      { error: 'Failed to delete API key' }, 
      { status: 500 }
    )
  }
}
