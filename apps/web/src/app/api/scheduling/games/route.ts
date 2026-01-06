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
      conditions.push(gte(schema.gameSchedules.scheduledStart, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(schema.gameSchedules.scheduledStart, new Date(endDate)));
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

    logger.api.response('GET', '/api/scheduling/games', 200, { count: games.length });
    return NextResponse.json({
      success: true,
      games: games.map(g => ({
        ...g,
        broadcastNetworks: JSON.parse(g.broadcastNetworks || '[]'),
      })),
    });
  } catch (error: any) {
    logger.api.error('GET', '/api/scheduling/games', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch games', details: error.message },
      { status: 500 }
    );
  }
}
