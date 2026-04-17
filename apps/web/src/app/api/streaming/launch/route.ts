/**
 * API Route: Launch Streaming App
 *
 * Launches a streaming app on a Fire TV device
 */

import { NextRequest, NextResponse } from 'next/server'
import { streamingManager } from '@/services/streaming-service-manager'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, ValidationSchemas, isValidationError } from '@/lib/validation'
import { logger } from '@sports-bar/logger'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

// Validation schema for launching streaming apps
const launchAppSchema = z.object({
  deviceId: ValidationSchemas.deviceId,
  ipAddress: ValidationSchemas.ipAddress,
  appId: z.string().min(1).max(200),
  port: ValidationSchemas.port.default(5555),
  deepLink: ValidationSchemas.deepLink.optional(),
  activityName: z.string().min(1).max(200).optional()
})

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const validation = await validateRequestBody(request, launchAppSchema)
    if (isValidationError(validation)) return validation.error

    const {
      deviceId,
      ipAddress,
      appId,
      port,
      deepLink,
      activityName: providedActivityName
    } = validation.data

    logger.info(`[API] Launching app ${appId} on device ${deviceId}`)

    // Try to get activity name from DB if not provided
    let activityName = providedActivityName
    if (!activityName) {
      try {
        const appConfig = await db.select().from(schema.subscribedStreamingApps)
          .where(eq(schema.subscribedStreamingApps.appId, appId))
          .get()
        if (appConfig?.activityName) {
          activityName = appConfig.activityName
          logger.info(`[API] Using activity name from DB: ${activityName}`)
        }
      } catch (error) {
        logger.info('[API] Could not load activity name from DB')
      }
    }

    const success = await streamingManager.launchApp(
      deviceId,
      ipAddress,
      appId,
      { deepLink, activityName },
      port
    )

    if (success) {
      return NextResponse.json({
        success: true,
        message: `Successfully launched app ${appId}`,
        deviceId,
        appId
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to launch app ${appId}`,
          deviceId,
          appId
        },
        { status: 400 }
      )
    }
  } catch (error: any) {
    logger.error('[API] Error launching app:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to launch app',
        message: error.message
      },
      { status: 500 }
    )
  }
}
