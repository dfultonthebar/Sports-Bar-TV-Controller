
import { NextRequest, NextResponse } from 'next/server';
import { schema } from '@/db';
import { desc, asc, eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { findMany, create } from '@/lib/db-helpers';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'


// GET - List all home teams
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  logger.api.request('GET', '/api/home-teams');

  try {
    const teams = await findMany('homeTeams', {
      orderBy: [
        desc(schema.homeTeams.isPrimary),
        desc(schema.homeTeams.priority),
        asc(schema.homeTeams.teamName)
      ]
    });

    // Parse JSON fields for response
    const teamsWithParsedFields = teams.map(team => ({
      ...team,
      preferredZones: team.preferredZones ? JSON.parse(team.preferredZones) : null,
      rivalTeams: team.rivalTeams ? JSON.parse(team.rivalTeams) : null,
      aliases: team.aliases ? JSON.parse(team.aliases) : null,
      cityAbbreviations: team.cityAbbreviations ? JSON.parse(team.cityAbbreviations) : null,
      teamAbbreviations: team.teamAbbreviations ? JSON.parse(team.teamAbbreviations) : null,
      commonVariations: team.commonVariations ? JSON.parse(team.commonVariations) : null,
    }));

    logger.api.response('GET', '/api/home-teams', 200, { count: teams.length });
    return NextResponse.json({ success: true, teams: teamsWithParsedFields });
  } catch (error: any) {
    logger.api.error('GET', '/api/home-teams', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch home teams', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new home team
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Input validation schema
  const createTeamSchema = z.object({
    teamName: z.string().min(1, 'Team name is required'),
    league: z.string().min(1, 'League is required'),
    category: z.enum(['professional', 'college', 'international', 'other']).default('professional'),
    sport: z.string().min(1, 'Sport is required'),
    location: z.string().optional().nullable(),
    conference: z.string().optional().nullable(),
    isPrimary: z.boolean().default(false),
    isActive: z.boolean().default(true),
    priority: z.number().int().min(0).max(100).default(0),

    // Scheduler fields
    minTVsWhenActive: z.number().int().min(0).max(20).default(1).nullable(),
    autoPromotePlayoffs: z.boolean().default(true).nullable(),
    preferredZones: z.array(z.string()).optional().nullable(),
    rivalTeams: z.array(z.string()).optional().nullable(),
    schedulerNotes: z.string().optional().nullable(),

    // Fuzzy matching fields
    aliases: z.array(z.string()).optional().nullable(),
    cityAbbreviations: z.array(z.string()).optional().nullable(),
    teamAbbreviations: z.array(z.string()).optional().nullable(),
    commonVariations: z.array(z.string()).optional().nullable(),
    matchingStrategy: z.enum(['exact', 'fuzzy', 'alias', 'learned']).default('fuzzy').nullable(),
    minMatchConfidence: z.number().min(0).max(1).default(0.7).nullable(),

    // Branding
    logoUrl: z.string().url().optional().nullable(),
    primaryColor: z.string().optional().nullable(),
    secondaryColor: z.string().optional().nullable(),
  })

  const bodyValidation = await validateRequestBody(request, createTeamSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const teamData = bodyValidation.data

  logger.api.request('POST', '/api/home-teams');

  try {
    logger.debug('Creating home team', { data: teamData });

    // Convert arrays to JSON strings for storage
    const team = await create('homeTeams', {
      ...teamData,
      preferredZones: teamData.preferredZones ? JSON.stringify(teamData.preferredZones) : null,
      rivalTeams: teamData.rivalTeams ? JSON.stringify(teamData.rivalTeams) : null,
      aliases: teamData.aliases ? JSON.stringify(teamData.aliases) : null,
      cityAbbreviations: teamData.cityAbbreviations ? JSON.stringify(teamData.cityAbbreviations) : null,
      teamAbbreviations: teamData.teamAbbreviations ? JSON.stringify(teamData.teamAbbreviations) : null,
      commonVariations: teamData.commonVariations ? JSON.stringify(teamData.commonVariations) : null,
    });

    logger.api.response('POST', '/api/home-teams', 201, { teamId: team.id });
    return NextResponse.json({ success: true, team }, { status: 201 });
  } catch (error: any) {
    logger.api.error('POST', '/api/home-teams', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create home team', details: error.message },
      { status: 500 }
    );
  }
}
