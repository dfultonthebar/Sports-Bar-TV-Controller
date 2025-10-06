
/**
 * Web Search API
 * 
 * Internal endpoint for web searches (used by TV documentation service)
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/web-search
 * 
 * Perform a web search
 * 
 * Request body:
 * - query: Search query
 * - numResults: Number of results to return (default: 5)
 * 
 * Response:
 * - results: Array of search results
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, numResults = 5 } = body
    
    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      )
    }
    
    // Mock search results for development
    // In production, this would integrate with a real search API
    const mockResults = [
      {
        url: `https://www.manualslib.com/manual/${encodeURIComponent(query)}.pdf`,
        title: `${query} - User Manual PDF`,
        snippet: 'Official user manual and documentation'
      },
      {
        url: `https://www.manuals.plus/${encodeURIComponent(query)}/`,
        title: `${query} Manual - Manuals+`,
        snippet: 'Complete manual and setup guide'
      },
      {
        url: `https://support.example.com/manuals/${encodeURIComponent(query)}.pdf`,
        title: `${query} Support Documentation`,
        snippet: 'Technical specifications and user guide'
      }
    ]
    
    return NextResponse.json({
      success: true,
      results: mockResults.slice(0, numResults)
    })
  } catch (error: any) {
    console.error('[Web Search API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Search failed'
      },
      { status: 500 }
    )
  }
}
