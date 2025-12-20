/**
 * Vector Store - Bridge File
 *
 * Re-exports from @sports-bar/rag-server package.
 */

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
