import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { logger } from '@sports-bar/logger';
import { withRateLimit } from '@/lib/rate-limiting/middleware';
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter';

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ);
  if (!rateLimit.allowed) {
    return rateLimit.response;
  }

  logger.api.request('GET', '/api/atlas-processors');

  try {
    const processors = await db.select().from(schema.audioProcessors);

    logger.api.response('GET', '/api/atlas-processors', 200, { count: processors.length });
    return NextResponse.json({
      success: true,
      processors: processors
    });
  } catch (error: any) {
    logger.api.error('GET', '/api/atlas-processors', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch audio processors',
        details: error.message
      },
      { status: 500 }
    );
  }
}
