import { NextRequest, NextResponse } from 'next/server'
import { getAutomatedHealthCheckService } from '@/lib/services/automated-health-check'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'

/**
 * POST /api/system/health-check
 * Run manual health check
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SYSTEM)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error


  try {
    const body = await request.json().catch(() => ({}))
    const checkType = body.checkType || 'manual'

    logger.info(`[Health Check API] Running ${checkType} health check`)

    const service = getAutomatedHealthCheckService()
    const result = await service.runHealthCheck(checkType)
    const report = service.formatReport(result)

    return NextResponse.json({
      success: true,
      result,
      report
    })
  } catch (error) {
    logger.error('[Health Check API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/system/health-check
 * Get recent health check history
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SYSTEM)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { findMany, schema } = await import('@/lib/db-helpers')

    // Get recent health check logs from system settings
    const settings = await findMany('systemSettings', {
      limit: 20
    })

    const healthChecks = settings
      .filter((s: any) => s.key?.startsWith('health_check_'))
      .map((s: any) => {
        try {
          return JSON.parse(s.value)
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .slice(0, 10)

    return NextResponse.json({
      success: true,
      recentChecks: healthChecks
    })
  } catch (error) {
    logger.error('[Health Check API] Error getting history:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get health check history' },
      { status: 500 }
    )
  }
}
