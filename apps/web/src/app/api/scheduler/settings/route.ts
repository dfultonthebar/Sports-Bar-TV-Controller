/**
 * Smart Scheduler Settings API
 *
 * GET /api/scheduler/settings - Get current scheduler settings
 * POST /api/scheduler/settings - Update scheduler settings
 *
 * Settings:
 * - enabled: Master on/off switch for AI scheduler
 * - useFireTV: Include Fire TV streaming games
 * - useFuzzyMatching: Use team name fuzzy matching
 * - minMatchConfidence: Minimum confidence for fuzzy matches (0.0-1.0)
 * - logDistributionPlans: Log distribution plans to console
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, z } from '@/lib/validation'
import { db } from '@/db'
import { logger } from '@sports-bar/logger'
import { sql } from 'drizzle-orm'

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  useFireTV: z.boolean().optional(),
  useFuzzyMatching: z.boolean().optional(),
  minMatchConfidence: z.number().min(0).max(1).optional(),
  logDistributionPlans: z.boolean().optional()
})

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    logger.info('[API] Getting smart scheduler settings')

    // Get settings from database
    const result = await db.all(sql`SELECT * FROM SmartSchedulerSettings WHERE id = 'default' LIMIT 1`)

    if (result.length === 0) {
      // Create default settings
      await db.run(sql`
        INSERT INTO SmartSchedulerSettings (id, enabled, useFireTV, useFuzzyMatching, minMatchConfidence, logDistributionPlans)
        VALUES ('default', 1, 1, 1, 0.7, 1)
      `)

      return NextResponse.json({
        success: true,
        data: {
          enabled: true,
          useFireTV: true,
          useFuzzyMatching: true,
          minMatchConfidence: 0.7,
          logDistributionPlans: true
        }
      })
    }

    const settings = result[0]

    return NextResponse.json({
      success: true,
      data: {
        enabled: settings.enabled === 1,
        useFireTV: settings.useFireTV === 1,
        useFuzzyMatching: settings.useFuzzyMatching === 1,
        minMatchConfidence: settings.minMatchConfidence,
        logDistributionPlans: settings.logDistributionPlans === 1,
        updatedAt: settings.updatedAt,
        updatedBy: settings.updatedBy
      }
    })
  } catch (error: any) {
    logger.error('[API] Error getting scheduler settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get scheduler settings'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) return rateLimit.response

  // Validation
  const bodyValidation = await validateRequestBody(request, settingsSchema)
  if (!bodyValidation.success) return bodyValidation.error

  const updates = bodyValidation.data

  try {
    logger.info('[API] Updating smart scheduler settings:', updates)

    // Build update query
    const setStatements: string[] = []
    const values: any[] = []

    if (updates.enabled !== undefined) {
      setStatements.push('enabled = ?')
      values.push(updates.enabled ? 1 : 0)
    }

    if (updates.useFireTV !== undefined) {
      setStatements.push('useFireTV = ?')
      values.push(updates.useFireTV ? 1 : 0)
    }

    if (updates.useFuzzyMatching !== undefined) {
      setStatements.push('useFuzzyMatching = ?')
      values.push(updates.useFuzzyMatching ? 1 : 0)
    }

    if (updates.minMatchConfidence !== undefined) {
      setStatements.push('minMatchConfidence = ?')
      values.push(updates.minMatchConfidence)
    }

    if (updates.logDistributionPlans !== undefined) {
      setStatements.push('logDistributionPlans = ?')
      values.push(updates.logDistributionPlans ? 1 : 0)
    }

    if (setStatements.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No settings to update'
        },
        { status: 400 }
      )
    }

    // Add timestamp
    setStatements.push('updatedAt = ?')
    values.push(new Date().toISOString())

    // Update settings using direct SQL execution
    const query = `UPDATE SmartSchedulerSettings SET ${setStatements.join(', ')} WHERE id = ?`
    values.push('default')

    logger.debug(`[API] Executing query: ${query}`, values)

    // Execute update
    await db.run(sql.raw(query), values)

    // Get updated settings
    const result = await db.all(sql`SELECT * FROM SmartSchedulerSettings WHERE id = 'default' LIMIT 1`)

    if (result.length === 0) {
      throw new Error('Settings not found after update')
    }

    const settings = result[0]

    logger.info('[API] Smart scheduler settings updated successfully')

    // Log status change
    if (updates.enabled !== undefined) {
      if (updates.enabled) {
        logger.info('🟢 [SCHEDULER] AI Smart Scheduler ENABLED')
      } else {
        logger.warn('🔴 [SCHEDULER] AI Smart Scheduler DISABLED - Using manual mode')
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        enabled: settings.enabled === 1,
        useFireTV: settings.useFireTV === 1,
        useFuzzyMatching: settings.useFuzzyMatching === 1,
        minMatchConfidence: settings.minMatchConfidence,
        logDistributionPlans: settings.logDistributionPlans === 1,
        updatedAt: settings.updatedAt,
        updatedBy: settings.updatedBy
      }
    })
  } catch (error: any) {
    logger.error('[API] Error updating scheduler settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update scheduler settings'
      },
      { status: 500 }
    )
  }
}
