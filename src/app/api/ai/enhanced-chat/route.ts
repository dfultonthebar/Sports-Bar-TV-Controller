
import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledgeBase, buildContextFromDocs } from '@/lib/ai-knowledge';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, model = 'llama3.2:3b', useKnowledge = true } = body;
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    
    let fullPrompt = message;
    let sources: any[] = [];
    
    // Add knowledge base context if enabled
    if (useKnowledge) {
      const relevantDocs = searchKnowledgeBase(message, 5);
      
      if (relevantDocs.length > 0) {
        const context = buildContextFromDocs(relevantDocs);
        fullPrompt = context + '\nUser Question: ' + message;
        
        sources = relevantDocs.map(doc => ({
          source: doc.source,
          title: doc.title,
          section: doc.section
        }));
      }
    }
    
    // Call Ollama API
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt: fullPrompt,
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return NextResponse.json({
      response: data.response,
      model: data.model,
      sources,
      usedKnowledge: sources.length > 0
    });
    
  } catch (error) {
    console.error('Error in enhanced chat:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
