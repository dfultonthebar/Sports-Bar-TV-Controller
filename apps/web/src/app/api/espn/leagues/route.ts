import { NextRequest, NextResponse } from 'next/server';
import { espnTeamsAPI } from '@/lib/sports-apis/espn-teams-api';
import { logger } from '@sports-bar/logger';
import { withRateLimit } from '@/lib/rate-limiting/middleware';
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter';

// GET - Get all available leagues
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL);
  if (!rateLimit.allowed) {
    return rateLimit.response;
  }

  logger.api.request('GET', '/api/espn/leagues');

  try {
    const leagues = await espnTeamsAPI.getAvailableLeagues();

    logger.api.response('GET', '/api/espn/leagues', 200, { count: leagues.length });
    return NextResponse.json({
      success: true,
      leagues: leagues.map(league => ({
        id: league.id,
        name: league.name,
        abbreviation: league.abbreviation,
        sport: league.sport,
      })),
    });
  } catch (error: any) {
    logger.api.error('GET', '/api/espn/leagues', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leagues', details: error.message },
      { status: 500 }
    );
  }
}
