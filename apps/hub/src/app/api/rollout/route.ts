import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createRollout, listRollouts, listLocations, getRolloutBoxes } from '@/lib/repo'
import { computeNextAction } from '@/lib/rollout-engine'

export const dynamic = 'force-dynamic'

/** Admin guard: if HUB_ADMIN_TOKEN is set, require it; otherwise allow (Tailscale-only host). */
function adminOk(req: NextRequest): boolean {
  const expected = process.env.HUB_ADMIN_TOKEN
  if (!expected) return true
  return req.headers.get('x-hub-admin-token') === expected
}

export async function GET() {
  const rollouts = listRollouts()
  const withBoxes = rollouts.map((r) => {
    const boxes = getRolloutBoxes(r.id)
    return { ...r, boxes, nextAction: computeNextAction(r, boxes) }
  })
  return NextResponse.json({ rollouts: withBoxes })
}

/**
 * POST { targetVersion, targetSha?, canaryLocationId?, minSoakMinutes?, createdBy? }
 * canaryLocationId defaults to 'leg-lamp' (matches scripts/canary-config.json's
 * existing canaryBranch choice, location/leg-lamp — same designated canary,
 * just actively driven instead of the passive git-bless mechanism).
 * Wave = every OTHER active, known location EXCEPT holmgren-way (the local
 * dev box — fleet-deploy.sh excludes it from triggers for the same reason).
 */
export async function POST(req: NextRequest) {
  if (!adminOk(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }
  const { targetVersion, targetSha, canaryLocationId, minSoakMinutes, createdBy } = body || {}
  if (!targetVersion) {
    return NextResponse.json({ error: 'targetVersion required' }, { status: 400 })
  }
  const canary = canaryLocationId || 'leg-lamp'
  const waveLocationIds = listLocations()
    .map((l) => l.id)
    .filter((id) => id !== canary && id !== 'holmgren-way')

  const rollout = createRollout({
    targetVersion,
    targetSha,
    canaryLocationId: canary,
    minSoakMinutes,
    createdBy,
    waveLocationIds,
  })
  return NextResponse.json({ ok: true, rollout, waveLocationIds })
}
