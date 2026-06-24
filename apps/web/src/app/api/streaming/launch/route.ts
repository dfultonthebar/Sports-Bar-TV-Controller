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
import { reportToFlywheel } from '@/lib/flywheel'

const LOC = () => process.env.LOCATION_ID || process.env.LOCATION_NAME || 'unknown'

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
      // v2.32.87 — Mirror the just-launched app into inputCurrentChannels
      // so the bartender remote's input label updates instantly. Pre-fix:
      // the Watch button launched the app but the input label still showed
      // the previous state (e.g. "Home • streaming") until scheduler-service
      // polled `/api/firetv-devices/[id]/current-app` 5min later.
      // Same write shape as that polling endpoint (channelNumber="APP",
      // channelName=app's friendly name).
      try {
        const ftRow = await db.select().from(schema.fireTVDevices)
          .where(eq(schema.fireTVDevices.id, deviceId)).get()
        if (ftRow?.inputChannel) {
          // Resolve friendly app name from the catalog. streamingManager
          // already did the alias resolution; we just need a display label.
          const { findStreamingAppByDisplayName, STREAMING_APPS_DATABASE } = await import('@sports-bar/streaming')
          const catalogApp = STREAMING_APPS_DATABASE.find((a: any) => a.id === appId)
            ?? findStreamingAppByDisplayName(appId)
          const friendlyName = catalogApp?.name ?? appId
          const now = new Date().toISOString()

          const existing = await db.select().from(schema.inputCurrentChannels)
            .where(eq(schema.inputCurrentChannels.inputNum, ftRow.inputChannel)).get()
          const channelData = {
            inputLabel: ftRow.name || 'Fire TV',
            deviceType: 'firetv' as const,
            deviceId,
            channelNumber: 'APP',
            channelName: friendlyName,
            presetId: null,
            lastTuned: now,
            updatedAt: now,
          }
          if (existing) {
            await db.update(schema.inputCurrentChannels)
              .set(channelData)
              .where(eq(schema.inputCurrentChannels.id, existing.id))
          } else {
            await db.insert(schema.inputCurrentChannels).values({
              id: crypto.randomUUID(),
              inputNum: ftRow.inputChannel,
              ...channelData,
            })
          }
          logger.info(`[API] Mirrored ${friendlyName} into inputCurrentChannels for input ${ftRow.inputChannel}`)
        }
      } catch (mirrorErr: any) {
        // Non-fatal — the launch already succeeded; UI will catch up on the
        // next 5-min poll if this write failed.
        logger.warn(`[API] Failed to mirror launched app into inputCurrentChannels: ${mirrorErr.message}`)
      }

      reportToFlywheel('fleet-firetv-tune', `Streaming launch @ ${LOC()}: ${appId} on ${deviceId} → OK${deepLink ? ' (deep-link)' : ''}`)
      return NextResponse.json({
        success: true,
        message: `Successfully launched app ${appId}`,
        deviceId,
        appId
      })
    } else {
      reportToFlywheel('fleet-firetv-tune', `Streaming launch @ ${LOC()}: ${appId} on ${deviceId} → FAILED`)
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
    reportToFlywheel('fleet-firetv-tune', `Streaming launch @ ${LOC()}: ${appId ?? '?'} on ${deviceId ?? '?'} → ERROR: ${error?.message || error}`)
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
