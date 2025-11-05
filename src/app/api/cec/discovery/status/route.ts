/**
 * CEC Discovery Status API
 *
 * Endpoint for checking the status of async CEC discovery jobs
 */

import { NextRequest, NextResponse } from 'next/server'
import { jobTracker } from '@/lib/services/job-tracker'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@/lib/logger'

/**
 * GET /api/cec/discovery/status?jobId=XXX
 *
 * Check status of async discovery job
 *
 * Query params:
 * - jobId (required): Job ID returned from POST /api/cec/discovery
 *
 * Response:
 * - job.status: 'running' | 'completed' | 'failed'
 * - job.progress: Current progress info (current, total, percentage, message)
 * - job.result: Discovery results (only when completed)
 * - job.error: Error message (only when failed)
 * - job.duration: Time elapsed since job started
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('jobId')

  if (!jobId) {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing jobId parameter. Usage: /api/cec/discovery/status?jobId=<JOB_ID>'
      },
      { status: 400 }
    )
  }

  logger.debug(`[CEC Discovery Status API] Checking status for job: ${jobId}`)

  const job = jobTracker.getJob(jobId)

  if (!job) {
    logger.warn(`[CEC Discovery Status API] Job not found: ${jobId}`)
    return NextResponse.json(
      {
        success: false,
        error: 'Job not found. It may have expired (jobs are kept for 1 hour after completion).'
      },
      { status: 404 }
    )
  }

  // Calculate duration
  const endTime = job.completedAt ? job.completedAt.getTime() : Date.now()
  const durationMs = endTime - job.startedAt.getTime()
  const durationSeconds = Math.round(durationMs / 1000)

  // Format duration for readability
  let durationFormatted: string
  if (durationSeconds < 60) {
    durationFormatted = `${durationSeconds}s`
  } else if (durationSeconds < 3600) {
    const minutes = Math.floor(durationSeconds / 60)
    const seconds = durationSeconds % 60
    durationFormatted = `${minutes}m ${seconds}s`
  } else {
    const hours = Math.floor(durationSeconds / 3600)
    const minutes = Math.floor((durationSeconds % 3600) / 60)
    durationFormatted = `${hours}h ${minutes}m`
  }

  // Calculate percentage
  const percentage = job.progress.total > 0
    ? Math.round((job.progress.current / job.progress.total) * 100)
    : 0

  // Build response
  const response: any = {
    success: true,
    job: {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: {
        current: job.progress.current,
        total: job.progress.total,
        percentage,
        message: job.progress.message
      },
      startedAt: job.startedAt.toISOString(),
      duration: durationFormatted,
      durationSeconds
    }
  }

  // Add completion-specific info
  if (job.completedAt) {
    response.job.completedAt = job.completedAt.toISOString()
  }

  // Add result if completed
  if (job.status === 'completed' && job.result) {
    const results = job.result
    const successCount = results.filter((r: any) => r.success).length
    const totalCount = results.length

    response.job.result = results
    response.job.summary = {
      totalOutputs: totalCount,
      discovered: successCount,
      failed: totalCount - successCount,
      successRate: totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0
    }
  }

  // Add error if failed
  if (job.status === 'failed' && job.error) {
    response.job.error = job.error
  }

  logger.debug(
    `[CEC Discovery Status API] Job ${jobId} status: ${job.status} (${percentage}% complete)`
  )

  return NextResponse.json(response)
}
