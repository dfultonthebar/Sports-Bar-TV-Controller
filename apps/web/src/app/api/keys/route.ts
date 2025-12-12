
import { NextRequest, NextResponse } from 'next/server'
import { findMany, create, update, deleteRecord, eq, desc } from '@/lib/db-helpers'
import { encrypt, decrypt } from '@/lib/encryption'
import { schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
// GET - List all API keys
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

    return NextResponse.json({ success: true, data: safeApiKeys })
  } catch (error) {
    logger.error('Error fetching API keys:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch API keys' },
      { status: 500 }
    )
  }
}

// POST - Create new API key
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AUTH)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    const { data } = bodyValidation
    const { name, provider, keyValue, description } = data
    if (!name || !provider || !keyValue) {
      return NextResponse.json(
        { success: false, error: 'Name, provider, and key value are required' },
        { status: 400 }
      )
    }

    // Encrypt the API key
    const encryptedKey = encrypt(keyValue as string)

    // Create the API key record
    const apiKey = await create('apiKeys', {
      name,
      provider,
      keyValue: encryptedKey,
      description: description || null,
      isActive: true,
    })

    // Remove keyValue from response
    const { keyValue: _, ...safeApiKey } = apiKey

    return NextResponse.json({
      success: true,
      message: 'API key created successfully',
      data: safeApiKey,
    })
  } catch (error) {
    logger.error('Error creating API key:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create API key' },
      { status: 500 }
    )
  }
}

// PUT - Update API key
export async function PUT(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AUTH)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    const { data } = bodyValidation
    const { id, name, provider, keyValue, description, isActive } = data
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'API key ID is required' },
        { status: 400 }
      )
    }

    const updateData: any = {}

    if (name) updateData.name = name
    if (provider) updateData.provider = provider
    if (keyValue) updateData.keyValue = encrypt(keyValue as string)
    if (description !== undefined) updateData.description = description
    if (isActive !== undefined) updateData.isActive = isActive

    const apiKey = await update('apiKeys', eq(schema.apiKeys.id, id as string), updateData)

    // Remove keyValue from response
    const { keyValue: _, ...safeApiKey } = apiKey

    return NextResponse.json({
      success: true,
      message: 'API key updated successfully',
      data: safeApiKey,
    })
  } catch (error) {
    logger.error('Error updating API key:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update API key' },
      { status: 500 }
    )
  }
}

// DELETE - Delete API key
export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AUTH)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'API key ID is required' },
        { status: 400 }
      )
    }

    await deleteRecord('apiKeys', eq(schema.apiKeys.id, id))

    return NextResponse.json({
      success: true,
      message: 'API key deleted successfully',
    })
  } catch (error) {
    logger.error('Error deleting API key:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete API key' },
      { status: 500 }
    )
  }
}
