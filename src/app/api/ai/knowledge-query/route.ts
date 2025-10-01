
import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledgeBase, buildContextFromDocs, loadKnowledgeBase } from '@/lib/ai-knowledge';

// Get knowledge base stats
export async function GET() {
  try {
    const kb = loadKnowledgeBase();
    
    return NextResponse.json({
      stats: kb.stats,
      lastUpdated: kb.lastUpdated,
      documentSources: Array.from(new Set(kb.documents.map(d => d.source)))
    });
  } catch (error) {
    console.error('Error getting knowledge base stats:', error);
    return NextResponse.json(
      { error: 'Failed to load knowledge base' },
      { status: 500 }
    );
  }
}

// Search knowledge base
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, maxResults = 5 } = body;
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    const relevantDocs = searchKnowledgeBase(query, maxResults);
    const context = buildContextFromDocs(relevantDocs);
    
    return NextResponse.json({
      query,
      relevantDocuments: relevantDocs.length,
      sources: relevantDocs.map(doc => ({
        source: doc.source,
        title: doc.title,
        section: doc.section,
        excerpt: doc.content.substring(0, 200) + '...'
      })),
      context
    });
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to search knowledge base' },
      { status: 500 }
    );
  }
}
