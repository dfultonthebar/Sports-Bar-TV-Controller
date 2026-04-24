/**
 * Time-overlap conflict checker for input allocations (package copy).
 *
 * v2.27.1 — duplicates apps/web/src/lib/scheduling/allocation-conflicts.ts
 * so the package allocator can guard `createAllocation` without a
 * cross-package import (web app cannot be a dependency of a package).
 *
 * Keep these two files in sync. If the SQL changes here, change the
 * web copy too — both protect against the same race condition (same
 * input booked for two overlapping games).
 *
 * Overlap semantics: two windows [a_start, a_end) and [b_start, b_end)
 * overlap iff a_start < b_end && a_end > b_start. Endpoints are
 * EXCLUSIVE of the previous allocation's end — a booking ending at
 * 15:49 doesn't block a new booking starting at 15:49 on the same
 * input.
 */

import { db, schema, and, eq, inArray, lt, gt } from '@sports-bar/database'

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

export async function checkAllocationConflict(
  inputSourceId: string,
  startUnix: number,
  endUnix: number,
  excludeAllocationId?: string | null,
): Promise<ConflictCheckResult> {
  if (!inputSourceId || startUnix >= endUnix) {
    return { conflict: null }
  }

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
