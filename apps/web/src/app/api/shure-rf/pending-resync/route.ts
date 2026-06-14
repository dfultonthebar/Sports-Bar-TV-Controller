/**
 * GET /api/shure-rf/pending-resync
 *
 * Polled by the bartender Audio tab's resync banner (and by anyone else
 * who cares — admin RF panel, etc) to render the warning while a
 * receiver-side freq change has not yet been verified by the watcher.
 *
 * Returns rows where verified_at IS NULL AND canceled_at IS NULL, ordered
 * by set_at ASC. Includes a friendly age + receiver name for display.
 *
 * No auth — this is read-only state that drives a passive warning
 * banner; the bartender always sees it. Routes that MODIFY state are
 * admin-gated.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { db, schema } from '@/db'
import { and, isNull, asc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    // Active pending = not verified AND not canceled.
    const rows = await db
      .select()
      .from(schema.shurePendingResync)
      .where(
        and(
          isNull(schema.shurePendingResync.verifiedAt),
          isNull(schema.shurePendingResync.canceledAt),
        ),
      )
      .orderBy(asc(schema.shurePendingResync.setAt))
      .all()

    // Enrich each row with the receiver's display name so the banner
    // can say "Holmgren Mic's 1 and 2 — channel 1" without a second
    // round-trip.
    const enriched = await Promise.all(
      rows.map(async (row) => {
        let receiverName: string | null = null
        try {
          const rec = await db
            .select({ name: schema.audioProcessors.name })
            .from(schema.audioProcessors)
            .where(eq(schema.audioProcessors.id, row.receiverId))
            .all()
          receiverName = rec[0]?.name ?? null
        } catch (err) {
          /* silent — degrade to null */
        }
        const nowSec = Math.floor(Date.now() / 1000)
        return {
          id: row.id,
          receiverId: row.receiverId,
          receiverName,
          channel: row.channel,
          oldFreqMhz: row.oldFreqKhz / 1000,
          newFreqMhz: row.newFreqKhz / 1000,
          setAt: row.setAt,
          setAtIso: new Date(row.setAt * 1000).toISOString(),
          ageSec: nowSec - row.setAt,
          notes: row.notes,
        }
      }),
    )

    return NextResponse.json({
      success: true,
      count: enriched.length,
      pending: enriched,
    })
  } catch (err) {
    logger.debug(
      `[PENDING-RESYNC] query failed: ${(err as Error)?.message ?? err}`,
    )
    // Degrade gracefully — empty list rather than 500 — so a transient
    // DB hiccup doesn't put a red banner up everywhere.
    return NextResponse.json({ success: true, count: 0, pending: [] })
  }
}
