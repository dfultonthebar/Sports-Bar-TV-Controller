import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'

const SETTING_KEY = 'dj_mode_state'

const djModeSchema = z.object({
  isActive: z.boolean(),
  activeMode: z.enum(['dj', 'game']),
  djSourceIndex: z.number().int().min(0).optional(),
  djSourceName: z.string().optional(),
  gameAudioSourceIndex: z.number().int().min(0).optional(),
  gameAudioSourceName: z.string().optional(),
  selectedZones: z.array(z.number().int().min(0)).optional(),
})

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const setting = await db.select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, SETTING_KEY))
      .get()

    if (!setting) {
      return NextResponse.json({
        success: true,
        state: { isActive: false, activeMode: 'game', selectedZones: [] },
      })
    }

    return NextResponse.json({
      success: true,
      state: JSON.parse(setting.value),
    })
  } catch (error: any) {
    logger.error('[DJ-MODE] Error loading state:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, djModeSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const state = bodyValidation.data

  try {
    const existing = await db.select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, SETTING_KEY))
      .get()

    if (existing) {
      await db.update(schema.systemSettings)
        .set({ value: JSON.stringify(state), updatedAt: new Date().toISOString() })
        .where(eq(schema.systemSettings.key, SETTING_KEY))
    } else {
      await db.insert(schema.systemSettings).values({
        key: SETTING_KEY,
        value: JSON.stringify(state),
      })
    }

    return NextResponse.json({ success: true, state })
  } catch (error: any) {
    logger.error('[DJ-MODE] Error saving state:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
