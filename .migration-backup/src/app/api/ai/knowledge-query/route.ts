
import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledgeBase, getKnowledgeBaseStats, buildContext } from '@/lib/ai-knowledge';
import { cacheHelpers, cacheManager } from '@/lib/cache-manager';
import { parsePaginationParams, paginateArray } from '@/lib/pagination';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = await request.json();
    const { query, limit = 10, page = 1 } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // Try to get from cache first
    const cacheKey = `query:${query}:limit:${limit}`;
    const cached = cacheManager.get('knowledge-base', cacheKey);

    if (cached) {
      // Apply pagination to cached results
      const paginatedResults = paginateArray(cached.results, page, limit);

      return NextResponse.json({
        success: true,
        query,
        results: paginatedResults.data,
        context: cached.context,
        count: cached.results.length,
        pagination: paginatedResults.pagination,
        cached: true
      });
    }

    // Search knowledge base
    const results = searchKnowledgeBase(query, limit * 5); // Get more for better caching
    const context = buildContext(query, 5);

    // Cache the results
    cacheManager.set('knowledge-base', cacheKey, { results, context });

    // Apply pagination
    const paginatedResults = paginateArray(results, page, limit);

    return NextResponse.json({
      success: true,
      query,
      results: paginatedResults.data,
      context,
      count: results.length,
      pagination: paginatedResults.pagination,
      cached: false
    });
  } catch (error: any) {
    logger.error('Error querying knowledge base:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const stats = getKnowledgeBaseStats();
    
    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    logger.error('Error getting knowledge base stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
