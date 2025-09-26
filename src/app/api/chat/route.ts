
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/db'
import { decrypt } from '../../../lib/encryption'

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

    // Search for relevant documents based on the message
    const relevantDocs = await searchRelevantDocuments(message)
    const context = relevantDocs.map(doc => 
      `Document: ${doc.originalName}\nContent: ${doc.content?.substring(0, 1500)}...`
    ).join('\n\n')

    // Get or create chat session
    let session
    if (sessionId) {
      session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
      })
    }

    const messages = session ? JSON.parse(session.messages || '[]') : []
    
    // Add system message with context
    const systemMessage: ChatMessage = {
      role: 'system',
      content: `You are a Sports Bar AI Assistant specializing in AV system troubleshooting and management. You have access to uploaded documentation and can provide specific technical guidance.

You help with:
- Audio/Visual equipment troubleshooting
- Matrix switching and routing issues
- IR device control problems
- Network connectivity issues
- Equipment configuration guidance

${context ? `\n\nRelevant documentation context:\n${context}` : ''}

Provide helpful, technical, and actionable responses based on the available documentation and your knowledge of AV systems.`
    }

    const allMessages = [systemMessage, ...messages, { role: 'user', content: message }]

    // Get AI response using the same method as enhanced chat
    const aiResponse = await makeAPICall(allMessages, apiKeyRecord.provider, decryptedKey)

    if (aiResponse.error) {
      return NextResponse.json({
        response: `I encountered an error: ${aiResponse.error}. Please check your API key configuration.`
      })
    }

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
      })),
    })
  } catch (error) {
    console.error('Chat error:', error)
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

async function searchRelevantDocuments(query: string) {
  // Simple text search - in production you might want to use vector embeddings
  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { content: { contains: query } },
        { originalName: { contains: query } },
      ],
    },
    take: 3, // Limit to top 3 relevant documents
  })

  return documents
}
