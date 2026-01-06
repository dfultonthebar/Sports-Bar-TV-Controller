
import { NextRequest, NextResponse } from 'next/server'
import { update, deleteRecord, eq } from '@/lib/db-helpers'
import { encrypt } from '@/lib/encryption'
import { schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequest, ValidationSchemas } from '@/lib/validation'

import { logger } from '@/lib/logger'
// Validation schemas
const updateApiKeySchema = z.object({
  name: ValidationSchemas.apiKeyName.optional(),
  provider: ValidationSchemas.apiKeyProvider.optional(),
  keyValue: ValidationSchemas.apiKeyValue.optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional()
})

const pathParamsSchema = z.object({
  id: ValidationSchemas.uuid
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AUTH)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const resolvedParams = await params

    // Validate path parameters and request body
    const validation = await validateRequest(request, {
      body: updateApiKeySchema,
      params: { data: resolvedParams, schema: pathParamsSchema }
    })

    if (!validation.success) return validation.error

    const { id } = validation.data.params!
    const { name, provider, keyValue, description, isActive } = validation.data.body!

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
    logger.error('Error updating API key:', error)
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
    const resolvedParams = await params

    // Validate path parameters
    const validation = await validateRequest(request, {
      params: { data: resolvedParams, schema: pathParamsSchema }
    })

    if (!validation.success) return validation.error

    const { id } = validation.data.params!
    await deleteRecord('apiKeys', eq(schema.apiKeys.id, id))

    return NextResponse.json({ message: 'API key deleted successfully' })
  } catch (error) {
    logger.error('Error deleting API key:', error)
    return NextResponse.json(
      { error: 'Failed to delete API key' },
      { status: 500 }
    )
  }
}
