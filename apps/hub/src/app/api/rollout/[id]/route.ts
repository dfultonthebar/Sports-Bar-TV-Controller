import { NextResponse } from 'next/server'
import { getRollout, getRolloutBoxes } from '@/lib/repo'
import { computeNextAction, tick } from '@/lib/rollout-engine'

export const dynamic = 'force-dynamic'

/** GET re-evaluates against fresh telemetry (tick) before returning, so the
 * dashboard always reflects current progress without a separate poll step. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const existing = getRollout(id)
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const rollout = tick(id) ?? existing
  const boxes = getRolloutBoxes(id)
  return NextResponse.json({ rollout, boxes, nextAction: computeNextAction(rollout, boxes) })
}
