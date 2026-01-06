/**
 * @sports-bar/rag-server
 *
 * RAG (Retrieval-Augmented Generation) server for documentation search and Q&A.
 * Uses Ollama for local LLM inference and embedding generation.
 *
 * Core Components:
 * - config: Configuration settings for RAG system
 * - doc-processor: Document scanning, parsing, and chunking
 * - llm-client: Ollama LLM integration for embeddings and queries
 * - vector-store: File-based vector storage with cosine similarity
 * - query-engine: Main interface for querying documentation
 * - auto-indexer: Automatic re-indexing on file changes
 */

// Configuration
export { RAGConfig, determineQueryComplexity, extractTechTags } from './config';
export type { RAGConfigType } from './config';

// Document Processing
export {
  scanDocuments,
  readDocument,
  chunkDocument,
  processDocument,
  processDocuments,
} from './doc-processor';
export type { DocumentChunk, ProcessedDocument } from './doc-processor';

// LLM Client
export {
  generateEmbedding,
  generateEmbeddings,
  queryLLM,
  streamLLM,
  testOllamaConnection,
  getAvailableModels,
} from './llm-client';
export type { LLMOptions, LLMResponse, EmbeddingResponse } from './llm-client';

// Vector Store
export {
  initializeVectorStore,
  loadVectorStore,
  saveVectorStore,
  addChunks,
  searchVectorStore,
  clearVectorStore,
  getVectorStoreStats,
  removeDocument,
  listIndexedDocuments,
} from './vector-store';
export type { VectorEntry, VectorStoreData, SearchResult } from './vector-store';

// Query Engine
export {
  queryDocs,
  queryDocsStream,
  findRelatedDocs,
  retrieveContext,
} from './query-engine';
export type { QueryOptions, QueryResult } from './query-engine';

// Auto-Indexer
export {
  RAGAutoIndexer,
  initializeAutoIndexer,
  getAutoIndexer,
  startAutoIndexer,
  stopAutoIndexer,
} from './auto-indexer';
export type { AutoIndexerOptions } from './auto-indexer';
