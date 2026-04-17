import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { schema } from '@/db';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { logger } from '@sports-bar/logger';
import { withRateLimit } from '@/lib/rate-limiting/middleware';
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter';
import { validateQueryParams, z } from '@/lib/validation';
import { espnSyncService } from '@/lib/scheduling/espn-sync-service';
import { priorityCalculator } from '@/lib/scheduling/priority-calculator';
import { resolveChannelsForNetworks } from '@/lib/network-channel-resolver';

// GET - Get games with optional filters
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT);
  if (!rateLimit.allowed) return rateLimit.response;

  logger.api.request('GET', '/api/scheduling/games');

  const queryValidation = validateQueryParams(
    request,
    z.object({
      status: z.enum(['scheduled', 'in_progress', 'completed']).optional(),
      league: z.string().optional(),
      sport: z.string().optional(),
      startDate: z.string().optional(), // ISO date string
      endDate: z.string().optional(),
      priorityOnly: z.coerce.boolean().optional(),
    })
  );

  if (!queryValidation.success) return queryValidation.error;

  try {
    const { status, league, sport, startDate, endDate, priorityOnly } = queryValidation.data;

    // Build where conditions
    const conditions: any[] = [];

    if (status) {
      conditions.push(eq(schema.gameSchedules.status, status));
    }

    if (league) {
      conditions.push(eq(schema.gameSchedules.league, league));
    }

    if (sport) {
      conditions.push(eq(schema.gameSchedules.sport, sport));
    }

    if (startDate) {
      // Convert ISO date string to Unix timestamp (seconds)
      conditions.push(gte(schema.gameSchedules.scheduledStart, Math.floor(new Date(startDate).getTime() / 1000)));
    }

    if (endDate) {
      // Convert ISO date string to Unix timestamp (seconds)
      conditions.push(lte(schema.gameSchedules.scheduledStart, Math.floor(new Date(endDate).getTime() / 1000)));
    }

    if (priorityOnly) {
      conditions.push(eq(schema.gameSchedules.isPriorityGame, true));
    }

    const games = await db
      .select()
      .from(schema.gameSchedules)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.gameSchedules.scheduledStart))
      .limit(100);

    // Resolve cable + directv channel numbers for each game by walking its
    // broadcast_networks array against the station_aliases + channel_presets
    // tables. This is what makes the Games tab show "ch 308" for Brewers
    // games instead of just "MLB.TV, Brewers.TV" with no channel. Resolver
    // caches the alias/preset lookup for 5 min internally so this loop is
    // cheap even for 100 games.
    const enrichedGames = await Promise.all(
      games.map(async (g) => {
        const broadcastNetworks: string[] = (() => {
          try { return JSON.parse(g.broadcastNetworks || '[]') } catch { return [] }
        })()
        const resolved = await resolveChannelsForNetworks(broadcastNetworks, g.primaryNetwork)
        return {
          ...g,
          broadcastNetworks,
          cableChannel: resolved.cable?.channelNumber || null,
          cablePresetName: resolved.cable?.presetName || null,
          cableMatchedNetwork: resolved.cable?.matchedNetwork || null,
          direcTVChannel: resolved.directv?.channelNumber || null,
          direcTVPresetName: resolved.directv?.presetName || null,
          direcTVMatchedNetwork: resolved.directv?.matchedNetwork || null,
        }
      })
    )

    logger.api.response('GET', '/api/scheduling/games', 200, { count: games.length });
    return NextResponse.json({
      success: true,
      games: enrichedGames,
    });
  } catch (error: any) {
    logger.api.error('GET', '/api/scheduling/games', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch games', details: error.message },
      { status: 500 }
    );
  }
}
