/**
 * GET /api/memory-bank/history
 * List all context snapshots
 */

import { NextResponse } from 'next/server';
import { getMemoryBank } from '@/lib/memory-bank';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const memoryBank = getMemoryBank();
    const snapshots = await memoryBank.listSnapshots();
    const stats = await memoryBank.getStats();

    return NextResponse.json({
      success: true,
      snapshots,
      stats,
    });
  } catch (error) {
    logger.error('Failed to get snapshot history:', { error });
    return NextResponse.json(
      { error: 'Failed to get snapshot history' },
      { status: 500 }
    );
  }
}
