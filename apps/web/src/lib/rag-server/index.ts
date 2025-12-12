/**
 * RAG Server - Main Export
 *
 * Centralized exports for the RAG documentation system
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
