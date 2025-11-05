/**
 * RAG Documents API Endpoint
 *
 * GET /api/rag/docs - List all indexed documents
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { listIndexedDocuments } from '@/lib/rag-server/vector-store';

export async function GET() {
  try {
    const documents = await listIndexedDocuments();

    return NextResponse.json({
      success: true,
      data: {
        documents,
        total: documents.length,
      },
    });
  } catch (error) {
    logger.error('Error listing indexed documents', { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
