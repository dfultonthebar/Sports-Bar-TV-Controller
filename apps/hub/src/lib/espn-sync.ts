/**
 * Feature B1 — central ESPN sync (runs on the hub only).
 *
 * The hub fetches the 26-league ESPN scoreboard ONCE every 10 min and caches each
 * league's raw `ESPNGame[]` as JSON. Locations pull these (see
 * /api/game-data/espn) and run their OWN existing `syncLeague(sport, league,
 * games)` over them — so the per-location DB write-path is byte-identical to a
 * direct ESPN fetch. Reusing `espnScoreboardAPI.getWeekGames` (the exact client
 * the locations use) guarantees the cached games match what a box would fetch.
 *
 * Cache is only overwritten on a SUCCESSFUL fetch, so a transient ESPN outage
 * keeps serving the last-good games rather than blanking them.
 */
import { espnScoreboardAPI } from '@sports-bar/sports-apis'
import { db, schema } from '../db'

/** Same 26-league set as apps/web/src/instrumentation.ts. */
export const ESPN_LEAGUES: Array<{ sport: string; league: string }> = [
  { sport: 'baseball', league: 'mlb' },
  { sport: 'baseball', league: 'college-baseball' },
  { sport: 'baseball', league: 'college-softball' },
  { sport: 'basketball', league: 'nba' },
  { sport: 'basketball', league: 'wnba' },
  { sport: 'basketball', league: 'mens-college-basketball' },
  { sport: 'basketball', league: 'womens-college-basketball' },
  { sport: 'hockey', league: 'nhl' },
  { sport: 'hockey', league: 'mens-college-hockey' },
  { sport: 'football', league: 'nfl' },
  { sport: 'football', league: 'college-football' },
  { sport: 'football', league: 'ufl' },
  { sport: 'soccer', league: 'usa.1' },
  { sport: 'soccer', league: 'eng.1' },
  { sport: 'soccer', league: 'uefa.champions' },
  { sport: 'racing', league: 'f1' },
  { sport: 'racing', league: 'nascar-premier' },
  { sport: 'racing', league: 'irl' },
  { sport: 'golf', league: 'pga' },
  { sport: 'golf', league: 'lpga' },
  { sport: 'mma', league: 'ufc' },
  { sport: 'tennis', league: 'atp' },
  { sport: 'tennis', league: 'wta' },
  { sport: 'lacrosse', league: 'pll' },
]

let syncing = false

export async function syncAllLeaguesToHub(): Promise<{ leagues: number; games: number; errors: number }> {
  if (syncing) return { leagues: 0, games: 0, errors: 0 }
  syncing = true
  let leagues = 0
  let games = 0
  let errors = 0
  const now = Date.now()
  try {
    for (const { sport, league } of ESPN_LEAGUES) {
      try {
        const g = await espnScoreboardAPI.getWeekGames(sport, league)
        const gamesJson = JSON.stringify(g)
        db.insert(schema.espnCache)
          .values({
            leagueKey: `${sport}-${league}`,
            sport,
            league,
            gamesJson,
            gameCount: g.length,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: schema.espnCache.leagueKey,
            set: { gamesJson, gameCount: g.length, updatedAt: now },
          })
          .run()
        games += g.length
        leagues++
      } catch (e) {
        errors++
        console.error(`[HUB-ESPN] ${sport}/${league} failed:`, (e as Error)?.message ?? e)
      }
    }
  } finally {
    syncing = false
  }
  console.log(`[HUB-ESPN] synced ${leagues} leagues, ${games} games, ${errors} errors`)
  return { leagues, games, errors }
}

/** All cached leagues, for the location pull endpoint. */
export function getAllCachedLeagues() {
  return db.select().from(schema.espnCache).all()
}
