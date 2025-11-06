

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

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
// Simple encryption (in production, use proper encryption)
function encrypt(text: string): string {
  const algorithm = 'aes-256-ctr'
  const secretKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32'
  const iv = crypto.randomBytes(16)
  
  const cipher = crypto.createCipheriv(algorithm, secretKey.substring(0, 32), iv)
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()])
  
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function decrypt(hash: string): string {
  const algorithm = 'aes-256-ctr'
  const secretKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32'
  
  const parts = hash.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = Buffer.from(parts[1], 'hex')
  
  const decipher = crypto.createDecipheriv(algorithm, secretKey.substring(0, 32), iv)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  
  return decrypted.toString()
}

/**
 * GET /api/ir/credentials
 * Get current credentials status
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AUTH)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('📋 [IR CREDENTIALS] Fetching credentials status')
  logger.info('   Timestamp:', { data: new Date().toISOString() })
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const credentials = await db.select().from(irDatabaseCredentials).where(eq(irDatabaseCredentials.isActive, true)).limit(1).get()

    if (credentials) {
      logger.info('✅ [IR CREDENTIALS] Credentials found')
      logger.info('   Email:', { data: credentials.email })
      logger.info('   Has API Key:', { data: !!credentials.apiKey })
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      return NextResponse.json({
        success: true,
        hasCredentials: true,
        isLoggedIn: !!credentials.apiKey,
        email: credentials.email,
        lastLogin: credentials.lastLogin
      })
    }

    logger.info('ℹ️  [IR CREDENTIALS] No credentials found')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json({
      success: true,
      hasCredentials: false,
      isLoggedIn: false
    })
  } catch (error: any) {
    logger.error('❌ [IR CREDENTIALS] Error:', error)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

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
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AUTH)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('💾 [IR CREDENTIALS] Saving credentials')
  logger.info('   Timestamp:', { data: new Date().toISOString() })
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const { email, password } = bodyValidation.data

    if (!email || !password) {
      logger.info('❌ [IR CREDENTIALS] Email and password required')
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    logger.info('   Email:', email)

    // Try to login to verify credentials
    const loginResult = await irDatabaseService.login(email as string, password as string)

    if (loginResult.Status !== 'success' || !loginResult.Account?.ApiKey) {
      logger.info('❌ [IR CREDENTIALS] Login failed')
      logger.info('   Message:', { data: loginResult.Message })
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      return NextResponse.json(
        { success: false, error: loginResult.Message || 'Login failed' },
        { status: 401 }
      )
    }

    // Encrypt password
    const encryptedPassword = encrypt(password as string)

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

    logger.info('✅ [IR CREDENTIALS] Credentials saved successfully')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_CREDENTIALS', 'save', {
      email
    })

    return NextResponse.json({
      success: true,
      message: 'Credentials saved and logged in successfully',
      email: credentials.email
    })
  } catch (error: any) {
    logger.error('❌ [IR CREDENTIALS] Error:', error)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_CREDENTIALS', 'save_error', {
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
