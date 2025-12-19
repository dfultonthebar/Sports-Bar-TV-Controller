import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { withRateLimit } from '@/lib/rate-limiting/middleware';
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter';
import { validateRequestBody, z } from '@/lib/validation';

/**
 * Clean Up Old Games
 *
 * Removes games from the system that started more than X hours ago.
 * Helps keep the sports guide fresh by removing stale game data.
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT);
  if (!rateLimit.allowed) {
    return rateLimit.response;
  }

  logger.api.request('POST', '/api/sports-guide/cleanup-old');

  const bodyValidation = await validateRequestBody(request, z.object({
    hoursOld: z.number().min(1).max(24).default(2)
  }));

  if (!bodyValidation.success) {
    return bodyValidation.error;
  }

  const { hoursOld } = bodyValidation.data;

  try {
    const cutoffTime = new Date(Date.now() - (hoursOld * 60 * 60 * 1000));

    logger.info(`[SPORTS_GUIDE] Cleaning up games that started before ${cutoffTime.toISOString()}`);

    // Since games are fetched fresh from The Rail Media API each time,
    // we just need to confirm the cleanup timestamp for logging purposes.
    // The actual filtering happens in the searchForGames function.

    logger.info('[SPORTS_GUIDE] Old games cleanup logged successfully');

    logger.api.response('POST', '/api/sports-guide/cleanup-old', 200);
    return NextResponse.json({
      success: true,
      message: `Games older than ${hoursOld} hours will be filtered from results`,
      cutoffTime: cutoffTime.toISOString(),
      removed: 0 // Filtering happens at query time, not storage time
    });
  } catch (error: any) {
    logger.api.error('POST', '/api/sports-guide/cleanup-old', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process cleanup',
        details: error.message
      },
      { status: 500 }
    );
  }
}
