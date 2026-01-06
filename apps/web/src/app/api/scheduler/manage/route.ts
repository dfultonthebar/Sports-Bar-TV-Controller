import { NextRequest, NextResponse } from 'next/server'
import { commandScheduler } from '@/lib/services/command-scheduler'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export const dynamic = 'force-dynamic'

/**
 * POST - Manage scheduler (start, stop, trigger)
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SCHEDULER)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  try {
    const { action, commandId } = bodyValidation.data

    switch (action) {
      case 'start':
        commandScheduler.start()
        return NextResponse.json({
          success: true,
          message: 'Scheduler started successfully',
        })

      case 'stop':
        commandScheduler.stop()
        return NextResponse.json({
          success: true,
          message: 'Scheduler stopped successfully',
        })

      case 'trigger':
        if (!commandId) {
          return NextResponse.json(
            { error: 'Command ID is required for trigger action' },
            { status: 400 }
          )
        }
        await commandScheduler.triggerCommand(commandId as string)
        return NextResponse.json({
          success: true,
          message: 'Command triggered successfully',
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, stop, or trigger' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    logger.error('Error managing scheduler:', error)
    return NextResponse.json(
      { error: 'Failed to manage scheduler', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET - Get scheduler status
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SCHEDULER)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Note: You'll need to add a getStatus method to the scheduler
    // For now, return a basic status
    return NextResponse.json({
      success: true,
      status: {
        running: true, // This should come from scheduler.isRunning
        checkInterval: 60000,
      },
    })
  } catch (error: any) {
    logger.error('Error getting scheduler status:', error)
    return NextResponse.json(
      { error: 'Failed to get scheduler status', details: error.message },
      { status: 500 }
    )
  }
}
