/**
 * GET /api/memory-bank/restore/[id]
 * Get a specific context snapshot by ID
 */

import { NextResponse } from 'next/server';
import { getMemoryBank } from '@/lib/memory-bank';
import { logger } from '@/lib/logger';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const memoryBank = getMemoryBank();
    const snapshot = await memoryBank.getSnapshot(id);

    if (!snapshot) {
      return NextResponse.json(
        { error: 'Snapshot not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      id,
      content: snapshot,
    });
  } catch (error) {
    logger.error('Failed to restore snapshot:', { error });
    return NextResponse.json(
      { error: 'Failed to restore snapshot' },
      { status: 500 }
    );
  }
}
