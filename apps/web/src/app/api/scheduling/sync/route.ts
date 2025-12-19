import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { withRateLimit } from '@/lib/rate-limiting/middleware';
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter';
import { validateRequestBody, z } from '@/lib/validation';
import { espnSyncService } from '@/lib/scheduling/espn-sync-service';
import { priorityCalculator } from '@/lib/scheduling/priority-calculator';

// POST - Manually trigger sync for a league
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT);
  if (!rateLimit.allowed) return rateLimit.response;

  logger.api.request('POST', '/api/scheduling/sync');

  const validationSchema = z.object({
    sport: z.string().min(1),
    league: z.string().min(1),
    startDate: z.string().optional(), // YYYYMMDD format
    endDate: z.string().optional(),   // YYYYMMDD format
  });

  const bodyValidation = await validateRequestBody(request, validationSchema);
  if (!bodyValidation.success) return bodyValidation.error;

  try {
    const { sport, league, startDate, endDate } = bodyValidation.data;

    let result;
    if (startDate && endDate) {
      // Manual sync for date range
      result = await espnSyncService.syncDateRange(sport, league, startDate, endDate);
    } else {
      // Default sync (7-day window)
      result = await espnSyncService.syncLeague(sport, league);
    }

    // Recalculate priorities for synced games
    await priorityCalculator.recalculateAllPriorities();

    // Auto-detect and create tournament brackets
    const { tournamentDetector } = await import('@/lib/scheduling/tournament-detector');
    const newBrackets = await tournamentDetector.autoCreateBrackets();
    const updatedBrackets = await tournamentDetector.updateBrackets();

    logger.api.response('POST', '/api/scheduling/sync', 200);
    return NextResponse.json({
      success: true,
      result,
      tournaments: {
        created: newBrackets.length,
        updated: updatedBrackets,
      },
    });
  } catch (error: any) {
    logger.api.error('POST', '/api/scheduling/sync', error);
    return NextResponse.json(
      { success: false, error: 'Sync failed', details: error.message },
      { status: 500 }
    );
  }
}

// GET - Get active sync status
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT);
  if (!rateLimit.allowed) return rateLimit.response;

  logger.api.request('GET', '/api/scheduling/sync');

  try {
    const activeSyncs = espnSyncService.getActiveSyncs();

    logger.api.response('GET', '/api/scheduling/sync', 200);
    return NextResponse.json({
      success: true,
      activeSyncs,
    });
  } catch (error: any) {
    logger.api.error('GET', '/api/scheduling/sync', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get sync status', details: error.message },
      { status: 500 }
    );
  }
}
