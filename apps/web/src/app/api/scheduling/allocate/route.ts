import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { schema } from '@/db';
import { eq } from 'drizzle-orm';
import { logger } from '@sports-bar/logger';
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

    // v2.25.4: the smartInputAllocator picks ONE input source by capability.
    // Before it persists the allocation, verify the chosen input is free
    // during the game's time window. Conflict check is done here (post-
    // pick, pre-persist) because the allocator doesn't expose a hook and
    // we don't want to duplicate its capability matching.
    if (result.success && result.allocationId && result.inputSourceId) {
      const { checkAllocationConflict } = await import('@/lib/scheduling/allocation-conflicts');
      const alloc = await db.select().from(schema.inputSourceAllocations)
        .where(eq(schema.inputSourceAllocations.id, result.allocationId)).limit(1).get();
      if (alloc) {
        const { conflict } = await checkAllocationConflict(
          result.inputSourceId,
          alloc.allocatedAt,
          alloc.expectedFreeAt,
          result.allocationId,
        );
        if (conflict) {
          logger.warn(`[ALLOCATE] Allocator picked ${result.inputSourceId} but it collides with ${conflict.gameLabel}; reverting`);
          // Revert the just-created allocation — smartInputAllocator.allocateGame
          // already persisted it, so we delete the conflict-creating row.
          await db.delete(schema.inputSourceAllocations)
            .where(eq(schema.inputSourceAllocations.id, result.allocationId));
          return NextResponse.json(
            { success: false, error: `Allocation conflict: input already booked for "${conflict.gameLabel}"`, conflict },
            { status: 409 },
          );
        }
      }
    }

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
    // v2.27.1: package allocator now throws `[ALLOCATOR] ...` for empty
    // outputs and conflict cases. Surface those as 409 (caller error)
    // instead of 500 (server error) so the UI can show a useful message
    // and retry with corrected inputs.
    const isAllocatorError = typeof error?.message === 'string' && error.message.startsWith('[ALLOCATOR]')
    if (isAllocatorError) {
      logger.warn(`[ALLOCATE] Allocator rejected request: ${error.message}`)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      )
    }
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
