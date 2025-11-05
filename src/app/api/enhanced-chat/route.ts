
import { NextRequest, NextResponse } from 'next/server'
import { EnhancedAIClient } from '@/lib/enhanced-ai-client'
import { findUnique, findMany, create, update, like, or as orOp } from '@/lib/db-helpers'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
export async function POST(request: NextRequest) {
  // Input validation
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.aiQuery)
  if (!bodyValidation.success) return bodyValidation.error


  logger.info('[ENHANCED-CHAT] POST request received')
  try {
    logger.info('[ENHANCED-CHAT] Parsing request body...')
    const { message, sessionId, chatType = 'general', context } = bodyValidation.data
    logger.info('[ENHANCED-CHAT] Request parsed:', { message: message?.substring(0, 50), sessionId, chatType })

    if (!message) {
      logger.info('[ENHANCED-CHAT] No message provided')
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Initialize enhanced AI client
    logger.info('[ENHANCED-CHAT] Initializing EnhancedAIClient...')
    const enhancedAI = new EnhancedAIClient()

    // Search for relevant documents based on the message
    logger.info('[ENHANCED-CHAT] Searching for relevant documents...')
    const relevantDocs = await searchRelevantDocuments(message)
    logger.info('[ENHANCED-CHAT] Found documents:', relevantDocs.length)
    const documentContext = relevantDocs.map(doc => 
      `Document: ${doc.originalName}\nContent: ${doc.content?.substring(0, 1500)}...`
    ).join('\n\n')

    // Combine context from documents and user-provided context
    logger.info('[ENHANCED-CHAT] Building full context...')
    const fullContext = [documentContext, context].filter(Boolean).join('\n\n')

    // Get or create chat session
    logger.info('[ENHANCED-CHAT] Getting chat session...')
    let session
    if (sessionId) {
      session = await findUnique('chatSessions', eq(schema.chatSessions.id, sessionId))
      logger.info('[ENHANCED-CHAT] Session found:', !!session)
    }

    const messages = session ? JSON.parse(session.messages || '[]') : []
    messages.push({ role: 'user', content: message })
    logger.info('[ENHANCED-CHAT] Message count:', messages.length)

    // Get enhanced AI response
    logger.info('[ENHANCED-CHAT] Calling enhancedAI.enhancedChat...')
    const aiResponse = await enhancedAI.enhancedChat(messages, fullContext)
    logger.info('[ENHANCED-CHAT] AI response received:', aiResponse.error ? 'ERROR' : 'SUCCESS')

    if (aiResponse.error) {
      return NextResponse.json({
        response: `I encountered an error: ${aiResponse.error}. Please try again or check the system configuration.`
      })
    }

    // Add AI response to messages
    messages.push({ role: 'assistant', content: aiResponse.content })

    // Save or update session
    if (session) {
      await update('chatSessions', eq(schema.chatSessions.id, sessionId), {
        messages: JSON.stringify(messages)
      })
    } else {
      session = await create('chatSessions', {
        title: message.substring(0, 50) + '...',
        messages: JSON.stringify(messages),
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
    logger.error('Enhanced chat error:', error)
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

    // Search for documents containing any of the keywords
    // Note: Since we can't do complex OR with contains, we'll fetch all docs and filter
    const documents = await findMany('documents', {
      limit: 100 // Get a reasonable set to filter
    })

    // Filter documents that match keywords
    const filteredDocs = documents.filter(doc => {
      const contentLower = (doc.content || '').toLowerCase()
      const nameLower = doc.originalName.toLowerCase()
      return keywords.some(keyword =>
        contentLower.includes(keyword) || nameLower.includes(keyword)
      )
    }).slice(0, 5) // Limit to top 5

    // Score documents by number of matching keywords
    const scoredDocuments = filteredDocs.map(doc => {
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
    logger.error('Document search error:', error)
    return []
  }
}
