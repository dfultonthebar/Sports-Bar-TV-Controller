
import { NextRequest, NextResponse } from 'next/server';
import { schema } from '@/db';
import { desc, asc, eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { findMany, create } from '@/lib/db-helpers';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'


// GET - List all home teams
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  logger.api.request('GET', '/api/home-teams');
  
  try {
    const teams = await findMany('homeTeams', {
      where: eq(schema.homeTeams.isActive, true),
      orderBy: [
        desc(schema.homeTeams.isPrimary),
        asc(schema.homeTeams.teamName)
      ]
    });

    logger.api.response('GET', '/api/home-teams', 200, { count: teams.length });
    return NextResponse.json({ teams });
  } catch (error: any) {
    logger.api.error('GET', '/api/home-teams', error);
    return NextResponse.json(
      { error: 'Failed to fetch home teams', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new home team
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error


  logger.api.request('POST', '/api/home-teams');
  
  try {
    const body = await request.json();
    logger.debug('Creating home team', { data: body });
    
    const team = await create('homeTeams', {
      teamName: body.teamName,
      league: body.league || '',
      category: body.category || 'professional',
      sport: body.sport || 'football',
      location: body.location || null,
      conference: body.conference || null,
      isPrimary: body.isPrimary || false,
      isActive: body.isActive !== undefined ? body.isActive : true
    });

    logger.api.response('POST', '/api/home-teams', 201, { teamId: team.id });
    return NextResponse.json({ team }, { status: 201 });
  } catch (error: any) {
    logger.api.error('POST', '/api/home-teams', error);
    return NextResponse.json(
      { error: 'Failed to create home team', details: error.message },
      { status: 500 }
    );
  }
}
