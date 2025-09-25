
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { decrypt } from '../../../../lib/encryption'
import { AIClient } from '../../../../lib/ai-client'

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

    // Use the first active API key (you could implement provider selection logic here)
    const apiKeyRecord = activeApiKeys[0]
    const decryptedKey = decrypt(apiKeyRecord.keyValue)
    const aiClient = new AIClient(decryptedKey, apiKeyRecord.provider)

    // Search for relevant documents based on the message
    const relevantDocs = await searchRelevantDocuments(message)
    const context = relevantDocs.map(doc => 
      `Document: ${doc.originalName}\nContent: ${doc.content?.substring(0, 1000)}...`
    ).join('\n\n')

    // Get or create chat session
    let session
    if (sessionId) {
      session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
      })
    }

    const messages = session ? JSON.parse(session.messages || '[]') : []
    
    // Add context as system message if available and no messages yet
    if (context && messages.length === 0) {
      messages.push({ 
        role: 'system', 
        content: `You are an AI assistant for sports bar AV system troubleshooting. Here is relevant context from uploaded documents:\n\n${context}` 
      })
    }
    
    messages.push({ role: 'user', content: message })

    // Get AI response
    const aiResponse = await aiClient.chat(messages)

    if (aiResponse.error) {
      return NextResponse.json({
        response: `I encountered an error: ${aiResponse.error}. Please check your API key configuration.`
      })
    }

    // Add AI response to messages
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
