/**
 * RAG Rebuild API Endpoint
 *
 * POST /api/rag/rebuild - Rebuild the vector database from documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@sports-bar/logger';
import { scanDocuments, processDocuments } from '@/lib/rag-server/doc-processor';
import { clearVectorStore, addChunks, initializeVectorStore } from '@/lib/rag-server/vector-store';
import { testOllamaConnection } from '@/lib/rag-server/llm-client';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    logger.info('Starting vector database rebuild');

    // Test Ollama connection
    const ollamaReady = await testOllamaConnection();
    if (!ollamaReady) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ollama is not available or required models are not installed',
        },
        { status: 503 }
      );
    }

    // Initialize vector store
    await initializeVectorStore();

    // Clear existing data
    await clearVectorStore();
    logger.info('Vector store cleared');

    // Scan documents
    const documentPaths = await scanDocuments();
    logger.info('Documents scanned', { data: { count: documentPaths.length }
      });

    if (documentPaths.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No documents found to index',
        data: {
          documentsProcessed: 0,
          chunksCreated: 0,
          errors: 0,
          duration: Date.now() - startTime,
        },
      });
    }

    // Process documents in batches
    const batchSize = 10;
    let totalChunks = 0;
    let errors = 0;

    for (let i = 0; i < documentPaths.length; i += batchSize) {
      const batch = documentPaths.slice(i, i + batchSize);
      const results = await processDocuments(batch);

      for (const result of results) {
        if (result.error) {
          errors++;
          logger.warn('Document processing error', {
            data: {
              file: result.filename,
              error: result.error,
            }
          });
          continue;
        }

        if (result.chunks.length > 0) {
          await addChunks(result.chunks);
          totalChunks += result.chunks.length;
        }
      }

      logger.info('Batch processed', {
        data: {
          batch: Math.floor(i / batchSize) + 1,
          totalBatches: Math.ceil(documentPaths.length / batchSize),
          chunksCreated: totalChunks,
        }
      });
    }

    const duration = Date.now() - startTime;

    logger.info('Vector database rebuild completed', {
      data: {
        documentsProcessed: documentPaths.length,
        chunksCreated: totalChunks,
        errors,
        duration,
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Vector database rebuilt successfully',
      data: {
        documentsProcessed: documentPaths.length,
        chunksCreated: totalChunks,
        errors,
        duration,
      },
    });
  } catch (error) {
    logger.error('Error rebuilding vector database', { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
