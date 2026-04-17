/**
 * API Route: Bartender Overrides
 *
 * Manages bartender manual override locks on TVs.
 * When a bartender manually changes a TV, it gets locked for 4 hours.
 * The AI scheduler respects these locks and won't change locked TVs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, gt, and, lt } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'

// GET - Get all active overrides
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const now = new Date().toISOString()

    // Get only active (non-expired) overrides
    const overrides = await db
      .select()
      .from(schema.bartenderOverrides)
      .where(gt(schema.bartenderOverrides.lockedUntil, now))
      .all()

    // Clean up expired overrides
    await db
      .delete(schema.bartenderOverrides)
      .where(lt(schema.bartenderOverrides.lockedUntil, now))
      .run()

    logger.info(`[BARTENDER_OVERRIDE] Retrieved ${overrides.length} active overrides`)

    return NextResponse.json({
      success: true,
      overrides,
      count: overrides.length
    })
  } catch (error: any) {
    logger.error('[BARTENDER_OVERRIDE] Error getting overrides:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get bartender overrides',
      details: error.message
    }, { status: 500 })
  }
}

// POST - Create or update an override (when bartender changes a TV)
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, z.object({
    tvId: z.string().min(1),
    tvName: z.string().min(1),
    lockType: z.enum(['manual', 'permanent', 'game_end_buffer']).optional().default('manual'),
    currentChannel: z.string().optional(),
    currentGameId: z.string().optional(),
    gameEndTime: z.string().optional(),
    overrideReason: z.string().optional()
  }))

  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { tvId, tvName, lockType, currentChannel, currentGameId, gameEndTime, overrideReason } = bodyValidation.data

  try {
    const now = new Date()

    // Calculate lock duration based on type
    let lockedUntil: Date
    let gameEndBufferUntil: string | null = null

    switch (lockType) {
      case 'permanent':
        // 100 years - essentially permanent
        lockedUntil = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000)
        break
      case 'game_end_buffer':
        // 10 minutes after game ends
        if (gameEndTime) {
          const gameEnd = new Date(gameEndTime)
          lockedUntil = new Date(gameEnd.getTime() + 10 * 60 * 1000) // 10 min buffer
          gameEndBufferUntil = lockedUntil.toISOString()
        } else {
          // Default to 4 hours if no game end time
          lockedUntil = new Date(now.getTime() + 4 * 60 * 60 * 1000)
        }
        break
      case 'manual':
      default:
        // 4 hours from now
        lockedUntil = new Date(now.getTime() + 4 * 60 * 60 * 1000)
        break
    }

    // Check if override already exists for this TV
    const existing = await db
      .select()
      .from(schema.bartenderOverrides)
      .where(eq(schema.bartenderOverrides.tvId, tvId))
      .get()

    let override
    if (existing) {
      // Update existing override
      await db
        .update(schema.bartenderOverrides)
        .set({
          lockedUntil: lockedUntil.toISOString(),
          lockType,
          currentChannel: currentChannel || null,
          currentGameId: currentGameId || null,
          gameEndTime: gameEndTime || null,
          gameEndBufferUntil,
          overrideReason: overrideReason || null,
          updatedAt: now.toISOString()
        })
        .where(eq(schema.bartenderOverrides.id, existing.id))
        .run()

      override = { ...existing, lockedUntil: lockedUntil.toISOString() }
      logger.info(`[BARTENDER_OVERRIDE] Updated override for TV ${tvName} (${tvId}), locked until ${lockedUntil.toISOString()}`)
    } else {
      // Create new override
      const newOverride = {
        tvId,
        tvName,
        lockedUntil: lockedUntil.toISOString(),
        lockType,
        currentChannel: currentChannel || null,
        currentGameId: currentGameId || null,
        gameEndTime: gameEndTime || null,
        gameEndBufferUntil,
        overriddenBy: 'bartender',
        overrideReason: overrideReason || null,
        unlockOnDeviceCrash: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      }

      await db.insert(schema.bartenderOverrides).values(newOverride).run()
      override = newOverride
      logger.info(`[BARTENDER_OVERRIDE] Created override for TV ${tvName} (${tvId}), locked until ${lockedUntil.toISOString()}`)
    }

    return NextResponse.json({
      success: true,
      override,
      message: `TV ${tvName} locked from AI control until ${lockedUntil.toLocaleString()}`
    })
  } catch (error: any) {
    logger.error('[BARTENDER_OVERRIDE] Error creating override:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create bartender override',
      details: error.message
    }, { status: 500 })
  }
}

// DELETE - Remove an override (unlock a TV)
export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, z.object({
    tvId: z.string().min(1)
  }))

  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { tvId } = bodyValidation.data

  try {
    const result = await db
      .delete(schema.bartenderOverrides)
      .where(eq(schema.bartenderOverrides.tvId, tvId))
      .run()

    logger.info(`[BARTENDER_OVERRIDE] Removed override for TV ${tvId}`)

    return NextResponse.json({
      success: true,
      message: `Override removed for TV ${tvId}`
    })
  } catch (error: any) {
    logger.error('[BARTENDER_OVERRIDE] Error removing override:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to remove bartender override',
      details: error.message
    }, { status: 500 })
  }
}
