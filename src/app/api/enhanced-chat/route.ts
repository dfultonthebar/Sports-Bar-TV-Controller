
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/db'
import { EnhancedAIClient } from '../../../lib/enhanced-ai-client'

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId, chatType = 'general', context } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Initialize enhanced AI client
    const enhancedAI = new EnhancedAIClient()

    // Search for relevant documents based on the message
    const relevantDocs = await searchRelevantDocuments(message)
    const documentContext = relevantDocs.map(doc => 
      `Document: ${doc.originalName}\nContent: ${doc.content?.substring(0, 1500)}...`
    ).join('\n\n')

    // Combine context from documents and user-provided context
    const fullContext = [documentContext, context].filter(Boolean).join('\n\n')

    // Get or create chat session
    let session
    if (sessionId) {
      session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
      })
    }

    const messages = session ? JSON.parse(session.messages || '[]') : []
    messages.push({ role: 'user', content: message })

    // Get enhanced AI response
    const aiResponse = await enhancedAI.enhancedChat(messages, fullContext)

    if (aiResponse.error) {
      return NextResponse.json({
        response: `I encountered an error: ${aiResponse.error}. Please try again or check the system configuration.`
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
    console.error('Enhanced chat error:', error)
    return NextResponse.json(
      { error: 'Failed to process enhanced chat message' }, 
      { status: 500 }
    )
  }
}

async function searchRelevantDocuments(query: string) {
  try {
    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { content: { contains: query } },
          { originalName: { contains: query } },
          { content: { contains: query.toLowerCase() } },
          { originalName: { contains: query.toLowerCase() } },
        ],
      },
      take: 5, // Limit to top 5 relevant documents
    })

    return documents
  } catch (error) {
    console.error('Document search error:', error)
    return []
  }
}
