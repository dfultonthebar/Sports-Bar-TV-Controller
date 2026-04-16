import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, ValidationSchemas, isValidationError } from '@/lib/validation'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// Simple encryption helper (legacy — new credentials use AES-256-GCM via /credentials route)
function simpleEncrypt(text: string): string {
  return Buffer.from(text).toString('base64')
}

// Mock authentication function
async function authenticateWithPlatform(platformId: string, username: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info(`[STREAMING AUTH] Authenticating with ${platformId} for user: ${username}`)

    switch (platformId) {
      case 'youtube-tv':
        if (username.includes('@') && password.length >= 6) return { success: true }
        return { success: false, error: 'Invalid YouTube TV credentials' }
      case 'hulu-live':
      case 'paramount-plus':
      case 'peacock':
      case 'amazon-prime':
        if (username && password) return { success: true }
        return { success: false, error: `Invalid ${platformId} credentials` }
      default:
        return { success: false, error: 'Unsupported platform' }
    }
  } catch (error) {
    logger.error('Authentication error:', error)
    return { success: false, error: 'Authentication service error' }
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AUTH)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, ValidationSchemas.streamingCredentials)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { platformId, username, password } = bodyValidation.data

  try {
    if (!platformId || !username || !password) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const authResult = await authenticateWithPlatform(platformId, username, password)

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Authentication failed' },
        { status: 401 }
      )
    }

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const existing = await db.select().from(schema.streamingCredentials)
      .where(eq(schema.streamingCredentials.platformId, platformId))
      .get()

    let credentialId: string

    if (existing) {
      await db.update(schema.streamingCredentials)
        .set({
          username,
          passwordHash: simpleEncrypt(password),
          encrypted: true,
          encryptionVersion: 'base64',
          status: 'active',
          lastSync: now,
          updatedAt: now,
        })
        .where(eq(schema.streamingCredentials.platformId, platformId))
      credentialId = existing.id
    } else {
      credentialId = `cred_${Date.now()}`
      await db.insert(schema.streamingCredentials).values({
        id: credentialId,
        platformId,
        username,
        passwordHash: simpleEncrypt(password),
        encrypted: true,
        encryptionVersion: 'base64',
        status: 'active',
        lastSync: now,
        createdAt: now,
        updatedAt: now,
      })
    }

    logger.info(`[STREAMING AUTH] Authenticated and saved credentials for ${platformId}`)

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      credential: {
        id: credentialId,
        platformId,
        username,
        encrypted: true,
        lastUpdated: now,
        status: 'active',
        lastSync: now,
      },
    })
  } catch (error) {
    logger.error('Error in authentication:', error)
    return NextResponse.json(
      { success: false, error: 'Authentication service error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AUTH)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, z.object({
    platformId: z.string()
  }))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  try {
    const { platformId } = bodyValidation.data

    if (!platformId) {
      return NextResponse.json(
        { success: false, error: 'Platform ID is required' },
        { status: 400 }
      )
    }

    await db.delete(schema.streamingCredentials)
      .where(eq(schema.streamingCredentials.platformId, platformId))

    logger.info(`[STREAMING AUTH] Logged out from ${platformId}`)

    return NextResponse.json({
      success: true,
      message: 'Successfully logged out',
    })
  } catch (error) {
    logger.error('Error during logout:', error)
    return NextResponse.json(
      { success: false, error: 'Logout service error' },
      { status: 500 }
    )
  }
}
