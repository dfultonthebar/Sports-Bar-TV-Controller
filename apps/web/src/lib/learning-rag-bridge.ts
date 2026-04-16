/**
 * Learning → RAG Bridge
 *
 * Converts learned patterns (Wolf Pack or Atlas) into DocumentChunk format
 * and ingests them into the RAG vector store. Patterns become searchable
 * via /api/rag/query after ingestion.
 *
 * Designed to be fault-tolerant: if Ollama is down or addChunks fails,
 * the learning cycle still completes successfully.
 */

import { logger } from '@sports-bar/logger'
import type { LearnedPattern } from '@sports-bar/wolfpack'
import type { AtlasLearnedPattern } from '@sports-bar/atlas'
import type { DocumentChunk } from '@sports-bar/rag-server'

type PatternLike = LearnedPattern | AtlasLearnedPattern

export interface RAGIngestionResult {
  ingested: number
  skipped: boolean
}

/**
 * Convert learned patterns into DocumentChunks and add them to the RAG vector store.
 *
 * @param source - 'wolfpack' or 'atlas'
 * @param patterns - Array of learned patterns from either learning system
 * @returns Count of ingested chunks, or skipped=true if RAG was unavailable
 */
export async function ingestLearnedPatternsToRAG(
  source: 'wolfpack' | 'atlas',
  patterns: PatternLike[]
): Promise<RAGIngestionResult> {
  if (patterns.length === 0) {
    return { ingested: 0, skipped: false }
  }

  try {
    // Dynamic import to avoid hard dependency on rag-server/Ollama
    const { addChunks } = await import('@sports-bar/rag-server')

    const chunks: DocumentChunk[] = patterns.map((p, index) => {
      const content = [
        p.title,
        '',
        p.description,
        '',
        `Severity: ${p.severity} | Confidence: ${p.confidence}%`,
        '',
        'Recommendations:',
        ...p.recommendations.map(r => `- ${r}`),
      ].join('\n')

      return {
        id: `learning-${source}-${p.id}`,
        content,
        metadata: {
          filename: `${source}-learning-patterns.generated`,
          filepath: `learning://${source}/patterns`,
          techTags: [`${source}-learning`, 'ai'],
          chunkIndex: index,
          totalChunks: patterns.length,
          heading: p.title,
          fileType: 'generated',
          tokens: Math.ceil(content.length / 4),
        },
      }
    })

    await addChunks(chunks)

    logger.info(`[LEARNING-RAG] Ingested ${chunks.length} ${source} patterns into RAG vector store`)
    return { ingested: chunks.length, skipped: false }
  } catch (error) {
    logger.warn(`[LEARNING-RAG] Failed to ingest ${source} patterns into RAG (Ollama down?):`, error)
    return { ingested: 0, skipped: true }
  }
}
