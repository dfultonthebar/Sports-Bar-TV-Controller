import { NextResponse } from 'next/server'
import { askFleet, type ChatMsg } from '@/lib/ai'

export const dynamic = 'force-dynamic'

/** POST /api/chat — { messages: ChatMsg[] } or { question: string } → { answer }. */
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
    const answer = await askFleet(messages)
    return NextResponse.json({ answer })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'chat failed' }, { status: 500 })
  }
}
