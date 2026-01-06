import { NextRequest, NextResponse } from 'next/server';
import { cacheManager } from '@/lib/cache-manager';
import { logger } from '@sports-bar/logger';
import { withRateLimit } from '@/lib/rate-limiting/middleware';
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter';

/**
 * Clear Sports Guide Cache
 *
 * Clears the cached sports guide data to force a refresh from The Rail Media API.
 * Useful for midnight refreshes to remove old game data and fetch fresh listings.
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT);
  if (!rateLimit.allowed) {
    return rateLimit.response;
  }

  logger.api.request('POST', '/api/sports-guide/clear-cache');

  try {
    // Clear all sports-data cache entries
    cacheManager.clearType('sports-data');

    logger.info('[SPORTS_GUIDE] Cache cleared successfully');

    logger.api.response('POST', '/api/sports-guide/clear-cache', 200);
    return NextResponse.json({
      success: true,
      message: 'Sports guide cache cleared successfully'
    });
  } catch (error: any) {
    logger.api.error('POST', '/api/sports-guide/clear-cache', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear cache',
        details: error.message
      },
      { status: 500 }
    );
  }
}
