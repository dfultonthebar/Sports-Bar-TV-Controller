
/**
 * Fetch TV Manual API
 * 
 * Endpoint for fetching TV manuals and generating Q&A pairs
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchTVManual } from '@/lib/tvDocs'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
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
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error


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
    
    logger.info(`[Fetch TV Manual API] Fetching manual for ${manufacturer} ${model}`)
    
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
    logger.error('[Fetch TV Manual API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch TV manual'
      },
      { status: 500 }
    )
  }
}
