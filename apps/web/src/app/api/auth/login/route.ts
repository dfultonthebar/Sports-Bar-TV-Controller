/**
 * Login API Endpoint
 *
 * POST /api/auth/login
 * - Validates PIN
 * - Creates session
 * - Sets httpOnly cookie
 * - Returns session info
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validatePIN, createSession, logAuditAction, AUTH_CONFIG } from '@/lib/auth'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

function getIpAddress(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') || 'unknown'
}

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AUTH)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const ipAddress = getIpAddress(request)
  const userAgent = request.headers.get('user-agent') || undefined

  try {
    const body = await request.json()
    const { pin } = body

    if (!pin) {
      return NextResponse.json(
        { success: false, error: 'PIN is required' },
        { status: 400 }
      )
    }

    // Validate PIN
    const pinResult = await validatePIN(pin)

    if (!pinResult) {
      // Log failed login attempt
      await logAuditAction({
        action: 'LOGIN_FAILED',
        resource: 'authentication',
        endpoint: '/api/auth/login',
        method: 'POST',
        ipAddress,
        userAgent,
        success: false,
        errorMessage: 'Invalid PIN',
      })

      return NextResponse.json(
        { success: false, error: 'Invalid PIN' },
        { status: 401 }
      )
    }

    // Create session
    const sessionResult = await createSession(
      pinResult.role,
      ipAddress,
      userAgent
    )

    if (!sessionResult.success || !sessionResult.sessionId || !sessionResult.expiresAt) {
      logger.error('Failed to create session:', { data: sessionResult.error })

      return NextResponse.json(
        { success: false, error: 'Failed to create session' },
        { status: 500 }
      )
    }

    // Set session cookie
    const cookieStore = await cookies()
    cookieStore.set(AUTH_CONFIG.COOKIE_NAME, sessionResult.sessionId, {
      ...AUTH_CONFIG.COOKIE_OPTIONS,
      expires: sessionResult.expiresAt,
    })

    // Log successful login
    await logAuditAction({
      action: 'LOGIN_SUCCESS',
      resource: 'authentication',
      endpoint: '/api/auth/login',
      method: 'POST',
      ipAddress,
      userAgent,
      sessionId: sessionResult.sessionId,
      success: true,
      metadata: { role: pinResult.role },
    })

    logger.info(`User logged in successfully: ${pinResult.role} role`)

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      session: {
        role: pinResult.role,
        expiresAt: sessionResult.expiresAt.toISOString(),
      },
    })
  } catch (error) {
    logger.error('Login error:', error)

    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    )
  }
}
