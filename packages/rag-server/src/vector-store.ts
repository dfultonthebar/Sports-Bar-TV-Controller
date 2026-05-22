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
import { bm25AddChunks, bm25Clear, bm25Search } from './bm25-store';

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
  /**
   * Cross-encoder rerank score (logit + sigmoid, 0-1).
   * Populated by `rerankChunks` when `RAG_RERANK_ENABLED=true`. Distinct
   * from `score` (RRF hybrid score 0-1) so downstream UI can keep
   * displaying the bi-encoder relevance percentage unchanged.
   */
  rerankScore?: number;
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

    // v2.50.6 Contextual Retrieval: embed `contextPrefix + content` so the
    // chunk inherits doc-level context (Anthropic Sept 2024 — claimed -35%
    // retrieval failure embeddings alone, stacks to -67% with reranker).
    // The chunk.content stays clean so the LLM sees the raw text for
    // generation. Both BM25 (below) and downstream display use raw content.
    const texts = chunks.map((chunk) => {
      const prefix = chunk.metadata.contextPrefix
      return prefix ? `${prefix}\n\n${chunk.content}` : chunk.content
    })
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

    // v2.50.4: mirror to BM25 sparse index. Errors here MUST NOT
    // poison the dense store — log and move on. Hybrid search falls
    // back to vector-only if BM25 is empty/broken.
    try {
      await bm25AddChunks(chunks.map((c) => ({
        id: c.id,
        content: c.content,
        metadata: { filepath: c.metadata?.filepath, filename: c.metadata?.filename },
      })));
    } catch (bm25Err) {
      logger.warn('BM25 mirror failed (vector store still updated)', { error: bm25Err });
    }

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

    // v2.49.6: query-aware relevance boost — when the operator's question
    // mentions a known location name OR a vendor name, boost matching
    // location/vendor-specific chunks so they crowd out generic matches.
    //
    // Motivating example: "What outputOffset does Lucky's use?" used to
    // retrieve mostly CLAUDE.md generic-rule chunks (high cosine similarity
    // because they explain outputOffset) and miss the per-location file
    // .claude/locations/lucky-s-1313.md that has the actual value.
    //
    // Boost is additive (+0.10) so it nudges relevant location chunks above
    // generic ones without overwhelming true high-similarity matches. Tuned
    // small to avoid burying truly-relevant generic docs.
    const queryLower = query.toLowerCase();
    const LOCATION_BOOSTS: Array<[RegExp, string]> = [
      [/\b(holmgren|lambeau)\b/, 'holmgren-way'],
      [/\b(graystone)\b/, 'graystone'],
      [/\b(lucky'?s?|1313)\b/, 'lucky-s-1313'],
      [/\b(stoneyard.*greenville|greenville)\b/, 'stoneyard-greenville'],
      [/\b(stoneyard.*appleton|appleton)\b/, 'stoneyard-appleton'],
      [/\b(leg lamp|leglamp)\b/, 'leg-lamp'],
    ];
    const locationMatches = LOCATION_BOOSTS
      .filter(([re]) => re.test(queryLower))
      .map(([, slug]) => slug);

    // v2.49.12/v2.50.6: audience-aware boost. When the query reads like
    // a bartender, boost docs/bartender-help/ chunks by +0.12 so they
    // crowd out operator-grade runbooks that have higher cosine
    // similarity but the wrong vocabulary.
    //
    // v2.50.6 fix: the old v2.49.12 regex was too strict — it required
    // "how do i" (with the trailing "i") and missed natural English
    // phrasings like "how do fix interference on my shure". Broadened
    // to catch:
    //   - "how do" / "how can" / "how to" (without requiring trailing "i")
    //   - "fix" / "trouble" as standalone trouble verbs
    //   - "interferen" (interference + interferance misspelling)
    //   - vendor names (shure/atlas/wolf|wolfpack/directv/fire tv) as
    //     evidence of "I'm asking about this hardware"
    //   - "wireless" / "channel" / "scan" as topic markers
    //   - "where is" / "where do" (find-something questions)
    //
    // Motivating example (v2.50.5 user-reported failure): "how do fix
    // interferance on my shure wireless system" returned SYSTEM_OVERVIEW
    // HDMI-matrix chunks and the SDR/Atlas pipeline architecture memo —
    // NOT the actual user-facing SHURE_FREQUENCY_SCAN.md / MIC_NOT_WORKING.md
    // that answer the question. Below regex catches "how do fix" + "shure"
    // + "interferen" so the boost fires.
    const BARTENDER_MARKERS = /\b(isn'?t working|not working|won'?t (come up|turn on|play|work)|no (sound|signal|video|audio|music|picture)|the (tv|mic|music|sound)|stopped|broken|stuck|frozen|i (pressed|tried|just|don'?t know)|how (do|can|to|i|you)|what do i do|where (is|do)|fix|trouble|interferen|wireless|channel scan|group scan|help)\b/;
    const isBartenderRegister = BARTENDER_MARKERS.test(queryLower);

    // v2.50.6: vendor-name boost. When the query mentions a specific
    // vendor or product line, +0.08 boost to chunks under that vendor's
    // doc/package/runbook namespace. Stacks with bartender + location.
    //
    // Resolves: "shure interference" queries that retrieve generic config
    // docs because dense embeddings don't strongly favor the Shure
    // namespace. Same problem the per-location boost solved for location
    // names.
    const VENDOR_BOOSTS: Array<[RegExp, RegExp]> = [
      [/\b(shure|slx[\-_ ]?d?|wireless mic|wireless microphone|handheld)\b/, /(shure|SHURE_|MIC_NOT_WORKING)/],
      [/\b(atlas|azm[48]|azmp[48]|audio processor)\b/, /(atlas|ATLAS_)/],
      [/\b(wolf ?pack|wolfpack|hdmi matrix|matrix switcher|output ?offset)\b/, /(wolfpack|MATRIX_|wolf-pack)/],
      [/\b(directv|genie|satellite)\b/, /(directv|DIRECTV)/],
      [/\b(fire ?tv|cube|amazon stick|alexa|kindle)\b/, /(firetv|firecube|FIRETV_|streaming)/],
      [/\b(dbx|zonepro|zone pro)\b/, /(dbx-zonepro|dbx)/],
      [/\b(bss|soundweb|hiqnet)\b/, /(bss-blu|bss)/],
      [/\b(crestron|dm[\-_ ]?nvx)\b/, /(crestron)/],
      [/\b(itach|ip2ir|ir blaster|global cache)\b/, /(ir-control|iTach|IR_)/],
      [/\b(sdr|rtl[\-_ ]?sdr|nesdr|spectrum monitor)\b/, /(sdr|SDR_)/],
    ];
    const vendorPatterns = VENDOR_BOOSTS
      .filter(([qre]) => qre.test(queryLower))
      .map(([, pathRe]) => pathRe);

    // Calculate similarities (with optional location-file boost +
    // audience boost + vendor boost)
    const results: SearchResult[] = entries.map(entry => {
      const baseScore = cosineSimilarity(queryEmbedding, entry.embedding);
      let boost = 0;
      const filepath = entry.chunk.metadata.filepath || '';
      if (isBartenderRegister && filepath.includes('/bartender-help/')) {
        boost = Math.max(boost, 0.12);
      }
      // v2.50.6: vendor-namespace boost (stacks with bartender + location)
      if (vendorPatterns.length > 0) {
        for (const pathRe of vendorPatterns) {
          if (pathRe.test(filepath)) {
            boost = Math.max(boost, 0.08);
            break;
          }
        }
      }
      if (locationMatches.length > 0) {
        for (const slug of locationMatches) {
          if (filepath.includes(`/locations/${slug}.md`) ||
              filepath.includes(`/locations/${slug}/`)) {
            boost = Math.max(boost, 0.10);
            break;
          }
        }
      }
      return {
        chunk: entry.chunk,
        score: baseScore + boost,
        id: entry.id,
      };
    });

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
    // v2.50.4: also clear BM25 index — keeping them in lockstep
    try {
      await bm25Clear();
    } catch (bm25Err) {
      logger.warn('BM25 clear failed', { error: bm25Err });
    }
  } catch (error) {
    logger.error('Error clearing vector store', { error });
    throw error;
  }
}

/**
 * v2.50.4: Hybrid search — runs vector + BM25 in parallel, fuses with
 * Reciprocal Rank Fusion (RRF, k=60 — the documented robust default).
 *
 * Why hybrid: dense embeddings smear literal identifiers (TX_MODEL,
 * outputOffset, ERR_2:1,010) into "concept" space; BM25 nails exact
 * tokens. Stacked, they outperform either alone by ~15-20% on
 * identifier-heavy queries per 2025 benchmarks.
 *
 * RRF formula: score(d) = Σ 1/(k + rank_i(d))
 *   where k=60, rank_i = rank of doc d in retriever i (1-based)
 *
 * Robust against BM25 being empty (no results / not yet indexed): falls
 * back to vector-only.
 */
export async function searchHybrid(
  query: string,
  topK: number = RAGConfig.topK,
  techTagFilter?: string[],
): Promise<SearchResult[]> {
  const RRF_K = 60;
  const RETRIEVE_DEPTH = Math.max(topK * 6, 50);

  // Run both in parallel — BM25 is fast (<10ms), vector is ~200ms
  const [vectorResults, bm25Results] = await Promise.all([
    searchVectorStore(query, RETRIEVE_DEPTH, techTagFilter),
    bm25Search(query, RETRIEVE_DEPTH),
  ]);

  // If BM25 returned nothing (no scorable query tokens), just return
  // vector top-K — no point in fusion
  if (bm25Results.length === 0) {
    return vectorResults.slice(0, topK);
  }

  // Build chunkId → SearchResult lookup from the vector side (we'll
  // need to return SearchResult shape; BM25 only knows chunkIds)
  const vectorById = new Map<string, SearchResult>();
  vectorResults.forEach((r) => vectorById.set(r.id, r));

  // Build chunkId → fused RRF score
  const fusedScores = new Map<string, { result: SearchResult; rrf: number }>();

  vectorResults.forEach((r, i) => {
    const rank = i + 1;
    fusedScores.set(r.id, { result: r, rrf: 1 / (RRF_K + rank) });
  });

  bm25Results.forEach((b) => {
    const rrfBoost = 1 / (RRF_K + b.rank);
    const existing = fusedScores.get(b.chunkId);
    if (existing) {
      existing.rrf += rrfBoost;
    } else {
      // BM25-only hit — we don't have a vector for it in our top retrieval.
      // Synthesize a SearchResult shell so it can rank in the output.
      // The chunk won't have full metadata but at least makes it through.
      // (Full content reconstruction would require a JSON store read.)
      // For now: skip BM25-only results to keep semantics tight. RRF
      // already favors items that appear in BOTH retrievers — solo-BM25
      // hits are usually low-quality (single keyword match in irrelevant doc).
    }
  });

  // Sort by fused RRF score, take topK
  const fused = Array.from(fusedScores.values())
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, topK)
    .map(({ result, rrf }) => ({
      ...result,
      score: rrf, // override score with fused RRF for downstream display
    }));

  logger.info('Hybrid search completed', {
    data: {
      query: query.substring(0, 50),
      vectorTop1Score: vectorResults[0]?.score ?? 0,
      bm25Hits: bm25Results.length,
      fusedReturned: fused.length,
      topFused: fused[0]?.score ?? 0,
    },
  });

  return fused;
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
