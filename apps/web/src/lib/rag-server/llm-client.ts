/**
 * LLM Client for Ollama Integration
 *
 * Handles communication with local Ollama LLM server
 */

import { logger } from '@/lib/logger';
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
 * Generate embeddings using Ollama
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${RAGConfig.ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: RAGConfig.embeddingModel,
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;

    logger.debug('Generated embedding', {
      data: {
        model: RAGConfig.embeddingModel,
        textLength: text.length,
        embeddingDim: data.embedding?.length || 0,
        duration,
      }
    });

    return data.embedding || [];
  } catch (error) {
    logger.error('Error generating embedding', { data: { error, text: text.substring(0, 100) }
      });
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (const text of texts) {
    try {
      const embedding = await generateEmbedding(text);
      embeddings.push(embedding);
    } catch (error) {
      logger.error('Error in batch embedding', { error });
      embeddings.push([]);
    }
  }

  return embeddings;
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
