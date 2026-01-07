/**
 * Commercial Lighting Scenes for Bartender Remote API
 * GET /api/commercial-lighting/scenes/bartender - Get bartender-visible scenes
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

// GET - Get bartender-visible scenes grouped by category
export async function GET() {
  try {
    // Get all bartender-visible scenes
    const scenes = await db
      .select({
        id: schema.commercialLightingScenes.id,
        name: schema.commercialLightingScenes.name,
        description: schema.commercialLightingScenes.description,
        category: schema.commercialLightingScenes.category,
        isFavorite: schema.commercialLightingScenes.isFavorite,
        iconName: schema.commercialLightingScenes.iconName,
        iconColor: schema.commercialLightingScenes.iconColor,
        usageCount: schema.commercialLightingScenes.usageCount,
        lastUsed: schema.commercialLightingScenes.lastUsed,
        systemId: schema.commercialLightingScenes.systemId,
        systemName: schema.commercialLightingSystems.name,
        systemType: schema.commercialLightingSystems.systemType,
      })
      .from(schema.commercialLightingScenes)
      .leftJoin(
        schema.commercialLightingSystems,
        eq(schema.commercialLightingScenes.systemId, schema.commercialLightingSystems.id)
      )
      .where(eq(schema.commercialLightingScenes.bartenderVisible, true))
      .orderBy(
        desc(schema.commercialLightingScenes.isFavorite),
        desc(schema.commercialLightingScenes.usageCount),
        schema.commercialLightingScenes.name
      )

    // Group by category
    const byCategory = scenes.reduce((acc, scene) => {
      const category = scene.category || 'general'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(scene)
      return acc
    }, {} as Record<string, typeof scenes>)

    // Get favorites separately
    const favorites = scenes.filter(s => s.isFavorite)

    return NextResponse.json({
      success: true,
      data: {
        all: scenes,
        byCategory,
        favorites,
        totalCount: scenes.length,
      },
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to fetch bartender scenes', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bartender scenes' },
      { status: 500 }
    )
  }
}
