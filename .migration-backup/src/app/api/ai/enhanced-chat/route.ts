
import { NextRequest, NextResponse } from 'next/server';
import { buildEnhancedContext } from '@/lib/ai-knowledge-enhanced';
import { withRateLimit, addRateLimitHeaders } from '@/lib/rate-limiting/middleware';
import { ollamaThrottler } from '@/lib/rate-limiting/request-throttler';

import { logger } from '@/lib/logger'
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

// Configure route to allow longer execution time for AI responses
export const maxDuration = 120; // 120 seconds
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Apply rate limiting (5 requests per minute for AI endpoints)
  const rateLimitCheck = await withRateLimit(request, 'AI');

  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!;
  }

  try {
    const body = await request.json();
    const {
      message,
      model = 'llama3.2:3b',
      useKnowledge = true,
      useCodebase = true,
      stream = true
    } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // If streaming is requested, use streaming response
    if (stream) {
      return handleStreamingResponse(message, model, useKnowledge, useCodebase, rateLimitCheck.result);
    }

    // Otherwise, use non-streaming response (for backward compatibility)
    const response = await handleNonStreamingResponse(message, model, useKnowledge, useCodebase);
    return addRateLimitHeaders(response, rateLimitCheck.result);

  } catch (error) {
    logger.error('Error in enhanced chat:', error);
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

async function handleStreamingResponse(
  message: string,
  model: string,
  useKnowledge: boolean,
  useCodebase: boolean,
  rateLimitResult: any
) {
  const encoder = new TextEncoder();

  // Create a TransformStream for streaming
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Start processing in background
  (async () => {
    try {
      let fullPrompt = message;
      let usedContext = false;
      let contextError: string | null = null;

      // Send initial status
      await writer.write(encoder.encode(`data: ${JSON.stringify({
        type: 'status',
        message: 'Building context...'
      })}\n\n`));

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
          logger.error('Error building context:', error);
          contextError = error instanceof Error ? error.message : 'Unknown error';
          // Continue without context rather than failing completely
        }
      }

      // Send context status
      await writer.write(encoder.encode(`data: ${JSON.stringify({
        type: 'context',
        usedContext,
        contextError
      })}\n\n`));

      // Send generating status
      await writer.write(encoder.encode(`data: ${JSON.stringify({
        type: 'status',
        message: 'Generating response...'
      })}\n\n`));

      // Call Ollama API with streaming through throttler
      const response = await ollamaThrottler.execute(
        async () => {
          const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              prompt: fullPrompt,
              stream: true
            })
          });

          if (!res.ok) {
            throw new Error(`Ollama API error: ${res.statusText}`);
          }

          return res;
        },
        'ollama-streaming'
      );

      // Stream the response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.response) {
                await writer.write(encoder.encode(`data: ${JSON.stringify({
                  type: 'token',
                  content: data.response
                })}\n\n`));
              }
              if (data.done) {
                await writer.write(encoder.encode(`data: ${JSON.stringify({
                  type: 'done',
                  model: data.model,
                  usedContext,
                  usedCodebase: useCodebase,
                  usedKnowledge: useKnowledge,
                  contextError
                })}\n\n`));
              }
            } catch (e) {
              logger.error('Error parsing Ollama response:', e);
            }
          }
        }
      }

    } catch (error) {
      logger.error('Streaming error:', error);
      await writer.write(encoder.encode(`data: ${JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })}\n\n`));
    } finally {
      try {
        await writer.close();
      } catch (e) {
        // Writer may already be closed
        logger.error('Error closing writer:', e);
      }
    }
  })();

  // Return streaming response with proper headers including rate limit info
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-RateLimit-Limit': rateLimitResult.limit.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
    },
  });
}

async function handleNonStreamingResponse(
  message: string,
  model: string,
  useKnowledge: boolean,
  useCodebase: boolean
) {
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
      logger.error('Error building context:', error);
      contextError = error instanceof Error ? error.message : 'Unknown error';
      // Continue without context rather than failing completely
    }
  }
  
  // Call Ollama API with extended timeout through throttler
  try {
    const data = await ollamaThrottler.execute(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout

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
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            logger.error('Ollama API error:', response.status, errorText);
            throw new Error(`Ollama API error: ${response.statusText}`);
          }

          return await response.json();
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      },
      'ollama-non-streaming'
    );

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
      logger.error('Ollama request timed out:', fetchError);
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
      logger.error('Ollama service is not running:', fetchError);
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
      logger.error('Headers timeout error:', fetchError);
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
}
