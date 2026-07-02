import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getRollout } from '@/lib/repo'
import { finalizeRollout } from '@/lib/rollout-engine'

export const dynamic = 'force-dynamic'

function adminOk(req: NextRequest): boolean {
  const expected = process.env.HUB_ADMIN_TOKEN
  if (!expected) return true
  return req.headers.get('x-hub-admin-token') === expected
}

/** Manual escape hatch. Marks the rollout aborted so tick()/computeNextAction
 * stop suggesting further actions. Does NOT undo anything already triggered —
 * a box mid-update keeps running its own auto-update.sh to completion
 * (which self-verifies/rolls-back independently regardless of rollout state). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!adminOk(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const rollout = getRollout(id)
  if (!rollout) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const updated = finalizeRollout(id, { status: 'aborted' })
  return NextResponse.json({ ok: true, rollout: updated })
}
