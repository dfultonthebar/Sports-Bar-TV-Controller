/**
 * LLM Client for Ollama Integration
 *
 * Handles communication with local Ollama LLM server
 */

import { logger } from '@sports-bar/logger';
import { RAGConfig, determineQueryComplexity } from './config';

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
}

export interface LLMResponse {
  answer: string;
  tokensUsed: number;
  model: string;
  duration: number;
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
}

/**
 * Generate embeddings using Ollama's /api/embed (batch-capable, Ollama 0.2+).
 *
 * v2.50.1 Quick Win #2: switched from the legacy /api/embeddings endpoint
 * (one-text-per-call) to the newer /api/embed (accepts `input: [...]` array).
 * For batch scans (scan-system-docs.ts), this is 10-50× faster because the
 * model stays warm and one HTTP round-trip handles many chunks instead of
 * N round-trips. Single-text callers route through the same batch path with
 * a length-1 array for code unity.
 *
 * Both paths set `keep_alive: -1` so the embedding model never unloads —
 * pairs with the chat-route v2.50.0 #1 change for the same reason.
 *
 * Backwards-compatible: if Ollama is too old to support /api/embed (returns
 * 404), falls back to serial /api/embeddings calls.
 */

async function embedBatchViaNewApi(texts: string[]): Promise<number[][] | null> {
  // Returns null on 404 so the caller can fall back. Throws on other errors.
  const response = await fetch(`${RAGConfig.ollamaUrl}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: RAGConfig.embeddingModel,
      input: texts,
      keep_alive: -1,
    }),
  });
  if (response.status === 404) return null; // old Ollama, fall back
  if (!response.ok) {
    throw new Error(`Ollama /api/embed error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  // Response shape: { model, embeddings: [[...], [...], ...], total_duration, ... }
  if (!Array.isArray(data.embeddings) || data.embeddings.length !== texts.length) {
    throw new Error(
      `Ollama /api/embed returned malformed result: expected ${texts.length} embeddings, got ${data.embeddings?.length ?? 0}`,
    );
  }
  return data.embeddings as number[][];
}

async function embedSingleViaLegacyApi(text: string): Promise<number[]> {
  const response = await fetch(`${RAGConfig.ollamaUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: RAGConfig.embeddingModel,
      prompt: text,
      keep_alive: -1, // v2.50.1: keep embedding model resident across scans
    }),
  });
  if (!response.ok) {
    throw new Error(`Ollama /api/embeddings error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data.embedding || [];
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const startTime = Date.now();
  try {
    const batched = await embedBatchViaNewApi([text]);
    const embedding = batched ? batched[0] : await embedSingleViaLegacyApi(text);
    logger.debug('Generated embedding', {
      data: {
        model: RAGConfig.embeddingModel,
        textLength: text.length,
        embeddingDim: embedding.length,
        duration: Date.now() - startTime,
        via: batched ? 'embed-batch' : 'embeddings-legacy',
      },
    });
    return embedding;
  } catch (error) {
    logger.error('Error generating embedding', { data: { error, text: text.substring(0, 100) } });
    throw error;
  }
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const startTime = Date.now();
  try {
    const batched = await embedBatchViaNewApi(texts);
    if (batched) {
      logger.debug('Generated embeddings (batch)', {
        data: {
          model: RAGConfig.embeddingModel,
          count: texts.length,
          duration: Date.now() - startTime,
        },
      });
      return batched;
    }
    // Fallback: legacy serial loop (only when /api/embed returns 404)
    logger.warn('Ollama /api/embed not supported; falling back to serial /api/embeddings', {
      data: { count: texts.length },
    });
    const embeddings: number[][] = [];
    for (const text of texts) {
      try {
        embeddings.push(await embedSingleViaLegacyApi(text));
      } catch (e) {
        logger.error('Error in batch embedding fallback', { error: e });
        embeddings.push([]);
      }
    }
    return embeddings;
  } catch (error) {
    logger.error('Error generating embeddings batch', { data: { error, count: texts.length } });
    throw error;
  }
}

/**
 * Query the LLM with context
 */
export async function queryLLM(
  query: string,
  context: string,
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const startTime = Date.now();
  const complexity = determineQueryComplexity(query);
  const maxTokens = options.maxTokens || RAGConfig.maxTokens[complexity];

  const systemPrompt = options.systemPrompt || `You are a technical documentation assistant for a Sports Bar TV Controller system.

Provide clear, accurate answers based ONLY on the context provided below. If the answer isn't in the context, say so.

Include code examples if relevant and format them properly in markdown.

Be concise but comprehensive. Focus on practical, actionable information.`;

  const prompt = `${systemPrompt}

Context from documentation:
${context}

Question: ${query}

Answer:`;

  try {
    const response = await fetch(`${RAGConfig.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: RAGConfig.llmModel,
        prompt,
        temperature: options.temperature || 0.7,
        stream: false,
        options: {
          num_predict: maxTokens,
          top_p: 0.9,
          top_k: 40,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;

    // Clean up response
    let answer = data.response || '';
    answer = cleanupResponse(answer);

    logger.info('LLM query completed', {
      data: {
        model: RAGConfig.llmModel,
        complexity,
        maxTokens,
        queryLength: query.length,
        contextLength: context.length,
        answerLength: answer.length,
        duration,
      }
    });

    return {
      answer,
      tokensUsed: data.eval_count || 0,
      model: RAGConfig.llmModel,
      duration,
    };
  } catch (error) {
    logger.error('Error querying LLM', { data: { error, query: query.substring(0, 100) }
      });
    throw error;
  }
}

/**
 * Stream LLM response
 */
export async function* streamLLM(
  query: string,
  context: string,
  options: LLMOptions = {}
): AsyncGenerator<string> {
  const complexity = determineQueryComplexity(query);
  const maxTokens = options.maxTokens || RAGConfig.maxTokens[complexity];

  const systemPrompt = options.systemPrompt || `You are a technical documentation assistant.

Provide clear, accurate answers based ONLY on the context provided. If the answer isn't in the context, say so.

Include code examples if relevant.`;

  const prompt = `${systemPrompt}

Context:
${context}

Question: ${query}

Answer:`;

  try {
    const response = await fetch(`${RAGConfig.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: RAGConfig.llmModel,
        prompt,
        temperature: options.temperature || 0.7,
        stream: true,
        options: {
          num_predict: maxTokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              yield data.response;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  } catch (error) {
    logger.error('Error streaming LLM', { error });
    throw error;
  }
}

/**
 * Clean up LLM response artifacts
 */
function cleanupResponse(text: string): string {
  // Remove common artifacts
  text = text.trim();

  // Remove "Answer:" prefix if present
  text = text.replace(/^Answer:\s*/i, '');

  // Remove excessive newlines
  text = text.replace(/\n{3,}/g, '\n\n');

  // Fix code block formatting
  text = text.replace(/```(\w+)?\n/g, '```$1\n');

  return text;
}

/**
 * Test Ollama connection
 */
export async function testOllamaConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${RAGConfig.ollamaUrl}/api/tags`, {
      method: 'GET',
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    const models = data.models || [];

    // Check if required models are available
    const hasLLM = models.some((m: any) => m.name.includes(RAGConfig.llmModel));
    const hasEmbedding = models.some((m: any) => m.name.includes(RAGConfig.embeddingModel));

    if (!hasLLM) {
      logger.warn('LLM model not found in Ollama', { data: { model: RAGConfig.llmModel }
        });
    }
    if (!hasEmbedding) {
      logger.warn('Embedding model not found in Ollama', { data: { model: RAGConfig.embeddingModel }
        });
    }

    return hasLLM && hasEmbedding;
  } catch (error) {
    logger.error('Error testing Ollama connection', { error });
    return false;
  }
}

/**
 * Get available Ollama models
 */
export async function getAvailableModels(): Promise<string[]> {
  try {
    const response = await fetch(`${RAGConfig.ollamaUrl}/api/tags`, {
      method: 'GET',
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return (data.models || []).map((m: any) => m.name);
  } catch (error) {
    logger.error('Error getting available models', { error });
    return [];
  }
}
