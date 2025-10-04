
import fs from 'fs';
import path from 'path';

export interface DocumentChunk {
  source: string;
  type: 'pdf' | 'markdown';
  content: string;
  title?: string;
  section?: string;
}

export interface KnowledgeBase {
  documents: DocumentChunk[];
  lastUpdated: string;
  stats: {
    totalDocuments: number;
    totalPDFs: number;
    totalMarkdown: number;
    totalCharacters: number;
  };
}

let knowledgeBaseCache: KnowledgeBase | null = null;
let lastLoadTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function loadKnowledgeBase(): KnowledgeBase {
  const now = Date.now();
  
  // Return cached version if still valid
  if (knowledgeBaseCache && (now - lastLoadTime) < CACHE_DURATION) {
    return knowledgeBaseCache;
  }
  
  const knowledgeBasePath = path.join(process.cwd(), 'data', 'ai-knowledge-base.json');
  
  try {
    const data = fs.readFileSync(knowledgeBasePath, 'utf-8');
    knowledgeBaseCache = JSON.parse(data);
    lastLoadTime = now;
    return knowledgeBaseCache!;
  } catch (error) {
    console.error('Error loading knowledge base:', error);
    return {
      documents: [] as any[],
      lastUpdated: new Date().toISOString(),
      stats: {
        totalDocuments: 0,
        totalPDFs: 0,
        totalMarkdown: 0,
        totalCharacters: 0
      }
    };
  }
}

export function searchKnowledgeBase(query: string, maxResults: number = 5): DocumentChunk[] {
  const kb = loadKnowledgeBase();
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2);
  
  // Score each document based on relevance
  const scoredDocs = kb.documents.map(doc => {
    let score = 0;
    const contentLower = doc.content.toLowerCase();
    const titleLower = (doc.title || '').toLowerCase();
    const sourceLower = doc.source.toLowerCase();
    
    // Count term matches
    for (const term of queryTerms) {
      // Title matches are worth more
      if (titleLower.includes(term)) score += 5;
      if (sourceLower.includes(term)) score += 3;
      
      // Count occurrences in content
      const regex = new RegExp(term, 'gi');
      const matches = contentLower.match(regex);
      if (matches) {
        score += matches.length;
      }
    }
    
    return { doc, score };
  });
  
  // Sort by score and return top results
  return scoredDocs
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(item => item.doc);
}

export function buildContextFromDocs(docs: DocumentChunk[]): string {
  if (docs.length === 0) {
    return '';
  }
  
  let context = '\n\n=== SYSTEM DOCUMENTATION CONTEXT ===\n\n';
  
  docs.forEach((doc, index) => {
    context += `[Document ${index + 1}: ${doc.title || doc.source}`;
    if (doc.section) {
      context += ` - ${doc.section}`;
    }
    context += ']\n';
    context += doc.content;
    context += '\n\n---\n\n';
  });
  
  context += '=== END DOCUMENTATION CONTEXT ===\n\n';
  context += 'Based on the above documentation, please provide an accurate and helpful response.\n\n';
  
  return context;
}
