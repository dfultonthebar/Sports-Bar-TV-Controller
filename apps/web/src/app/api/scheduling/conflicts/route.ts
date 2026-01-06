import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@sports-bar/logger';
import { withRateLimit } from '@/lib/rate-limiting/middleware';
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter';
import { validateQueryParams, z } from '@/lib/validation';
import { conflictDetector } from '@/lib/scheduling/conflict-detector';

// GET - Detect scheduling conflicts
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT);
  if (!rateLimit.allowed) return rateLimit.response;

  logger.api.request('GET', '/api/scheduling/conflicts');

  const validationSchema = z.object({
    lookAheadHours: z.coerce.number().int().min(1).max(168).optional(), // 1 hour to 1 week
    gameId: z.string().optional(), // Check conflicts for specific game
    startTime: z.coerce.number().int().optional(), // Unix timestamp
    endTime: z.coerce.number().int().optional(), // Unix timestamp
  });

  const queryValidation = validateQueryParams(request, validationSchema);
  if (!queryValidation.success) return queryValidation.error;

  try {
    const { lookAheadHours = 24, gameId, startTime, endTime } = queryValidation.data;

    let result;

    if (gameId) {
      // Check conflicts for specific game
      const conflicts = await conflictDetector.checkGameConflicts(gameId);
      result = {
        conflicts,
        totalConflicts: conflicts.length,
        criticalConflicts: conflicts.filter(c => c.severity === 'critical').length,
        affectedGames: conflicts.reduce((sum, c) => sum + c.conflictingGames.length, 0),
        detectedAt: Math.floor(Date.now() / 1000),
      };
    } else if (startTime && endTime) {
      // Check conflicts for specific time window
      const conflicts = await conflictDetector.getConflictsForTimeWindow(startTime, endTime);
      result = {
        conflicts,
        totalConflicts: conflicts.length,
        criticalConflicts: conflicts.filter(c => c.severity === 'critical').length,
        affectedGames: conflicts.reduce((sum, c) => sum + c.conflictingGames.length, 0),
        detectedAt: Math.floor(Date.now() / 1000),
      };
    } else {
      // Detect all conflicts in look-ahead window
      result = await conflictDetector.detectConflicts(lookAheadHours);
    }

    logger.api.response('GET', '/api/scheduling/conflicts', 200);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.api.error('GET', '/api/scheduling/conflicts', error);
    return NextResponse.json(
      { success: false, error: 'Failed to detect conflicts', details: error.message },
      { status: 500 }
    );
  }
}
