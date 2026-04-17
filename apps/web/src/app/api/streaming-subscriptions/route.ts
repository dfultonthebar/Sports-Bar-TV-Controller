/**
 * Streaming Subscriptions API
 *
 * Manages which streaming services the bar subscribes to
 * and which Fire TV devices have them logged in
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { withTransaction } from '@/lib/db/transaction-wrapper'

export const dynamic = 'force-dynamic'

// Default streaming services with their station codes and packages
const DEFAULT_STREAMING_SERVICES = [
  {
    name: 'ESPN+',
    stationCodes: ['ESPND', 'ESPN+'],
    packages: ['com.espn.score_center', 'com.espn.gtv', 'com.espn'],
    category: 'sports'
  },
  {
    name: 'Peacock',
    stationCodes: ['NBCUN', 'PEACOCK'],
    packages: ['com.peacocktv.peacockandroid', 'com.peacock.peacockfiretv'],
    category: 'streaming'
  },
  {
    name: 'NBA League Pass',
    stationCodes: ['NBALP'],
    packages: ['com.nba.leaguepass', 'com.nba.app'],
    category: 'sports'
  },
  {
    name: 'NHL Center Ice',
    stationCodes: ['NHLCI'],
    packages: ['com.nhl.gc', 'com.nhl.gc1415'],
    category: 'sports'
  },
  {
    name: 'MLB.TV',
    stationCodes: ['MLBEI'],
    packages: ['com.mlb.android', 'com.mlb.atbat'],
    category: 'sports'
  },
  {
    name: 'Prime Video',
    stationCodes: ['PRIME', 'AMZN'],
    packages: ['com.amazon.avod'],
    category: 'streaming'
  },
  {
    name: 'Apple TV+',
    stationCodes: ['APPLETV'],
    packages: ['com.apple.atve.amazon.appletv'],
    category: 'streaming'
  },
  {
    name: 'MLS Season Pass',
    stationCodes: ['MLSDK'],
    packages: ['tv.mls', 'com.apple.atve.amazon.appletv'],
    category: 'sports'
  },
  {
    name: 'Fox Sports',
    stationCodes: ['FOXD'],
    packages: ['com.foxsports.android', 'com.foxsports.android.foxsportsgo'],
    category: 'sports'
  },
  {
    name: 'Bally Sports',
    stationCodes: ['BSNOR+'],
    packages: ['com.bfrapp', 'com.ballysports.ftv'],
    category: 'sports'
  },
  {
    name: 'Big Ten+',
    stationCodes: ['B10+'],
    packages: ['com.foxsports.bigten.android'],
    category: 'sports'
  },
  {
    name: 'YouTube TV',
    stationCodes: ['YTTV'],
    packages: ['com.google.android.apps.youtube.unplugged'],
    category: 'live_tv'
  },
  {
    name: 'fuboTV',
    stationCodes: ['FUBO'],
    packages: ['com.fubo.firetv.screen'],
    category: 'live_tv'
  },
  {
    name: 'Paramount+',
    stationCodes: ['PARA+'],
    packages: ['com.cbs.ott', 'com.cbs.app'],
    category: 'streaming'
  },
  {
    name: 'Max',
    stationCodes: ['MAX', 'HBO'],
    packages: ['com.wbd.stream', 'com.hbo.hbonow'],
    category: 'streaming'
  },
  {
    name: 'NFHS Network',
    stationCodes: ['NFHS'],
    packages: ['com.nfhsnetwork.ui', 'com.nfhsnetwork.app', 'com.playon.nfhslive'],
    category: 'sports'
  }
]

// GET - List all streaming services, subscriptions, and device logins
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    // Get all streaming services
    let services = await db.select().from(schema.streamingServices)

    // If no services exist, seed the defaults
    if (services.length === 0) {
      logger.info('[STREAMING] Seeding default streaming services')
      for (const service of DEFAULT_STREAMING_SERVICES) {
        await db.insert(schema.streamingServices).values({
          name: service.name,
          stationCodes: JSON.stringify(service.stationCodes),
          packages: JSON.stringify(service.packages),
          category: service.category
        })
      }
      services = await db.select().from(schema.streamingServices)
    }

    // Get active subscriptions
    const subscriptions = await db.select().from(schema.streamingSubscriptions)
    const activeSubscriptionIds = new Set(
      subscriptions.filter(s => s.isActive).map(s => s.serviceId)
    )

    // Get device logins
    const deviceLogins = await db.select().from(schema.deviceStreamingLogins)

    // Build device login map
    const deviceLoginMap: Record<string, string[]> = {}
    for (const login of deviceLogins) {
      if (login.isLoggedIn) {
        if (!deviceLoginMap[login.deviceId]) {
          deviceLoginMap[login.deviceId] = []
        }
        deviceLoginMap[login.deviceId].push(login.serviceId)
      }
    }

    // Get Fire TV devices for reference
    let fireTVDevices: any[] = []
    try {
      const scoutResponse = await fetch('http://localhost:3001/api/firestick-scout')
      if (scoutResponse.ok) {
        const scoutData = await scoutResponse.json()
        fireTVDevices = scoutData.statuses || []
      }
    } catch (error: any) {
      logger.warn(`[STREAMING] Could not fetch Fire TV devices: ${error.message}`)
    }

    // Format services with subscription and login status
    const formattedServices = services.map(service => {
      const stationCodes = JSON.parse(service.stationCodes || '[]')
      const packages = JSON.parse(service.packages || '[]')
      const hasSubscription = activeSubscriptionIds.has(service.id)

      // Find which devices have this service logged in
      const loggedInDevices = Object.entries(deviceLoginMap)
        .filter(([_, serviceIds]) => serviceIds.includes(service.id))
        .map(([deviceId]) => {
          const device = fireTVDevices.find(d => d.deviceId === deviceId)
          return {
            deviceId,
            deviceName: device?.deviceName || deviceId,
            isOnline: device?.isOnline || false,
            hasAppInstalled: device?.installedApps?.some((pkg: string) => packages.includes(pkg)) || false
          }
        })

      return {
        id: service.id,
        name: service.name,
        stationCodes,
        packages,
        category: service.category,
        hasSubscription,
        loggedInDevices
      }
    })

    return NextResponse.json({
      success: true,
      services: formattedServices,
      fireTVDevices: fireTVDevices.map(d => ({
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        isOnline: d.isOnline,
        installedApps: d.installedApps || []
      })),
      summary: {
        totalServices: services.length,
        activeSubscriptions: activeSubscriptionIds.size,
        devicesWithLogins: Object.keys(deviceLoginMap).length
      }
    })
  } catch (error: any) {
    logger.error('[STREAMING] Error fetching subscriptions:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// POST - Update subscription or device login status
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, z.object({
    action: z.enum(['setSubscription', 'setDeviceLogin', 'bulkSetDeviceLogins']),
    serviceId: z.string().optional(),
    deviceId: z.string().optional(),
    isActive: z.boolean().optional(),
    isLoggedIn: z.boolean().optional(),
    logins: z.array(z.object({
      serviceId: z.string(),
      isLoggedIn: z.boolean()
    })).optional()
  }))

  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { action, serviceId, deviceId, isActive, isLoggedIn, logins } = bodyValidation.data

  try {
    if (action === 'setSubscription' && serviceId !== undefined) {
      // Update subscription status
      const existing = await db.select()
        .from(schema.streamingSubscriptions)
        .where(eq(schema.streamingSubscriptions.serviceId, serviceId))
        .limit(1)

      if (existing.length > 0) {
        await db.update(schema.streamingSubscriptions)
          .set({ isActive: isActive ?? true, updatedAt: new Date().toISOString() })
          .where(eq(schema.streamingSubscriptions.serviceId, serviceId))
      } else if (isActive) {
        await db.insert(schema.streamingSubscriptions).values({
          serviceId,
          isActive: true
        })
      }

      logger.info(`[STREAMING] Updated subscription for service ${serviceId}: ${isActive}`)
      return NextResponse.json({ success: true, action: 'subscriptionUpdated' })
    }

    if (action === 'setDeviceLogin' && serviceId && deviceId !== undefined) {
      // Update device login status
      const existing = await db.select()
        .from(schema.deviceStreamingLogins)
        .where(and(
          eq(schema.deviceStreamingLogins.deviceId, deviceId),
          eq(schema.deviceStreamingLogins.serviceId, serviceId)
        ))
        .limit(1)

      if (existing.length > 0) {
        await db.update(schema.deviceStreamingLogins)
          .set({
            isLoggedIn: isLoggedIn ?? true,
            lastVerified: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
          .where(and(
            eq(schema.deviceStreamingLogins.deviceId, deviceId),
            eq(schema.deviceStreamingLogins.serviceId, serviceId)
          ))
      } else if (isLoggedIn) {
        await db.insert(schema.deviceStreamingLogins).values({
          deviceId,
          serviceId,
          isLoggedIn: true,
          lastVerified: new Date().toISOString()
        })
      }

      logger.info(`[STREAMING] Updated device login for ${deviceId}/${serviceId}: ${isLoggedIn}`)
      return NextResponse.json({ success: true, action: 'deviceLoginUpdated' })
    }

    if (action === 'bulkSetDeviceLogins' && deviceId && logins) {
      // Bulk update device logins - use transaction for atomicity
      await withTransaction(async (tx) => {
        for (const login of logins) {
          const existing = await tx.select()
            .from(schema.deviceStreamingLogins)
            .where(and(
              eq(schema.deviceStreamingLogins.deviceId, deviceId),
              eq(schema.deviceStreamingLogins.serviceId, login.serviceId)
            ))
            .limit(1)

          if (existing.length > 0) {
            await tx.update(schema.deviceStreamingLogins)
              .set({
                isLoggedIn: login.isLoggedIn,
                lastVerified: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              })
              .where(and(
                eq(schema.deviceStreamingLogins.deviceId, deviceId),
                eq(schema.deviceStreamingLogins.serviceId, login.serviceId)
              ))
          } else if (login.isLoggedIn) {
            await tx.insert(schema.deviceStreamingLogins).values({
              deviceId,
              serviceId: login.serviceId,
              isLoggedIn: true,
              lastVerified: new Date().toISOString()
            })
          }
        }
      })

      logger.info(`[STREAMING] Bulk updated ${logins.length} logins for device ${deviceId}`)
      return NextResponse.json({ success: true, action: 'bulkDeviceLoginsUpdated' })
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action or missing parameters'
    }, { status: 400 })

  } catch (error: any) {
    logger.error('[STREAMING] Error updating subscription:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
