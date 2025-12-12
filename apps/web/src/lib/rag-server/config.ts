/**
 * RAG (Retrieval Augmented Generation) Server Configuration
 *
 * Centralized configuration for the documentation RAG system
 */

import path from 'path';

export const RAGConfig = {
  // Document paths
  docsPath: path.join(process.cwd(), 'docs'),
  ragDataPath: path.join(process.cwd(), 'rag-data'),

  // Chunking strategy
  chunkSize: 750, // Target tokens per chunk
  chunkOverlap: 100, // Overlap between chunks for context

  // Retrieval settings
  topK: 5, // Number of relevant chunks to retrieve
  minRelevanceScore: 0.3, // Minimum similarity score (0-1)

  // Ollama configuration
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  embeddingModel: 'nomic-embed-text',
  llmModel: 'llama3.1:8b',

  // Token allocation based on query complexity
  maxTokens: {
    simple: 512,
    medium: 1024,
    complex: 2048,
  },

  // Vector store settings
  collectionName: 'sports-bar-docs',
  embeddingDimension: 768, // nomic-embed-text dimension

  // Document processing
  supportedExtensions: ['.md', '.html', '.pdf', '.txt'],
  excludeFolders: ['node_modules', '.git', '.next', 'rag-data'],

  // Tech tag detection from folder structure
  techTagPatterns: {
    'authentication': ['auth', 'login', 'session'],
    'cec': ['cec', 'hdmi'],
    'database': ['db', 'schema', 'migration'],
    'api': ['api', 'route', 'endpoint'],
    'firetv': ['firetv', 'adb'],
    'matrix': ['matrix', 'switcher'],
    'ai': ['ai', 'assistant', 'chat'],
    'testing': ['test', 'jest', 'playwright'],
    'deployment': ['deploy', 'production', 'pm2'],
  },

  // Cache settings
  embeddingsCacheDuration: 3600000, // 1 hour in ms
  documentsCacheDuration: 600000, // 10 minutes in ms
} as const;

export type RAGConfigType = typeof RAGConfig;

/**
 * Determine query complexity based on length and keywords
 */
export function determineQueryComplexity(query: string): 'simple' | 'medium' | 'complex' {
  const words = query.trim().split(/\s+/).length;
  const hasComplexKeywords = /how|why|explain|describe|implement|architecture|configure|setup/i.test(query);
  const hasCodeRequest = /code|example|snippet|function|class/i.test(query);

  if (words > 20 || (hasComplexKeywords && hasCodeRequest)) {
    return 'complex';
  } else if (words > 10 || hasComplexKeywords || hasCodeRequest) {
    return 'medium';
  }
  return 'simple';
}

/**
 * Extract tech tags from file path
 */
export function extractTechTags(filePath: string): string[] {
  const tags: string[] = [];
  const lowerPath = filePath.toLowerCase();

  for (const [tag, patterns] of Object.entries(RAGConfig.techTagPatterns)) {
    if (patterns.some(pattern => lowerPath.includes(pattern))) {
      tags.push(tag);
    }
  }

  return tags;
}
