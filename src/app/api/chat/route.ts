
/**
 * OPTIMIZED Chat API Route with Streaming Support
 * Implements Server-Sent Events (SSE) for real-time streaming responses
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
import { documentSearch } from '@/lib/enhanced-document-search'
import { operationLogger } from '@/lib/operation-logger'
import { chatSessions } from '@/db/schema'
import {
  executeTool,
  getAvailableTools,
  createDefaultContext,
  ToolDefinition,
} from '@/lib/ai-tools'

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
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'phi3:mini' // OPTIMIZED: Faster model

export async function POST(request: NextRequest) {
  console.log('[CHAT API] POST request received')
  try {
    console.log('[CHAT API] Parsing request body...')
    const { message, sessionId, enableTools = true, stream = true } = await request.json()
    console.log('[CHAT API] Request parsed:', { message: message?.substring(0, 50), sessionId, enableTools, stream })

    if (!message) {
      console.log('[CHAT API] No message provided')
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // OPTIMIZED: Return streaming response if requested
    if (stream) {
      console.log('[CHAT API] Handling streaming chat...')
      return handleStreamingChat(message, sessionId, enableTools)
    }

    // Fallback to non-streaming for compatibility
    console.log('[CHAT API] Handling non-streaming chat...')
    return handleNonStreamingChat(message, sessionId, enableTools)
  } catch (error) {
    console.error('[CHAT API] Error:', error)
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
  console.log('[HANDLE_STREAMING] Creating encoder and stream')
  const encoder = new TextEncoder()

  // Create a TransformStream for streaming
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  console.log('[HANDLE_STREAMING] Starting processStreamingChat in background')
  // Start processing in background
  processStreamingChat(message, sessionId, enableTools, writer, encoder)
    .catch(error => {
      console.error('[HANDLE_STREAMING] Streaming chat error:', error)
      try {
        writer.write(encoder.encode(`data: ${JSON.stringify({ 
          type: 'error', 
          error: error.message 
        })}\n\n`))
      } catch (writeError) {
        console.error('[HANDLE_STREAMING] Failed to write error to stream:', writeError)
      }
    })
    .finally(() => {
      console.log('[HANDLE_STREAMING] Closing writer')
      try {
        writer.close()
      } catch (closeError) {
        console.error('[HANDLE_STREAMING] Failed to close writer:', closeError)
      }
    })

  console.log('[HANDLE_STREAMING] Returning streaming response')
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
  console.log('[STREAMING] Starting processStreamingChat')
  // Helper to send SSE message
  const sendSSE = async (data: any) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
    } catch (error) {
      console.error('[STREAMING] Failed to write to stream:', error)
      throw error
    }
  }

  try {
    // Enhanced document search with better relevance scoring
    console.log('[STREAMING] Sending status: Searching documentation...')
    await sendSSE({ type: 'status', message: 'Searching documentation...' })
    console.log('[STREAMING] Calling documentSearch.searchDocuments...')
    const relevantDocs = await documentSearch.searchDocuments(message, 5)
    console.log('[STREAMING] Document search completed, found:', relevantDocs.length)
    
    // Get recent operation logs for context
    console.log('[STREAMING] Getting recent operations...')
    const recentOperations = await operationLogger.getRecentOperations(24)
    console.log('[STREAMING] Recent operations retrieved:', recentOperations.length)
    console.log('[STREAMING] Getting operation summary...')
    const operationSummary = await operationLogger.getOperationSummary(24)
    console.log('[STREAMING] Operation summary retrieved')
    
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
    console.log('[STREAMING] Getting available tools...')
    const availableTools = enableTools ? getAvailableTools() : []
    console.log('[STREAMING] Available tools:', availableTools.length)
    const toolsPrompt = enableTools ? buildToolsPrompt(availableTools) : ''
    console.log('[STREAMING] Tools prompt built')

    // Get or create chat session
    console.log('[STREAMING] Getting chat session...')
    let session
    if (sessionId) {
      session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
      })
      console.log('[STREAMING] Session found:', !!session)
    } else {
      console.log('[STREAMING] No sessionId provided')
    }

    const messages: ChatMessage[] = session ? JSON.parse(session.messages || '[]') : []
    
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
- Always explain what you're doing when using tools`,
    }

    // Add user message
    messages.push({
      role: 'user',
      content: message,
    })

    // OPTIMIZED: Stream response from Ollama
    console.log('[STREAMING] Sending status: Generating response...')
    await sendSSE({ type: 'status', message: 'Generating response...' })
    
    console.log('[STREAMING] Calling Ollama API at:', OLLAMA_BASE_URL)
    console.log('[STREAMING] Using model:', OLLAMA_MODEL)
    console.log('[STREAMING] Message count:', [systemMessage, ...messages].length)
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [systemMessage, ...messages],
        stream: true, // Enable streaming from Ollama
        options: {
          temperature: 0.7,
          top_p: 0.9,
        },
      }),
    })

    console.log('[STREAMING] Ollama response status:', response.status)
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`)
    }

    // Stream the response
    console.log('[STREAMING] Getting response reader...')
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    console.log('[STREAMING] Starting to read stream...')
    let fullResponse = ''
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        console.log('[STREAMING] Stream reading complete')
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
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          messages: JSON.stringify(messages),
          updatedAt: new Date(),
        },
      })
    }

    // Send completion
    await sendSSE({ 
      type: 'done',
      sessionId: sessionId || 'new'
    })

  } catch (error) {
    console.error('Streaming error:', error)
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
  // Enhanced document search
  const relevantDocs = await documentSearch.searchDocuments(message, 5)
  
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
    session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    })
  }

  const messages: ChatMessage[] = session ? JSON.parse(session.messages || '[]') : []
  
  const systemMessage: ChatMessage = {
    role: 'system',
    content: `You are a Sports Bar AI Assistant with access to documentation and tools.

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
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        messages: JSON.stringify(messages),
        updatedAt: new Date(),
      },
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
