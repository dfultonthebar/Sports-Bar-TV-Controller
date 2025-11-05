/**
 * POST /api/memory-bank/snapshot
 * Create a manual snapshot
 */

import { NextResponse } from 'next/server';
import { getMemoryBank } from '@/lib/memory-bank';
import { logger } from '@/lib/logger';

export async function POST() {
  try {
    const memoryBank = getMemoryBank();
    const snapshot = await memoryBank.createSnapshot();

    return NextResponse.json({
      success: true,
      snapshot,
    });
  } catch (error) {
    logger.error('Failed to create snapshot:', { error });
    return NextResponse.json(
      { error: 'Failed to create snapshot' },
      { status: 500 }
    );
  }
}
