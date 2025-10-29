
import prisma from "@/lib/prisma";
import { loadKnowledgeBase, DocumentChunk } from './ai-knowledge';

// Using singleton prisma from @/lib/prisma;

export interface CodebaseContext {
  files: Array<{
    path: string;
    type: string;
    content: string;
    relevance: number;
  }>;
  totalFiles: number;
}

/**
 * Search the indexed codebase for relevant files
 */
export async function searchCodebase(
  query: string,
  maxResults: number = 5
): Promise<CodebaseContext> {
  try {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2);
    
    // Search in indexed files
    const files = await prisma.indexedFile.findMany({
      where: {
        isActive: true,
        OR: queryTerms.map(term => ({
          OR: [
            { content: { contains: term } },
            { filePath: { contains: term } },
            { fileName: { contains: term } }
          ]
        }))
      },
      take: maxResults * 2 // Get more than needed for scoring
    });
    
    // Score and rank files
    const scoredFiles = files.map(file => {
      let score = 0;
      const contentLower = file.content.toLowerCase();
      const pathLower = file.filePath.toLowerCase();
      const nameLower = file.fileName.toLowerCase();
      
      for (const term of queryTerms) {
        if (nameLower.includes(term)) score += 5;
        if (pathLower.includes(term)) score += 3;
        
        const regex = new RegExp(term, 'gi');
        const matches = contentLower.match(regex);
        if (matches) {
          score += matches.length;
        }
      }
      
      return {
        path: file.filePath,
        type: file.fileType,
        content: file.content,
        relevance: score
      };
    });
    
    // Sort by relevance and take top results
    const topFiles = scoredFiles
      .filter(f => f.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxResults);
    
    return {
      files: topFiles,
      totalFiles: files.length
    };
    
  } catch (error) {
    console.error('Error searching codebase:', error);
    return {
      files: [] as any[],
      totalFiles: 0
    };
  }
}

/**
 * Build enhanced context combining documentation and codebase
 */
export async function buildEnhancedContext(
  query: string,
  includeCodebase: boolean = true,
  includeDocs: boolean = true
): Promise<string> {
  let context = '';
  
  // Add documentation context
  if (includeDocs) {
    try {
      const kb = loadKnowledgeBase();
      const queryLower = query.toLowerCase();
      const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2);
      
      const scoredDocs = kb.chunks.map(doc => {
        let score = 0;
        const contentLower = doc.content.toLowerCase();
        const titleLower = (doc.metadata.filename || '').toLowerCase();
        
        for (const term of queryTerms) {
          if (titleLower.includes(term)) score += 5;
          const regex = new RegExp(term, 'gi');
          const matches = contentLower.match(regex);
          if (matches) score += matches.length;
        }
        
        return { doc, score };
      });
      
      const relevantDocs = scoredDocs
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(item => item.doc);
      
      if (relevantDocs.length > 0) {
        context += '\n\n=== DOCUMENTATION CONTEXT ===\n\n';
        relevantDocs.forEach((doc, index) => {
          context += `[Document ${index + 1}: ${doc.metadata.filename || doc.source}]\n`;
          context += doc.content.substring(0, 2000); // Limit doc length
          context += '\n\n---\n\n';
        });
      }
    } catch (error) {
      console.error('Error loading documentation:', error);
    }
  }
  
  // Add codebase context
  if (includeCodebase) {
    try {
      const codebaseContext = await searchCodebase(query, 5);
      
      if (codebaseContext.files.length > 0) {
        context += '\n\n=== CODEBASE CONTEXT ===\n\n';
        context += `Found ${codebaseContext.totalFiles} relevant files in the codebase.\n\n`;
        
        codebaseContext.files.forEach((file, index) => {
          context += `[File ${index + 1}: ${file.path}]\n`;
          context += `Type: ${file.type}\n`;
          context += `Relevance Score: ${file.relevance}\n\n`;
          
          // Include file content (truncated if too long)
          const maxLength = 1500;
          if (file.content.length > maxLength) {
            context += file.content.substring(0, maxLength);
            context += '\n\n... (content truncated) ...\n\n';
          } else {
            context += file.content;
            context += '\n\n';
          }
          
          context += '---\n\n';
        });
      }
    } catch (error) {
      console.error('Error loading codebase context:', error);
    }
  }
  
  if (context) {
    context += '=== END CONTEXT ===\n\n';
    context += 'Based on the above documentation and codebase, please provide an accurate and helpful response.\n\n';
  }
  
  return context;
}

/**
 * Get file by path from indexed codebase
 */
export async function getFileByPath(filePath: string): Promise<any | null> {
  try {
    const file = await prisma.indexedFile.findUnique({
      where: { filePath }
    });
    return file;
  } catch (error) {
    console.error('Error getting file:', error);
    return null;
  }
}

/**
 * Get codebase statistics
 */
export async function getCodebaseStats() {
  try {
    const stats = await prisma.indexedFile.aggregate({
      where: { isActive: true },
      _count: true,
      _sum: {
        fileSize: true
      }
    });
    
    const filesByType = await prisma.indexedFile.groupBy({
      by: ['fileType'],
      where: { isActive: true },
      _count: true
    });
    
    return {
      totalFiles: stats._count,
      totalSize: stats._sum.fileSize || 0,
      filesByType: filesByType.map(ft => ({
        type: ft.fileType,
        count: ft._count
      }))
    };
  } catch (error) {
    console.error('Error getting codebase stats:', error);
    return null;
  }
}
