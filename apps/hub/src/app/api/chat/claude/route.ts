import { NextResponse } from 'next/server'
import { askClaude } from '@/lib/claude'
import type { ChatMsg } from '@/lib/ai'

// child_process spawn requires the Node runtime, and the fleet context must be
// read fresh on every request.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/chat/claude — { messages: ChatMsg[] } or { question: string } → { answer }
 * The "Ask Claude (deep)" path: delegates to the Claude Code CLI (read-only plan
 * mode) grounded with the live fleet snapshot. Slower than the local-model path
 * (deep reads can take a couple of minutes) — the UI warns accordingly.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}) as any)
    const messages: ChatMsg[] | null = Array.isArray(body.messages)
      ? body.messages.filter((m: any) => m && typeof m.content === 'string')
      : typeof body.question === 'string'
        ? [{ role: 'user', content: body.question }]
        : null
    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'messages[] or question required' }, { status: 400 })
    }
    const answer = await askClaude(messages)
    return NextResponse.json({ answer })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'claude chat failed' }, { status: 500 })
  }
}
