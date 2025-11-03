export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { findMany, eq, desc } from '@/lib/db-helpers'
import { schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

// GET - Get schedule execution logs
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');
    const limit = parseInt(searchParams.get('limit') || '50');

    const logs = await findMany('scheduleLogs', {
      where: scheduleId ? eq(schema.scheduleLogs.scheduleId, scheduleId) : undefined,
      orderBy: desc(schema.scheduleLogs.executedAt),
      limit
    });

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('Error fetching schedule logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logs', details: error.message },
      { status: 500 }
    );
  }
}
