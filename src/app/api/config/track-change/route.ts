
import { NextRequest, NextResponse } from 'next/server'
import { configChangeTracker } from '@/lib/config-change-tracker'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  try {
    const { type, file, changes, action = 'modified' } = await request.json()
    
    if (!type || !file) {
      return NextResponse.json({
        success: false,
        error: 'Type and file are required'
      }, { status: 400 })
    }

    const changeEvent = await configChangeTracker.trackConfigChange(
      type,
      file,
      changes,
      action
    )

    return NextResponse.json({
      success: true,
      changeEvent,
      message: 'Configuration change tracked successfully'
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  try {
    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const limit = parseInt(url.searchParams.get('limit') || '50')

    const history = await configChangeTracker.getChangeHistory(
      type as any, 
      limit
    )

    return NextResponse.json({
      success: true,
      history,
      total: history.length
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
