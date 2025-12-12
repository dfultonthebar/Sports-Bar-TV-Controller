/**
 * POST /api/memory-bank/stop-watching
 * Stop the file watcher
 */

import { NextResponse } from 'next/server';
import { getMemoryBank } from '@/lib/memory-bank';
import { logger } from '@/lib/logger';

export async function POST() {
  try {
    const memoryBank = getMemoryBank();
    await memoryBank.stopWatching();

    return NextResponse.json({
      success: true,
      message: 'File watcher stopped',
    });
  } catch (error) {
    logger.error('Failed to stop file watcher:', { error });
    return NextResponse.json(
      { error: 'Failed to stop file watcher' },
      { status: 500 }
    );
  }
}
