
import { NextRequest, NextResponse } from 'next/server'
import { update, deleteRecord, eq } from '@/lib/db-helpers'
import { encrypt } from '@/lib/encryption'
import { schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AUTH)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { id } = await params
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

    const apiKey = await update('apiKeys', eq(schema.apiKeys.id, id), updateData)

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
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AUTH)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { id } = await params
    await deleteRecord('apiKeys', eq(schema.apiKeys.id, id))

    return NextResponse.json({ message: 'API key deleted successfully' })
  } catch (error) {
    console.error('Error deleting API key:', error)
    return NextResponse.json(
      { error: 'Failed to delete API key' },
      { status: 500 }
    )
  }
}
