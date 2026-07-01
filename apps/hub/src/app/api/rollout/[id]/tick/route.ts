import { NextResponse } from 'next/server'
import { getRollout, getRolloutBoxes } from '@/lib/repo'
import { computeNextAction, tick } from '@/lib/rollout-engine'

export const dynamic = 'force-dynamic'

/** Explicit tick endpoint for a poller (Hermes cron or manual) that wants to
 * force re-evaluation without fetching the full GET payload. Same logic as
 * GET /api/rollout/[id] — kept separate so the intent at the call site is
 * clear ("advance this") vs. "read current state". */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const existing = getRollout(id)
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const rollout = tick(id) ?? existing
  const boxes = getRolloutBoxes(id)
  return NextResponse.json({ rollout, boxes, nextAction: computeNextAction(rollout, boxes) })
}
