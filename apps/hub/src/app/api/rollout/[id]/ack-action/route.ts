import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getRollout } from '@/lib/repo'
import { ackAction } from '@/lib/rollout-engine'

export const dynamic = 'force-dynamic'

function adminOk(req: NextRequest): boolean {
  const expected = process.env.HUB_ADMIN_TOKEN
  if (!expected) return true
  return req.headers.get('x-hub-admin-token') === expected
}

/**
 * POST { role: 'canary' | 'wave' } — called by whoever actually performed the
 * SSH trigger (Hermes, or an operator reading the dashboard's nextAction and
 * running fleet-deploy.sh by hand) to record that the action happened. This
 * is the ONLY way rollout status advances past pending/canary_soaking — tick()
 * never fabricates a trigger that wasn't actually taken.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!adminOk(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  if (!getRollout(id)) return NextResponse.json({ error: 'not found' }, { status: 404 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }
  const role = body?.role
  if (role !== 'canary' && role !== 'wave') {
    return NextResponse.json({ error: "role must be 'canary' or 'wave'" }, { status: 400 })
  }

  try {
    const rollout = ackAction(id, role)
    return NextResponse.json({ ok: true, rollout })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'ack failed' }, { status: 409 })
  }
}
