
/**
 * OPTIMIZED Chat API Route with Streaming Support
 * Implements Server-Sent Events (SSE) for real-time streaming responses
 */

import { NextRequest, NextResponse } from 'next/server'
import { documentSearch } from '@/lib/enhanced-document-search'
import { retrieveContext } from '@/lib/rag-server/query-engine'
import { operationLogger } from '@/lib/operation-logger'
import { findUnique, update } from '@/lib/db-helpers'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
import {
  executeTool,
  getAvailableTools,
  createDefaultContext,
  ToolDefinition,
} from '@/lib/ai-tools'
import { HARDWARE_CONFIG } from '@/lib/hardware-config'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
}

interface ToolCall {
  id: string
  name: string
  parameters: Record<string, any>
}

interface ToolResult {
  id: string
  name: string
  result: any
  success: boolean
  error?: string
}

interface AIResponse {
  content: string
  error?: string
}

// Local Ollama configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || HARDWARE_CONFIG.ollama.baseUrl
// v2.46.3: defaulted to llama3.1:8b — iGPU-accelerated via IPEX-LLM
// (~14 tok/s, same as pattern-digest). phi3:mini ground worse against
// RAG snippets per fact-checker grilling 2026-05-18. Override via
// OLLAMA_MODEL env if you want the faster/dumber phi3:mini.
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b'

// Option B unification (v2.46.3): the AI Hub /api/chat reads from the
// RAG vector store (3000+ chunks: CLAUDE.md, docs/, packages/*/README.md,
// .claude/locations/*.md, memory files, vendor protocol specs) instead
// of the older enhanced-document-search. AI Hub chat is now grounded
// in the same SME corpus the pattern-digest uses.
//
// Adapter preserves the DocumentSearchResult shape so downstream
// context-formatting (line ~180 + ~441) is unchanged. Falls back to
// enhanced-document-search if RAG is empty (fresh location install
// before scan-system-docs.ts has run) so chat keeps working.
async function searchDocsViaRag(
  query: string,
  topK: number,
): Promise<Array<{ id: string; originalName: string; content: string; relevanceScore: number; matchedTerms: string[] }>> {
  try {
    const result = await retrieveContext(query, topK)
    if (!result.chunks || result.chunks.length === 0) {
      return documentSearch.searchDocuments(query, topK)
    }
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 3)
      .slice(0, 5)
    return result.chunks.map((c, i) => ({
      id: `rag-${i}`,
      originalName: c.source ?? `chunk_${i}`,
      content: c.content,
      relevanceScore: c.score ?? 0,
      matchedTerms: terms,
    }))
  } catch (err) {
    logger.warn(`[AI-HUB-CHAT] RAG retrieval failed, falling back: ${(err as Error)?.message ?? err}`)
    return documentSearch.searchDocuments(query, topK)
  }
}

export async function POST(request: NextRequest) {
  // Input validation
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.aiQuery)
  if (isValidationError(bodyValidation)) return bodyValidation.error


  logger.info('[CHAT API] POST request received')
  try {
    logger.info('[CHAT API] Parsing request body...')
    const { data } = bodyValidation
    const { message, query, sessionId, enableTools = true, stream = true } = data
    const userMessage = message || query
    logger.info('[CHAT API] Request parsed:', { data: { message: userMessage?.substring(0, 50), sessionId, enableTools, stream } })

    if (!userMessage) {
      logger.info('[CHAT API] No message provided')
      return NextResponse.json({ error: 'Message or query is required' }, { status: 400 })
    }

    // OPTIMIZED: Return streaming response if requested
    if (stream) {
      logger.info('[CHAT API] Handling streaming chat...')
      return handleStreamingChat(userMessage, sessionId, enableTools)
    }

    // Fallback to non-streaming for compatibility
    logger.info('[CHAT API] Handling non-streaming chat...')
    return handleNonStreamingChat(userMessage, sessionId, enableTools)
  } catch (error) {
    logger.error('[CHAT API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * OPTIMIZED: Handle streaming chat with Server-Sent Events
 */
async function handleStreamingChat(
  message: string,
  sessionId: string | undefined,
  enableTools: boolean
) {
  logger.info('[HANDLE_STREAMING] Creating encoder and stream')
  const encoder = new TextEncoder()

  // Create a TransformStream for streaming
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  logger.info('[HANDLE_STREAMING] Starting processStreamingChat in background')
  // Start processing in background
  processStreamingChat(message, sessionId, enableTools, writer, encoder)
    .catch(error => {
      logger.error('[HANDLE_STREAMING] Streaming chat error:', error)
      try {
        writer.write(encoder.encode(`data: ${JSON.stringify({ 
          type: 'error', 
          error: error.message 
        })}\n\n`))
      } catch (writeError) {
        logger.error('[HANDLE_STREAMING] Failed to write error to stream:', writeError)
      }
    })
    .finally(() => {
      logger.info('[HANDLE_STREAMING] Closing writer')
      try {
        writer.close()
      } catch (closeError) {
        logger.error('[HANDLE_STREAMING] Failed to close writer:', closeError)
      }
    })

  logger.info('[HANDLE_STREAMING] Returning streaming response')
  // Return streaming response with proper headers
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

/**
 * Process streaming chat and write chunks to the stream
 */
async function processStreamingChat(
  message: string,
  sessionId: string | undefined,
  enableTools: boolean,
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder
) {
  logger.info('[STREAMING] Starting processStreamingChat')
  // Helper to send SSE message
  const sendSSE = async (data: any) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
    } catch (error) {
      logger.error('[STREAMING] Failed to write to stream:', error)
      throw error
    }
  }

  try {
    // Enhanced document search with better relevance scoring
    logger.info('[STREAMING] Sending status: Searching documentation...')
    await sendSSE({ type: 'status', message: 'Searching documentation...' })
    logger.info('[STREAMING] Calling documentSearch.searchDocuments...')
    const relevantDocs = await searchDocsViaRag(message, 8)
    logger.info('[STREAMING] Document search completed', { data: { found: relevantDocs.length } })
    
    // Get recent operation logs for context
    logger.info('[STREAMING] Getting recent operations...')
    const recentOperations = await operationLogger.getRecentOperations(24)
    logger.info('[STREAMING] Recent operations retrieved:', { data: recentOperations.length })
    logger.info('[STREAMING] Getting operation summary...')
    const operationSummary = await operationLogger.getOperationSummary(24)
    logger.info('[STREAMING] Operation summary retrieved')
    
    // Build enhanced context
    let context = ''
    
    if (relevantDocs.length > 0) {
      context += `\n\n=== RELEVANT DOCUMENTATION ===\n`
      relevantDocs.forEach((doc, index) => {
        context += `\nDocument ${index + 1}: ${doc.originalName} (Relevance: ${doc.relevanceScore})\n`
        context += `Matched terms: ${doc.matchedTerms.join(', ')}\n`
        context += `Content excerpt: ${doc.content.substring(0, 1000)}...\n`
        context += `---\n`
      })
    }
    
    // Add operational context if the query seems related to system status or troubleshooting
    const isOperationalQuery = /status|error|problem|issue|trouble|working|broken|log|recent|activity/i.test(message)
    if (isOperationalQuery && (recentOperations.length > 0 || operationSummary.errorCount > 0)) {
      context += `\n\n=== RECENT SYSTEM ACTIVITY ===\n`
      context += `Operations in last 24h: ${operationSummary.totalOperations}\n`
      context += `Success rate: ${operationSummary.successRate.toFixed(1)}%\n`
      context += `Error count: ${operationSummary.errorCount}\n`
      
      if (operationSummary.mostCommonOperations.length > 0) {
        context += `Most common operations:\n`
        operationSummary.mostCommonOperations.slice(0, 3).forEach(op => {
          context += `  - ${op.type}: ${op.count} times\n`
        })
      }
      
      if (operationSummary.patterns.length > 0) {
        context += `Usage patterns:\n`
        operationSummary.patterns.slice(0, 3).forEach(pattern => {
          context += `  - ${pattern.pattern}: ${pattern.count} occurrences\n`
        })
      }
      
      if (recentOperations.length > 0) {
        context += `\nRecent operations (last 5):\n`
        recentOperations.slice(0, 5).forEach(op => {
          context += `  - ${new Date(op.timestamp).toLocaleString()}: ${op.type} - ${op.action} ${op.success ? '✓' : '✗'}\n`
        })
      }
    }

    // Get available AI tools
    logger.info('[STREAMING] Getting available tools...')
    const availableTools = enableTools ? getAvailableTools() : []
    logger.info('[STREAMING] Available tools:', { data: availableTools.length })
    const toolsPrompt = enableTools ? buildToolsPrompt(availableTools) : ''
    logger.info('[STREAMING] Tools prompt built')

    // Get or create chat session
    logger.info('[STREAMING] Getting chat session...')
    let session
    if (sessionId) {
      session = await findUnique('chatSessions', eq(schema.chatSessions.id, sessionId))
      logger.info('[STREAMING] Session found:', { data: !!session })
    } else {
      logger.info('[STREAMING] No sessionId provided')
    }

    let messages: ChatMessage[] = []
    try {
      messages = session ? JSON.parse(session.messages || '[]') : []
    } catch (error) {
      logger.error('[Chat] Failed to parse session messages:', error)
      messages = []
    }

    // Enhanced system message with AI tools support
    const systemMessage: ChatMessage = {
      role: 'system',
      content: `You are an advanced Sports Bar AI Assistant specializing in AV system management, troubleshooting, and operational support. You have access to comprehensive documentation, real-time system logs, and powerful AI tools.

## Your Expertise:
- Audio/Visual equipment troubleshooting and configuration
- Wolf Pack HDMI matrix switchers and routing
- Atlas audio processors and zone management
- IR device control and programming
- Network troubleshooting and system diagnostics
- Daily operations analysis and optimization

## Your Capabilities:
- Analyze uploaded technical documentation with intelligent search
- Monitor real-time system operations and identify patterns
- Provide actionable troubleshooting steps based on recent activity
- Suggest optimizations based on usage patterns
- Help with equipment configuration and setup
- Run comprehensive system diagnostics using the diagnostic APIs
- Check AI provider status and system health
- Execute automated fixes for common issues
- Analyze device mapping and configuration
- **Access file system to read code and configuration files**
- **Execute code to analyze and fix issues**
- **Search through codebase for specific implementations**

${toolsPrompt}

${context}

## Tool Usage:
When you need to access files, execute code, or perform system operations, use the available tools by responding in this format:

TOOL_CALL: tool_name
{
  "parameter": "value"
}

Available tools: ${availableTools.map(t => t.name).join(', ')}

## Response Guidelines:
- Be concise but thorough
- Provide step-by-step instructions when appropriate
- Reference specific documentation when available
- Suggest preventive measures
- Use tools when they can provide better information
- Always explain what you're doing when using tools

## CRITICAL — Grounding rules (v2.46.3):
When the RELEVANT DOCUMENTATION section contains a specific name, port,
property, IP, file path, version, command flag, or wire-protocol token
that answers the question, **QUOTE IT VERBATIM from the documentation**.
Do not paraphrase or substitute with a generic term you remember from
training data — our docs are authoritative on every detail of this
system. If the docs disagree with what you remember, the docs win.
If the documentation does NOT contain the specific detail being asked,
say "I don't see that in the indexed documentation" rather than
fabricating an answer.`,
    }

    // Add user message
    messages.push({
      role: 'user',
      content: message,
    })

    // OPTIMIZED: Stream response from Ollama
    logger.info('[STREAMING] Sending status: Generating response...')
    await sendSSE({ type: 'status', message: 'Generating response...' })
    
    logger.info('[STREAMING] Calling Ollama API at:', { data: OLLAMA_BASE_URL })
    logger.info('[STREAMING] Using model:', { data: OLLAMA_MODEL })
    logger.info('[STREAMING] Message count:', { data: [systemMessage, ...messages].length })
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [systemMessage, ...messages],
        stream: true, // Enable streaming from Ollama
        options: {
          temperature: 0.3, // v2.46.3: lowered from 0.7 for RAG fidelity
          top_p: 0.9,
        },
      }),
    })

    logger.info('[STREAMING] Ollama response status:', { data: response.status })
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`)
    }

    // Stream the response
    logger.info('[STREAMING] Getting response reader...')
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    logger.info('[STREAMING] Starting to read stream...')
    let fullResponse = ''
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        logger.info('[STREAMING] Stream reading complete')
        break
      }

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.trim())

      for (const line of lines) {
        try {
          const data = JSON.parse(line)
          
          if (data.message?.content) {
            const content = data.message.content
            fullResponse += content
            
            // Send content chunk to client
            await sendSSE({ 
              type: 'content', 
              content,
              done: false 
            })
          }

          if (data.done) {
            break
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    }

    // Check for tool calls in the response
    if (enableTools && fullResponse.includes('TOOL_CALL:')) {
      await sendSSE({ type: 'status', message: 'Executing tools...' })
      const toolResults = await handleToolCalls(fullResponse)
      
      if (toolResults.length > 0) {
        // Send tool results
        await sendSSE({ 
          type: 'tool_results', 
          results: toolResults 
        })

        // Get follow-up response with tool results
        const followUpResponse = await getFollowUpResponse(
          systemMessage,
          messages,
          fullResponse,
          toolResults
        )

        await sendSSE({ 
          type: 'content', 
          content: followUpResponse,
          done: true 
        })

        fullResponse += '\n\n' + followUpResponse
      }
    }

    // Save conversation
    messages.push({
      role: 'assistant',
      content: fullResponse,
    })

    if (sessionId) {
      await update('chatSessions', eq(schema.chatSessions.id, sessionId), {
        messages: JSON.stringify(messages),
        updatedAt: new Date(),
      })
    }

    // Send completion
    await sendSSE({ 
      type: 'done',
      sessionId: sessionId || 'new'
    })

  } catch (error) {
    logger.error('Streaming error:', error)
    await sendSSE({ 
      type: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
}

/**
 * Handle non-streaming chat (fallback)
 */
async function handleNonStreamingChat(
  message: string,
  sessionId: string | undefined,
  enableTools: boolean
): Promise<NextResponse> {
  // v2.46.3: topK 5→8 — see fact-checker re-grill 2026-05-18
  const relevantDocs = await searchDocsViaRag(message, 8)
  
  // Get recent operation logs
  const recentOperations = await operationLogger.getRecentOperations(24)
  const operationSummary = await operationLogger.getOperationSummary(24)
  
  // Build context (same as streaming version)
  let context = ''
  
  if (relevantDocs.length > 0) {
    context += `\n\n=== RELEVANT DOCUMENTATION ===\n`
    relevantDocs.forEach((doc, index) => {
      context += `\nDocument ${index + 1}: ${doc.originalName}\n`
      context += `Content: ${doc.content.substring(0, 1000)}...\n`
    })
  }

  const availableTools = enableTools ? getAvailableTools() : []
  const toolsPrompt = enableTools ? buildToolsPrompt(availableTools) : ''

  let session
  if (sessionId) {
    session = await findUnique('chatSessions', eq(schema.chatSessions.id, sessionId))
  }

  let messages: ChatMessage[] = []
  try {
    messages = session ? JSON.parse(session.messages || '[]') : []
  } catch (error) {
    logger.error('[Chat] Failed to parse session messages (non-streaming):', error)
    messages = []
  }

  const systemMessage: ChatMessage = {
    role: 'system',
    content: `You are a Sports Bar AI Assistant with access to documentation and tools.

CRITICAL: When the RELEVANT DOCUMENTATION section contains a specific
name, port, property, IP, path, or wire-protocol token that answers the
question, QUOTE IT VERBATIM from the documentation. Do not paraphrase
or substitute with a generic term from training data — our docs are
authoritative. If the docs don't contain the specific detail, say so
rather than fabricating an answer.

${toolsPrompt}
${context}`,
  }

  messages.push({ role: 'user', content: message })

  // Call Ollama without streaming
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [systemMessage, ...messages],
      stream: false,
      options: {
        temperature: 0.3, // v2.46.3: match streaming-path fidelity setting
        top_p: 0.9,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`)
  }

  const data = await response.json()
  let aiResponse = data.message?.content || ''

  // Handle tool calls
  if (enableTools && aiResponse.includes('TOOL_CALL:')) {
    const toolResults = await handleToolCalls(aiResponse)
    
    if (toolResults.length > 0) {
      const followUp = await getFollowUpResponse(
        systemMessage,
        messages,
        aiResponse,
        toolResults
      )
      aiResponse += '\n\n' + followUp
    }
  }

  messages.push({ role: 'assistant', content: aiResponse })

  if (sessionId) {
    await update('chatSessions', eq(schema.chatSessions.id, sessionId), {
      messages: JSON.stringify(messages),
      updatedAt: new Date(),
    })
  }

  return NextResponse.json({
    response: aiResponse,
    sessionId: sessionId || 'new',
  })
}

/**
 * Build tools prompt for system message
 */
function buildToolsPrompt(tools: ToolDefinition[]): string {
  if (tools.length === 0) return ''

  let prompt = '\n\n## Available Tools:\n'
  
  tools.forEach(tool => {
    prompt += `\n### ${tool.name}\n`
    prompt += `${tool.description}\n`
    prompt += `Security Level: ${tool.securityLevel}\n`
    
    if (tool.parameters.length > 0) {
      prompt += 'Parameters:\n'
      tool.parameters.forEach(param => {
        prompt += `  - ${param.name} (${param.type})${param.required ? ' [required]' : ''}: ${param.description}\n`
      })
    }
  })

  return prompt
}

/**
 * Handle tool calls from AI response
 */
async function handleToolCalls(response: string): Promise<ToolResult[]> {
  const toolCallPattern = /TOOL_CALL:\s*(\w+)\s*\{([^}]+)\}/g
  const results: ToolResult[] = []
  let match

  while ((match = toolCallPattern.exec(response)) !== null) {
    const toolName = match[1]
    const paramsStr = match[2]

    try {
      const params = JSON.parse(`{${paramsStr}}`)
      const context = createDefaultContext()
      
      const result = await executeTool(toolName, params, context)
      
      results.push({
        id: `tool_${Date.now()}_${Math.random()}`,
        name: toolName,
        result: result.output,
        success: result.success,
        error: result.error,
      })
    } catch (error) {
      results.push({
        id: `tool_${Date.now()}_${Math.random()}`,
        name: toolName,
        result: null,
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      })
    }
  }

  return results
}

/**
 * Get follow-up response after tool execution
 */
async function getFollowUpResponse(
  systemMessage: ChatMessage,
  messages: ChatMessage[],
  initialResponse: string,
  toolResults: ToolResult[]
): Promise<string> {
  const toolResultsText = toolResults
    .map(r => `Tool: ${r.name}\nSuccess: ${r.success}\nResult: ${JSON.stringify(r.result, null, 2)}`)
    .join('\n\n')

  const followUpMessages = [
    systemMessage,
    ...messages,
    { role: 'assistant' as const, content: initialResponse },
    { 
      role: 'tool' as const, 
      content: `Tool execution results:\n\n${toolResultsText}\n\nPlease provide a summary of these results.` 
    },
  ]

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: followUpMessages,
      stream: false,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to get follow-up response')
  }

  const data = await response.json()
  return data.message?.content || 'Tool execution completed.'
}
