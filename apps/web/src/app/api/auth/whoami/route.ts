/**
 * GET /api/auth/whoami
 *
 * Lightweight diagnostic that reports whether the incoming request carries
 * a valid session cookie. No auth required — the point is to tell you
 * whether you HAVE a session, not to gate on one. Useful for debugging
 * "login works but subsequent requests look unauthenticated" issues.
 *
 * Response shape:
 *   { authenticated: true,  role: 'ADMIN' | 'STAFF', sessionId, cookieName }
 *   { authenticated: false, reason, cookieName, seenCookieHeader }
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession, AUTH_CONFIG } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie') || ''
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(AUTH_CONFIG.COOKIE_NAME)

  if (!sessionCookie) {
    return NextResponse.json({
      authenticated: false,
      reason: 'no session cookie present in request',
      cookieName: AUTH_CONFIG.COOKIE_NAME,
      seenCookieHeader: cookieHeader ? cookieHeader.split(';').map(c => c.trim().split('=')[0]) : [],
    })
  }

  const sessionData = await validateSession(sessionCookie.value)
  if (!sessionData) {
    return NextResponse.json({
      authenticated: false,
      reason: 'session cookie present but not valid (expired/revoked/unknown)',
      cookieName: AUTH_CONFIG.COOKIE_NAME,
      sessionIdPrefix: sessionCookie.value.slice(0, 8),
    })
  }

  return NextResponse.json({
    authenticated: true,
    role: sessionData.role,
    sessionId: sessionData.sessionId.slice(0, 8) + '...',
    cookieName: AUTH_CONFIG.COOKIE_NAME,
  })
}
