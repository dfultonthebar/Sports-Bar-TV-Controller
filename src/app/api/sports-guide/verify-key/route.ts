
/**
 * Sports Guide API - Verify Key Endpoint
 * 
 * Verifies that the configured API key is valid and working
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSportsGuideApi } from '@/lib/sportsGuideApi';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const api = getSportsGuideApi();
    const result = await api.verifyApiKey();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error verifying Sports Guide API key:', error);
    return NextResponse.json(
      {
        success: false,
        valid: false,
        message: error instanceof Error ? error.message : 'Failed to verify API key',
      },
      { status: 500 }
    );
  }
}
