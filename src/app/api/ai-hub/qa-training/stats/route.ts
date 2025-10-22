import { NextRequest, NextResponse } from 'next/server';
import { count, findMany, eq, sql } from '@/lib/db-helpers';
import { schema } from '@/db';
import { db } from '@/lib/db-helpers';

/**
 * GET /api/ai-hub/qa-training/stats
 * Returns comprehensive statistics for Q&A training dashboard
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[QA Stats] Fetching Q&A training statistics...');

    // Fetch all statistics in parallel
    const [
      totalCount,
      activeCount,
      categoryGroups,
      sourceTypeGroups,
    ] = await Promise.all([
      // Total Q&As
      count('qaEntries'),
      
      // Active Q&As
      count('qaEntries', eq(schema.qaEntries.isActive, true)),
      
      // Q&As by category - using raw SQL for groupBy
      db.all(sql`
        SELECT category, COUNT(*) as count
        FROM QAEntry
        GROUP BY category
        ORDER BY count DESC
      `),
      
      // Q&As by source type - using raw SQL for groupBy
      db.all(sql`
        SELECT sourceType, COUNT(*) as count
        FROM QAEntry
        GROUP BY sourceType
        ORDER BY count DESC
      `),
    ]);

    // Format the response
    const stats = {
      total: totalCount,
      active: activeCount,
      inactive: totalCount - activeCount,
      byCategory: categoryGroups.map((group: any) => ({
        category: group.category,
        count: group.count,
      })),
      bySource: sourceTypeGroups.map((group: any) => ({
        source: group.sourceType,
        count: group.count,
      })),
    };

    console.log('[QA Stats] Statistics retrieved:', {
      total: stats.total,
      active: stats.active,
      categoriesCount: stats.byCategory.length,
      sourcesCount: stats.bySource.length,
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[QA Stats] Error fetching statistics:', error);
    
    // Return safe default values on error
    return NextResponse.json({
      total: 0,
      active: 0,
      inactive: 0,
      byCategory: [],
      bySource: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
