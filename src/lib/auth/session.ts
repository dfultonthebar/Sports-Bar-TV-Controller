/**
 * Session Management Utilities
 *
 * Handles session creation, validation, extension, and cleanup including:
 * - Creating new sessions after successful authentication
 * - Validating active sessions
 * - Extending session expiry on activity
 * - Destroying sessions on logout
 * - Cleaning up expired sessions
 */

import { db } from '@/db'
import { sessions } from '@/db/schema'
import { eq, and, lt, gt } from 'drizzle-orm'
import { AUTH_CONFIG, type UserRole } from './config'
import { logger } from '@/lib/logger'

export interface SessionData {
  sessionId: string
  locationId: string
  role: UserRole
  ipAddress: string
  userAgent: string | null
  createdAt: string
  expiresAt: string
  lastActivity: string
}

/**
 * Create a new session
 */
export async function createSession(
  role: UserRole,
  ipAddress: string,
  userAgent?: string,
  locationId?: string
): Promise<{ success: boolean; sessionId?: string; expiresAt?: Date; error?: string }> {
  try {
    const locId = locationId || AUTH_CONFIG.LOCATION_ID
    const now = new Date()
    const expiresAt = new Date(now.getTime() + AUTH_CONFIG.SESSION_DURATION)

    const newSession = await db.insert(sessions).values({
      locationId: locId,
      role,
      ipAddress,
      userAgent: userAgent || null,
      isActive: true,
      expiresAt: expiresAt.toISOString(),
      lastActivity: now.toISOString(),
    }).returning()

    logger.info(`Created new ${role} session: ${newSession[0].id}`)

    return {
      success: true,
      sessionId: newSession[0].id,
      expiresAt,
    }
  } catch (error) {
    logger.error('Error creating session:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create session',
    }
  }
}

/**
 * Validate a session and return session data if valid
 * Automatically extends session if it's close to expiry
 */
export async function validateSession(sessionId: string): Promise<SessionData | null> {
  try {
    const session = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.isActive, true)
        )
      )
      .limit(1)

    if (session.length === 0) {
      logger.warn(`Session validation failed - session not found: ${sessionId}`)
      return null
    }

    const sessionData = session[0]
    const now = new Date()
    const expiresAt = new Date(sessionData.expiresAt)

    // Check if session has expired
    if (expiresAt < now) {
      logger.warn(`Session expired: ${sessionId}`)

      // Mark session as inactive
      await db
        .update(sessions)
        .set({ isActive: false })
        .where(eq(sessions.id, sessionId))

      return null
    }

    // Auto-extend session if close to expiry (within threshold)
    const timeUntilExpiry = expiresAt.getTime() - now.getTime()
    if (timeUntilExpiry < AUTH_CONFIG.SESSION_EXTENSION_THRESHOLD) {
      await extendSession(sessionId)
      logger.info(`Auto-extended session: ${sessionId}`)
    }

    // Update last activity
    await db
      .update(sessions)
      .set({ lastActivity: now.toISOString() })
      .where(eq(sessions.id, sessionId))

    return {
      sessionId: sessionData.id,
      locationId: sessionData.locationId,
      role: sessionData.role as UserRole,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      createdAt: sessionData.createdAt,
      expiresAt: sessionData.expiresAt,
      lastActivity: now.toISOString(),
    }
  } catch (error) {
    logger.error('Error validating session:', error)
    return null
  }
}

/**
 * Extend a session's expiration time
 */
export async function extendSession(sessionId: string): Promise<{ success: boolean; expiresAt?: Date; error?: string }> {
  try {
    const now = new Date()
    const newExpiresAt = new Date(now.getTime() + AUTH_CONFIG.SESSION_DURATION)

    const result = await db
      .update(sessions)
      .set({
        expiresAt: newExpiresAt.toISOString(),
        lastActivity: now.toISOString(),
      })
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.isActive, true)
        )
      )
      .returning()

    if (result.length === 0) {
      return { success: false, error: 'Session not found or inactive' }
    }

    return {
      success: true,
      expiresAt: newExpiresAt,
    }
  } catch (error) {
    logger.error('Error extending session:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extend session',
    }
  }
}

/**
 * Destroy a session (logout)
 */
export async function destroySession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await db
      .update(sessions)
      .set({ isActive: false })
      .where(eq(sessions.id, sessionId))
      .returning()

    if (result.length === 0) {
      return { success: false, error: 'Session not found' }
    }

    logger.info(`Destroyed session: ${sessionId}`)
    return { success: true }
  } catch (error) {
    logger.error('Error destroying session:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to destroy session',
    }
  }
}

/**
 * Cleanup expired sessions
 * Should be called periodically (e.g., via cron job or on server startup)
 */
export async function cleanupExpiredSessions(): Promise<{ cleaned: number; error?: string }> {
  try {
    const now = new Date()

    const result = await db
      .update(sessions)
      .set({ isActive: false })
      .where(
        and(
          eq(sessions.isActive, true as any),
          gt(sessions.expiresAt, now.toISOString())
        )
      )
      .returning()

    const cleanedCount = result.length

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired sessions`)
    }

    return { cleaned: cleanedCount }
  } catch (error) {
    logger.error('Error cleaning up expired sessions:', error)
    return {
      cleaned: 0,
      error: error instanceof Error ? error.message : 'Failed to cleanup sessions',
    }
  }
}

/**
 * Get all active sessions for a location
 */
export async function getActiveSessions(locationId?: string): Promise<SessionData[]> {
  try {
    const locId = locationId || AUTH_CONFIG.LOCATION_ID
    const now = new Date()

    const activeSessions = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.locationId, locId),
          eq(sessions.isActive, true as any),
          gt(sessions.expiresAt, now.toISOString())
        )
      )

    return activeSessions.map(s => ({
      sessionId: s.id,
      locationId: s.locationId,
      role: s.role as UserRole,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      lastActivity: s.lastActivity,
    }))
  } catch (error) {
    logger.error('Error getting active sessions:', error)
    return []
  }
}

/**
 * Destroy all sessions for a location (emergency logout)
 */
export async function destroyAllSessions(locationId?: string): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const locId = locationId || AUTH_CONFIG.LOCATION_ID

    const result = await db
      .update(sessions)
      .set({ isActive: false })
      .where(
        and(
          eq(sessions.locationId, locId),
          eq(sessions.isActive, true)
        )
      )
      .returning()

    logger.warn(`Destroyed all sessions for location ${locId}: ${result.length} sessions`)

    return {
      success: true,
      count: result.length,
    }
  } catch (error) {
    logger.error('Error destroying all sessions:', error)
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Failed to destroy sessions',
    }
  }
}

/**
 * Get session statistics
 */
export async function getSessionStats(locationId?: string): Promise<{
  totalActive: number
  staffSessions: number
  adminSessions: number
  oldestSession: string | null
  newestSession: string | null
}> {
  try {
    const locId = locationId || AUTH_CONFIG.LOCATION_ID
    const now = new Date()

    const activeSessions = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.locationId, locId),
          eq(sessions.isActive, true as any),
          gt(sessions.expiresAt, now.toISOString())
        )
      )

    const staffSessions = activeSessions.filter(s => s.role === 'STAFF').length
    const adminSessions = activeSessions.filter(s => s.role === 'ADMIN').length

    const sortedByCreation = [...activeSessions].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    return {
      totalActive: activeSessions.length,
      staffSessions,
      adminSessions,
      oldestSession: sortedByCreation[0]?.createdAt || null,
      newestSession: sortedByCreation[sortedByCreation.length - 1]?.createdAt || null,
    }
  } catch (error) {
    logger.error('Error getting session stats:', error)
    return {
      totalActive: 0,
      staffSessions: 0,
      adminSessions: 0,
      oldestSession: null,
      newestSession: null,
    }
  }
}
