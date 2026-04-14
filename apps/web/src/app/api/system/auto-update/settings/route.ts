import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, sql } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { requireAuth } from '@/lib/auth'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'

export const dynamic = 'force-dynamic'

// Basic 5-field cron sanity check (does NOT validate full cron grammar — the
// shell script and systemd timer have their own validation)
const cronRegex = /^[\d*\/,\-]+\s+[\d*\/,\-]+\s+[\d*\/,\-]+\s+[\d*\/,\-]+\s+[\d*\/,\-]+$/

const settingsSchema = z.object({
  enabled: z.boolean(),
  scheduleCron: z
    .string()
    .min(1)
    .max(120)
    .refine((v) => cronRegex.test(v.trim()), {
      message: 'scheduleCron must be a 5-field cron expression',
    }),
})

export async function PUT(request: NextRequest) {
  // Auth
  const authResult = await requireAuth(request, 'ADMIN', {
    auditAction: 'AUTO_UPDATE_SETTINGS_UPDATE',
    auditResource: 'auto-update',
  })
  if (!authResult.allowed) return authResult.response!

  // Rate limit
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) return rateLimit.response

  // Body validation
  const bodyValidation = await validateRequestBody(request, settingsSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { enabled, scheduleCron } = bodyValidation.data

  try {
    // Upsert the singleton row (id=1)
    const existing = await db
      .select()
      .from(schema.autoUpdateState)
      .where(eq(schema.autoUpdateState.id, 1))
      .limit(1)

    if (existing.length === 0) {
      await db.insert(schema.autoUpdateState).values({
        id: 1,
        enabled,
        scheduleCron,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
    } else {
      await db
        .update(schema.autoUpdateState)
        .set({
          enabled,
          scheduleCron,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(schema.autoUpdateState.id, 1))
    }

    logger.info('[AUTO_UPDATE_API] settings updated', { enabled, scheduleCron })

    // TODO(phase 2 systemd): per docs/AUTO_UPDATE_SYSTEM_PLAN.md "Implementation
    // note on /etc/cron.d/", the recommended path is a systemd user timer in
    // ~/.config/systemd/user/ enabled via `systemctl --user enable` with
    // `loginctl enable-linger ubuntu`. Phase 2 leaves the timer install as a
    // manual one-time step on each deployment. The DB `enabled` flag is the
    // gate the auto-update.sh pre-flight checks, so toggling it here is
    // sufficient to disable cron-mode runs even if the timer is installed.

    return NextResponse.json({
      success: true,
      enabled,
      scheduleCron,
    })
  } catch (error: any) {
    logger.error('[AUTO_UPDATE_API] settings update error:', error)
    return NextResponse.json(
      { error: 'Failed to update auto-update settings', details: error?.message },
      { status: 500 }
    )
  }
}
