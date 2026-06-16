import { NextResponse } from 'next/server'
import { getAllCachedLeagues } from '@/lib/espn-sync'

export const dynamic = 'force-dynamic'

/**
 * GET /api/game-data/espn — Feature B1. Returns each league's cached raw ESPN
 * games for locations to run their own syncLeague() over. No auth: read-only,
 * non-PII game schedules, hub is tailnet-only (same exposure as the dashboard).
 */
export function GET() {
  const rows = getAllCachedLeagues()
  const leagues = rows.map((r) => ({
    sport: r.sport,
    league: r.league,
    games: JSON.parse(r.gamesJson) as unknown[],
    gameCount: r.gameCount,
    updatedAt: r.updatedAt,
  }))
  return NextResponse.json({ ok: true, serverTime: Date.now(), leagues })
}
