/**
 * GET /api/chat/sessions
 *
 * Returns the persisted chat history from the chatSessions table so
 * operators can see what's been asked + what answers came back across
 * all browser sessions for this install.
 *
 * Query params:
 *   ?limit=20    (default 20, max 200) — most recent N sessions
 *   ?detail=full (default summary) — include the full messages JSON;
 *                otherwise just id, title, message count, timestamps
 *
 * v2.49.6: shipped alongside the upsert() fix that finally makes
 * ChatSession actually populate from the AI Hub UI.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { desc } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const url = new URL(request.url)
    const limit = Math.min(Number(url.searchParams.get('limit') || 20), 200)
    const wantsFullDetail = url.searchParams.get('detail') === 'full'

    const rows = await db
      .select()
      .from(schema.chatSessions)
      .orderBy(desc(schema.chatSessions.updatedAt))
      .limit(limit)

    const sessions = rows.map((row: any) => {
      let parsed: any[] = []
      try {
        parsed = JSON.parse(row.messages || '[]')
      } catch {
        parsed = []
      }
      const userMessages = parsed.filter((m) => m?.role === 'user')
      const assistantMessages = parsed.filter((m) => m?.role === 'assistant')
      return {
        id: row.id,
        title: row.title,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        messageCount: parsed.length,
        userMessageCount: userMessages.length,
        assistantMessageCount: assistantMessages.length,
        // Last user message preview (so operator can identify the session)
        lastUserMessage: userMessages.length > 0
          ? (userMessages[userMessages.length - 1].content || '').slice(0, 180)
          : null,
        // Full messages only when explicitly asked — keeps the index call cheap
        ...(wantsFullDetail ? { messages: parsed } : {}),
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        total: sessions.length,
        sessions,
      },
    })
  } catch (error) {
    logger.error('[CHAT-SESSIONS] Failed to list sessions:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
