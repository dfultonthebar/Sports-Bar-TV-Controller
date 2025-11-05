
/**
 * CEC Discovery API
 *
 * Endpoint for discovering TV brands connected to WolfPack outputs
 * Supports both synchronous and asynchronous discovery with job tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { discoverAllTVBrands, discoverSingleTV } from '@/lib/services/cec-discovery-service'
import { findMany, eq, asc } from '@/lib/db-helpers'
import { schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { jobTracker } from '@/lib/services/job-tracker'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
/**
 * POST /api/cec/discovery
 *
 * Run CEC discovery on all outputs or a specific output
 *
 * Request body:
 * - outputNumber (optional): Discover specific output only
 * - async (optional): Run discovery in background with job tracking (default: true for all outputs)
 *
 * Response (async mode):
 * - jobId: Job ID for tracking progress
 * - message: Instructions for checking status
 * - estimatedTime: Estimated completion time
 *
 * Response (sync mode):
 * - results: Array of discovery results
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Input validation
  const bodyValidation = await validateRequestBody(
    request,
    z.object({
      outputNumber: z.number().int().positive().optional(),
      async: z.boolean().optional()
    })
  )
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { data: body } = bodyValidation
  const { outputNumber, async: asyncMode } = body

  try {
    if (outputNumber) {
      // Single output discovery - always synchronous (fast, 10-15 seconds)
      logger.info(`[CEC Discovery API] Starting single output discovery for output ${outputNumber}`)

      const result = await discoverSingleTV(parseInt(outputNumber))

      return NextResponse.json({
        success: true,
        results: [result],
        message: result.success
          ? `Discovered ${result.brand} on output ${outputNumber}`
          : `Failed to discover TV on output ${outputNumber}`
      })
    } else {
      // All outputs discovery - can be async (long operation, 4-5 minutes)
      const shouldRunAsync = asyncMode !== false // Default to true

      if (shouldRunAsync) {
        // ASYNC MODE: Start background job, return immediately
        logger.info('[CEC Discovery API] Starting async discovery job for all outputs')

        // Create job with estimated count (will be updated with actual count)
        const jobId = jobTracker.createJob('cec-discovery', 30, 'Initializing discovery...')

        // Start discovery in background (don't await!)
        discoverAllTVBrands((current, total, message) => {
          jobTracker.updateProgress(jobId, current, message)
        })
          .then(results => {
            jobTracker.completeJob(jobId, results)
            const successCount = results.filter(r => r.success).length
            logger.info(
              `[CEC Discovery API] Job ${jobId} completed: ${successCount}/${results.length} TVs discovered`
            )
          })
          .catch(error => {
            jobTracker.failJob(jobId, error.message)
            logger.error(`[CEC Discovery API] Job ${jobId} failed:`, error)
          })

        return NextResponse.json({
          success: true,
          jobId,
          message: 'Discovery started in background. Use GET /api/cec/discovery/status?jobId=<JOB_ID> to check progress.',
          estimatedTime: '4-5 minutes',
          statusEndpoint: `/api/cec/discovery/status?jobId=${jobId}`
        })
      } else {
        // SYNC MODE: Wait for completion (old behavior)
        logger.info('[CEC Discovery API] Starting synchronous discovery for all outputs')

        const results = await discoverAllTVBrands()
        const successCount = results.filter(r => r.success).length

        return NextResponse.json({
          success: true,
          results,
          message: `Discovery complete: ${successCount}/${results.length} TVs detected`
        })
      }
    }
  } catch (error: any) {
    logger.error('[CEC Discovery API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to run discovery'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cec/discovery
 * 
 * Get last discovery results from database
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const outputs = await findMany('matrixOutputs', {
      where: eq(schema.matrixOutputs.isActive, true),
      orderBy: asc(schema.matrixOutputs.channelNumber)
    })
    
    return NextResponse.json({
      success: true,
      outputs: outputs.map(o => ({
        outputNumber: o.channelNumber,
        label: o.label,
        brand: o.tvBrand,
        model: o.tvModel,
        cecAddress: o.cecAddress,
        lastDiscovery: o.lastDiscovery,
        discovered: !!o.tvBrand
      }))
    })
  } catch (error: any) {
    logger.error('[CEC Discovery API] Error fetching results:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch discovery results'
      },
      { status: 500 }
    )
  }
}

