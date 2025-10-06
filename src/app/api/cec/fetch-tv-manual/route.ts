
/**
 * Fetch TV Manual API
 * 
 * Endpoint for fetching TV manuals and generating Q&A pairs
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchTVManual } from '@/lib/tvDocs'

/**
 * POST /api/cec/fetch-tv-manual
 * 
 * Fetch manual for a specific TV model
 * 
 * Request body:
 * - manufacturer: TV manufacturer/brand
 * - model: TV model number
 * - forceRefetch: Force re-download even if manual exists
 * 
 * Response:
 * - success: Whether the operation succeeded
 * - manufacturer: TV manufacturer
 * - model: TV model
 * - manualPath: Local path to downloaded manual
 * - documentationPath: Original URL of the manual
 * - qaGenerated: Whether Q&A pairs were generated
 * - qaPairsCount: Number of Q&A pairs generated
 * - error: Error message if failed
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { manufacturer, model, forceRefetch = false } = body
    
    if (!manufacturer || !model) {
      return NextResponse.json(
        {
          success: false,
          error: 'Manufacturer and model are required'
        },
        { status: 400 }
      )
    }
    
    console.log(`[Fetch TV Manual API] Fetching manual for ${manufacturer} ${model}`)
    
    const result = await fetchTVManual({
      manufacturer,
      model,
      forceRefetch
    })
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        manufacturer: result.manufacturer,
        model: result.model,
        manualPath: result.manualPath,
        documentationPath: result.documentationPath,
        qaGenerated: result.qaGenerated,
        qaPairsCount: result.qaPairsCount,
        message: `Successfully fetched manual for ${manufacturer} ${model}`
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          manufacturer: result.manufacturer,
          model: result.model,
          error: result.error,
          searchResults: result.searchResults,
          message: `Failed to fetch manual: ${result.error}`
        },
        { status: 404 }
      )
    }
  } catch (error: any) {
    console.error('[Fetch TV Manual API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch TV manual'
      },
      { status: 500 }
    )
  }
}
