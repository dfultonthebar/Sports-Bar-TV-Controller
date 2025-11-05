
import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export const dynamic = 'force-dynamic'

// TV Programming API - NO MOCK DATA
// This API requires integration with real TV programming sources:
// - Gracenote EPG API (Electronic Programming Guide)
// - TMS (Tribune Media Services)
// - Rovi/TiVo Guide Data
// - Spectrum Business TV API
// - DirecTV Guide API

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  try {
    const url = new URL(request.url)
    const channelNumber = url.searchParams.get('channel')
    const days = parseInt(url.searchParams.get('days') || '7')
    
    logger.info('⚠️ TV Programming API: No real data source configured')
    logger.info('ℹ️ Please configure Gracenote, TMS, or Spectrum Business API for EPG data')
    
    return NextResponse.json({
      success: false,
      error: 'No TV programming data source configured',
      message: 'Please configure a real EPG (Electronic Programming Guide) data source',
      suggestedProviders: [
        'Gracenote EPG API',
        'TMS (Tribune Media Services)',
        'Rovi/TiVo Guide Data',
        'Spectrum Business TV API',
        'DirecTV Guide API via receivers'
      ],
      alternativeEndpoints: [
        '/api/sports-guide - For live sports programming',
        '/api/directv-devices/guide-data - For DirecTV receiver guide',
        '/api/firetv-devices/guide-data - For Fire TV streaming guide'
      ],
      requestedChannel: channelNumber,
      requestedDays: days
    })
  } catch (error) {
    logger.error('Error in TV programming API:', error)
    return NextResponse.json({ 
      success: false,
      error: 'TV Programming API error' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  try {
    logger.info('⚠️ TV Programming Update: No real data source configured')
    
    return NextResponse.json({
      success: false,
      message: 'No TV programming data source configured for updates',
      timestamp: new Date().toISOString(),
      recommendation: 'Configure Gracenote EPG, TMS, or Spectrum Business API for automated updates'
    })
  } catch (error) {
    logger.error('Error updating TV programming:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to update programming' 
    }, { status: 500 })
  }
}
