import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { listLocations, upsertLocation } from '@/lib/repo'

export const dynamic = 'force-dynamic'

/** Admin guard: if HUB_ADMIN_TOKEN is set, require it; otherwise allow (Tailscale-only host). */
function adminOk(req: NextRequest): boolean {
  const expected = process.env.HUB_ADMIN_TOKEN
  if (!expected) return true
  return req.headers.get('x-hub-admin-token') === expected
}

export async function GET() {
  // never leak the hmac secret
  const rows = listLocations().map(({ hmacSecret, ...r }) => r)
  return NextResponse.json({ locations: rows })
}

export async function POST(req: NextRequest) {
  if (!adminOk(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }
  const { id, name, branch, timezone, tailscaleHost, hmacSecret } = body || {}
  if (!id || !name || !hmacSecret) {
    return NextResponse.json({ error: 'id, name, hmacSecret required' }, { status: 400 })
  }
  const loc = upsertLocation({ id, name, branch, timezone, tailscaleHost, hmacSecret })
  const { hmacSecret: _omit, ...safe } = loc as any
  return NextResponse.json({ ok: true, location: safe })
}
