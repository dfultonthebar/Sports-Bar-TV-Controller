
import fs from 'fs';
import path from 'path';

interface DocumentChunk {
  id: string;
  content: string;
  source: string;
  type: 'pdf' | 'markdown' | 'code';
  metadata: {
    filename: string;
    path: string;
    size: number;
    lastModified: string;
  };
}

interface KnowledgeBase {
  chunks: DocumentChunk[];
  metadata: {
    totalChunks: number;
    totalFiles: number;
    pdfCount: number;
    markdownCount: number;
    codeCount: number;
    totalCharacters: number;
    buildDate: string;
  };
}

let cachedKnowledgeBase: KnowledgeBase | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function loadKnowledgeBase(): KnowledgeBase {
  const now = Date.now();
  
  // Return cached version if still valid
  if (cachedKnowledgeBase && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedKnowledgeBase;
  }
  
  const kbPath = path.join(process.cwd(), 'data', 'ai-knowledge-base.json');
  
  if (!fs.existsSync(kbPath)) {
    throw new Error('Knowledge base not found. Please run: npm run build-knowledge-base');
  }
  
  const data = fs.readFileSync(kbPath, 'utf-8');
  cachedKnowledgeBase = JSON.parse(data);
  cacheTimestamp = now;
  
  return cachedKnowledgeBase;
}

export function searchKnowledgeBase(query: string, limit: number = 10): DocumentChunk[] {
  const kb = loadKnowledgeBase();
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2);
  
  // Score each chunk based on relevance
  const scoredChunks = kb.chunks.map(chunk => {
    const contentLower = chunk.content.toLowerCase();
    let score = 0;
    
    // Exact phrase match gets highest score
    if (contentLower.includes(queryLower)) {
      score += 100;
    }
    
    // Individual term matches
    queryTerms.forEach(term => {
      const matches = (contentLower.match(new RegExp(term, 'g')) || []).length;
      score += matches * 10;
    });
    
    // Boost for documentation over code
    if (chunk.type === 'markdown' || chunk.type === 'pdf') {
      score *= 1.5;
    }
    
    return { chunk, score };
  });
  
  // Sort by score and return top results
  return scoredChunks
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.chunk);
}

export function getKnowledgeBaseStats() {
  const kb = loadKnowledgeBase();
  return kb.metadata;
}

export function buildContext(query: string, maxChunks: number = 5): string {
  const relevantChunks = searchKnowledgeBase(query, maxChunks);
  
  if (relevantChunks.length === 0) {
    return 'No relevant documentation found for this query.';
  }
  
  let context = 'Relevant documentation:\n\n';
  
  relevantChunks.forEach((chunk, index) => {
    context += `--- Document ${index + 1} (${chunk.metadata.filename}) ---\n`;
    context += chunk.content;
    context += '\n\n';
  });
  
  return context;
}

export function buildContextFromDocs(chunks: DocumentChunk[]): string {
  if (chunks.length === 0) {
    return 'No relevant documentation found for this query.';
  }
  
  let context = '## Relevant Documentation:\n\n';
  
  chunks.forEach((chunk, index) => {
    context += `### Document ${index + 1}: ${chunk.metadata.filename}\n`;
    context += `Source: ${chunk.source}\n`;
    context += `Type: ${chunk.type}\n\n`;
    context += chunk.content;
    context += '\n\n';
  });
  
  return context;
}
