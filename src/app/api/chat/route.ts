

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { documentSearch } from '@/lib/enhanced-document-search'
import { operationLogger } from '@/lib/operation-logger'
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
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2'

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId, enableTools = true } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Enhanced document search with better relevance scoring
    const relevantDocs = await documentSearch.searchDocuments(message, 5)
    
    // Get recent operation logs for context
    const recentOperations = await operationLogger.getRecentOperations(24)
    const operationSummary = await operationLogger.getOperationSummary(24)
    
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
    const availableTools = enableTools ? getAvailableTools() : []
    const toolsPrompt = enableTools ? buildToolsPrompt(availableTools) : ''

    // Get or create chat session
    let session
    if (sessionId) {
      session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
      })
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
PARAMETERS:
{
  "param1": "value1",
  "param2": "value2"
}

You can make multiple tool calls in sequence. After receiving tool results, provide a natural language response to the user explaining what you found and what actions you took.

## Response Guidelines:
- Reference specific documentation when available
- Include relevant recent system activity in your analysis  
- Provide step-by-step technical guidance
- Suggest preventive measures based on observed patterns
- Highlight any concerning error patterns or trends
- Use tools proactively when they would help answer the user's question
- Always explain what you're doing before using tools

Always provide detailed, technical, and actionable responses based on the available documentation, system activity data, and tool capabilities.`
    }

    const allMessages: ChatMessage[] = [systemMessage, ...messages, { role: 'user', content: message }]

    // Main conversation loop with tool calling
    let response = ''
    let toolCalls: ToolCall[] = []
    let toolResults: ToolResult[] = []
    let iterations = 0
    const maxIterations = 5

    while (iterations < maxIterations) {
      iterations++

      // Get AI response from local Ollama
      const aiResponse = await callLocalOllama(allMessages)

      if (aiResponse.error) {
        await operationLogger.logError({
          level: 'error',
          source: 'chat-api',
          message: `Local AI error: ${aiResponse.error}`,
          details: { message }
        })
        
        return NextResponse.json({
          response: `I encountered an error: ${aiResponse.error}. Please ensure Ollama is running on ${OLLAMA_BASE_URL} with model ${OLLAMA_MODEL}.`
        })
      }

      response = aiResponse.content || ''

      // Check if AI wants to use tools
      if (enableTools && response.includes('TOOL_CALL:')) {
        const parsedToolCalls = parseToolCalls(response)

        if (parsedToolCalls.length > 0) {
          // Execute tools
          const context = createDefaultContext({
            sessionId,
            maxExecutionTime: 30000,
          })

          const results = await executeTools(parsedToolCalls, context)
          toolCalls.push(...parsedToolCalls)
          toolResults.push(...results)

          // Add tool results to conversation
          const toolResultsMessage = formatToolResults(results)
          allMessages.push({
            role: 'assistant',
            content: response,
            toolCalls: parsedToolCalls,
          })
          allMessages.push({
            role: 'tool',
            content: toolResultsMessage,
            toolResults: results,
          })

          // Continue conversation with tool results
          continue
        }
      }

      // No more tool calls, break the loop
      break
    }

    // Log successful AI interaction
    await operationLogger.logOperation({
      type: 'error', // Using existing type system, could add 'ai_query' type
      action: 'AI chat query processed',
      details: { 
        query: message.substring(0, 100),
        documentsFound: relevantDocs.length,
        responseLength: response.length,
        toolsUsed: toolCalls.length,
        iterations
      },
      success: true
    })

    // Add user message and AI response to session
    messages.push({ role: 'user', content: message })
    messages.push({ 
      role: 'assistant', 
      content: response,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      toolResults: toolResults.length > 0 ? toolResults : undefined
    })

    // Save or update session
    if (session) {
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { messages: JSON.stringify(messages) },
      })
    } else {
      session = await prisma.chatSession.create({
        data: {
          title: message.substring(0, 50) + '...',
          messages: JSON.stringify(messages),
        },
      })
    }

    return NextResponse.json({
      response,
      sessionId: session.id,
      relevantDocuments: relevantDocs.map(doc => ({
        id: doc.id,
        name: doc.originalName,
        relevanceScore: doc.relevanceScore,
        matchedTerms: doc.matchedTerms
      })),
      systemContext: isOperationalQuery ? {
        totalOperations: operationSummary.totalOperations,
        successRate: operationSummary.successRate,
        errorCount: operationSummary.errorCount
      } : undefined,
      toolsEnabled: enableTools,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      toolResults: toolResults.length > 0 ? toolResults : undefined,
      iterations
    })
  } catch (error) {
    console.error('Chat error:', error)
    
    await operationLogger.logError({
      level: 'error',
      source: 'chat-api',
      message: 'Chat processing failed',
      stack: error instanceof Error ? error.stack : undefined,
      details: { error: error instanceof Error ? error.message : error }
    })
    
    return NextResponse.json(
      { error: 'Failed to process chat message' }, 
      { status: 500 }
    )
  }
}

/**
 * Build tools prompt for system message
 */
function buildToolsPrompt(tools: ToolDefinition[]): string {
  let prompt = '\n## Available AI Tools:\n\n'

  const categories = ['filesystem', 'code_execution', 'analysis', 'system']

  for (const category of categories) {
    const categoryTools = tools.filter(t => t.category === category)
    if (categoryTools.length === 0) continue

    prompt += `### ${category.replace('_', ' ').toUpperCase()}\n\n`

    for (const tool of categoryTools) {
      prompt += `**${tool.name}** (${tool.securityLevel})\n`
      prompt += `${tool.description}\n`
      prompt += 'Parameters:\n'

      for (const param of tool.parameters) {
        const required = param.required ? 'required' : 'optional'
        prompt += `  - ${param.name} (${param.type}, ${required}): ${param.description}\n`
      }

      prompt += '\n'
    }
  }

  return prompt
}

/**
 * Parse tool calls from AI response
 */
function parseToolCalls(response: string): ToolCall[] {
  const toolCalls: ToolCall[] = []
  const toolCallRegex = /TOOL_CALL:\s*(\w+)\s*PARAMETERS:\s*(\{[\s\S]*?\})/g

  let match
  while ((match = toolCallRegex.exec(response)) !== null) {
    try {
      const toolName = match[1].trim()
      const parametersStr = match[2].trim()
      const parameters = JSON.parse(parametersStr)

      toolCalls.push({
        id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: toolName,
        parameters,
      })
    } catch (error) {
      console.error('Failed to parse tool call:', error)
    }
  }

  return toolCalls
}

/**
 * Execute multiple tools
 */
async function executeTools(
  toolCalls: ToolCall[],
  context: any
): Promise<ToolResult[]> {
  const results: ToolResult[] = []

  for (const toolCall of toolCalls) {
    try {
      const result = await executeTool(
        toolCall.name,
        toolCall.parameters,
        context
      )

      results.push({
        id: toolCall.id,
        name: toolCall.name,
        result: result.output,
        success: result.success,
        error: result.error,
      })
    } catch (error) {
      results.push({
        id: toolCall.id,
        name: toolCall.name,
        result: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return results
}

/**
 * Format tool results for AI
 */
function formatToolResults(results: ToolResult[]): string {
  let formatted = 'TOOL_RESULTS:\n\n'

  for (const result of results) {
    formatted += `Tool: ${result.name}\n`
    formatted += `Status: ${result.success ? 'SUCCESS' : 'FAILED'}\n`

    if (result.success) {
      formatted += `Result:\n${JSON.stringify(result.result, null, 2)}\n`
    } else {
      formatted += `Error: ${result.error}\n`
    }

    formatted += '\n---\n\n'
  }

  return formatted
}

async function callLocalOllama(messages: ChatMessage[]): Promise<AIResponse> {
  try {
    // Convert messages to Ollama format (filter out tool role)
    const ollamaMessages = messages.map(msg => ({
      role: msg.role === 'tool' ? 'user' : msg.role,
      content: msg.content,
    }))

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 3000
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Ollama API Error (${response.status}):`, errorText)
      return { 
        error: `Ollama error: ${response.statusText}. Is Ollama running on ${OLLAMA_BASE_URL}?`, 
        content: '' 
      }
    }

    const data = await response.json()
    return { content: data.message?.content || 'No response from local AI' }
  } catch (error) {
    console.error('Local AI call error:', error)
    return { 
      error: error instanceof Error ? error.message : 'Unknown error connecting to local AI', 
      content: '' 
    }
  }
}
