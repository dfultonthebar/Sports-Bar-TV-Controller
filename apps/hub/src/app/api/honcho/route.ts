import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// SBCC AI-Ops panel data source. Reads the fleet-ops flywheel from the Honcho
// REST API (CT213 over Tailscale). Best-effort — never throws; the page degrades
// to an "unreachable" card. No auth on Honcho v3 (LAN/Tailscale only).
const HONCHO = process.env.HONCHO_BASE || 'http://100.90.175.125:8000'
const WS = process.env.HONCHO_WORKSPACE || 'sports-bar'
const SESSION = process.env.HONCHO_SESSION || 'fleet-ops-log'

export async function GET() {
  try {
    const res = await fetch(`${HONCHO}/v3/workspaces/${WS}/sessions/${SESSION}/messages/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ ok: false, error: `honcho ${res.status}` }, { status: 502 })
    const data: any = await res.json()
    const items: any[] = data.items || data.data || []
    const events = items
      .map((m) => ({
        content: String(m.content || ''),
        createdAt: m.created_at || m.createdAt || null,
        peer: m.peer_id || m.peer_name || '',
      }))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 60)
    return NextResponse.json({ ok: true, total: items.length, workspace: WS, session: SESSION, events })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'fetch failed' }, { status: 502 })
  }
}
