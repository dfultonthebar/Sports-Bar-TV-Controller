export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { findMany, eq, desc } from '@/lib/db-helpers'
import { schema } from '@/db'

// GET - Get schedule execution logs
export async function GET(request: NextRequest) {
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
