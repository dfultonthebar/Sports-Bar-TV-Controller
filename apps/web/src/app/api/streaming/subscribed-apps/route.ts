import { NextRequest, NextResponse } from 'next/server'
import { STREAMING_APPS_DATABASE } from '@/lib/streaming/streaming-apps-database'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const rows = await db.select().from(schema.subscribedStreamingApps)

    // Enrich with app details from the static database
    const enrichedApps = rows
      .filter(row => row.enabled)
      .map(row => {
        const appDetails = STREAMING_APPS_DATABASE.find(app => app.id === row.appId)
        return {
          appId: row.appId,
          enabled: row.enabled,
          activityName: row.activityName,
          displayOrder: row.displayOrder,
          ...appDetails,
        }
      })

    return NextResponse.json({
      apps: enrichedApps,
      lastUpdated: rows.length > 0
        ? rows.reduce((latest, r) => r.updatedAt && r.updatedAt > latest ? r.updatedAt : latest, '')
        : null,
    })
  } catch (error) {
    logger.error('Error loading subscribed apps:', error)
    return NextResponse.json({ error: 'Failed to load subscribed apps' }, { status: 500 })
  }
}

const updateSubscribedAppsSchema = z.object({
  subscribedApps: z.array(z.object({
    appId: z.string().min(1),
    enabled: z.boolean().optional().default(true),
    activityName: z.string().optional(),
  })),
})

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, updateSubscribedAppsSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  try {
    const { subscribedApps } = bodyValidation.data
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    for (let i = 0; i < subscribedApps.length; i++) {
      const app = subscribedApps[i]
      const existing = await db.select().from(schema.subscribedStreamingApps)
        .where(eq(schema.subscribedStreamingApps.appId, app.appId))
        .get()

      if (existing) {
        await db.update(schema.subscribedStreamingApps)
          .set({
            enabled: app.enabled,
            activityName: app.activityName || existing.activityName,
            displayOrder: i,
            updatedAt: now,
          })
          .where(eq(schema.subscribedStreamingApps.appId, app.appId))
      } else {
        await db.insert(schema.subscribedStreamingApps).values({
          appId: app.appId,
          enabled: app.enabled,
          activityName: app.activityName || null,
          displayOrder: i,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Subscribed apps updated successfully',
    })
  } catch (error) {
    logger.error('Error updating subscribed apps:', error)
    return NextResponse.json({ error: 'Failed to update subscribed apps' }, { status: 500 })
  }
}
