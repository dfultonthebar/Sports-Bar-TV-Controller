
/**
 * Sports Guide API - Status Endpoint
 * 
 * Returns current API configuration status
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const apiKey = process.env.SPORTS_GUIDE_API_KEY;
    const userId = process.env.SPORTS_GUIDE_USER_ID;
    const apiUrl = process.env.SPORTS_GUIDE_API_URL || 'https://guide.thedailyrail.com/api/v1';

    const configured = !!(apiKey && userId);

    return NextResponse.json({
      success: true,
      configured,
      apiUrl,
      userId: userId || null,
      apiKeySet: !!apiKey,
      // Don't expose the actual API key for security
      apiKeyPreview: apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : null,
    });
  } catch (error) {
    logger.error('Error getting Sports Guide API status:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get API status',
      },
      { status: 500 }
    );
  }
}
