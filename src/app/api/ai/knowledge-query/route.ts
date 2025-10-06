
import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledgeBase, getKnowledgeBaseStats, buildContext } from '@/lib/ai-knowledge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit = 10 } = body;
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }
    
    const results = searchKnowledgeBase(query, limit);
    const context = buildContext(query, 5);
    
    return NextResponse.json({
      success: true,
      query,
      results,
      context,
      count: results.length,
    });
  } catch (error: any) {
    console.error('Error querying knowledge base:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const stats = getKnowledgeBaseStats();
    
    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('Error getting knowledge base stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
