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

interface SchedulerSettingsRow {
  id: string
  enabled: number
  useFireTV: number
  useFuzzyMatching: number
  minMatchConfidence: number
  logDistributionPlans: number
  updatedAt: string | null
  updatedBy: string | null
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    logger.info('[API] Getting smart scheduler settings')

    // Get settings from database
    const result = await db.all(sql`SELECT * FROM SmartSchedulerSettings WHERE id = 'default' LIMIT 1`) as SchedulerSettingsRow[]

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

    // Build update object
    const updateFields: Record<string, number | string> = {}

    if (updates.enabled !== undefined) {
      updateFields.enabled = updates.enabled ? 1 : 0
    }

    if (updates.useFireTV !== undefined) {
      updateFields.useFireTV = updates.useFireTV ? 1 : 0
    }

    if (updates.useFuzzyMatching !== undefined) {
      updateFields.useFuzzyMatching = updates.useFuzzyMatching ? 1 : 0
    }

    if (updates.minMatchConfidence !== undefined) {
      updateFields.minMatchConfidence = updates.minMatchConfidence
    }

    if (updates.logDistributionPlans !== undefined) {
      updateFields.logDistributionPlans = updates.logDistributionPlans ? 1 : 0
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No settings to update'
        },
        { status: 400 }
      )
    }

    // Add timestamp
    updateFields.updatedAt = new Date().toISOString()

    // Build SET clause with proper SQL escaping
    const setClause = Object.entries(updateFields)
      .map(([key, value]) => {
        if (typeof value === 'number') {
          return `${key} = ${value}`
        }
        // Escape single quotes in string values
        return `${key} = '${String(value).replace(/'/g, "''")}'`
      })
      .join(', ')

    const query = `UPDATE SmartSchedulerSettings SET ${setClause} WHERE id = 'default'`
    logger.debug(`[API] Executing query: ${query}`)

    // Execute update using raw SQL
    await db.run(sql.raw(query))

    // Get updated settings
    const result = await db.all(sql`SELECT * FROM SmartSchedulerSettings WHERE id = 'default' LIMIT 1`) as SchedulerSettingsRow[]

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
