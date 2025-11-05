/**
 * Authentication Middleware
 *
 * Provides middleware functions for protecting API routes with:
 * - Session-based authentication (PIN login)
 * - API key authentication (webhooks)
 * - Role-based access control
 * - Automatic audit logging
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from './session'
import { validateApiKey } from './api-key'
import { logAuditAction } from './audit'
import { AUTH_CONFIG, type UserRole, AccessLevel, getEndpointAccessLevel } from './config'
import { logger } from '@/lib/logger'

export interface AuthResult {
  allowed: boolean
  role?: UserRole
  sessionId?: string
  apiKeyId?: string
  response?: NextResponse
}

/**
 * Get IP address from request
 */
function getIpAddress(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  return 'unknown'
}

/**
 * Get session ID from cookie
 */
async function getSessionIdFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(AUTH_CONFIG.COOKIE_NAME)
    return sessionCookie?.value || null
  } catch (error) {
    logger.error('Error getting session cookie:', error)
    return null
  }
}

/**
 * Require authentication for an endpoint
 * Supports both session-based (PIN) and API key authentication
 */
export async function requireAuth(
  request: NextRequest,
  requiredRole: UserRole = 'STAFF',
  options: {
    allowApiKey?: boolean
    auditAction?: string
    auditResource?: string
  } = {}
): Promise<AuthResult> {
  const ipAddress = getIpAddress(request)
  const userAgent = request.headers.get('user-agent') || undefined
  const pathname = new URL(request.url).pathname

  try {
    // Check for API key first (if allowed)
    if (options.allowApiKey !== false) {
      const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '')

      if (apiKey) {
        const keyResult = await validateApiKey(apiKey, pathname)

        if (keyResult.valid) {
          // Log successful API key authentication
          if (options.auditAction && options.auditResource) {
            await logAuditAction({
              action: options.auditAction,
              resource: options.auditResource,
              endpoint: pathname,
              method: request.method,
              ipAddress,
              userAgent,
              apiKeyId: keyResult.keyId,
              success: true,
            })
          }

          return {
            allowed: true,
            apiKeyId: keyResult.keyId,
          }
        }

        // Invalid API key - log failed attempt
        await logAuditAction({
          action: 'AUTH_FAILED',
          resource: 'authentication',
          endpoint: pathname,
          method: request.method,
          ipAddress,
          userAgent,
          success: false,
          errorMessage: keyResult.error || 'Invalid API key',
        })

        return {
          allowed: false,
          response: NextResponse.json(
            { error: 'Invalid or expired API key' },
            { status: 401 }
          ),
        }
      }
    }

    // Check for session cookie
    const sessionId = await getSessionIdFromCookie()

    if (!sessionId) {
      return {
        allowed: false,
        response: NextResponse.json(
          { error: 'Authentication required. Please log in.' },
          { status: 401 }
        ),
      }
    }

    // Validate session
    const sessionData = await validateSession(sessionId)

    if (!sessionData) {
      return {
        allowed: false,
        response: NextResponse.json(
          { error: 'Session expired or invalid. Please log in again.' },
          { status: 401 }
        ),
      }
    }

    // Check role permissions
    if (requiredRole === 'ADMIN' && sessionData.role !== 'ADMIN') {
      // Log unauthorized access attempt
      await logAuditAction({
        action: 'AUTH_INSUFFICIENT_PERMISSIONS',
        resource: 'authentication',
        endpoint: pathname,
        method: request.method,
        ipAddress,
        userAgent,
        sessionId,
        success: false,
        errorMessage: `${sessionData.role} role attempted to access ADMIN endpoint`,
      })

      return {
        allowed: false,
        response: NextResponse.json(
          { error: 'Insufficient permissions. Admin access required.' },
          { status: 403 }
        ),
      }
    }

    // Log successful authentication (if audit action specified)
    if (options.auditAction && options.auditResource) {
      await logAuditAction({
        action: options.auditAction,
        resource: options.auditResource,
        endpoint: pathname,
        method: request.method,
        ipAddress,
        userAgent,
        sessionId,
        success: true,
      })
    }

    return {
      allowed: true,
      role: sessionData.role,
      sessionId: sessionData.sessionId,
    }
  } catch (error) {
    logger.error('Authentication error:', error)

    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Authentication error. Please try again.' },
        { status: 500 }
      ),
    }
  }
}

/**
 * Middleware to check authentication based on endpoint
 * Automatically determines required access level
 */
export async function checkAuth(request: NextRequest): Promise<AuthResult> {
  const pathname = new URL(request.url).pathname
  const accessLevel = getEndpointAccessLevel(pathname)

  // Public endpoints - no auth required
  if (accessLevel === AccessLevel.PUBLIC) {
    return { allowed: true }
  }

  // Webhook endpoints - API key required
  if (accessLevel === AccessLevel.WEBHOOK) {
    return requireAuth(request, 'STAFF', { allowApiKey: true })
  }

  // Admin endpoints - admin role required
  if (accessLevel === AccessLevel.ADMIN) {
    return requireAuth(request, 'ADMIN')
  }

  // Default - staff role required
  return requireAuth(request, 'STAFF')
}

/**
 * Require confirmation for destructive operations
 */
export async function requireConfirmation(
  request: NextRequest,
  action: string
): Promise<{ confirmed: boolean; response?: NextResponse }> {
  try {
    const body = await request.json()

    if (!body.confirm || body.confirm !== true) {
      return {
        confirmed: false,
        response: NextResponse.json(
          {
            error: 'Confirmation required',
            message: `This is a destructive operation: ${action}. Send { confirm: true } to proceed.`,
            action,
            requiresConfirmation: true,
          },
          { status: 400 }
        ),
      }
    }

    return { confirmed: true }
  } catch (error) {
    return {
      confirmed: false,
      response: NextResponse.json(
        { error: 'Invalid request body. Confirmation required.' },
        { status: 400 }
      ),
    }
  }
}

/**
 * Helper to get current session info
 */
export async function getCurrentSession(request: NextRequest) {
  const sessionId = await getSessionIdFromCookie()

  if (!sessionId) {
    return null
  }

  return await validateSession(sessionId)
}

/**
 * Helper to check if user has admin role
 */
export async function isAdmin(request: NextRequest): Promise<boolean> {
  const session = await getCurrentSession(request)
  return session?.role === 'ADMIN'
}

/**
 * Helper to check if user is authenticated
 */
export async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const sessionId = await getSessionIdFromCookie()

  if (!sessionId) {
    return false
  }

  const session = await validateSession(sessionId)
  return session !== null
}

/**
 * Audit logging wrapper for protected endpoints
 */
export async function withAudit<T>(
  request: NextRequest,
  action: string,
  resource: string,
  handler: () => Promise<T>
): Promise<T> {
  const ipAddress = getIpAddress(request)
  const userAgent = request.headers.get('user-agent') || undefined
  const pathname = new URL(request.url).pathname
  const sessionId = await getSessionIdFromCookie()

  let success = false
  let errorMessage: string | undefined
  let responseStatus: number | undefined

  try {
    const result = await handler()

    success = true
    responseStatus = 200

    return result
  } catch (error) {
    success = false
    errorMessage = error instanceof Error ? error.message : 'Unknown error'
    responseStatus = 500

    throw error
  } finally {
    // Log the action
    await logAuditAction({
      action,
      resource,
      endpoint: pathname,
      method: request.method,
      ipAddress,
      userAgent,
      sessionId: sessionId || undefined,
      success,
      errorMessage,
      responseStatus,
    })
  }
}
