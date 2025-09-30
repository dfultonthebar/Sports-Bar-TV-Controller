
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { EnhancedAIClient } from '@/lib/enhanced-ai-client'

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
    // Split query into individual keywords
    const keywords = query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2) // Filter out very short words
      .slice(0, 10) // Limit to first 10 keywords

    if (keywords.length === 0) return []

    // Create search conditions for each keyword
    const searchConditions = keywords.flatMap(keyword => [
      { content: { contains: keyword } },
      { originalName: { contains: keyword } }
    ])

    const documents = await prisma.document.findMany({
      where: {
        OR: searchConditions
      },
      take: 5, // Limit to top 5 relevant documents
    })

    // Score documents by number of matching keywords
    const scoredDocuments = documents.map(doc => {
      const contentLower = (doc.content || '').toLowerCase()
      const nameLower = doc.originalName.toLowerCase()
      
      const matches = keywords.filter(keyword => 
        contentLower.includes(keyword) || nameLower.includes(keyword)
      ).length

      return { ...doc, matchScore: matches }
    })

    // Sort by match score (highest first) and return
    return scoredDocuments
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5)

  } catch (error) {
    console.error('Document search error:', error)
    return []
  }
}
