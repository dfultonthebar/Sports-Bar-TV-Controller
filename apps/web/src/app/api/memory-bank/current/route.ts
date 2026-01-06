/**
 * GET /api/memory-bank/current
 * Get the current/latest context snapshot
 */

import { NextResponse } from 'next/server';
import { getMemoryBank } from '@/lib/memory-bank';
import { logger } from '@sports-bar/logger';

export async function GET() {
  try {
    const memoryBank = getMemoryBank();
    const snapshot = await memoryBank.getLatestSnapshot();

    if (!snapshot) {
      return NextResponse.json(
        { error: 'No snapshots found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      content: snapshot,
    });
  } catch (error) {
    logger.error('Failed to get current snapshot:', { error });
    return NextResponse.json(
      { error: 'Failed to get current snapshot' },
      { status: 500 }
    );
  }
}
