
import { NextRequest, NextResponse } from 'next/server';
import { findMany, like, and, or, desc } from '@/lib/db-helpers';
import { schema } from '@/db';


export async function POST(request: NextRequest) {
  try {
    const { query, fileTypes, maxResults = 10 } = await request.json();
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter((term: string) => term.length > 2);
    
    // Build where conditions using Drizzle ORM
    const conditions: any[] = [];
    
    // Add isActive condition
    conditions.push(schema.indexedFiles.isActive);
    
    // Add search conditions for each term
    for (const term of queryTerms) {
      conditions.push(
        or(
          like(schema.indexedFiles.content, `%${term}%`),
          like(schema.indexedFiles.filePath, `%${term}%`),
          like(schema.indexedFiles.fileName, `%${term}%`)
        )
      );
    }
    
    // Add file type filter if provided
    if (fileTypes && fileTypes.length > 0) {
      // For multiple file types, we need to check each one
      const fileTypeConditions = fileTypes.map((ft: string) => 
        schema.indexedFiles.fileType === ft
      );
      conditions.push(or(...fileTypeConditions));
    }
    
    // Search for matching files using Drizzle
    const files = await findMany('indexedFiles', {
      where: and(...conditions),
      orderBy: desc(schema.indexedFiles.lastIndexed),
      limit: maxResults
    });
    
    // Score and rank results
    const scoredFiles = files.map(file => {
      let score = 0;
      const contentLower = file.content.toLowerCase();
      const pathLower = file.filePath.toLowerCase();
      const nameLower = file.fileName.toLowerCase();
      
      for (const term of queryTerms) {
        // File name matches are worth more
        if (nameLower.includes(term)) score += 5;
        if (pathLower.includes(term)) score += 3;
        
        // Count occurrences in content
        const regex = new RegExp(term, 'gi');
        const matches = contentLower.match(regex);
        if (matches) {
          score += matches.length;
        }
      }
      
      return {
        ...file,
        score,
        // Extract relevant snippets
        snippets: extractSnippets(file.content, queryTerms)
      };
    });
    
    // Sort by score and return
    const results = scoredFiles
      .filter(f => f.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
    
    return NextResponse.json({
      success: true,
      results: results.map(r => ({
        id: r.id,
        filePath: r.filePath,
        fileName: r.fileName,
        fileType: r.fileType,
        score: r.score,
        snippets: r.snippets,
        lastModified: r.lastModified
      })),
      totalResults: results.length
    });
    
  } catch (error) {
    console.error('Error searching code:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to search code'
      },
      { status: 500 }
    );
  } finally {
  }
}

function extractSnippets(content: string, terms: string[], maxSnippets = 3): string[] {
  const lines = content.split('\n');
  const snippets: string[] = [];
  
  for (let i = 0; i < lines.length && snippets.length < maxSnippets; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();
    
    for (const term of terms) {
      if (lineLower.includes(term)) {
        // Get context (2 lines before and after)
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length, i + 3);
        const snippet = lines.slice(start, end).join('\n');
        snippets.push(snippet);
        break;
      }
    }
  }
  
  return snippets;
}
