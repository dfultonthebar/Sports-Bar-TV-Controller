# @sports-bar/rag-server

**Purpose:** Local RAG (Retrieval-Augmented Generation) for documentation Q&A. Indexes `/docs` into a file-based vector store and queries via local Ollama LLM — no cloud calls.

**Key exports** (`src/index.ts`):
- Config: `RAGConfig`, `determineQueryComplexity`, `extractTechTags`, `RAGConfigType`
- Doc processing (`src/doc-processor.ts`): `scanDocuments`, `readDocument`, `chunkDocument`, `processDocument`, `processDocuments`, `DocumentChunk`, `ProcessedDocument`
- LLM client (`src/llm-client.ts`): `generateEmbedding`, `generateEmbeddings`, `queryLLM`, `streamLLM`, `testOllamaConnection`, `getAvailableModels`, `LLMOptions`, `LLMResponse`, `EmbeddingResponse`
- Vector store (`src/vector-store.ts`): `initializeVectorStore`, `loadVectorStore`, `saveVectorStore`, `addChunks`, `searchVectorStore`, `clearVectorStore`, `getVectorStoreStats`, `removeDocument`, `listIndexedDocuments`, `VectorEntry`, `VectorStoreData`, `SearchResult`
- Query engine (`src/query-engine.ts`): `queryDocs`, `queryDocsStream`, `findRelatedDocs`, `retrieveContext`
- Auto-indexer (`src/auto-indexer.ts`) — watches docs folder for changes via `chokidar`

**Protocol / port:** Ollama HTTP on **localhost:11434**. Requires models `llama3.1:8b` (generation) and `nomic-embed-text` (embeddings).

**Used by:** `apps/web` `/api/rag/*` routes (`/stats`, `/query`, `/rebuild`, `/docs`); CLI: `npm run rag:scan`, `rag:scan:clear`, `rag:test`.

**Gotchas:**
- Chunk size **750 tokens, 100 overlap** by default — tune in `config.ts`.
- Supported formats: Markdown (`.md`), PDF (`.pdf`), HTML (`.html`).
- At Holmgren and similar fleet hosts Ollama runs IPEX-LLM on Intel Iris Xe iGPU (~14 tok/s on `llama3.1:8b` Q4). On non-Intel hardware falls back to upstream Ollama (CPU, ~3 tok/s) — see CLAUDE.md §9 "Ollama runtime".
- Tech-tag filter is auto-extracted from file content (`ai`, `cec`, `ir`, `hardware`, `testing`, `auth`, …).
- Performance: ~200ms similarity search, 2-5s LLM answer generation.

**See also:**
- CLAUDE.md §7 (RAG Documentation Server)
- `docs/CLAUDE_MEMORY_GUIDE.md` (relationship to other memory systems)
