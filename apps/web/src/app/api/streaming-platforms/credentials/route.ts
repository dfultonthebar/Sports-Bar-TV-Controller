/**
 * Streaming Credentials API
 * Uses database storage with AES-256-GCM encryption for passwords
 */

import { NextRequest, NextResponse } from 'next/server'
import { encryptToString, decryptFromString } from '@/lib/security/encryption'
import { withRateLimit, addRateLimitHeaders } from '@/lib/rate-limiting/middleware'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, ValidationSchemas, isValidationError } from '@/lib/validation'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * Decrypt password from stored credential
 * Handles both old base64 encoding and new AES-256-GCM encryption
 */
function decryptPassword(credential: { passwordHash: string; encryptionVersion: string | null; encrypted: boolean | null }): string {
  try {
    if (credential.encryptionVersion === 'aes-256-gcm') {
      return decryptFromString(credential.passwordHash)
    }
    if (credential.encrypted && credential.passwordHash) {
      return Buffer.from(credential.passwordHash, 'base64').toString()
    }
    return credential.passwordHash
  } catch (error) {
    logger.error('Error decrypting password:', error)
    throw new Error('Failed to decrypt password')
  }
}

/**
 * GET /api/streaming-platforms/credentials
 * Retrieve all stored credentials (without passwords)
 */
export async function GET(request: NextRequest) {
  try {
    const rows = await db.select().from(schema.streamingCredentials)

    const safeCredentials = rows.map(cred => ({
      id: cred.id,
      platformId: cred.platformId,
      username: cred.username,
      encrypted: cred.encrypted,
      encryptionVersion: cred.encryptionVersion,
      lastUpdated: cred.updatedAt,
      status: cred.status,
      lastSync: cred.lastSync,
    }))

    return NextResponse.json({ success: true, credentials: safeCredentials })
  } catch (error) {
    logger.error('Error getting credentials:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load credentials' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/streaming-platforms/credentials
 * Add or update streaming platform credentials
 */
export async function POST(request: NextRequest) {
  const rateLimitCheck = await withRateLimit(request, 'AUTH')
  if (!rateLimitCheck.allowed) return rateLimitCheck.response!

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

    if (!process.env.ENCRYPTION_KEY) {
      return NextResponse.json(
        { success: false, error: 'Encryption not configured. Please set ENCRYPTION_KEY environment variable.' },
        { status: 500 }
      )
    }

    const encryptedPassword = encryptToString(password)
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const existing = await db.select().from(schema.streamingCredentials)
      .where(eq(schema.streamingCredentials.platformId, platformId))
      .get()

    let credentialId: string

    if (existing) {
      await db.update(schema.streamingCredentials)
        .set({
          username,
          passwordHash: encryptedPassword,
          encrypted: true,
          encryptionVersion: 'aes-256-gcm',
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
        passwordHash: encryptedPassword,
        encrypted: true,
        encryptionVersion: 'aes-256-gcm',
        status: 'active',
        lastSync: now,
        createdAt: now,
        updatedAt: now,
      })
    }

    const jsonResponse = NextResponse.json({
      success: true,
      credential: {
        id: credentialId,
        platformId,
        username,
        encrypted: true,
        encryptionVersion: 'aes-256-gcm',
        lastUpdated: now,
        status: 'active',
      },
    })
    return addRateLimitHeaders(jsonResponse, rateLimitCheck.result)
  } catch (error) {
    logger.error('Error saving credentials:', error)
    const jsonResponse = NextResponse.json(
      {
        success: false,
        error: 'Failed to save credentials',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
    return addRateLimitHeaders(jsonResponse, rateLimitCheck.result)
  }
}

/**
 * DELETE /api/streaming-platforms/credentials
 * Remove streaming platform credentials
 */
export async function DELETE(request: NextRequest) {
  const bodyValidation = await validateRequestBody(request, z.object({
    platformId: z.string().min(1)
  }))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  try {
    const { platformId } = bodyValidation.data

    await db.delete(schema.streamingCredentials)
      .where(eq(schema.streamingCredentials.platformId, platformId))

    return NextResponse.json({
      success: true,
      message: 'Credentials removed successfully',
    })
  } catch (error) {
    logger.error('Error removing credentials:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove credentials' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/streaming-platforms/credentials
 * Verify that credentials can be decrypted
 */
export async function PUT(request: NextRequest) {
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.streamingCredentials)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { platformId } = bodyValidation.data

  try {
    if (!platformId) {
      return NextResponse.json(
        { success: false, error: 'Platform ID is required' },
        { status: 400 }
      )
    }

    const credential = await db.select().from(schema.streamingCredentials)
      .where(eq(schema.streamingCredentials.platformId, platformId))
      .get()

    if (!credential) {
      return NextResponse.json(
        { success: false, error: 'Credentials not found' },
        { status: 404 }
      )
    }

    try {
      decryptPassword(credential)
      return NextResponse.json({
        success: true,
        message: 'Credentials verified successfully',
        encryptionVersion: credential.encryptionVersion,
        canDecrypt: true,
      })
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to decrypt credentials',
        encryptionVersion: credential.encryptionVersion,
        canDecrypt: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  } catch (error) {
    logger.error('Error verifying credentials:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to verify credentials' },
      { status: 500 }
    )
  }
}
