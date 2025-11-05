
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { routeMatrix } from '@/lib/matrix-control'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'


export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.matrixRouting)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Security: use validated data
  const { data } = bodyValidation
  const { input, output } = data
  try {

    // Validate input parameters
    if (!input || !output || input < 1 || output < 1 || input > 32 || output > 32) {
      return NextResponse.json(
        { error: 'Invalid input or output channel' },
        { status: 400 }
      )
    }

    // Use shared matrix routing logic
    const success = await routeMatrix(input, output)

    if (!success) {
      return NextResponse.json({
        error: `Failed to route input ${input} to output ${output}`,
        success: false
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Successfully routed input ${input} to output ${output}`,
      command: `${input}X${output}.`,
      route: { input, output }
    })

  } catch (error) {
    logger.error('Error routing signal:', error)
    return NextResponse.json(
      { error: 'Failed to route signal' },
      { status: 500 }
    )
  }
}
