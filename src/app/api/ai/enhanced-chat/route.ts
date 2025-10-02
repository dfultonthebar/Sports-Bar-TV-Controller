
import { NextRequest, NextResponse } from 'next/server';
import { buildEnhancedContext } from '@/lib/ai-knowledge-enhanced';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      message, 
      model = 'llama3.2:3b', 
      useKnowledge = true,
      useCodebase = true 
    } = body;
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    
    let fullPrompt = message;
    let usedContext = false;
    
    // Add enhanced context (documentation + codebase) if enabled
    if (useKnowledge || useCodebase) {
      const context = await buildEnhancedContext(
        message,
        useCodebase,
        useKnowledge
      );
      
      if (context) {
        fullPrompt = context + '\nUser Question: ' + message;
        usedContext = true;
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
      usedContext,
      usedCodebase: useCodebase,
      usedKnowledge: useKnowledge
    });
    
  } catch (error) {
    console.error('Error in enhanced chat:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
