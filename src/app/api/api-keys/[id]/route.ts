
import { NextRequest, NextResponse } from 'next/server'
import { update, deleteRecord, eq } from '@/lib/db-helpers'
import { encrypt } from '@/lib/encryption'
import { schema } from '@/db'

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

    const apiKey = await update('apiKeys', eq(schema.apiKeys.id, params.id), updateData)

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
    await deleteRecord('apiKeys', eq(schema.apiKeys.id, params.id))

    return NextResponse.json({ message: 'API key deleted successfully' })
  } catch (error) {
    console.error('Error deleting API key:', error)
    return NextResponse.json(
      { error: 'Failed to delete API key' },
      { status: 500 }
    )
  }
}
