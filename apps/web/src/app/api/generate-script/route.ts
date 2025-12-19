
import { NextRequest, NextResponse } from 'next/server'
import { EnhancedAIClient, ScriptGenerationRequest } from '@/lib/enhanced-ai-client'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { data } = bodyValidation


  try {
    const scriptRequest = data as unknown as ScriptGenerationRequest

    if (!scriptRequest.description || !scriptRequest.scriptType) {
      return NextResponse.json({ 
        error: 'Description and script type are required' 
      }, { status: 400 })
    }

    const enhancedAI = new EnhancedAIClient()
    const result = await enhancedAI.generateScript(scriptRequest)

    if (result.error) {
      return NextResponse.json({ 
        error: `Script generation failed: ${result.error}` 
      }, { status: 500 })
    }

    return NextResponse.json({ script: result.content })
  } catch (error) {
    logger.error('Script generation API error:', error)
    return NextResponse.json({ 
      error: 'Failed to generate script' 
    }, { status: 500 })
  }
}
