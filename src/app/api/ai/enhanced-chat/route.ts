
import { NextRequest, NextResponse } from 'next/server';
import { buildEnhancedContext } from '@/lib/ai-knowledge-enhanced';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

// Configure route to allow longer execution time for AI responses
export const maxDuration = 120; // 120 seconds
export const dynamic = 'force-dynamic';

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
    let contextError: string | null = null;
    
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
    
    // Call Ollama API with extended timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout
      
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt: fullPrompt,
          stream: false
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
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
      // Check if it's a timeout error
      if (fetchError.name === 'AbortError') {
        console.error('Ollama request timed out:', fetchError);
        return NextResponse.json(
          { 
            error: 'Request timed out',
            message: 'The AI model took too long to respond. This may happen with complex queries or larger models.',
            suggestion: 'Try using a smaller model like llama3.2:3b or simplify your question.',
            ollamaUrl: OLLAMA_BASE_URL
          },
          { status: 504 }
        );
      }
      
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
      
      // Check for headers timeout error
      if (fetchError.cause?.code === 'UND_ERR_HEADERS_TIMEOUT' || fetchError.message?.includes('HeadersTimeoutError')) {
        console.error('Headers timeout error:', fetchError);
        return NextResponse.json(
          { 
            error: 'Connection timeout',
            message: 'The connection to Ollama timed out while waiting for response headers.',
            suggestion: 'Ollama may be overloaded or the model is taking too long to start. Try again or use a smaller model.',
            ollamaUrl: OLLAMA_BASE_URL
          },
          { status: 504 }
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
