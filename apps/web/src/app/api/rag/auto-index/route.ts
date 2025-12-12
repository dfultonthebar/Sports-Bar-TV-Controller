/**
 * RAG Auto-Indexer Control API
 *
 * GET  /api/rag/auto-index - Get auto-indexer status
 * POST /api/rag/auto-index - Control auto-indexer (start/stop/rebuild)
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getAutoIndexer, startAutoIndexer, stopAutoIndexer } from '@/lib/rag-server';
import { z } from 'zod';

const controlSchema = z.object({
  action: z.enum(['start', 'stop', 'rebuild', 'status']),
  options: z.object({
    debounceMs: z.number().optional(),
    initialRebuild: z.boolean().optional(),
    periodicRebuildMinutes: z.number().optional(),
  }).optional(),
});

/**
 * GET - Get auto-indexer status
 */
export async function GET(request: NextRequest) {
  try {
    const indexer = getAutoIndexer();

    if (!indexer) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'not_initialized',
          message: 'Auto-indexer has not been started',
        },
      });
    }

    const status = indexer.getStatus();

    return NextResponse.json({
      success: true,
      data: {
        status: status.isRunning ? 'running' : 'stopped',
        ...status,
      },
    });
  } catch (error) {
    logger.error('[RAG-AUTO-INDEX] Error getting status', { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Control auto-indexer
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = controlSchema.safeParse(body);
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

    const { action, options } = validation.data;

    logger.info('[RAG-AUTO-INDEX] Control action received', {
      data: { action, options }
    });

    switch (action) {
      case 'start': {
        await startAutoIndexer(options);
        const indexer = getAutoIndexer();
        const status = indexer?.getStatus();

        return NextResponse.json({
          success: true,
          data: {
            message: 'Auto-indexer started successfully',
            status,
          },
        });
      }

      case 'stop': {
        await stopAutoIndexer();

        return NextResponse.json({
          success: true,
          data: {
            message: 'Auto-indexer stopped successfully',
          },
        });
      }

      case 'rebuild': {
        const indexer = getAutoIndexer();

        if (!indexer) {
          return NextResponse.json(
            {
              success: false,
              error: 'Auto-indexer not initialized. Start it first.',
            },
            { status: 400 }
          );
        }

        // Trigger rebuild in background
        indexer.triggerFullRebuild().catch(error => {
          logger.error('[RAG-AUTO-INDEX] Manual rebuild failed', { error });
        });

        return NextResponse.json({
          success: true,
          data: {
            message: 'Full rebuild triggered. This may take a few minutes.',
          },
        });
      }

      case 'status': {
        const indexer = getAutoIndexer();

        if (!indexer) {
          return NextResponse.json({
            success: true,
            data: {
              status: 'not_initialized',
              message: 'Auto-indexer has not been started',
            },
          });
        }

        const status = indexer.getStatus();

        return NextResponse.json({
          success: true,
          data: {
            status: status.isRunning ? 'running' : 'stopped',
            ...status,
          },
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid action',
          },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('[RAG-AUTO-INDEX] Error in control endpoint', { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
