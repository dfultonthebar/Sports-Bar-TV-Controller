/**
 * Shared time-overlap conflict checker for input allocations.
 *
 * Any code path that creates or proposes an `input_source_allocation`
 * MUST consult this helper BEFORE committing. Before v2.25.4 each path
 * had its own (or no) overlap check:
 *   - /api/schedules/bartender-schedule had a handwritten check
 *   - /api/scheduling/allocate had none
 *   - AI Suggest parser had a partial check via the bookings snapshot
 *   - scheduler-service auto-allocator had none
 *
 * That led to the v2.25.3 incident (AI Suggest proposed 76ers on
 * DirecTV 3 while Brewers were already booked). Centralizing into one
 * helper + one query makes it impossible for a new allocation path to
 * forget.
 *
 * Overlap semantics: two windows [a_start, a_end) and [b_start, b_end)
 * overlap iff a_start < b_end && a_end > b_start. Endpoints are
 * EXCLUSIVE of the previous allocation's end — so a booking that ends
 * at 15:49 doesn't block a new booking that starts at 15:49 on the
 * same input.
 */

import { and, eq, inArray, lt, gt } from 'drizzle-orm'
import { db, schema } from '@/db'

export interface ConflictInfo {
  allocationId: string
  allocatedAt: number
  expectedFreeAt: number
  status: string
  gameLabel: string
}

export interface ConflictCheckResult {
  conflict: ConflictInfo | null
}

/**
 * Check whether a proposed allocation on `inputSourceId` during the
 * window [startUnix, endUnix) would overlap any existing pending/active
 * allocation on the same input.
 *
 * Returns `{ conflict: null }` when the window is free.
 * Returns `{ conflict: {...} }` with details of the first overlapping
 * booking when the window is taken.
 *
 * Caller responsibilities:
 *   - Validate startUnix < endUnix before calling (helper does not).
 *   - If `excludeAllocationId` is provided, that specific allocation
 *     is ignored in the check (for in-place tvOutputIds updates that
 *     shouldn't trigger self-conflict).
 */
export async function checkAllocationConflict(
  inputSourceId: string,
  startUnix: number,
  endUnix: number,
  excludeAllocationId?: string | null,
): Promise<ConflictCheckResult> {
  if (!inputSourceId || startUnix >= endUnix) {
    return { conflict: null }
  }

  // Overlap condition: existing.allocatedAt < newEnd AND existing.expectedFreeAt > newStart
  const rows = await db
    .select({
      allocation: schema.inputSourceAllocations,
      game: schema.gameSchedules,
    })
    .from(schema.inputSourceAllocations)
    .leftJoin(
      schema.gameSchedules,
      eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id),
    )
    .where(
      and(
        eq(schema.inputSourceAllocations.inputSourceId, inputSourceId),
        inArray(schema.inputSourceAllocations.status, ['pending', 'active']),
        lt(schema.inputSourceAllocations.allocatedAt, endUnix),
        gt(schema.inputSourceAllocations.expectedFreeAt, startUnix),
      ),
    )
    .all()

  const overlapping = rows.filter(
    r => !excludeAllocationId || r.allocation.id !== excludeAllocationId,
  )

  if (overlapping.length === 0) return { conflict: null }

  const hit = overlapping[0]
  const game = hit.game
  const gameLabel = game
    ? [game.awayTeamName, game.homeTeamName].filter(Boolean).join(' @ ') || 'existing booking'
    : 'existing booking'

  return {
    conflict: {
      allocationId: hit.allocation.id,
      allocatedAt: hit.allocation.allocatedAt,
      expectedFreeAt: hit.allocation.expectedFreeAt,
      status: hit.allocation.status,
      gameLabel,
    },
  }
}

/**
 * Find the FIRST free input among a candidate list, skipping any that
 * would collide with an existing booking during [startUnix, endUnix).
 * Candidates are checked in array order; use that to express preference
 * (e.g., primary cable box first, overflow last).
 *
 * Returns the first non-conflicting candidate's ID, or null if all
 * candidates are busy during the window.
 */
export async function findFirstFreeInput(
  candidateInputIds: string[],
  startUnix: number,
  endUnix: number,
): Promise<string | null> {
  for (const id of candidateInputIds) {
    const { conflict } = await checkAllocationConflict(id, startUnix, endUnix)
    if (!conflict) return id
  }
  return null
}
