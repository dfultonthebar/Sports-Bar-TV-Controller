/**
 * Vector Store for Document Embeddings
 *
 * Simple file-based vector store using cosine similarity
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '@sports-bar/logger';
import { RAGConfig } from './config';
import { DocumentChunk } from './doc-processor';
import { generateEmbedding, generateEmbeddings } from './llm-client';

export interface VectorEntry {
  id: string;
  embedding: number[];
  chunk: DocumentChunk;
  timestamp: number;
}

export interface VectorStoreData {
  version: string;
  collectionName: string;
  entries: VectorEntry[];
  lastUpdated: number;
  totalDocuments: number;
  totalChunks: number;
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
  id: string;
}

const VECTOR_STORE_FILE = path.join(RAGConfig.ragDataPath, 'vector-store.json');
const METADATA_FILE = path.join(RAGConfig.ragDataPath, 'metadata.json');

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Initialize vector store
 */
export async function initializeVectorStore(): Promise<void> {
  try {
    // Ensure rag-data directory exists
    await fs.mkdir(RAGConfig.ragDataPath, { recursive: true });

    // Check if store exists
    try {
      await fs.access(VECTOR_STORE_FILE);
      logger.info('Vector store already exists');
    } catch {
      // Create empty store
      const emptyStore: VectorStoreData = {
        version: '1.0',
        collectionName: RAGConfig.collectionName,
        entries: [],
        lastUpdated: Date.now(),
        totalDocuments: 0,
        totalChunks: 0,
      };
      await fs.writeFile(VECTOR_STORE_FILE, JSON.stringify(emptyStore, null, 2));
      logger.info('Created new vector store');
    }
  } catch (error) {
    logger.error('Error initializing vector store', { error });
    throw error;
  }
}

/**
 * Load vector store from disk
 */
export async function loadVectorStore(): Promise<VectorStoreData> {
  try {
    const data = await fs.readFile(VECTOR_STORE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    logger.warn('Failed to load vector store, creating new one', { error });
    await initializeVectorStore();
    return {
      version: '1.0',
      collectionName: RAGConfig.collectionName,
      entries: [],
      lastUpdated: Date.now(),
      totalDocuments: 0,
      totalChunks: 0,
    };
  }
}

/**
 * Save vector store to disk
 */
export async function saveVectorStore(data: VectorStoreData): Promise<void> {
  try {
    data.lastUpdated = Date.now();
    await fs.writeFile(VECTOR_STORE_FILE, JSON.stringify(data, null, 2));
    logger.info('Vector store saved', {
      data: {
        entries: data.entries.length,
        totalChunks: data.totalChunks,
      }
    });
  } catch (error) {
    logger.error('Error saving vector store', { error });
    throw error;
  }
}

/**
 * Add document chunks to vector store
 */
export async function addChunks(chunks: DocumentChunk[]): Promise<void> {
  if (chunks.length === 0) {
    return;
  }

  const startTime = Date.now();
  logger.info('Adding chunks to vector store', { data: { count: chunks.length }
    });

  try {
    // Load existing store
    const store = await loadVectorStore();

    // Generate embeddings for chunks
    const texts = chunks.map(chunk => chunk.content);
    const embeddings = await generateEmbeddings(texts);

    // Create vector entries
    const newEntries: VectorEntry[] = chunks.map((chunk, index) => ({
      id: chunk.id,
      embedding: embeddings[index],
      chunk,
      timestamp: Date.now(),
    }));

    // Remove existing entries with same IDs
    const existingIds = new Set(newEntries.map(e => e.id));
    store.entries = store.entries.filter(e => !existingIds.has(e.id));

    // Add new entries
    store.entries.push(...newEntries);
    store.totalChunks = store.entries.length;

    // Save store
    await saveVectorStore(store);

    const duration = Date.now() - startTime;
    logger.info('Chunks added successfully', {
      data: {
        count: chunks.length,
        totalChunks: store.totalChunks,
        duration,
      }
    });
  } catch (error) {
    logger.error('Error adding chunks to vector store', { error });
    throw error;
  }
}

/**
 * Search vector store for relevant chunks
 */
export async function searchVectorStore(
  query: string,
  topK: number = RAGConfig.topK,
  techTagFilter?: string[]
): Promise<SearchResult[]> {
  const startTime = Date.now();

  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Load vector store
    const store = await loadVectorStore();

    if (store.entries.length === 0) {
      logger.warn('Vector store is empty');
      return [];
    }

    // Filter by tech tags if provided
    let entries = store.entries;
    if (techTagFilter && techTagFilter.length > 0) {
      entries = entries.filter(entry =>
        entry.chunk.metadata.techTags.some(tag => techTagFilter.includes(tag))
      );
      logger.debug('Filtered by tech tags', {
        data: {
          filter: techTagFilter,
          remaining: entries.length,
        }
      });
    }

    // Calculate similarities
    const results: SearchResult[] = entries.map(entry => ({
      chunk: entry.chunk,
      score: cosineSimilarity(queryEmbedding, entry.embedding),
      id: entry.id,
    }));

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Take top K
    const topResults = results.slice(0, topK);

    // Filter by minimum relevance score
    const filteredResults = topResults.filter(
      result => result.score >= RAGConfig.minRelevanceScore
    );

    const duration = Date.now() - startTime;
    logger.info('Vector search completed', {
      data: {
        query: query.substring(0, 50),
        resultsFound: filteredResults.length,
        topScore: filteredResults[0]?.score || 0,
        duration,
      }
    });

    return filteredResults;
  } catch (error) {
    logger.error('Error searching vector store', { error });
    throw error;
  }
}

/**
 * Clear vector store
 */
export async function clearVectorStore(): Promise<void> {
  try {
    const emptyStore: VectorStoreData = {
      version: '1.0',
      collectionName: RAGConfig.collectionName,
      entries: [],
      lastUpdated: Date.now(),
      totalDocuments: 0,
      totalChunks: 0,
    };
    await saveVectorStore(emptyStore);
    logger.info('Vector store cleared');
  } catch (error) {
    logger.error('Error clearing vector store', { error });
    throw error;
  }
}

/**
 * Get vector store statistics
 */
export async function getVectorStoreStats(): Promise<{
  totalChunks: number;
  totalDocuments: number;
  lastUpdated: number;
  techTags: Record<string, number>;
  fileTypes: Record<string, number>;
}> {
  try {
    const store = await loadVectorStore();

    // Count tech tags
    const techTagCounts: Record<string, number> = {};
    const fileTypeCounts: Record<string, number> = {};
    const uniqueFiles = new Set<string>();

    for (const entry of store.entries) {
      uniqueFiles.add(entry.chunk.metadata.filepath);

      for (const tag of entry.chunk.metadata.techTags) {
        techTagCounts[tag] = (techTagCounts[tag] || 0) + 1;
      }

      const fileType = entry.chunk.metadata.fileType;
      fileTypeCounts[fileType] = (fileTypeCounts[fileType] || 0) + 1;
    }

    return {
      totalChunks: store.entries.length,
      totalDocuments: uniqueFiles.size,
      lastUpdated: store.lastUpdated,
      techTags: techTagCounts,
      fileTypes: fileTypeCounts,
    };
  } catch (error) {
    logger.error('Error getting vector store stats', { error });
    throw error;
  }
}

/**
 * Remove document from vector store
 */
export async function removeDocument(filepath: string): Promise<void> {
  try {
    const store = await loadVectorStore();

    const beforeCount = store.entries.length;
    store.entries = store.entries.filter(
      entry => entry.chunk.metadata.filepath !== filepath
    );
    const removedCount = beforeCount - store.entries.length;

    if (removedCount > 0) {
      store.totalChunks = store.entries.length;
      await saveVectorStore(store);
      logger.info('Document removed from vector store', {
        data: {
          filepath,
          chunksRemoved: removedCount,
        }
      });
    }
  } catch (error) {
    logger.error('Error removing document from vector store', { error });
    throw error;
  }
}

/**
 * List all indexed documents
 */
export async function listIndexedDocuments(): Promise<{
  filepath: string;
  filename: string;
  chunks: number;
  techTags: string[];
  lastUpdated: number;
}[]> {
  try {
    const store = await loadVectorStore();

    const documentMap = new Map<string, {
      filepath: string;
      filename: string;
      chunks: number;
      techTags: Set<string>;
      lastUpdated: number;
    }>();

    for (const entry of store.entries) {
      const filepath = entry.chunk.metadata.filepath;
      if (!documentMap.has(filepath)) {
        documentMap.set(filepath, {
          filepath,
          filename: entry.chunk.metadata.filename,
          chunks: 0,
          techTags: new Set(),
          lastUpdated: entry.timestamp,
        });
      }

      const doc = documentMap.get(filepath)!;
      doc.chunks++;
      entry.chunk.metadata.techTags.forEach(tag => doc.techTags.add(tag));
      doc.lastUpdated = Math.max(doc.lastUpdated, entry.timestamp);
    }

    return Array.from(documentMap.values()).map(doc => ({
      ...doc,
      techTags: Array.from(doc.techTags),
    }));
  } catch (error) {
    logger.error('Error listing indexed documents', { error });
    throw error;
  }
}
