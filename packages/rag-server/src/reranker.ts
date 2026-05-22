/**
 * Cross-encoder reranker for RAG retrieval (v2.53.0+, task #138)
 *
 * Wraps onnx-community/bge-reranker-v2-m3-ONNX via @huggingface/transformers.
 * Loads once per process (globalThis singleton per Gotcha #10), reuses for
 * every subsequent query.
 *
 * When RAG_RERANK_ENABLED=false (default), rerankChunks returns the input
 * sliced to topK unchanged. When true, scores each (query, chunk) pair via
 * the model's classification head and re-sorts before slicing.
 *
 * Safe fallback: any error during init or scoring logs a warn and returns
 * the original hybrid-search order. Rerank is a quality enhancement, not a
 * correctness requirement.
 */

import { logger } from '@sports-bar/logger';
import { RAGConfig } from './config';
import type { SearchResult } from './vector-store';

// One singleton key per process. Symbol.for() hits V8's process-wide
// registry so every Next.js route bundle sees the same instance.
const RERANKER_KEY = Symbol.for('@sports-bar/rag-server/reranker');
const INIT_PROMISE_KEY = Symbol.for('@sports-bar/rag-server/reranker.init');

type RerankerPipeline = (
  inputs: Array<{ text: string; text_pair: string }>
) => Promise<
  Array<{ label: string; score: number }> | Array<{ label: string; score: number }[]>
>;

async function getPipeline(): Promise<RerankerPipeline | null> {
  const g = globalThis as any;
  // Use `RERANKER_KEY in g` rather than truthy check — a cached null
  // (failed init) is a valid memo and must short-circuit retries.
  if (RERANKER_KEY in g) return g[RERANKER_KEY];
  if (g[INIT_PROMISE_KEY]) return g[INIT_PROMISE_KEY];

  g[INIT_PROMISE_KEY] = (async () => {
    const t0 = Date.now();
    try {
      // Dynamic import — @huggingface/transformers is ESM-only, can't be
      // top-level imported from a CJS-bundled Next.js route file. The
      // `await import()` is intentionally inside the async init so first
      // call pays the load cost, not import time.
      const { pipeline } = await import('@huggingface/transformers');
      const pipe = await pipeline('text-classification', RAGConfig.rerankModel, {
        dtype: RAGConfig.rerankQuantization as any,
      });
      logger.info(`[RAG-RERANK] Pipeline loaded in ${Date.now() - t0}ms`, {
        data: {
          model: RAGConfig.rerankModel,
          dtype: RAGConfig.rerankQuantization,
        },
      });
      g[RERANKER_KEY] = pipe as any;
      return pipe as any;
    } catch (e: any) {
      logger.warn(`[RAG-RERANK] Pipeline init failed; falling back to bi-encoder order for the lifetime of this process`, {
        data: {
          error: e?.message ?? String(e),
        },
      });
      // Cache the null so subsequent rerankChunks calls don't re-attempt
      // the (potentially slow) network probe + import for every query.
      // PM2 restart is the only way to retry — matches how we handle
      // other long-lived singletons (Atlas client, Shure client).
      g[RERANKER_KEY] = null;
      return null;
    } finally {
      delete g[INIT_PROMISE_KEY];
    }
  })();

  return g[INIT_PROMISE_KEY];
}

export async function rerankChunks(
  query: string,
  results: SearchResult[],
  topK: number
): Promise<SearchResult[]> {
  if (!RAGConfig.rerankEnabled || results.length === 0) {
    return results.slice(0, topK);
  }

  if (results.length <= topK) {
    // Nothing to rerank; reranker would just return same order
    return results;
  }

  const pipe = await getPipeline();
  if (!pipe) {
    // Init failed — already logged. Return bi-encoder order.
    return results.slice(0, topK);
  }

  const t0 = Date.now();
  try {
    // bge-reranker-v2-m3 has a 512-token model max-length, but our
    // chunkSize is 750. Pre-truncate the chunk content to ~1800 chars
    // (≈ 450 tokens at 4 chars/token average) so the reranker sees a
    // coherent prefix, not a mid-tokenizer cutoff. The full chunk still
    // gets passed to the LLM downstream — this truncation only affects
    // the (query, chunk) scoring pair.
    const pairs = results.map((r) => ({
      text: query,
      text_pair: r.chunk.content.length > 1800
        ? r.chunk.content.slice(0, 1800)
        : r.chunk.content,
    }));
    // Transformers.js text-classification with text_pair pairs returns one
    // {label, score} per input. Array shape varies; flatten defensively.
    const raw: any = await pipe(pairs);
    const scores: number[] = raw.map((r: any) => {
      if (Array.isArray(r)) return r[0]?.score ?? 0;
      return typeof r?.score === 'number' ? r.score : 0;
    });

    // Write the rerank score to a dedicated field so downstream UI that
    // formats `score * 100` as a relevance percentage keeps showing the
    // RRF score (0-1) — NOT the cross-encoder logit, which can be >1 or
    // negative and would render as "Relevance: 4500%". Sort by rerank
    // score for the slice, then return.
    const scored = results.map((r, i) => ({
      ...r,
      rerankScore: scores[i] ?? 0,
    }));
    scored.sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0));
    const sliced = scored.slice(0, topK);

    const topScore = sliced[0]?.rerankScore ?? 0;
    logger.info(
      `[RAG-RERANK] Reranked ${results.length} → ${topK} in ${Date.now() - t0}ms (top rerank score ${topScore.toFixed(3)})`,
    );
    return sliced;
  } catch (e: any) {
    logger.warn(`[RAG-RERANK] Scoring failed; falling back to bi-encoder order`, {
      data: {
        error: e?.message ?? String(e),
        candidates: results.length,
      },
    });
    return results.slice(0, topK);
  }
}
