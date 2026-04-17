import { NextRequest, NextResponse } from 'next/server'
import { pollRealDirecTVSubscriptions, pollRealFireTVSubscriptions, Subscription as RealSubscription } from '@/lib/real-device-subscriptions'
import { cacheService, CacheKeys, CacheTTL } from '@/lib/cache-service'
import { direcTVLogger, DirecTVOperation, LogLevel } from '@/lib/directv-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

type Subscription = RealSubscription

async function loadDeviceList(type: 'firetv' | 'directv') {
  try {
    const { loadFireTVDevices, loadDirecTVDevices } = await import('@/lib/device-db')
    if (type === 'firetv') {
      return await loadFireTVDevices()
    } else {
      return await loadDirecTVDevices()
    }
  } catch (error) {
    return { devices: [] as any[] }
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) return rateLimit.response

  const pollRequestSchema = z.object({
    deviceId: z.string().min(1, 'Device ID is required'),
    deviceType: z.enum(['directv', 'firetv'], {
      errorMap: () => ({ message: 'Device type must be either "directv" or "firetv"' })
    }),
    force: z.boolean().optional()
  })

  const bodyValidation = await validateRequestBody(request, pollRequestSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  try {
    const { deviceId, deviceType, force = false } = bodyValidation.data

    await direcTVLogger.log({
      level: LogLevel.INFO,
      operation: DirecTVOperation.SUBSCRIPTION_POLL,
      deviceId,
      message: `Received subscription poll request`,
      details: { deviceType, force, requestSource: 'API' }
    })

    // Load device information from DB
    const deviceData = await loadDeviceList(deviceType)
    const device = deviceData.devices.find((d: any) => d.id === deviceId)

    if (!device) {
      await direcTVLogger.log({
        level: LogLevel.ERROR,
        operation: DirecTVOperation.SUBSCRIPTION_POLL,
        deviceId,
        message: `Device not found in ${deviceType} device list`,
        details: { deviceType, requestedDeviceId: deviceId }
      })
      return NextResponse.json({
        success: false,
        error: `Device not found: ${deviceId} not found in ${deviceType} device list`,
      }, { status: 404 })
    }

    // Check existing subscription record in DB
    const existingEntry = await db.select().from(schema.deviceSubscriptions)
      .where(eq(schema.deviceSubscriptions.deviceId, deviceId))
      .get()

    const now = new Date()
    const nowStr = now.toISOString().replace('T', ' ').slice(0, 19)

    // Check if recently polled
    if (existingEntry && !force) {
      const lastPolled = existingEntry.lastPolled ? new Date(existingEntry.lastPolled) : new Date(0)
      const hoursSinceLastPoll = (now.getTime() - lastPolled.getTime()) / (1000 * 60 * 60)

      if (hoursSinceLastPoll < 1) {
        return NextResponse.json({
          success: true,
          message: 'Subscriptions recently polled, use force=true to refresh',
          subscriptions: JSON.parse(existingEntry.subscriptions || '[]'),
          lastPolled: existingEntry.lastPolled,
        })
      }
    }

    // Upsert a pending record
    if (existingEntry) {
      await db.update(schema.deviceSubscriptions)
        .set({ pollStatus: 'pending', updatedAt: nowStr })
        .where(eq(schema.deviceSubscriptions.deviceId, deviceId))
    } else {
      await db.insert(schema.deviceSubscriptions).values({
        deviceId,
        deviceType,
        deviceName: String(device.name),
        subscriptions: '[]',
        lastPolled: nowStr,
        pollStatus: 'pending',
        createdAt: nowStr,
        updatedAt: nowStr,
      })
    }

    try {
      // Check in-memory cache first
      const cacheKey = CacheKeys.deviceSubscriptions(deviceId)
      let subscriptions: Subscription[] = []

      if (!force) {
        const cached = cacheService.get<Subscription[]>(cacheKey)
        if (cached) {
          return NextResponse.json({
            success: true,
            message: 'Subscriptions from cache',
            subscriptions: cached,
            cached: true,
            lastPolled: existingEntry?.lastPolled,
          })
        }
      }

      // Poll actual device
      if (deviceType === 'directv') {
        subscriptions = await pollRealDirecTVSubscriptions(device)
      } else {
        subscriptions = await pollRealFireTVSubscriptions(device)
      }

      // Cache results
      cacheService.set(cacheKey, subscriptions, CacheTTL.HOUR)

      // Update DB record with results
      await db.update(schema.deviceSubscriptions)
        .set({
          subscriptions: JSON.stringify(subscriptions),
          lastPolled: nowStr,
          pollStatus: 'success',
          error: null,
          updatedAt: nowStr,
        })
        .where(eq(schema.deviceSubscriptions.deviceId, deviceId))

      return NextResponse.json({
        success: true,
        message: 'Subscriptions polled successfully',
        subscriptions,
        lastPolled: nowStr,
      })
    } catch (pollError) {
      const errorMsg = pollError instanceof Error ? pollError.message : 'Unknown polling error'

      await db.update(schema.deviceSubscriptions)
        .set({
          pollStatus: 'error',
          error: errorMsg,
          updatedAt: nowStr,
        })
        .where(eq(schema.deviceSubscriptions.deviceId, deviceId))

      await direcTVLogger.log({
        level: LogLevel.ERROR,
        operation: DirecTVOperation.SUBSCRIPTION_POLL,
        deviceId,
        deviceName: String(device.name),
        message: `Subscription poll failed: ${errorMsg}`,
      })

      return NextResponse.json({
        success: false,
        error: 'Failed to poll device subscriptions',
        details: errorMsg,
      }, { status: 500 })
    }
  } catch (error) {
    logger.error('Error polling device subscriptions:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
