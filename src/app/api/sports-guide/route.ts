/**
 * SIMPLIFIED Sports Guide API - The Rail Media API Only
 * 
 * AUTO-LOADS ALL SPORTS DATA - NO LEAGUE SELECTION REQUIRED
 * 
 * Version: 5.0.0 - Drastically Simplified Auto-Loading Implementation
 * Last Updated: October 16, 2025
 * 
 * API Provider: The Rail Media (https://guide.thedailyrail.com)
 * 
 * CHANGES FROM v4.0.0:
 * - Removed league selection logic
 * - Auto-fetches ALL game data when called with no parameters
 * - Maximum verbosity logging for AI analysis
 * - Simplified request handling
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSportsGuideApi, SportsGuideApiError } from '@/lib/sportsGuideApi'
import { withRateLimit, addRateLimitHeaders } from '@/lib/rate-limiting/middleware'
import { cacheManager } from '@/lib/cache-manager'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
// Configure route segment to be dynamic
export const dynamic = 'force-dynamic'

// MAXIMUM VERBOSITY LOGGING
function logInfo(message: string, data?: any) {
  const timestamp = new Date().toISOString()
  logger.info(`[${timestamp}] [Sports-Guide-API] INFO: ${message}`)
  if (data) {
    logger.info(`[${timestamp}] [Sports-Guide-API] DATA:`, { data: JSON.stringify(data, null, 2) })
  }
}

function logError(message: string, error?: any) {
  const timestamp = new Date().toISOString()
  logger.error(`[${timestamp}] [Sports-Guide-API] ERROR: ${message}`)
  if (error) {
    logger.error(`[${timestamp}] [Sports-Guide-API] ERROR-DETAILS:`, error)
  }
}

function logDebug(message: string, data?: any) {
  const timestamp = new Date().toISOString()
  logger.info(`[${timestamp}] [Sports-Guide-API] DEBUG: ${message}`)
  if (data) {
    logger.info(`[${timestamp}] [Sports-Guide-API] DEBUG-DATA:`, { data: JSON.stringify(data, null, 2) })
  }
}

/**
 * POST /api/sports-guide
 * 
 * SIMPLIFIED: Fetches ALL sports programming from The Rail Media API
 * No parameters required - automatically fetches 7 days of all sports
 * 
 * Optional Request Body:
 * {
 *   "days": 7,  // Optional: Number of days (default: 7)
 * }
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  const requestStart = Date.now()

  logInfo(`========== NEW SPORTS GUIDE REQUEST [${requestId}] ==========`)
  logInfo(`Request received at ${new Date().toISOString()}`)

  // Apply rate limiting (20 requests per minute for sports endpoints)
  const rateLimitCheck = await withRateLimit(request, 'SPORTS')

  if (!rateLimitCheck.allowed) {
    logInfo(`Rate limit exceeded for request [${requestId}]`)
    return rateLimitCheck.response!
  }

  logInfo(`Rate limit check passed: ${rateLimitCheck.result.remaining} requests remaining`)

  try {
    // Parse request body (optional) - Body is optional for this endpoint
    let body: any = {}
    try {
      const text = await request.text()
      if (text && text.trim()) {
        body = JSON.parse(text)
        logDebug(`Request body received:`, body)
      } else {
        logInfo(`No request body provided - using defaults`)
      }
    } catch (e) {
      logInfo(`No valid request body - using defaults`)
    }
    
    // Default to 7 days if not specified
    const days = body.days || 7
    logInfo(`Fetching ${days} days of sports programming`)

    // Validate The Rail API configuration
    logInfo(`---------- VALIDATING API CONFIGURATION ----------`)
    const apiKey = process.env.SPORTS_GUIDE_API_KEY
    const userId = process.env.SPORTS_GUIDE_USER_ID
    const apiUrl = process.env.SPORTS_GUIDE_API_URL || 'https://guide.thedailyrail.com/api/v1'
    
    logDebug(`API URL: ${apiUrl}`)
    logDebug(`User ID: ${userId}`)
    logDebug(`API Key: ${apiKey ? `${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length - 4)}` : 'NOT SET'}`)
    
    if (!apiKey || !userId) {
      logError(`API credentials missing in environment variables`)
      return NextResponse.json(
        { 
          success: false, 
          error: 'The Rail Media API not configured. Check SPORTS_GUIDE_API_KEY and SPORTS_GUIDE_USER_ID in .env',
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    }

    logInfo(`✓ The Rail API configuration validated successfully`)

    // Initialize The Rail API client
    logInfo(`---------- INITIALIZING API CLIENT ----------`)
    const api = getSportsGuideApi()
    logInfo(`✓ The Rail Media API client initialized`)

    // QUICK WIN 2: Check cache first before fetching
    logInfo(`---------- CHECKING CACHE ----------`)
    const cacheKey = `guide-${days}-days`
    const cached = cacheManager.get('sports-data', cacheKey)

    let guide
    let fromCache = false

    if (cached) {
      logInfo(`✓ Cache HIT - Returning cached data (key: ${cacheKey})`)
      guide = cached
      fromCache = true
    } else {
      logInfo(`✗ Cache MISS - Fetching fresh data from API (key: ${cacheKey})`)

      // Fetch ALL guide data
      logInfo(`---------- FETCHING SPORTS GUIDE DATA ----------`)
      logInfo(`Requesting ${days} days of ALL sports from The Rail Media API`)

      const fetchStart = Date.now()

      try {
        guide = await api.fetchDateRangeGuide(days)
        const fetchDuration = Date.now() - fetchStart

        logInfo(`✓ Successfully fetched guide data in ${fetchDuration}ms`)

        // QUICK WIN 2: Cache the response for 5 minutes
        cacheManager.set('sports-data', cacheKey, guide, 5 * 60 * 1000)
        logInfo(`✓ Cached response with 5-minute TTL`)

        logInfo(`---------- API RESPONSE SUMMARY ----------`)
        logDebug(`Full API response structure:`, {
          hasListingGroups: !!guide.listing_groups,
          listingGroupsCount: guide.listing_groups?.length || 0,
          listingGroupTitles: guide.listing_groups?.map((g: any) => g.group_title) || [],
          totalListings: guide.listing_groups?.reduce((sum: number, g: any) => sum + (g.listings?.length || 0), 0) || 0
        })

        // Log first listing group as sample
        if (guide.listing_groups && guide.listing_groups.length > 0) {
          logDebug(`Sample listing group (first):`, {
            title: guide.listing_groups[0].group_title,
            listingsCount: guide.listing_groups[0].listings?.length || 0,
            firstListing: guide.listing_groups[0].listings?.[0] || null
          })
        }

      } catch (apiError) {
        const fetchDuration = Date.now() - fetchStart
        logError(`✗ API request failed after ${fetchDuration}ms`, apiError)

        if (apiError instanceof SportsGuideApiError) {
          logError(`The Rail API Error Details:`, {
            message: apiError.message,
            statusCode: apiError.statusCode,
            response: apiError.response
          })

          return NextResponse.json(
            {
              success: false,
              error: `The Rail Media API error: ${apiError.message}`,
              statusCode: apiError.statusCode,
              requestId,
              timestamp: new Date().toISOString()
            },
            { status: apiError.statusCode || 500 }
          )
        }
        throw apiError
      }
    }

    // Return raw data - no filtering, no transformation
    const requestDuration = Date.now() - requestStart
    logInfo(`========== REQUEST COMPLETE [${requestId}] ==========`)
    logInfo(`Total request duration: ${requestDuration}ms`)
    logInfo(`Returning ${guide.listing_groups?.length || 0} listing groups to client`)

    const response = {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      durationMs: requestDuration,
      fromCache, // QUICK WIN 2: Indicate if response came from cache
      dataSource: 'The Rail Media API',
      apiProvider: {
        name: 'The Rail Media',
        url: apiUrl,
        userId: userId
      },
      fetchMethod: `fetchDateRangeGuide (${days} days)`,
      summary: {
        listingGroupsCount: guide.listing_groups?.length || 0,
        totalListings: guide.listing_groups?.reduce((sum: number, g: any) => sum + (g.listings?.length || 0), 0) || 0,
      },
      data: guide,
      rawApiResponse: guide // Include raw response for debugging
    }

    logDebug(`Response being sent to client:`, {
      success: response.success,
      listingGroupsCount: response.summary.listingGroupsCount,
      totalListings: response.summary.totalListings
    })

    // Add rate limit headers to response
    const jsonResponse = NextResponse.json(response)
    return addRateLimitHeaders(jsonResponse, rateLimitCheck.result)

  } catch (error) {
    const requestDuration = Date.now() - requestStart
    logError(`========== REQUEST FAILED [${requestId}] ==========`, error)
    logError(`Failed after ${requestDuration}ms`)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        requestId,
        timestamp: new Date().toISOString(),
        durationMs: requestDuration
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sports-guide
 * 
 * Simple GET endpoint that fetches 7 days of sports data
 */
export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  logInfo(`========== GET REQUEST [${requestId}] - Redirecting to POST ==========`)
  
  // Convert GET to POST with default parameters
  return POST(request)
}
