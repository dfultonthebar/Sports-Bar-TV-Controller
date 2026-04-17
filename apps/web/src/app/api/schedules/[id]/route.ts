
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db'
import { update } from '@/lib/db-helpers'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'


import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
// GET - Get single schedule
export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  // Path parameter validation
  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error


  try {
    const { id } = params
    const schedule = await db.select().from(schema.schedules).where(eq(schema.schedules.id, id)).limit(1).get();

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ schedule });
  } catch (error: any) {
    logger.error('Error fetching schedule:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update schedule
export async function PUT(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Path parameter validation
  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error

  try {
    const { id } = params;
    const body = bodyValidation.data

    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    if (body.scheduleType !== undefined) updateData.scheduleType = body.scheduleType;
    if (body.executionTime !== undefined) updateData.executionTime = body.executionTime;
    if (body.daysOfWeek !== undefined) updateData.daysOfWeek = JSON.stringify(body.daysOfWeek);
    if (body.powerOnTVs !== undefined) updateData.powerOnTVs = body.powerOnTVs;
    if (body.powerOffTVs !== undefined) updateData.powerOffTVs = body.powerOffTVs;
    if (body.selectedOutputs !== undefined) updateData.selectedOutputs = JSON.stringify(body.selectedOutputs);
    if (body.setDefaultChannels !== undefined) updateData.setDefaultChannels = body.setDefaultChannels;
    if (body.defaultChannelMap !== undefined) updateData.defaultChannelMap = JSON.stringify(body.defaultChannelMap);
    if (body.inputDefaultChannels !== undefined) updateData.inputDefaultChannels = JSON.stringify(body.inputDefaultChannels);
    if (body.autoFindGames !== undefined) updateData.autoFindGames = body.autoFindGames;
    if (body.monitorHomeTeams !== undefined) updateData.monitorHomeTeams = body.monitorHomeTeams;
    if (body.homeTeamIds !== undefined) updateData.homeTeamIds = JSON.stringify(body.homeTeamIds);
    if (body.preferredProviders !== undefined) updateData.preferredProviders = JSON.stringify(body.preferredProviders);
    if (body.executionOrder !== undefined) updateData.executionOrder = body.executionOrder;
    if (body.delayBetweenCommands !== undefined) updateData.delayBetweenCommands = body.delayBetweenCommands;
    if (body.audioSettings !== undefined) updateData.audioSettings = JSON.stringify(body.audioSettings);
    if (body.fillWithSports !== undefined) updateData.fillWithSports = body.fillWithSports;

    const schedule = await update('schedules', eq(schema.schedules.id, id), updateData);

    return NextResponse.json({ schedule });
  } catch (error: any) {
    logger.error('Error updating schedule:', error);
    return NextResponse.json(
      { error: 'Failed to update schedule', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete schedule
export async function DELETE(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Path parameter validation
  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error


  try {
    const { id } = params
    await db.delete(schema.schedules).where(eq(schema.schedules.id, id)).returning().get();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting schedule:', error);
    return NextResponse.json(
      { error: 'Failed to delete schedule', details: error.message },
      { status: 500 }
    );
  }
}
