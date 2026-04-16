import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// Mock status check for each platform
async function checkPlatformStatus(platformId: string, lastUpdated: string | null): Promise<'connected' | 'expired' | 'not-connected'> {
  try {
    if (!lastUpdated) return 'not-connected'

    const now = new Date()
    const lastUpdate = new Date(lastUpdated)
    const daysSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)

    if (daysSinceUpdate > 30) return 'expired'

    // Mock connectivity check
    switch (platformId) {
      case 'youtube-tv':
        return Math.random() > 0.05 ? 'connected' : 'not-connected'
      case 'hulu-live':
      case 'paramount-plus':
      case 'peacock':
        return Math.random() > 0.1 ? 'connected' : 'not-connected'
      case 'amazon-prime':
        return Math.random() > 0.05 ? 'connected' : 'not-connected'
      default:
        return 'not-connected'
    }
  } catch (error) {
    logger.error(`Error checking status for ${platformId}:`, error)
    return 'not-connected'
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const credentials = await db.select().from(schema.streamingCredentials)
    const statuses: Record<string, 'connected' | 'expired' | 'not-connected'> = {}

    for (const credential of credentials) {
      const status = await checkPlatformStatus(credential.platformId, credential.updatedAt)
      statuses[credential.platformId] = status
    }

    const allPlatforms = ['youtube-tv', 'hulu-live', 'paramount-plus', 'peacock', 'amazon-prime']
    for (const platformId of allPlatforms) {
      if (!statuses[platformId]) {
        statuses[platformId] = 'not-connected'
      }
    }

    return NextResponse.json({
      success: true,
      statuses,
      lastChecked: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Error checking platform statuses:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check platform statuses' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, z.object({
    platformId: z.string()
  }))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  try {
    const { platformId } = bodyValidation.data

    const credential = await db.select().from(schema.streamingCredentials)
      .where(eq(schema.streamingCredentials.platformId, platformId))
      .get()

    if (!credential) {
      return NextResponse.json({
        success: true,
        status: 'not-connected',
        message: 'No credentials found for this platform',
      })
    }

    const status = await checkPlatformStatus(platformId, credential.updatedAt)
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    // Update status in DB
    await db.update(schema.streamingCredentials)
      .set({ status, lastSync: now, updatedAt: now })
      .where(eq(schema.streamingCredentials.platformId, platformId))

    return NextResponse.json({
      success: true,
      status,
      lastChecked: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Error checking single platform status:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check platform status' },
      { status: 500 }
    )
  }
}
