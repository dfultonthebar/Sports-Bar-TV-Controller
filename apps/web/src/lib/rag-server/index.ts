/**
 * RAG Server - Bridge File
 *
 * Re-exports from @sports-bar/rag-server package.
 * This maintains backwards compatibility with existing imports.
 */

// Configuration
export { RAGConfig, determineQueryComplexity, extractTechTags } from '@sports-bar/rag-server';
export type { RAGConfigType } from '@sports-bar/rag-server';

// Document Processing
export {
  scanDocuments,
  readDocument,
  chunkDocument,
  processDocument,
  processDocuments,
} from '@sports-bar/rag-server';
export type { DocumentChunk, ProcessedDocument } from '@sports-bar/rag-server';

// LLM Client
export {
  generateEmbedding,
  generateEmbeddings,
  queryLLM,
  streamLLM,
  testOllamaConnection,
  getAvailableModels,
} from '@sports-bar/rag-server';
export type { LLMOptions, LLMResponse, EmbeddingResponse } from '@sports-bar/rag-server';

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
} from '@sports-bar/rag-server';
export type { VectorEntry, VectorStoreData, SearchResult } from '@sports-bar/rag-server';

// Query Engine
export {
  queryDocs,
  queryDocsStream,
  findRelatedDocs,
  retrieveContext,
} from '@sports-bar/rag-server';
export type { QueryOptions, QueryResult } from '@sports-bar/rag-server';

// Auto-Indexer
export {
  RAGAutoIndexer,
  initializeAutoIndexer,
  getAutoIndexer,
  startAutoIndexer,
  stopAutoIndexer,
} from '@sports-bar/rag-server';
export type { AutoIndexerOptions } from '@sports-bar/rag-server';
