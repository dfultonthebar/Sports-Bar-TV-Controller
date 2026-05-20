/**
 * POST /api/admin/venues/[id]/review
 *
 * Triage a pending_review NeighborhoodVenue. Three actions:
 *   { action: 'approve' }                          → review_status='approved'
 *   { action: 'decline' }                          → is_active=false
 *   { action: 'merge', targetVenueId: '<uuid>' }   → re-point events to
 *                                                    target, deactivate source
 *
 * v2.53.4 (task #182): backend half of the review workflow. UI is a
 * separate version.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db, schema } from '@/db'
import { eq, sql } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody } from '@sports-bar/validation'
import { logger } from '@sports-bar/logger'

const reviewSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('decline') }),
  z.object({ action: z.literal('merge'), targetVenueId: z.string().min(1) }),
])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const { id } = await params
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ success: false, error: 'Missing venue id' }, { status: 400 })
  }

  const bodyValidation = await validateRequestBody(request, reviewSchema)
  if (!bodyValidation.success) return bodyValidation.error
  const body = bodyValidation.data

  try {
    // Confirm the venue exists + is actually pending. Refuse to re-review
    // already-decided venues so a stale operator session can't undo
    // earlier triage decisions by accident.
    const venue = await db
      .select()
      .from(schema.neighborhoodVenues)
      .where(eq(schema.neighborhoodVenues.id, id))
      .get()
    if (!venue) {
      return NextResponse.json({ success: false, error: 'Venue not found' }, { status: 404 })
    }
    if (venue.reviewStatus !== 'pending_review') {
      return NextResponse.json(
        {
          success: false,
          error: `Venue is already ${venue.reviewStatus}; only pending_review venues can be reviewed`,
        },
        { status: 409 },
      )
    }

    if (body.action === 'approve') {
      await db
        .update(schema.neighborhoodVenues)
        .set({ reviewStatus: 'approved', updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(schema.neighborhoodVenues.id, id))
      logger.info('[ADMIN-VENUES] Approved', { data: { id, name: venue.name } })
      return NextResponse.json({ success: true, action: 'approve', venueId: id })
    }

    if (body.action === 'decline') {
      // Two changes per decline:
      //  1. is_active=false  → filters venue out of all downstream queries
      //     (shift-brief, preemptive-strike, etc — they all gate by is_active=1)
      //  2. review_status='declined'  → removes from the pending review queue.
      //     Without this, the venue stays in the GET /pending list forever
      //     even after the operator has clearly decided "no". Caught during
      //     the v2.53.4 bulk triage at Holmgren.
      await db
        .update(schema.neighborhoodVenues)
        .set({
          isActive: false,
          reviewStatus: 'declined',
          updatedAt: Math.floor(Date.now() / 1000),
        })
        .where(eq(schema.neighborhoodVenues.id, id))
      logger.info('[ADMIN-VENUES] Declined (deactivated)', { data: { id, name: venue.name } })
      return NextResponse.json({ success: true, action: 'decline', venueId: id })
    }

    // action === 'merge'
    const target = await db
      .select()
      .from(schema.neighborhoodVenues)
      .where(eq(schema.neighborhoodVenues.id, body.targetVenueId))
      .get()
    if (!target) {
      return NextResponse.json(
        { success: false, error: 'Target venue not found' },
        { status: 404 },
      )
    }
    if (target.id === id) {
      return NextResponse.json(
        { success: false, error: 'Cannot merge a venue into itself' },
        { status: 400 },
      )
    }

    // Re-point events from source to target, then deactivate source.
    // Don't delete the source row — there may be cross-table references
    // (alias rows pointing at it, scheduler logs referencing it). Just
    // hide it from downstream queries.
    const eventUpdate = await db
      .update(schema.neighborhoodEvents)
      .set({ venueId: target.id })
      .where(eq(schema.neighborhoodEvents.venueId, id))
      .returning({ id: schema.neighborhoodEvents.id })

    await db
      .update(schema.neighborhoodVenues)
      .set({ isActive: false, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(schema.neighborhoodVenues.id, id))

    logger.info('[ADMIN-VENUES] Merged', {
      data: {
        sourceId: id,
        sourceName: venue.name,
        targetId: target.id,
        targetName: target.name,
        eventsMoved: eventUpdate.length,
      },
    })
    return NextResponse.json({
      success: true,
      action: 'merge',
      sourceVenueId: id,
      targetVenueId: target.id,
      eventsMoved: eventUpdate.length,
    })
  } catch (e: any) {
    logger.error('[ADMIN-VENUES] Review failed', {
      data: { id, action: body.action, error: e?.message ?? String(e) },
    })
    return NextResponse.json(
      { success: false, error: e?.message ?? 'Internal error' },
      { status: 500 },
    )
  }
}
