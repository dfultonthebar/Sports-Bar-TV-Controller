
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
    let contextError = null;
    
    // Add enhanced context (documentation + codebase) if enabled
    if (useKnowledge || useCodebase) {
      try {
        const context = await buildEnhancedContext(
          message,
          useCodebase,
          useKnowledge
        );
        
        if (context) {
          fullPrompt = context + '\nUser Question: ' + message;
          usedContext = true;
        }
      } catch (error) {
        console.error('Error building context:', error);
        contextError = error instanceof Error ? error.message : 'Unknown error';
        // Continue without context rather than failing completely
      }
    }
    
    // Call Ollama API
    try {
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
        const errorText = await response.text();
        console.error('Ollama API error:', response.status, errorText);
        throw new Error(`Ollama API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return NextResponse.json({
        response: data.response,
        model: data.model,
        usedContext,
        usedCodebase: useCodebase,
        usedKnowledge: useKnowledge,
        contextError
      });
    } catch (fetchError: any) {
      // Check if it's a connection error to Ollama
      if (fetchError.cause?.code === 'ECONNREFUSED' || fetchError.message?.includes('ECONNREFUSED')) {
        console.error('Ollama service is not running:', fetchError);
        return NextResponse.json(
          { 
            error: 'Ollama AI service is not running',
            message: `Cannot connect to Ollama at ${OLLAMA_BASE_URL}. Please ensure Ollama is installed and running.`,
            suggestion: 'Start Ollama by running: ollama serve',
            ollamaUrl: OLLAMA_BASE_URL
          },
          { status: 503 }
        );
      }
      throw fetchError;
    }
    
  } catch (error) {
    console.error('Error in enhanced chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process chat request';
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
