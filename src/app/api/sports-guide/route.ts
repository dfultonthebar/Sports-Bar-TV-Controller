/**
 * Simplified Sports Guide API - The Rail Media API Only
 * 
 * This endpoint uses ONLY The Rail Media API as the single source of truth
 * for sports programming data. All other data sources have been removed.
 * 
 * Version: 4.0.0 - Simplified Implementation
 * Last Updated: October 16, 2025
 * 
 * API Provider: The Rail Media (https://guide.thedailyrail.com)
 * Documentation: https://guide.thedailyrail.com/api/v1
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSportsGuideApi, SportsGuideApiError } from '@/lib/sportsGuideApi'

// Configure route segment to be dynamic
export const dynamic = 'force-dynamic'

// Comprehensive logging utility
function logInfo(message: string, data?: any) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] [Sports-Guide] INFO: ${message}`, data || '')
}

function logError(message: string, error?: any) {
  const timestamp = new Date().toISOString()
  console.error(`[${timestamp}] [Sports-Guide] ERROR: ${message}`, error || '')
}

function logDebug(message: string, data?: any) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] [Sports-Guide] DEBUG: ${message}`, data || '')
}

/**
 * POST /api/sports-guide
 * 
 * Fetch sports programming guide from The Rail Media API
 * 
 * Request Body:
 * {
 *   "startDate": "2025-10-16",  // Optional: YYYY-MM-DD format
 *   "endDate": "2025-10-23",     // Optional: YYYY-MM-DD format
 *   "days": 7,                   // Optional: Number of days from today
 *   "lineup": "SAT",             // Optional: Filter by lineup (SAT, DRTV, etc.)
 *   "search": "NBA"              // Optional: Search term (team, league, sport)
 * }
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  logInfo(`[${requestId}] New sports guide request received`)
  
  try {
    // Parse request body
    const body = await request.json()
    logDebug(`[${requestId}] Request body:`, body)
    
    const { startDate, endDate, days, lineup, search } = body

    // Validate The Rail API configuration
    logInfo(`[${requestId}] Validating The Rail Media API configuration...`)
    const apiKey = process.env.SPORTS_GUIDE_API_KEY
    const userId = process.env.SPORTS_GUIDE_USER_ID
    const apiUrl = process.env.SPORTS_GUIDE_API_URL || 'https://guide.thedailyrail.com/api/v1'
    
    if (!apiKey || !userId) {
      logError(`[${requestId}] The Rail API credentials missing in environment variables`)
      return NextResponse.json(
        { 
          success: false, 
          error: 'The Rail Media API not configured. Please add SPORTS_GUIDE_API_KEY and SPORTS_GUIDE_USER_ID to .env file',
          requestId
        },
        { status: 500 }
      )
    }

    logInfo(`[${requestId}] The Rail API configured - User ID: ${userId}`)
    logDebug(`[${requestId}] API URL: ${apiUrl}`)
    logDebug(`[${requestId}] API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`)

    // Initialize The Rail API client
    logInfo(`[${requestId}] Initializing The Rail Media API client...`)
    const api = getSportsGuideApi()
    logInfo(`[${requestId}] The Rail API client initialized successfully`)

    // Fetch guide data based on parameters
    let guide
    let fetchMethod = 'unknown'

    try {
      if (days && typeof days === 'number') {
        fetchMethod = `fetchDateRangeGuide (${days} days)`
        logInfo(`[${requestId}] Fetching guide for next ${days} days...`)
        guide = await api.fetchDateRangeGuide(days)
      } else if (startDate && endDate) {
        fetchMethod = `fetchGuide (${startDate} to ${endDate})`
        logInfo(`[${requestId}] Fetching guide from ${startDate} to ${endDate}...`)
        guide = await api.fetchGuide(startDate, endDate)
      } else if (startDate) {
        fetchMethod = `fetchGuide (single day: ${startDate})`
        logInfo(`[${requestId}] Fetching guide for single day: ${startDate}...`)
        guide = await api.fetchGuide(startDate, startDate)
      } else {
        fetchMethod = 'fetchTodayGuide'
        logInfo(`[${requestId}] Fetching guide for today...`)
        guide = await api.fetchTodayGuide()
      }

      logInfo(`[${requestId}] Successfully fetched guide data from The Rail API using ${fetchMethod}`)
      logDebug(`[${requestId}] Guide data structure:`, {
        listingGroupsCount: guide.listing_groups?.length || 0,
        firstGroupTitle: guide.listing_groups?.[0]?.group_title || 'N/A',
      })

    } catch (apiError) {
      if (apiError instanceof SportsGuideApiError) {
        logError(`[${requestId}] The Rail API error:`, {
          message: apiError.message,
          statusCode: apiError.statusCode,
          response: apiError.response
        })
        return NextResponse.json(
          { 
            success: false, 
            error: `The Rail Media API error: ${apiError.message}`,
            statusCode: apiError.statusCode,
            requestId
          },
          { status: apiError.statusCode || 500 }
        )
      }
      throw apiError
    }

    // Apply filters if requested
    let filteredGuide = guide
    let appliedFilters: string[] = []

    // Filter by lineup (e.g., SAT for satellite, DRTV for DirecTV)
    if (lineup) {
      logInfo(`[${requestId}] Filtering by lineup: ${lineup}`)
      const channels = api.getChannelsByLineup(guide, lineup)
      logInfo(`[${requestId}] Found ${channels.length} channels for lineup ${lineup}`)
      appliedFilters.push(`lineup:${lineup}`)
      
      // Store channels info for response
      filteredGuide = {
        ...guide,
        _lineupChannels: channels
      }
    }

    // Filter by search term (team, league, sport name)
    if (search) {
      logInfo(`[${requestId}] Searching guide for: "${search}"`)
      const searchResults = api.searchGuide(filteredGuide, search)
      logInfo(`[${requestId}] Found ${searchResults.length} listing groups matching search term`)
      appliedFilters.push(`search:${search}`)
      
      filteredGuide = {
        listing_groups: searchResults,
      }
    }

    // Calculate statistics
    const totalListingGroups = filteredGuide.listing_groups?.length || 0
    const totalListings = filteredGuide.listing_groups?.reduce(
      (sum, group) => sum + (group.listings?.length || 0), 
      0
    ) || 0
    
    logInfo(`[${requestId}] Guide data processed successfully:`)
    logInfo(`[${requestId}]   - Total listing groups: ${totalListingGroups}`)
    logInfo(`[${requestId}]   - Total listings: ${totalListings}`)
    logInfo(`[${requestId}]   - Applied filters: ${appliedFilters.join(', ') || 'none'}`)

    // Build response
    const response = {
      success: true,
      requestId,
      dataSource: 'The Rail Media API',
      apiProvider: {
        name: 'The Rail Media',
        url: apiUrl,
        userId: userId
      },
      fetchMethod,
      data: filteredGuide,
      statistics: {
        totalListingGroups,
        totalListings,
        appliedFilters,
        generatedAt: new Date().toISOString()
      },
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        days: days || null,
        lineup: lineup || null,
        search: search || null
      }
    }

    logInfo(`[${requestId}] Returning successful response with ${totalListings} listings`)
    return NextResponse.json(response)

  } catch (error) {
    logError(`[${requestId}] Unexpected error in sports guide API:`, error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        requestId
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sports-guide
 * 
 * Get API information, status, and available endpoints
 */
export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  logInfo(`[${requestId}] API status/info request received`)
  
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    // Handle special actions
    if (action === 'test-connection') {
      logInfo(`[${requestId}] Testing The Rail API connection...`)
      
      try {
        const api = getSportsGuideApi()
        const result = await api.verifyApiKey()
        
        logInfo(`[${requestId}] Connection test result:`, result)
        
        return NextResponse.json({
          success: true,
          requestId,
          connectionTest: result,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        logError(`[${requestId}] Connection test failed:`, error)
        return NextResponse.json({
          success: false,
          requestId,
          error: error instanceof Error ? error.message : 'Connection test failed',
          timestamp: new Date().toISOString()
        }, { status: 500 })
      }
    }

    // Default: Return API information
    const apiKey = process.env.SPORTS_GUIDE_API_KEY
    const userId = process.env.SPORTS_GUIDE_USER_ID
    const apiUrl = process.env.SPORTS_GUIDE_API_URL || 'https://guide.thedailyrail.com/api/v1'
    
    const configured = !!(apiKey && userId)
    
    logInfo(`[${requestId}] Returning API status - Configured: ${configured}`)
    
    return NextResponse.json({
      success: true,
      requestId,
      version: '4.0.0',
      name: 'Simplified Sports Guide API',
      description: 'Sports programming guide using ONLY The Rail Media API',
      dataSource: {
        provider: 'The Rail Media',
        url: apiUrl,
        userId: userId || 'Not configured',
        apiKeySet: !!apiKey,
        configured
      },
      endpoints: {
        'POST /api/sports-guide': {
          description: 'Fetch sports programming guide',
          parameters: {
            startDate: 'Optional: Start date (YYYY-MM-DD)',
            endDate: 'Optional: End date (YYYY-MM-DD)',
            days: 'Optional: Number of days from today (default: 7)',
            lineup: 'Optional: Filter by lineup (SAT, DRTV, etc.)',
            search: 'Optional: Search term (team, league, sport)'
          }
        },
        'GET /api/sports-guide': 'Get API information and status',
        'GET /api/sports-guide?action=test-connection': 'Test The Rail API connection',
        'GET /api/sports-guide/status': 'Get detailed configuration status',
        'POST /api/sports-guide/verify-key': 'Verify API key validity',
        'POST /api/sports-guide/update-key': 'Update API credentials'
      },
      features: [
        'Single data source: The Rail Media API only',
        'Comprehensive verbose logging',
        'Date range filtering',
        'Lineup filtering (SAT, DRTV, etc.)',
        'Search functionality (teams, leagues, sports)',
        'Real-time sports programming data',
        'Simplified and maintainable codebase'
      ],
      logging: {
        enabled: true,
        location: 'PM2 logs (pm2 logs sports-bar-tv)',
        format: '[timestamp] [Sports-Guide] LEVEL: message',
        levels: ['INFO', 'ERROR', 'DEBUG']
      },
      supportedLineups: [
        'SAT - Satellite',
        'DRTV - DirecTV',
        'DISH - Dish Network',
        'CABLE - Cable providers',
        'STREAM - Streaming services'
      ],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logError(`[${requestId}] Error in GET endpoint:`, error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        requestId
      },
      { status: 500 }
    )
  }
}
