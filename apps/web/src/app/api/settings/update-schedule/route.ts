/**
 * Sports Guide Update Schedule Settings API
 *
 * Stores and retrieves the "when should the sports guide data auto-refresh"
 * configuration. This setting is purely informational today (no cron consumer
 * wired up yet) but persists the UI checkbox state so it doesn't reset between
 * page loads.
 *
 * GET /api/settings/update-schedule — return current schedule
 * PUT /api/settings/update-schedule — save schedule
 *
 * Storage: SystemSettings table with key 'sports_guide_update_schedule',
 * JSON value.
 *
 * Context: Prior to v2.4.3 the UpdateSchedule checkbox on the
 * /sports-guide-admin Configuration tab was wired to the sports-guide-config
 * POST endpoint, but that endpoint silently dropped the field (no DB column)
 * so the checkbox state never persisted. This route replaces that broken path.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, z } from '@/lib/validation'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

const SETTING_KEY = 'sports_guide_update_schedule'

export const dynamic = 'force-dynamic'

// --- Types ---

interface UpdateSchedule {
  enabled: boolean
  time: string // HH:MM format
  frequency: 'daily' | 'weekly'
}

const DEFAULT_SCHEDULE: UpdateSchedule = {
  enabled: true,
  time: '06:00',
  frequency: 'daily',
}

// --- Zod schema ---

const updateScheduleSchema = z.object({
  enabled: z.boolean(),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'time must be HH:MM'),
  frequency: z.enum(['daily', 'weekly']),
})

// --- Helpers ---

async function loadSchedule(): Promise<UpdateSchedule> {
  const setting = await db
    .select()
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, SETTING_KEY))
    .limit(1)
    .get()

  if (!setting) {
    return { ...DEFAULT_SCHEDULE }
  }

  try {
    const parsed = JSON.parse(setting.value) as UpdateSchedule
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_SCHEDULE.enabled,
      time: typeof parsed.time === 'string' && /^\d{2}:\d{2}$/.test(parsed.time) ? parsed.time : DEFAULT_SCHEDULE.time,
      frequency: parsed.frequency === 'weekly' ? 'weekly' : 'daily',
    }
  } catch {
    logger.warn('[SPORTS_GUIDE_UPDATE_SCHEDULE] Corrupt JSON in SystemSettings, returning default')
    return { ...DEFAULT_SCHEDULE }
  }
}

async function saveSchedule(schedule: UpdateSchedule): Promise<void> {
  const now = new Date().toISOString()
  const valueJson = JSON.stringify(schedule)

  const existing = await db
    .select()
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, SETTING_KEY))
    .limit(1)
    .get()

  if (existing) {
    await db
      .update(schema.systemSettings)
      .set({ value: valueJson, updatedAt: now })
      .where(eq(schema.systemSettings.key, SETTING_KEY))
  } else {
    await db.insert(schema.systemSettings).values({
      id: crypto.randomUUID(),
      key: SETTING_KEY,
      value: valueJson,
      description: 'Sports guide auto-refresh schedule (enabled, time, frequency)',
      updatedAt: now,
    })
  }
}

// =============================================================================
// GET
// =============================================================================

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const schedule = await loadSchedule()
    return NextResponse.json({ success: true, schedule })
  } catch (error: any) {
    logger.error('[SPORTS_GUIDE_UPDATE_SCHEDULE] Error loading schedule:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load update schedule' },
      { status: 500 }
    )
  }
}

// =============================================================================
// PUT
// =============================================================================

export async function PUT(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, updateScheduleSchema)
  if (!bodyValidation.success) return bodyValidation.error

  try {
    await saveSchedule(bodyValidation.data as UpdateSchedule)
    const saved = await loadSchedule()
    return NextResponse.json({ success: true, schedule: saved })
  } catch (error: any) {
    logger.error('[SPORTS_GUIDE_UPDATE_SCHEDULE] Error saving schedule:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save update schedule' },
      { status: 500 }
    )
  }
}
