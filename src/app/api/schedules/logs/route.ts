export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db'
import { scheduleLogs } from '@/db/schema'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm';
import { prisma } from '@/db/prisma-adapter'


// GET - Get schedule execution logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where = scheduleId ? { scheduleId } : {};

    const logs = await prisma.scheduleLog.findMany({
      where,
      orderBy: { executedAt: 'desc' },
      take: limit
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
