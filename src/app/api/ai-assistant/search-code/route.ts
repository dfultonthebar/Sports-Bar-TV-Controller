
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
    
    // Build where clause
    const whereClause: any = {
      isActive: true,
      OR: queryTerms.map((term: string) => ({
        OR: [
          { content: { contains: term } },
          { filePath: { contains: term } },
          { fileName: { contains: term } }
        ]
      }))
    };
    
    if (fileTypes && fileTypes.length > 0) {
      whereClause.fileType = { in: fileTypes };
    }
    
    // Search for matching files
    const files = await prisma.indexedFile.findMany({
      where: whereClause,
      take: maxResults,
      orderBy: { lastIndexed: 'desc' }
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
