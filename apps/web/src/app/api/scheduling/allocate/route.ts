import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { schema } from '@/db';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { withRateLimit } from '@/lib/rate-limiting/middleware';
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter';
import { validateRequestBody, z } from '@/lib/validation';
import { smartInputAllocator } from '@/lib/scheduling/smart-input-allocator';

// POST - Allocate a game to input sources
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT);
  if (!rateLimit.allowed) return rateLimit.response;

  logger.api.request('POST', '/api/scheduling/allocate');

  const validationSchema = z.object({
    gameId: z.string().min(1),
    tvOutputIds: z.array(z.string()).min(1),
    preferredNetwork: z.string().optional(),
    forceAllocation: z.boolean().default(false),
  });

  const bodyValidation = await validateRequestBody(request, validationSchema);
  if (!bodyValidation.success) return bodyValidation.error;

  try {
    const data = bodyValidation.data;

    const result = await smartInputAllocator.allocateGame({
      gameId: data.gameId,
      tvOutputIds: data.tvOutputIds,
      preferredNetwork: data.preferredNetwork,
      forceAllocation: data.forceAllocation,
    });

    if (result.success) {
      logger.api.response('POST', '/api/scheduling/allocate', 200);
      return NextResponse.json({
        success: true,
        allocation: result,
      });
    } else {
      logger.api.response('POST', '/api/scheduling/allocate', 409);
      return NextResponse.json(
        {
          success: false,
          error: result.message,
          conflicts: result.conflicts,
        },
        { status: 409 }
      );
    }
  } catch (error: any) {
    logger.api.error('POST', '/api/scheduling/allocate', error);
    return NextResponse.json(
      { success: false, error: 'Allocation failed', details: error.message },
      { status: 500 }
    );
  }
}

// GET - Get current allocations
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT);
  if (!rateLimit.allowed) return rateLimit.response;

  logger.api.request('GET', '/api/scheduling/allocate');

  try {
    const allocations = await db
      .select({
        allocation: schema.inputSourceAllocations,
        game: schema.gameSchedules,
        inputSource: schema.inputSources,
      })
      .from(schema.inputSourceAllocations)
      .innerJoin(
        schema.gameSchedules,
        eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id)
      )
      .innerJoin(
        schema.inputSources,
        eq(schema.inputSourceAllocations.inputSourceId, schema.inputSources.id)
      )
      .where(eq(schema.inputSourceAllocations.status, 'active'))
      .limit(50);

    logger.api.response('GET', '/api/scheduling/allocate', 200, { count: allocations.length });
    return NextResponse.json({
      success: true,
      allocations: allocations.map(a => ({
        ...a,
        allocation: {
          ...a.allocation,
          tvOutputIds: JSON.parse(a.allocation.tvOutputIds),
        },
        inputSource: {
          ...a.inputSource,
          availableNetworks: JSON.parse(a.inputSource.availableNetworks),
          installedApps: a.inputSource.installedApps ? JSON.parse(a.inputSource.installedApps) : null,
        },
        game: {
          ...a.game,
          broadcastNetworks: JSON.parse(a.game.broadcastNetworks || '[]'),
        },
      })),
    });
  } catch (error: any) {
    logger.api.error('GET', '/api/scheduling/allocate', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch allocations', details: error.message },
      { status: 500 }
    );
  }
}
