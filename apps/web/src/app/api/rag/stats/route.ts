/**
 * RAG Stats API Endpoint
 *
 * GET /api/rag/stats - Get vector database statistics
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getVectorStoreStats } from '@/lib/rag-server/vector-store';
import { getAvailableModels, testOllamaConnection } from '@/lib/rag-server/llm-client';
import { RAGConfig } from '@/lib/rag-server/config';

export async function GET() {
  try {
    // Get vector store stats
    const stats = await getVectorStoreStats();

    // Test Ollama connection
    const ollamaReady = await testOllamaConnection();
    const availableModels = ollamaReady ? await getAvailableModels() : [];

    return NextResponse.json({
      success: true,
      data: {
        vectorStore: stats,
        ollama: {
          connected: ollamaReady,
          url: RAGConfig.ollamaUrl,
          llmModel: RAGConfig.llmModel,
          embeddingModel: RAGConfig.embeddingModel,
          availableModels,
        },
        config: {
          chunkSize: RAGConfig.chunkSize,
          chunkOverlap: RAGConfig.chunkOverlap,
          topK: RAGConfig.topK,
          minRelevanceScore: RAGConfig.minRelevanceScore,
        },
      },
    });
  } catch (error) {
    logger.error('Error getting RAG stats', { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
