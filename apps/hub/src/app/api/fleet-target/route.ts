import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getFleetTarget, setFleetTarget } from '@/lib/repo'

export const dynamic = 'force-dynamic'

/** Admin guard: if HUB_ADMIN_TOKEN is set, require it; otherwise allow (Tailscale-only host). */
function adminOk(req: NextRequest): boolean {
  const expected = process.env.HUB_ADMIN_TOKEN
  if (!expected) return true
  return req.headers.get('x-hub-admin-token') === expected
}

export async function GET() {
  const target = getFleetTarget()
  return NextResponse.json({ target: target ?? null })
}

export async function POST(req: NextRequest) {
  if (!adminOk(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }
  const { targetVersion, targetSha, setBy } = body || {}
  if (!targetVersion) {
    return NextResponse.json({ error: 'targetVersion required' }, { status: 400 })
  }
  const target = setFleetTarget(targetVersion, targetSha ?? null, setBy || 'unknown')
  return NextResponse.json({ ok: true, target })
}
