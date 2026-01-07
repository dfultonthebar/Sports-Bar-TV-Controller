import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, desc, asc, and } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

/**
 * GET /api/dmx/scenes/bartender
 * Returns only scenes visible to bartenders, grouped by category
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const scenes = await db.select()
      .from(schema.dmxScenes)
      .orderBy(asc(schema.dmxScenes.displayOrder), desc(schema.dmxScenes.usageCount))
      .all()

    // Filter to bartender-visible scenes
    const bartenderScenes = scenes.filter(s => s.bartenderVisible)

    // Group by category
    const grouped: Record<string, typeof bartenderScenes> = {}
    for (const scene of bartenderScenes) {
      const cat = scene.category || 'general'
      if (!grouped[cat]) {
        grouped[cat] = []
      }
      grouped[cat].push(scene)
    }

    // Also get favorites for quick access
    const favorites = bartenderScenes.filter(s => s.isFavorite)

    return NextResponse.json({
      success: true,
      scenes: bartenderScenes,
      favorites,
      grouped,
      categories: Object.keys(grouped),
    })
  } catch (error) {
    logger.error('[DMX] Error loading bartender scenes:', error)
    return NextResponse.json({ error: 'Failed to load scenes' }, { status: 500 })
  }
}
