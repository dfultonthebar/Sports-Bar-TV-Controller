

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

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 [IR CREDENTIALS] Fetching credentials status')
  console.log('   Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const credentials = await db.select().from(irDatabaseCredentials).where(eq(irDatabaseCredentials.isActive, true)).limit(1).get()

    if (credentials) {
      console.log('✅ [IR CREDENTIALS] Credentials found')
      console.log('   Email:', credentials.email)
      console.log('   Has API Key:', !!credentials.apiKey)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      return NextResponse.json({
        success: true,
        hasCredentials: true,
        isLoggedIn: !!credentials.apiKey,
        email: credentials.email,
        lastLogin: credentials.lastLogin
      })
    }

    console.log('ℹ️  [IR CREDENTIALS] No credentials found')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json({
      success: true,
      hasCredentials: false,
      isLoggedIn: false
    })
  } catch (error: any) {
    console.error('❌ [IR CREDENTIALS] Error:', error)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

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

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('💾 [IR CREDENTIALS] Saving credentials')
  console.log('   Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      console.log('❌ [IR CREDENTIALS] Email and password required')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    console.log('   Email:', email)

    // Try to login to verify credentials
    const loginResult = await irDatabaseService.login(email, password)

    if (loginResult.Status !== 'success' || !loginResult.Account?.ApiKey) {
      console.log('❌ [IR CREDENTIALS] Login failed')
      console.log('   Message:', loginResult.Message)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
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

    console.log('✅ [IR CREDENTIALS] Credentials saved successfully')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_CREDENTIALS', 'save', {
      email
    })

    return NextResponse.json({
      success: true,
      message: 'Credentials saved and logged in successfully',
      email: credentials.email
    })
  } catch (error: any) {
    console.error('❌ [IR CREDENTIALS] Error:', error)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_CREDENTIALS', 'save_error', {
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
