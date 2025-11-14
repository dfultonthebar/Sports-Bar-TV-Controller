import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { schema } from '@/db';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { findFirst, update, deleteRecord } from '@/lib/db-helpers';
import { withRateLimit } from '@/lib/rate-limiting/middleware';
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter';
import { z } from 'zod';
import { validateRequestBody, validatePathParams, isValidationError } from '@/lib/validation';

// GET - Get single home team by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ);
  if (!rateLimit.allowed) {
    return rateLimit.response;
  }

  const { teamId } = params;
  logger.api.request('GET', `/api/home-teams/${teamId}`);

  try {
    const team = await findFirst('homeTeams', {
      where: eq(schema.homeTeams.id, teamId)
    });

    if (!team) {
      logger.api.response('GET', `/api/home-teams/${teamId}`, 404);
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    // Parse JSON fields for response
    const teamWithParsedFields = {
      ...team,
      preferredZones: team.preferredZones ? JSON.parse(team.preferredZones) : null,
      rivalTeams: team.rivalTeams ? JSON.parse(team.rivalTeams) : null,
      aliases: team.aliases ? JSON.parse(team.aliases) : null,
      cityAbbreviations: team.cityAbbreviations ? JSON.parse(team.cityAbbreviations) : null,
      teamAbbreviations: team.teamAbbreviations ? JSON.parse(team.teamAbbreviations) : null,
      commonVariations: team.commonVariations ? JSON.parse(team.commonVariations) : null,
    };

    logger.api.response('GET', `/api/home-teams/${teamId}`, 200);
    return NextResponse.json({ success: true, team: teamWithParsedFields });
  } catch (error: any) {
    logger.api.error('GET', `/api/home-teams/${teamId}`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch team', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update home team
export async function PUT(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE);
  if (!rateLimit.allowed) {
    return rateLimit.response;
  }

  const { teamId } = params;
  logger.api.request('PUT', `/api/home-teams/${teamId}`);

  // Validation schema for update (all fields optional except ID)
  const updateTeamSchema = z.object({
    teamName: z.string().min(1).optional(),
    league: z.string().min(1).optional(),
    category: z.enum(['professional', 'college', 'international', 'other']).optional(),
    sport: z.string().min(1).optional(),
    location: z.string().optional().nullable(),
    conference: z.string().optional().nullable(),
    isPrimary: z.boolean().optional(),
    isActive: z.boolean().optional(),
    priority: z.number().int().min(0).max(100).optional(),

    // Scheduler fields
    minTVsWhenActive: z.number().int().min(0).max(20).optional().nullable(),
    autoPromotePlayoffs: z.boolean().optional().nullable(),
    preferredZones: z.array(z.string()).optional().nullable(),
    rivalTeams: z.array(z.string()).optional().nullable(),
    schedulerNotes: z.string().optional().nullable(),

    // Fuzzy matching fields
    aliases: z.array(z.string()).optional().nullable(),
    cityAbbreviations: z.array(z.string()).optional().nullable(),
    teamAbbreviations: z.array(z.string()).optional().nullable(),
    commonVariations: z.array(z.string()).optional().nullable(),
    matchingStrategy: z.enum(['exact', 'fuzzy', 'alias', 'learned']).optional().nullable(),
    minMatchConfidence: z.number().min(0).max(1).optional().nullable(),

    // Branding
    logoUrl: z.string().url().optional().nullable(),
    primaryColor: z.string().optional().nullable(),
    secondaryColor: z.string().optional().nullable(),
  });

  const bodyValidation = await validateRequestBody(request, updateTeamSchema);
  if (isValidationError(bodyValidation)) return bodyValidation.error;
  const updateData = bodyValidation.data;

  try {
    // Check if team exists
    const existingTeam = await findFirst('homeTeams', {
      where: eq(schema.homeTeams.id, teamId)
    });

    if (!existingTeam) {
      logger.api.response('PUT', `/api/home-teams/${teamId}`, 404);
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    // Convert arrays to JSON strings for storage
    const dataToUpdate: any = { ...updateData };
    if (updateData.preferredZones !== undefined) {
      dataToUpdate.preferredZones = updateData.preferredZones ? JSON.stringify(updateData.preferredZones) : null;
    }
    if (updateData.rivalTeams !== undefined) {
      dataToUpdate.rivalTeams = updateData.rivalTeams ? JSON.stringify(updateData.rivalTeams) : null;
    }
    if (updateData.aliases !== undefined) {
      dataToUpdate.aliases = updateData.aliases ? JSON.stringify(updateData.aliases) : null;
    }
    if (updateData.cityAbbreviations !== undefined) {
      dataToUpdate.cityAbbreviations = updateData.cityAbbreviations ? JSON.stringify(updateData.cityAbbreviations) : null;
    }
    if (updateData.teamAbbreviations !== undefined) {
      dataToUpdate.teamAbbreviations = updateData.teamAbbreviations ? JSON.stringify(updateData.teamAbbreviations) : null;
    }
    if (updateData.commonVariations !== undefined) {
      dataToUpdate.commonVariations = updateData.commonVariations ? JSON.stringify(updateData.commonVariations) : null;
    }

    // Update team
    const updatedTeam = await update('homeTeams', teamId, dataToUpdate);

    logger.api.response('PUT', `/api/home-teams/${teamId}`, 200, { teamId });
    return NextResponse.json({ success: true, team: updatedTeam });
  } catch (error: any) {
    logger.api.error('PUT', `/api/home-teams/${teamId}`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to update team', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete home team
export async function DELETE(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE);
  if (!rateLimit.allowed) {
    return rateLimit.response;
  }

  const { teamId } = params;
  logger.api.request('DELETE', `/api/home-teams/${teamId}`);

  try {
    // Check if team exists
    const existingTeam = await findFirst('homeTeams', {
      where: eq(schema.homeTeams.id, teamId)
    });

    if (!existingTeam) {
      logger.api.response('DELETE', `/api/home-teams/${teamId}`, 404);
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    // Delete team
    await deleteRecord('homeTeams', teamId);

    logger.api.response('DELETE', `/api/home-teams/${teamId}`, 200, { teamId });
    return NextResponse.json({
      success: true,
      message: `Team "${existingTeam.teamName}" deleted successfully`
    });
  } catch (error: any) {
    logger.api.error('DELETE', `/api/home-teams/${teamId}`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete team', details: error.message },
      { status: 500 }
    );
  }
}
