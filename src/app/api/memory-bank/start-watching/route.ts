/**
 * POST /api/memory-bank/start-watching
 * Start the file watcher for auto-snapshots
 */

import { NextResponse } from 'next/server';
import { getMemoryBank } from '@/lib/memory-bank';
import { logger } from '@/lib/logger';

export async function POST() {
  try {
    const memoryBank = getMemoryBank();
    await memoryBank.startWatching();

    const stats = await memoryBank.getStats();

    return NextResponse.json({
      success: true,
      message: 'File watcher started',
      stats,
    });
  } catch (error) {
    logger.error('Failed to start file watcher:', { error });
    return NextResponse.json(
      { error: 'Failed to start file watcher' },
      { status: 500 }
    );
  }
}
