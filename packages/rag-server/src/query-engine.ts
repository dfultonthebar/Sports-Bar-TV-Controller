/**
 * Query Engine for RAG System
 *
 * Main interface for querying documentation with RAG
 */

import { logger } from '@sports-bar/logger';
import { searchVectorStore, SearchResult } from './vector-store';
import { queryLLM, LLMResponse } from './llm-client';
import { RAGConfig } from './config';

export interface QueryOptions {
  query: string;
  tech?: string | string[];
  topK?: number;
  includeContext?: boolean;
  temperature?: number;
}

export interface QueryResult {
  answer: string;
  sources: {
    filename: string;
    filepath: string;
    heading?: string;
    chunkIndex: number;
    relevanceScore: number;
    techTags: string[];
  }[];
  metadata: {
    model: string;
    tokensUsed: number;
    duration: number;
    chunksRetrieved: number;
    contextLength: number;
  };
  rawContext?: string;
}

/**
 * Query the documentation using RAG
 */
export async function queryDocs(options: QueryOptions): Promise<QueryResult> {
  const startTime = Date.now();
  const { query, tech, topK = RAGConfig.topK, includeContext = false, temperature } = options;

  logger.info('Processing documentation query', {
    data: {
      query: query.substring(0, 100),
      tech,
      topK,
    }
  });

  try {
    // Convert tech filter to array
    const techFilter = tech ? (Array.isArray(tech) ? tech : [tech]) : undefined;

    // Search vector store for relevant chunks
    const searchResults = await searchVectorStore(query, topK, techFilter);

    if (searchResults.length === 0) {
      logger.warn('No relevant documents found', { data: { query, tech }
        });
      return {
        answer: 'I could not find any relevant information in the documentation to answer your question. The documentation may need to be indexed, or the question may be outside the scope of available documentation.',
        sources: [],
        metadata: {
          model: RAGConfig.llmModel,
          tokensUsed: 0,
          duration: Date.now() - startTime,
          chunksRetrieved: 0,
          contextLength: 0,
        },
      };
    }

    // Build context from retrieved chunks
    const context = buildContext(searchResults);

    // Query LLM with context
    const llmResponse = await queryLLM(query, context, { temperature });

    // Extract source information
    const sources = searchResults.map(result => ({
      filename: result.chunk.metadata.filename,
      filepath: result.chunk.metadata.filepath,
      heading: result.chunk.metadata.heading,
      chunkIndex: result.chunk.metadata.chunkIndex,
      relevanceScore: result.score,
      techTags: result.chunk.metadata.techTags,
    }));

    const duration = Date.now() - startTime;

    const result: QueryResult = {
      answer: llmResponse.answer,
      sources,
      metadata: {
        model: llmResponse.model,
        tokensUsed: llmResponse.tokensUsed,
        duration,
        chunksRetrieved: searchResults.length,
        contextLength: context.length,
      },
    };

    if (includeContext) {
      result.rawContext = context;
    }

    logger.info('Query completed successfully', {
      data: {
        query: query.substring(0, 50),
        sourcesUsed: sources.length,
        answerLength: llmResponse.answer.length,
        duration,
      }
    });

    return result;
  } catch (error) {
    logger.error('Error processing query', { data: { error, query }
      });
    throw error;
  }
}

/**
 * Build context string from search results
 */
function buildContext(results: SearchResult[]): string {
  const contextParts: string[] = [];

  for (const result of results) {
    const { chunk, score } = result;
    const { filename, heading, chunkIndex } = chunk.metadata;

    // Build context header
    let header = `[Source: ${filename}`;
    if (heading) {
      header += ` - ${heading}`;
    }
    header += ` (Relevance: ${(score * 100).toFixed(1)}%)]`;

    contextParts.push(header);
    contextParts.push(chunk.content);
    contextParts.push(''); // Empty line separator
  }

  return contextParts.join('\n');
}

/**
 * Query with streaming response
 */
export async function* queryDocsStream(
  options: QueryOptions
): AsyncGenerator<{ type: 'context' | 'token' | 'metadata'; data: any }> {
  const startTime = Date.now();
  const { query, tech, topK = RAGConfig.topK } = options;

  try {
    // Convert tech filter to array
    const techFilter = tech ? (Array.isArray(tech) ? tech : [tech]) : undefined;

    // Search vector store
    const searchResults = await searchVectorStore(query, topK, techFilter);

    // Yield context information
    yield {
      type: 'context',
      data: {
        chunksFound: searchResults.length,
        sources: searchResults.map(r => ({
          filename: r.chunk.metadata.filename,
          score: r.score,
        })),
      },
    };

    if (searchResults.length === 0) {
      yield {
        type: 'token',
        data: 'No relevant documentation found.',
      };
      return;
    }

    // Build context
    const context = buildContext(searchResults);

    // Stream LLM response
    const { streamLLM } = await import('./llm-client');
    for await (const token of streamLLM(query, context, options)) {
      yield {
        type: 'token',
        data: token,
      };
    }

    // Yield final metadata
    yield {
      type: 'metadata',
      data: {
        duration: Date.now() - startTime,
        sources: searchResults.map(r => ({
          filename: r.chunk.metadata.filename,
          filepath: r.chunk.metadata.filepath,
          heading: r.chunk.metadata.heading,
          score: r.score,
        })),
      },
    };
  } catch (error) {
    logger.error('Error in streaming query', { data: { error, query }
      });
    throw error;
  }
}

/**
 * Get related documents based on a query
 */
export async function findRelatedDocs(
  query: string,
  topK: number = 10,
  techFilter?: string[]
): Promise<{
  filepath: string;
  filename: string;
  relevance: number;
  techTags: string[];
  heading?: string;
}[]> {
  try {
    const results = await searchVectorStore(query, topK, techFilter);

    // Group by document
    const docMap = new Map<string, {
      filepath: string;
      filename: string;
      maxRelevance: number;
      techTags: Set<string>;
      heading?: string;
    }>();

    for (const result of results) {
      const filepath = result.chunk.metadata.filepath;
      if (!docMap.has(filepath)) {
        docMap.set(filepath, {
          filepath,
          filename: result.chunk.metadata.filename,
          maxRelevance: result.score,
          techTags: new Set(result.chunk.metadata.techTags),
          heading: result.chunk.metadata.heading,
        });
      } else {
        const doc = docMap.get(filepath)!;
        doc.maxRelevance = Math.max(doc.maxRelevance, result.score);
        result.chunk.metadata.techTags.forEach(tag => doc.techTags.add(tag));
      }
    }

    // Convert to array and sort by relevance
    const docs = Array.from(docMap.values())
      .map(doc => ({
        filepath: doc.filepath,
        filename: doc.filename,
        relevance: doc.maxRelevance,
        techTags: Array.from(doc.techTags),
        heading: doc.heading,
      }))
      .sort((a, b) => b.relevance - a.relevance);

    return docs;
  } catch (error) {
    logger.error('Error finding related documents', { data: { error, query }
      });
    throw error;
  }
}

/**
 * Simple Q&A without LLM (just retrieve relevant chunks)
 */
export async function retrieveContext(
  query: string,
  topK: number = RAGConfig.topK,
  techFilter?: string[]
): Promise<{
  chunks: {
    content: string;
    source: string;
    score: number;
  }[];
  metadata: {
    duration: number;
    chunksFound: number;
  };
}> {
  const startTime = Date.now();

  try {
    const results = await searchVectorStore(query, topK, techFilter);

    const chunks = results.map(result => ({
      content: result.chunk.content,
      source: `${result.chunk.metadata.filename}${result.chunk.metadata.heading ? ` - ${result.chunk.metadata.heading}` : ''}`,
      score: result.score,
    }));

    return {
      chunks,
      metadata: {
        duration: Date.now() - startTime,
        chunksFound: results.length,
      },
    };
  } catch (error) {
    logger.error('Error retrieving context', { data: { error, query }
      });
    throw error;
  }
}
