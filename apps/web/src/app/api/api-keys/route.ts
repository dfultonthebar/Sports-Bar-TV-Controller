
import { NextRequest, NextResponse } from 'next/server'
import { findMany, create, desc, eq } from '@/lib/db-helpers'
import { encrypt, decrypt } from '@/lib/encryption'
import { schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

import { logger } from '@sports-bar/logger'
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AUTH)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const apiKeysList = await findMany('apiKeys', {
      orderBy: desc(schema.apiKeys.createdAt)
    })

    // Filter out keyValue for security
    const safeApiKeys = apiKeysList.map(({ keyValue, ...safe }) => safe)

    return NextResponse.json({ apiKeys: safeApiKeys })
  } catch (error) {
    logger.error('Error fetching API keys:', error)
    return NextResponse.json(
      { error: 'Failed to fetch API keys' }, 
      { status: 500 }
    )
  }
}

// Validation schema for creating API keys
const createApiKeySchema = z.object({
  name: ValidationSchemas.apiKeyName,
  provider: ValidationSchemas.apiKeyProvider,
  keyValue: ValidationSchemas.apiKeyValue,
  description: z.string().max(500).optional()
})

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AUTH)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Validate request body
    const validation = await validateRequestBody(request, createApiKeySchema)
    if (isValidationError(validation)) return validation.error
    const { data } = validation
    const { name, provider, keyValue, description } = data

    // Encrypt the API key before storing
    const encryptedKey = encrypt(keyValue)

    const apiKey = await create('apiKeys', {
      name,
      provider,
      keyValue: encryptedKey,
      description,
    })

    // Return without the actual key value
    const { keyValue: _, ...safeApiKey } = apiKey
    return NextResponse.json({ apiKey: safeApiKey })
  } catch (error) {
    logger.error('Error creating API key:', error)
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    )
  }
}
