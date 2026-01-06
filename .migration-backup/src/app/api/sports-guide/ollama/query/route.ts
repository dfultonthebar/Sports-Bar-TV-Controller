/**
 * Sports Guide Ollama Query API
 * 
 * API endpoint for querying Ollama about sports guide functionality and logs
 * 
 * POST /api/sports-guide/ollama/query
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@/lib/logger'
import { 
  queryOllamaWithContext, 
  analyzeSportsGuideLogs,
  getSportsGuideRecommendations,
  testOllamaConnection
} from '@/lib/sports-guide-ollama-helper'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = await request.json()
    const { query, action, includeRecentLogs, userPreferences } = body

    logger.info(`[Ollama-Query] Request received - Action: ${action || 'query'}`)

    // Handle different actions
    switch (action) {
      case 'analyze-logs':
        logger.info('[Ollama-Query] Analyzing sports guide logs...')
        const analysisResult = await analyzeSportsGuideLogs()
        return NextResponse.json(analysisResult)

      case 'get-recommendations':
        logger.info('[Ollama-Query] Getting sports guide recommendations...')
        const recommendations = await getSportsGuideRecommendations(userPreferences)
        return NextResponse.json(recommendations)

      case 'test-connection':
        logger.info('[Ollama-Query] Testing Ollama connection...')
        const connectionTest = await testOllamaConnection()
        return NextResponse.json(connectionTest)

      default:
        // Default: Query Ollama with user's question
        if (!query) {
          return NextResponse.json(
            { success: false, error: 'Query parameter is required' },
            { status: 400 }
          )
        }

        logger.info(`[Ollama-Query] Querying Ollama: "${query}"`)
        const result = await queryOllamaWithContext(query, includeRecentLogs !== false)
        return NextResponse.json(result)
    }

  } catch (error) {
    logger.error('[Ollama-Query] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  logger.info('[Ollama-Query] GET request - Testing Ollama connection...')
  const result = await testOllamaConnection()
  return NextResponse.json(result)
}
