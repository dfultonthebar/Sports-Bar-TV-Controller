/**
 * Logout API Endpoint
 *
 * POST /api/auth/logout
 * - Destroys session
 * - Clears cookie
 * - Logs audit event
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { destroySession, logAuditAction, AUTH_CONFIG } from '@/lib/auth'
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
  const ipAddress = getIpAddress(request)
  const userAgent = request.headers.get('user-agent') || undefined

  try {
    // Get session ID from cookie
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(AUTH_CONFIG.COOKIE_NAME)
    const sessionId = sessionCookie?.value

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'No active session' },
        { status: 400 }
      )
    }

    // Destroy session
    const result = await destroySession(sessionId)

    if (!result.success) {
      logger.error('Failed to destroy session:', { data: result.error })
    }

    // Clear cookie
    cookieStore.delete(AUTH_CONFIG.COOKIE_NAME)

    // Log logout
    await logAuditAction({
      action: 'LOGOUT',
      resource: 'authentication',
      endpoint: '/api/auth/logout',
      method: 'POST',
      ipAddress,
      userAgent,
      sessionId,
      success: true,
    })

    logger.info(`User logged out: ${sessionId}`)

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })
  } catch (error) {
    logger.error('Logout error:', error)

    return NextResponse.json(
      { success: false, error: 'Logout failed' },
      { status: 500 }
    )
  }
}
