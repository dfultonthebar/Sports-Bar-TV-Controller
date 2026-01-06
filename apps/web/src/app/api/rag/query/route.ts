/**
 * RAG Query API Endpoint
 *
 * POST /api/rag/query - Query documentation using RAG
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@sports-bar/logger';
import { queryDocs } from '@/lib/rag-server/query-engine';
import { z } from 'zod';

const querySchema = z.object({
  query: z.string().min(1).max(1000),
  tech: z.union([z.string(), z.array(z.string())]).optional(),
  topK: z.number().int().min(1).max(20).optional(),
  includeContext: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = querySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const options = validation.data as import('@/lib/rag-server/query-engine').QueryOptions;

    logger.info('RAG query received', {
      data: {
        query: options.query?.substring(0, 50),
        tech: options.tech,
      }
    });

    // Execute query
    const result = await queryDocs(options);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error in RAG query endpoint', { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// Allow GET for simple queries
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const tech = searchParams.get('tech');

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error: 'Query parameter is required',
        },
        { status: 400 }
      );
    }

    const result = await queryDocs({
      query,
      tech: tech || undefined,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error in RAG query endpoint (GET)', { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
