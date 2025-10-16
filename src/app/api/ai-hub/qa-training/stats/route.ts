import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
      prisma.qAEntry.count(),
      
      // Active Q&As
      prisma.qAEntry.count({
        where: { isActive: true },
      }),
      
      // Q&As by category
      prisma.qAEntry.groupBy({
        by: ['category'],
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
      }),
      
      // Q&As by source type
      prisma.qAEntry.groupBy({
        by: ['sourceType'],
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
      }),
    ]);

    // Format the response
    const stats = {
      total: totalCount,
      active: activeCount,
      inactive: totalCount - activeCount,
      byCategory: categoryGroups.map(group => ({
        category: group.category,
        count: group._count.id,
      })),
      bySource: sourceTypeGroups.map(group => ({
        source: group.sourceType,
        count: group._count.id,
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
