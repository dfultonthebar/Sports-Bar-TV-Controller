
import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { pollRealDirecTVSubscriptions, pollRealFireTVSubscriptions, Subscription as RealSubscription } from '@/lib/real-device-subscriptions'
import { cacheService, CacheKeys, CacheTTL } from '@/lib/cache-service'
import { direcTVLogger, DirecTVOperation, LogLevel } from '@/lib/directv-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
// Force dynamic rendering
export const dynamic = 'force-dynamic'

const SUBSCRIPTIONS_FILE = join(process.cwd(), 'data', 'device-subscriptions.json')

// Use the same Subscription interface from real-device-subscriptions
type Subscription = RealSubscription

interface DeviceSubscription {
  deviceId: string
  deviceType: 'firetv' | 'directv'
  deviceName: string
  subscriptions: Subscription[]
  lastPolled: string
  pollStatus: 'success' | 'error' | 'pending'
  error?: string
}

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = join(process.cwd(), 'data')
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true })
  }
}

async function loadSubscriptionsData() {
  try {
    await ensureDataDir()
    const data = await readFile(SUBSCRIPTIONS_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    return { devices: [] as DeviceSubscription[] }
  }
}

async function saveSubscriptionsData(data: { devices: DeviceSubscription[] }) {
  await ensureDataDir()
  await writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(data, null, 2))
}

async function loadDeviceList(type: 'firetv' | 'directv') {
  const fileName = type === 'firetv' ? 'firetv-devices.json' : 'directv-devices.json'
  const filePath = join(process.cwd(), 'data', fileName)
  try {
    const data = await readFile(filePath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    return { devices: [] as any[] }
  }
}

/**
 * Real device subscription polling - no mock data
 * Connects to actual devices to detect installed apps and packages
 */

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation with proper schema
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
      details: {
        deviceType,
        force,
        requestSource: 'API',
        clientInfo: {
          userAgent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
        }
      }
    })

    // Load current subscriptions
    const subscriptionsData = await loadSubscriptionsData()

    // Load device information
    const deviceData = await loadDeviceList(deviceType)
    const device = deviceData.devices.find((d: any) => d.id === deviceId)

    if (!device) {
      await direcTVLogger.log({
        level: LogLevel.ERROR,
        operation: DirecTVOperation.SUBSCRIPTION_POLL,
        deviceId,
        message: `Device not found in ${deviceType} device list`,
        details: {
          deviceType,
          requestedDeviceId: deviceId,
          availableDeviceCount: deviceData.devices?.length || 0,
          availableDevices: deviceData.devices?.map((d: any) => ({ id: d.id, name: d.name })) || [],
          deviceDataLoaded: !!deviceData,
          devicesArrayExists: Array.isArray(deviceData.devices)
        }
      })
      return NextResponse.json({
        success: false,
        error: `Device not found: ${deviceId} not found in ${deviceType} device list`,
        details: {
          requestedDeviceId: deviceId,
          deviceType,
          availableDevices: deviceData.devices?.map((d: any) => d.id) || []
        }
      }, { status: 404 })
    }

    await direcTVLogger.log({
      level: LogLevel.DEBUG,
      operation: DirecTVOperation.SUBSCRIPTION_POLL,
      deviceId,
      deviceName: String(device.name),
      ipAddress: String(device.ipAddress),
      port: device.port || 8080,
      message: `Device found, preparing to poll subscriptions`,
      details: {
        device: {
          id: String(device.id),
          name: String(device.name),
          type: deviceType,
          ipAddress: String(device.ipAddress),
          port: device.port || 8080
        }
      }
    })

    // Check if we should skip polling (if not forced and recently polled)
    const existingEntry = subscriptionsData.devices.find((d: DeviceSubscription) => d.deviceId === deviceId)
    const lastPolled = existingEntry ? new Date(existingEntry.lastPolled) : new Date(0)
    const now = new Date()
    const hoursSinceLastPoll = (now.getTime() - lastPolled.getTime()) / (1000 * 60 * 60)
    
    if (!force && hoursSinceLastPoll < 1) {
      await direcTVLogger.log({
        level: LogLevel.INFO,
        operation: DirecTVOperation.CACHE_OPERATION,
        deviceId,
        deviceName: String(device.name),
        message: `Returning cached subscription data (polled ${hoursSinceLastPoll.toFixed(2)} hours ago)`,
        details: {
          lastPolled: existingEntry?.lastPolled,
          subscriptionCount: existingEntry?.subscriptions?.length || 0,
          hoursSinceLastPoll
        }
      })
      return NextResponse.json({
        success: true,
        message: 'Subscriptions recently polled, use force=true to refresh',
        subscriptions: existingEntry?.subscriptions || [],
        lastPolled: existingEntry?.lastPolled
      })
    }

    await direcTVLogger.log({
      level: LogLevel.INFO,
      operation: DirecTVOperation.SUBSCRIPTION_POLL,
      deviceId,
      deviceName: String(device.name),
      ipAddress: String(device.ipAddress),
      port: device.port || 8080,
      message: force ? 'Forced poll requested' : `Cache expired (${hoursSinceLastPoll.toFixed(2)} hours old), initiating fresh poll`,
      details: {
        force,
        hoursSinceLastPoll,
        lastPolled: existingEntry?.lastPolled
      }
    })

    // Mark as pending
    const updatedEntry: DeviceSubscription = {
      deviceId,
      deviceType,
      deviceName: String(device.name),
      subscriptions: existingEntry?.subscriptions || [],
      lastPolled: now.toISOString(),
      pollStatus: 'pending'
    }

    // Update or add entry
    const entryIndex = subscriptionsData.devices.findIndex(d => d.deviceId === deviceId)
    if (entryIndex >= 0) {
      subscriptionsData.devices[entryIndex] = updatedEntry
    } else {
      subscriptionsData.devices.push(updatedEntry)
    }
    await saveSubscriptionsData(subscriptionsData)

    try {
      // Check cache first (unless forced)
      const cacheKey = CacheKeys.deviceSubscriptions(deviceId)
      let subscriptions: Subscription[] = []
      
      if (!force) {
        await direcTVLogger.log({
          level: LogLevel.DEBUG,
          operation: DirecTVOperation.CACHE_OPERATION,
          deviceId,
          deviceName: String(device.name),
          message: 'Checking in-memory cache for subscription data'
        })

        const cached = cacheService.get<Subscription[]>(cacheKey)
        if (cached) {
          await direcTVLogger.log({
            level: LogLevel.INFO,
            operation: DirecTVOperation.CACHE_OPERATION,
            deviceId,
            deviceName: String(device.name),
            message: `Found cached subscription data (${cached.length} subscriptions)`,
            details: {
              subscriptionCount: cached.length,
              cacheKey
            }
          })
          return NextResponse.json({
            success: true,
            message: 'Subscriptions from cache',
            subscriptions: cached,
            cached: true,
            lastPolled: existingEntry?.lastPolled
          })
        }

        await direcTVLogger.log({
          level: LogLevel.DEBUG,
          operation: DirecTVOperation.CACHE_OPERATION,
          deviceId,
          deviceName: String(device.name),
          message: 'No cached data found, proceeding with device poll'
        })
      }

      // Poll subscriptions based on device type (REAL DATA)
      await direcTVLogger.log({
        level: LogLevel.INFO,
        operation: DirecTVOperation.SUBSCRIPTION_POLL,
        deviceId,
        deviceName: String(device.name),
        ipAddress: String(device.ipAddress),
        port: device.port || 8080,
        message: `Beginning ${deviceType} subscription poll`,
        details: {
          deviceType,
          pollingFunction: deviceType === 'directv' ? 'pollRealDirecTVSubscriptions' : 'pollRealFireTVSubscriptions'
        }
      })

      if (deviceType === 'directv') {
        subscriptions = await pollRealDirecTVSubscriptions(device)
      } else if (deviceType === 'firetv') {
        subscriptions = await pollRealFireTVSubscriptions(device)
      } else {
        await direcTVLogger.log({
          level: LogLevel.ERROR,
          operation: DirecTVOperation.SUBSCRIPTION_POLL,
          deviceId,
          deviceName: String(device.name),
          message: `Unsupported device type: ${deviceType}`,
          details: { deviceType }
        })
        throw new Error(`Unsupported device type: ${deviceType}`)
      }

      await direcTVLogger.log({
        level: LogLevel.INFO,
        operation: DirecTVOperation.SUBSCRIPTION_POLL,
        deviceId,
        deviceName: String(device.name),
        ipAddress: String(device.ipAddress),
        port: device.port || 8080,
        message: `Subscription poll completed successfully (${subscriptions.length} subscriptions found)`,
        details: {
          subscriptionCount: subscriptions.length,
          subscriptions: subscriptions.map(s => ({ id: s.id, name: s.name, type: s.type, status: s.status }))
        }
      })

      // Cache the results for 1 hour
      cacheService.set(cacheKey, subscriptions, CacheTTL.HOUR)

      await direcTVLogger.log({
        level: LogLevel.DEBUG,
        operation: DirecTVOperation.CACHE_OPERATION,
        deviceId,
        deviceName: String(device.name),
        message: 'Subscription data cached successfully',
        details: {
          cacheKey,
          ttl: CacheTTL.HOUR
        }
      })

      // Update with results
      updatedEntry.subscriptions = subscriptions
      updatedEntry.pollStatus = 'success'
      updatedEntry.lastPolled = new Date().toISOString()
      delete updatedEntry.error

      // Save updated data
      const finalIndex = subscriptionsData.devices.findIndex(d => d.deviceId === deviceId)
      subscriptionsData.devices[finalIndex] = updatedEntry
      await saveSubscriptionsData(subscriptionsData)

      return NextResponse.json({
        success: true,
        message: 'Subscriptions polled successfully',
        subscriptions,
        lastPolled: updatedEntry.lastPolled
      })

    } catch (pollError) {
      // Update with error
      updatedEntry.pollStatus = 'error'
      updatedEntry.error = pollError instanceof Error ? pollError.message : 'Unknown polling error'
      
      await direcTVLogger.log({
        level: LogLevel.ERROR,
        operation: DirecTVOperation.SUBSCRIPTION_POLL,
        deviceId,
        deviceName: String(device.name),
        ipAddress: String(device.ipAddress),
        port: device.port || 8080,
        message: `Subscription poll failed: ${updatedEntry.error}`,
        error: pollError instanceof Error ? {
          name: pollError.name,
          message: pollError.message,
          stack: pollError.stack,
          code: (pollError as any).code
        } : undefined,
        details: {
          deviceType,
          pollingAttempt: 'failed'
        }
      })
      
      const errorIndex = subscriptionsData.devices.findIndex(d => d.deviceId === deviceId)
      subscriptionsData.devices[errorIndex] = updatedEntry
      await saveSubscriptionsData(subscriptionsData)

      return NextResponse.json({
        success: false,
        error: 'Failed to poll device subscriptions',
        details: updatedEntry.error
      }, { status: 500 })
    }

  } catch (error) {
    await direcTVLogger.log({
      level: LogLevel.CRITICAL,
      operation: DirecTVOperation.SUBSCRIPTION_POLL,
      message: 'Unhandled exception in subscription polling API',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    })
    
    logger.error('Error polling device subscriptions:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
