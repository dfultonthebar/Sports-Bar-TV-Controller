/**
 * LLM Client - Bridge File
 *
 * Re-exports from @sports-bar/rag-server package.
 */

export {
  generateEmbedding,
  generateEmbeddings,
  queryLLM,
  streamLLM,
  testOllamaConnection,
  getAvailableModels,
} from '@sports-bar/rag-server';
export type { LLMOptions, LLMResponse, EmbeddingResponse } from '@sports-bar/rag-server';
