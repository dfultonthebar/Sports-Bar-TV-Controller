

import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
import { irDatabaseService } from '@/lib/services/ir-database'
import { logDatabaseOperation } from '@/lib/database-logger'
import crypto from 'crypto'
import { irDatabaseCredentials } from '@/db/schema'
import { findFirst, create, updateMany } from '@/lib/db-helpers'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { requireAuth } from '@/lib/auth'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

// Get encryption key from environment - REQUIRED, no default
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required for credential encryption')
  }
  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters')
  }
  return key.substring(0, 32)
}

function encrypt(text: string): string {
  const algorithm = 'aes-256-ctr'
  const secretKey = getEncryptionKey()
  const iv = crypto.randomBytes(16)

  const cipher = crypto.createCipheriv(algorithm, secretKey, iv)
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()])

  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function decrypt(hash: string): string {
  const algorithm = 'aes-256-ctr'
  const secretKey = getEncryptionKey()

  const parts = hash.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = Buffer.from(parts[1], 'hex')

  const decipher = crypto.createDecipheriv(algorithm, secretKey, iv)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])

  return decrypted.toString()
}

/**
 * GET /api/ir/credentials
 * Get current credentials status
 */
export async function GET(request: NextRequest) {
  // Authentication required - STAFF can view status
  const authResult = await requireAuth(request, 'STAFF', { auditAction: 'ir_credentials_read' })
  if (!authResult.authorized) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  const rateLimit = await withRateLimit(request, RateLimitConfigs.AUTH)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  logger.info('[IR-CREDENTIALS] Fetching credentials status')

  try {
    const credentials = await db.select().from(irDatabaseCredentials).where(eq(irDatabaseCredentials.isActive, true)).limit(1).get()

    if (credentials) {
      logger.info('[IR-CREDENTIALS] Credentials found', { email: credentials.email, hasApiKey: !!credentials.apiKey })

      return NextResponse.json({
        success: true,
        hasCredentials: true,
        isLoggedIn: !!credentials.apiKey,
        email: credentials.email,
        lastLogin: credentials.lastLogin
      })
    }

    logger.info('[IR-CREDENTIALS] No credentials found')

    return NextResponse.json({
      success: true,
      hasCredentials: false,
      isLoggedIn: false
    })
  } catch (error: any) {
    logger.error('[IR-CREDENTIALS] Error fetching credentials', { error: error.message })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ir/credentials
 * Save or update credentials
 */
export async function POST(request: NextRequest) {
  // Authentication required - ADMIN only for credential management
  const authResult = await requireAuth(request, 'ADMIN', { auditAction: 'ir_credentials_write' })
  if (!authResult.authorized) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  const rateLimit = await withRateLimit(request, RateLimitConfigs.AUTH)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Input validation
  const bodyValidation = await validateRequestBody(request, z.object({
    email: z.string().email(),
    password: z.string().min(1)
  }))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  logger.info('[IR-CREDENTIALS] Saving credentials')

  try {
    const { email, password } = bodyValidation.data

    logger.info('[IR-CREDENTIALS] Verifying credentials', { email })

    // Try to login to verify credentials
    const loginResult = await irDatabaseService.login(email, password)

    if (loginResult.Status !== 'success' || !loginResult.Account?.ApiKey) {
      logger.warn('[IR-CREDENTIALS] Login verification failed', { email, message: loginResult.Message })

      return NextResponse.json(
        { success: false, error: loginResult.Message || 'Login failed' },
        { status: 401 }
      )
    }

    // Encrypt password
    const encryptedPassword = encrypt(password)

    // Deactivate old credentials
    await db.update(irDatabaseCredentials)
      .set({ isActive: false })
      .where(eq(irDatabaseCredentials.isActive, true))
      .run()

    // Save new credentials
    const credentials = await create('irDatabaseCredentials', {
      email,
      password: encryptedPassword,
      apiKey: loginResult.Account.ApiKey,
      isActive: true,
      lastLogin: new Date().toISOString()
    })

    logger.info('[IR-CREDENTIALS] Credentials saved successfully', { email })

    logDatabaseOperation('IR_CREDENTIALS', 'save', {
      email
    })

    return NextResponse.json({
      success: true,
      message: 'Credentials saved and logged in successfully',
      email: credentials.email
    })
  } catch (error: any) {
    logger.error('[IR-CREDENTIALS] Error saving credentials', { error: error.message })

    logDatabaseOperation('IR_CREDENTIALS', 'save_error', {
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
