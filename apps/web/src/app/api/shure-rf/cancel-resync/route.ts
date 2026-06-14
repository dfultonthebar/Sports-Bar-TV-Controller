/**
 * POST /api/shure-rf/cancel-resync
 *
 * Abandon a pending freq-change without waiting for the watcher to
 * verify it. Sets canceled_at on the row → next /pending-resync poll
 * returns one less entry → bartender banner clears.
 *
 * Does NOT revert the receiver's frequency. The operator should
 * either re-queue a new change OR manually IR-sync the transmitter on
 * the new freq. The endpoint just removes the warning from the UI.
 *
 * Reason field is required so audit history records WHY the change was
 * abandoned (forgot, wrong freq, etc).
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody } from '@sports-bar/validation'
import { z } from 'zod'
import { logger } from '@sports-bar/logger'
import { requireAuth } from '@/lib/auth'
import { db, schema } from '@/db'
import { eq, and, isNull } from 'drizzle-orm'

const bodySchema = z.object({
  id: z.string().min(1).max(64),
  reason: z.string().min(1).max(200),
})

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const authCheck = await requireAuth(request, 'ADMIN', {
    auditAction: 'shure_cancel_resync',
  })
  if (!authCheck.allowed) return authCheck.response!

  const bodyValidation = await validateRequestBody(request, bodySchema)
  if (!bodyValidation.success) return bodyValidation.error
  const { id, reason } = bodyValidation.data

  const result = await db
    .update(schema.shurePendingResync)
    .set({
      canceledAt: Math.floor(Date.now() / 1000),
      notes: `canceled: ${reason}`,
    })
    .where(
      and(
        eq(schema.shurePendingResync.id, id),
        isNull(schema.shurePendingResync.verifiedAt),
        isNull(schema.shurePendingResync.canceledAt),
      ),
    )
    .returning({ id: schema.shurePendingResync.id })
    .all()

  if (result.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'Pending resync not found, already verified, or already canceled',
      },
      { status: 404 },
    )
  }

  logger.info(`[CANCEL-RESYNC] ${id}: ${reason}`)
  return NextResponse.json({ success: true, id })
}
