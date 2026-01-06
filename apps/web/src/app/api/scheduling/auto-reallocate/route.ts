/**
 * Auto-Reallocation API Endpoint
 * Handles manual triggering of auto-reallocation and retrieving stats/history
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/rate-limiting/middleware';
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter';
import { validateRequestBody, ValidationSchemas } from '@/lib/validation';
import { logger } from '@sports-bar/logger';
import { autoReallocator } from '@/lib/scheduling/auto-reallocator';
import { z } from 'zod';

/**
 * GET /api/scheduling/auto-reallocate
 * Get reallocation history and statistics
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT);
  if (!rateLimit.allowed) return rateLimit.response;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const history = autoReallocator.getHistory(limit);
    const stats = autoReallocator.getStats();

    return NextResponse.json({
      success: true,
      data: {
        stats,
        history,
      },
    });
  } catch (error: any) {
    logger.error('[AUTO-REALLOCATE-API] Error fetching history:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scheduling/auto-reallocate
 * Manually trigger auto-reallocation check or free specific allocation
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT);
  if (!rateLimit.allowed) return rateLimit.response;

  try {
    const bodyValidation = await validateRequestBody(
      request,
      z.object({
        action: z.enum(['check', 'free_allocation']),
        allocationId: z.string().optional(), // Required for 'free_allocation' action
      })
    );

    if (!bodyValidation.success) return bodyValidation.error;

    const { action, allocationId } = bodyValidation.data;

    if (action === 'check') {
      logger.info('[AUTO-REALLOCATE-API] Manual reallocation check triggered');
      const stats = await autoReallocator.performReallocationCheck();

      return NextResponse.json({
        success: true,
        message: 'Reallocation check completed',
        data: stats,
      });
    } else if (action === 'free_allocation') {
      if (!allocationId) {
        return NextResponse.json(
          { success: false, error: 'allocationId is required for free_allocation action' },
          { status: 400 }
        );
      }

      logger.info(`[AUTO-REALLOCATE-API] Manual free allocation: ${allocationId}`);
      const result = await autoReallocator.manuallyFreeAllocation(allocationId);

      return NextResponse.json(
        {
          success: result.success,
          message: result.message,
        },
        { status: result.success ? 200 : 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    logger.error('[AUTO-REALLOCATE-API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
