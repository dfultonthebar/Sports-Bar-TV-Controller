import { NextRequest, NextResponse } from 'next/server';
import { espnTeamsAPI } from '@/lib/sports-apis/espn-teams-api';
import { logger } from '@/lib/logger';
import { withRateLimit } from '@/lib/rate-limiting/middleware';
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter';
import { validateQueryParams } from '@/lib/validation';
import { z } from 'zod';

// GET - Get teams for a specific league
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL);
  if (!rateLimit.allowed) {
    return rateLimit.response;
  }

  // Query validation
  const queryValidation = validateQueryParams(request, z.object({
    sport: z.string().min(1).optional(),
    league: z.string().min(1).optional(),
    search: z.string().optional(),
    withDivisions: z.enum(['true', 'false']).optional(),
  }));

  if (!queryValidation.success) return queryValidation.error;

  const { sport, league, search, withDivisions } = queryValidation.data;

  logger.api.request('GET', '/api/espn/teams', { sport, league, search });

  try {
    // Search across all leagues
    if (search) {
      const results = await espnTeamsAPI.searchTeams(search);
      logger.api.response('GET', '/api/espn/teams', 200, { count: results.length });
      return NextResponse.json({
        success: true,
        teams: results,
      });
    }

    // Get teams for specific league
    if (sport && league) {
      if (withDivisions === 'true') {
        const { teams, groups } = await espnTeamsAPI.getTeamsWithDivisions(sport, league);
        logger.api.response('GET', '/api/espn/teams', 200, { teams: teams.length, groups: groups.length });
        return NextResponse.json({
          success: true,
          teams,
          divisions: groups,
        });
      } else {
        const teams = await espnTeamsAPI.getTeams(sport, league);
        logger.api.response('GET', '/api/espn/teams', 200, { count: teams.length });
        return NextResponse.json({
          success: true,
          teams,
        });
      }
    }

    return NextResponse.json(
      { success: false, error: 'Must provide either sport+league or search parameter' },
      { status: 400 }
    );
  } catch (error: any) {
    logger.api.error('GET', '/api/espn/teams', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch teams', details: error.message },
      { status: 500 }
    );
  }
}
