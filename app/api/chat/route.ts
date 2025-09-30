

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { decrypt } from '../../../../lib/encryption'
import { documentSearch } from '../../../../lib/enhanced-document-search'
import { operationLogger } from '../../../../lib/operation-logger'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface AIResponse {
  content: string
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Get active API keys
    const activeApiKeys = await prisma.apiKey.findMany({
      where: { isActive: true },
    })

    if (activeApiKeys.length === 0) {
      return NextResponse.json({
        response: "I'm sorry, but no AI providers are currently configured. Please add API keys in the API Keys tab to enable AI chat functionality."
      })
    }

    // Use the first active API key
    const apiKeyRecord = activeApiKeys[0]
    const decryptedKey = decrypt(apiKeyRecord.keyValue)

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

    // Get or create chat session
    let session
    if (sessionId) {
      session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
      })
    }

    const messages = session ? JSON.parse(session.messages || '[]') : []
    
    // Enhanced system message with better context
    const systemMessage: ChatMessage = {
      role: 'system',
      content: `You are an advanced Sports Bar AI Assistant specializing in AV system management, troubleshooting, and operational support. You have access to comprehensive documentation and real-time system logs.

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

## Response Guidelines:
- Reference specific documentation when available
- Include relevant recent system activity in your analysis  
- Provide step-by-step technical guidance
- Suggest preventive measures based on observed patterns
- Highlight any concerning error patterns or trends

${context}

Always provide detailed, technical, and actionable responses based on the available documentation and system activity data.`
    }

    const allMessages = [systemMessage, ...messages, { role: 'user', content: message }]

    // Get AI response
    const aiResponse = await makeAPICall(allMessages, apiKeyRecord.provider, decryptedKey)

    if (aiResponse.error) {
      await operationLogger.logError({
        level: 'error',
        source: 'chat-api',
        message: `AI API error: ${aiResponse.error}`,
        details: { provider: apiKeyRecord.provider, message }
      })
      
      return NextResponse.json({
        response: `I encountered an error: ${aiResponse.error}. Please check your API key configuration.`
      })
    }

    // Log successful AI interaction
    await operationLogger.logOperation({
      type: 'error', // Using existing type system, could add 'ai_query' type
      action: 'AI chat query processed',
      details: { 
        query: message.substring(0, 100),
        documentsFound: relevantDocs.length,
        responseLength: aiResponse.content?.length || 0
      },
      success: true
    })

    // Add user message and AI response to session
    messages.push({ role: 'user', content: message })
    messages.push({ role: 'assistant', content: aiResponse.content })

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
      response: aiResponse.content,
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
      } : undefined
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

async function makeAPICall(messages: ChatMessage[], provider: string, apiKey: string): Promise<AIResponse> {
  try {
    let response: Response

    switch (provider) {
      case 'claude':
      case 'anthropic':
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 3000,
            messages: messages.filter(msg => msg.role !== 'system').map(msg => ({
              role: msg.role === 'assistant' ? 'assistant' : 'user',
              content: msg.content
            })),
            system: messages.find(msg => msg.role === 'system')?.content || undefined
          })
        })
        break

      case 'openai':
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: messages,
            max_tokens: 3000
          })
        })
        break

      case 'grok':
      case 'xai':
        response = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'grok-beta',
            messages: messages,
            max_tokens: 3000
          })
        })
        break

      default:
        return { error: 'Unsupported AI provider', content: '' }
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`API Error (${response.status}):`, errorText)
      return { error: `API error: ${response.statusText}`, content: '' }
    }

    const data = await response.json()

    switch (provider) {
      case 'claude':
      case 'anthropic':
        return { content: data.content?.[0]?.text || 'No response from Claude' }
      case 'openai':
      case 'grok':
      case 'xai':
        return { content: data.choices?.[0]?.message?.content || 'No response from AI' }
      default:
        return { error: 'Unknown response format', content: '' }
    }
  } catch (error) {
    console.error('API call error:', error)
    return { error: error instanceof Error ? error.message : 'Unknown error', content: '' }
  }
}
