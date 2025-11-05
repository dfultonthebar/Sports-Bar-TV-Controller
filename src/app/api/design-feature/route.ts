
import { NextRequest, NextResponse } from 'next/server'
import { EnhancedAIClient, FeatureDesignRequest } from '@/lib/enhanced-ai-client'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { data } = bodyValidation


  try {
    const designRequest: FeatureDesignRequest = data

    if (!designRequest.featureName || !designRequest.description || !designRequest.requirements) {
      return NextResponse.json({ 
        error: 'Feature name, description, and requirements are required' 
      }, { status: 400 })
    }

    const enhancedAI = new EnhancedAIClient()
    const result = await enhancedAI.designFeature(designRequest)

    if (result.error) {
      return NextResponse.json({ 
        error: `Feature design failed: ${result.error}` 
      }, { status: 500 })
    }

    return NextResponse.json({ design: result.content })
  } catch (error) {
    logger.error('Feature design API error:', error)
    return NextResponse.json({ 
      error: 'Failed to design feature' 
    }, { status: 500 })
  }
}
