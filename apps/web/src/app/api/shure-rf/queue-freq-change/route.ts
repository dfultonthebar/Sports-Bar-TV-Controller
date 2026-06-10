/**
 * POST /api/shure-rf/queue-freq-change
 *
 * Operator-initiated wireless-mic frequency change with a bartender-
 * visible resync banner that stays up until the transmitter is IR-synced
 * to the new freq AND keys up (verified by shure-rf-watcher).
 *
 * Workflow:
 *   1. Look up the receiver and its current freq for the target channel
 *   2. INSERT row into shure_pending_resync (channel, old_khz, new_khz)
 *   3. Send `< SET <ch> FREQUENCY <kHz> >` to the receiver
 *   4. Return — the bartender Audio tab will start showing the banner
 *      on its next poll (~5s) and the watcher will mark verified_at
 *      automatically when a real TX_MODEL appears on the new freq
 *
 * Lifecycle the operator sees:
 *   - Press button in admin UI → bartender Audio tab gets a yellow
 *     warning card: "Mic N needs re-sync — receiver moved from X MHz
 *     to Y MHz. Hold the transmitter near the receiver's IR port and
 *     press SYNC."
 *   - Bartender does the IR sync, powers TX on, mic keys up
 *   - shure-rf-watcher sees TX_MODEL != UNKNOWN with RSSI > threshold
 *     at the new freq → UPDATE verified_at
 *   - Banner clears automatically
 *
 * To abandon a pending change: POST /api/shure-rf/cancel-resync.
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
import { getShureSlxdClient, shureSlxdClientManager } from '@sports-bar/shure-slxd'

const bodySchema = z.object({
  receiverId: z.string().min(1).max(64),
  channel: z.number().int().min(1).max(4),
  // SLX-D G58 band is 470-514 MHz. The Schema-level cap matches the
  // PATCH /channel endpoint's bounds (174-960 MHz allows for other
  // bands — caller must know their receiver's tunable range).
  newFreqMhz: z.number().min(174).max(960),
  notes: z.string().max(200).optional(),
})

function mhzToKhz(mhz: number): number {
  return Math.round(mhz * 1000)
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const authCheck = await requireAuth(request, 'ADMIN', {
    auditAction: 'shure_queue_freq_change',
  })
  if (!authCheck.allowed) return authCheck.response!

  const bodyValidation = await validateRequestBody(request, bodySchema)
  if (!bodyValidation.success) return bodyValidation.error
  const { receiverId, channel, newFreqMhz, notes } = bodyValidation.data

  // Resolve receiver.
  const rows = await db
    .select()
    .from(schema.audioProcessors)
    .where(eq(schema.audioProcessors.id, receiverId))
    .all()
  const processor = rows[0]
  if (!processor || processor.processorType !== 'shure-slxd') {
    return NextResponse.json(
      { success: false, error: 'Shure SLX-D receiver not found' },
      { status: 404 },
    )
  }
  if (!processor.ipAddress) {
    return NextResponse.json(
      { success: false, error: 'Receiver has no IP address configured' },
      { status: 400 },
    )
  }

  // Read current freq from the in-process client cache (shureSlxdClientManager
  // gets per-channel state from the receiver's SAMPLE/REP pushes). Falls
  // back to 0 if we somehow have no cached state — the row still gets
  // inserted so the bartender sees the banner, but old_freq_khz reads 0.
  let oldFreqKhz = 0
  try {
    const snap = shureSlxdClientManager.getSnapshot(receiverId)
    const chState = snap?.channels?.find((c) => c.channel === channel)
    if (chState?.frequencyMhz) {
      oldFreqKhz = mhzToKhz(chState.frequencyMhz)
    }
  } catch (err) {
    logger.warn(
      `[QUEUE-FREQ-CHANGE] could not read cached state for ${receiverId} ch${channel}: ${(err as Error).message}`,
    )
  }

  const newFreqKhz = mhzToKhz(newFreqMhz)

  // Reject no-op: if we're already there per the cache, no need.
  if (oldFreqKhz === newFreqKhz) {
    return NextResponse.json(
      {
        success: false,
        error: `Channel ${channel} is already on ${newFreqMhz} MHz`,
      },
      { status: 400 },
    )
  }

  // Cancel any previously-pending resync on this channel before inserting
  // the new one — otherwise the bartender sees two banners for the same
  // channel and the watcher has two open rows to satisfy.
  await db
    .update(schema.shurePendingResync)
    .set({ canceledAt: Math.floor(Date.now() / 1000), notes: 'superseded by new queue request' })
    .where(
      and(
        eq(schema.shurePendingResync.receiverId, receiverId),
        eq(schema.shurePendingResync.channel, channel),
        isNull(schema.shurePendingResync.verifiedAt),
        isNull(schema.shurePendingResync.canceledAt),
      ),
    )
    .run()

  // INSERT pending row.
  const inserted = await db
    .insert(schema.shurePendingResync)
    .values({
      receiverId,
      channel,
      oldFreqKhz,
      newFreqKhz,
      notes: notes ?? null,
    })
    .returning({ id: schema.shurePendingResync.id })
    .all()
  const pendingId = inserted[0]?.id ?? null

  // Send the SET to the receiver. setFrequencyMhz handles the
  // MHz → 6-digit kHz conversion + frame wrapping. Fire-and-forget per
  // Shure protocol (no ERR/NAK frame; out-of-range silently drops).
  try {
    const client = await getShureSlxdClient(receiverId, {
      ipAddress: processor.ipAddress,
      port: processor.tcpPort ?? 2202,
      receiverId,
      receiverName: processor.name || processor.ipAddress,
      autoReconnect: true,
    })
    await client.setFrequencyMhz(channel, newFreqMhz)
    logger.info(
      `[QUEUE-FREQ-CHANGE] ${processor.name} ch${channel}: ${oldFreqKhz / 1000} MHz → ${newFreqMhz} MHz queued (pendingId=${pendingId})`,
    )
  } catch (err) {
    // Roll back the insert if we couldn't actually reach the receiver —
    // the bartender shouldn't see a banner for a SET we never sent.
    if (pendingId) {
      await db
        .update(schema.shurePendingResync)
        .set({
          canceledAt: Math.floor(Date.now() / 1000),
          notes: `SET to receiver failed: ${(err as Error).message}`,
        })
        .where(eq(schema.shurePendingResync.id, pendingId))
        .run()
    }
    logger.error(`[QUEUE-FREQ-CHANGE] receiver SET failed: ${(err as Error).message}`)
    return NextResponse.json(
      {
        success: false,
        error: `Receiver unreachable or SET command failed: ${(err as Error).message}`,
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    success: true,
    pendingId,
    receiverId,
    channel,
    oldFreqMhz: oldFreqKhz / 1000,
    newFreqMhz,
    next: 'Bartender Audio tab will show the resync banner within 5 sec. The banner clears automatically when the transmitter is IR-synced AND keyed up on the new freq.',
  })
}
