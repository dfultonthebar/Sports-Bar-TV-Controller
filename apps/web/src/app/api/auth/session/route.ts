/**
 * Session API Endpoint
 *
 * GET /api/auth/session - Check current session status
 * POST /api/auth/session - Extend session
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession, extendSession, getSessionStats } from '@/lib/auth/session'
import { AUTH_CONFIG } from '@/lib/auth/config'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(AUTH_CONFIG.COOKIE_NAME)
    const sessionId = sessionCookie?.value

    if (!sessionId) {
      return NextResponse.json({
        authenticated: false,
        message: 'No active session',
      })
    }

    const sessionData = await validateSession(sessionId)

    if (!sessionData) {
      return NextResponse.json({
        authenticated: false,
        message: 'Session expired or invalid',
      })
    }

    return NextResponse.json({
      authenticated: true,
      session: {
        role: sessionData.role,
        expiresAt: sessionData.expiresAt,
        lastActivity: sessionData.lastActivity,
      },
    })
  } catch (error) {
    logger.error('Session check error:', error)

    return NextResponse.json(
      { authenticated: false, error: 'Failed to check session' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(AUTH_CONFIG.COOKIE_NAME)
    const sessionId = sessionCookie?.value

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'No active session' },
        { status: 400 }
      )
    }

    const result = await extendSession(sessionId)

    if (!result.success || !result.expiresAt) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to extend session' },
        { status: 400 }
      )
    }

    // Update cookie expiration
    cookieStore.set(AUTH_CONFIG.COOKIE_NAME, sessionId, {
      ...AUTH_CONFIG.COOKIE_OPTIONS,
      expires: result.expiresAt,
    })

    return NextResponse.json({
      success: true,
      message: 'Session extended',
      expiresAt: result.expiresAt.toISOString(),
    })
  } catch (error) {
    logger.error('Session extension error:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to extend session' },
      { status: 500 }
    )
  }
}
