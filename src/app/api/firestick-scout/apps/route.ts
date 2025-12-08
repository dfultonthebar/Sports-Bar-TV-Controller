/**
 * API Route: FireStick Scout App Registry
 *
 * Manages the registry of known streaming apps and their capabilities.
 * Used by the AI Game Plan to determine which apps can show which leagues.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@/lib/logger'

// GET - Get all apps in the registry
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const searchParams = request.nextUrl.searchParams
    const sportsOnly = searchParams.get('sportsOnly') === 'true'
    const league = searchParams.get('league')

    let apps = await db.select().from(schema.firestickAppRegistry).all()

    // Parse JSON fields
    apps = apps.map(app => ({
      ...app,
      supportedLeagues: app.supportedLeagues ? JSON.parse(app.supportedLeagues) : []
    }))

    // Filter to sports apps only
    if (sportsOnly) {
      apps = apps.filter(app => app.hasSportsContent)
    }

    // Filter by league
    if (league) {
      apps = apps.filter(app => {
        const leagues = app.supportedLeagues as string[]
        return leagues.some(l => l.toLowerCase().includes(league.toLowerCase()))
      })
    }

    // Group by category
    const byCategory = apps.reduce((acc, app) => {
      const cat = app.appCategory || 'other'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(app)
      return acc
    }, {} as Record<string, typeof apps>)

    return NextResponse.json({
      success: true,
      apps,
      byCategory,
      total: apps.length
    })
  } catch (error: any) {
    logger.error('[FIRESTICK_SCOUT] Error getting app registry:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get app registry',
      details: error.message
    }, { status: 500 })
  }
}
