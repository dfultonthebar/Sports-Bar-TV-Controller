import { NextResponse } from 'next/server'
import { getRailGuide } from '@/lib/rail-cache'

export const dynamic = 'force-dynamic'

/**
 * POST /api/game-data/rail — Feature B2. Body { userId, apiKey, days }.
 * Returns the caller-market's Rail guide, cached 30 min per userId. Tailnet-only;
 * the caller supplies its own Rail key (used transiently, never stored/logged).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}) as any)
    const userId = String(body?.userId || '')
    const apiKey = String(body?.apiKey || '')
    const days = Math.max(1, Math.min(14, Number(body?.days) || 7))
    if (!userId || !apiKey) {
      return NextResponse.json({ ok: false, error: 'userId and apiKey required' }, { status: 400 })
    }
    const guide = await getRailGuide(userId, apiKey, days)
    return NextResponse.json({ ok: true, guide })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'rail fetch failed' }, { status: 502 })
  }
}
