
/**
 * API Route for retrieving specific IR codes for cable box models
 * Integrated with Global Cache IR Database
 */

import { NextRequest, NextResponse } from 'next/server'
import { globalCacheAPI } from '@/lib/global-cache-api'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  try {
    const { searchParams } = new URL(request.url)
    const modelId = searchParams.get('modelId')

    if (!modelId) {
      return NextResponse.json({ 
        error: 'Model ID parameter is required' 
      }, { status: 400 })
    }

    // Get IR codes for the specific model
    const codes = await globalCacheAPI.getModelCodes(modelId)

    return NextResponse.json({
      modelId,
      codes,
      totalCodes: codes.reduce((sum, codeset) => sum + (codeset.functions?.length || 0), 0),
      message: `Retrieved IR codes for model ${modelId}`
    })

  } catch (error) {
    logger.error('Error retrieving model codes:', error)
    return NextResponse.json({ 
      error: 'Failed to retrieve model codes',
      codes: [] as any[]
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const body = bodyValidation.data

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error

  try {
    const { modelId, codesetId, functionName } = body
    const modelIdStr = modelId as string
    const functionNameStr = functionName as string

    if (!modelIdStr || !functionNameStr) {
      return NextResponse.json({
        error: 'Model ID and function name are required'
      }, { status: 400 })
    }

    // Get specific IR code for a function
    const codes = await globalCacheAPI.getModelCodes(modelIdStr)
    
    let irCode: string | null = null
    for (const codeset of codes) {
      const func = codeset.functions?.find(f => f.name === functionNameStr)
      if (func) {
        irCode = func.code
        break
      }
    }

    if (!irCode) {
      return NextResponse.json({ 
        error: `IR code not found for function '${functionName}' in model ${modelId}` 
      }, { status: 404 })
    }

    return NextResponse.json({
      modelId,
      functionName,
      irCode,
      frequency: 38000, // Standard frequency for most cable boxes
      message: `Retrieved IR code for ${functionName}`
    })

  } catch (error) {
    logger.error('Error retrieving specific IR code:', error)
    return NextResponse.json({ 
      error: 'Failed to retrieve IR code'
    }, { status: 500 })
  }
}
