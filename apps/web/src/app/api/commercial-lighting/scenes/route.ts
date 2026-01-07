/**
 * Commercial Lighting Scenes API
 * GET /api/commercial-lighting/scenes - List all scenes
 * POST /api/commercial-lighting/scenes - Create a new scene
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

// GET - List all scenes (optionally filtered by systemId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const systemId = searchParams.get('systemId')
    const bartenderOnly = searchParams.get('bartenderOnly') === 'true'

    let query = db.select().from(schema.commercialLightingScenes)

    const scenes = await query.orderBy(
      desc(schema.commercialLightingScenes.usageCount),
      schema.commercialLightingScenes.name
    )

    // Filter in JS since drizzle-orm chaining can be tricky
    let filtered = scenes
    if (systemId) {
      filtered = filtered.filter(s => s.systemId === systemId)
    }
    if (bartenderOnly) {
      filtered = filtered.filter(s => s.bartenderVisible)
    }

    return NextResponse.json({
      success: true,
      data: filtered,
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to fetch scenes', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scenes' },
      { status: 500 }
    )
  }
}

// POST - Create a new scene
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      systemId,
      name,
      description,
      externalId,
      triggerDeviceId,
      triggerButtonId,
      sceneData,
      category,
      bartenderVisible,
      isFavorite,
      iconName,
      iconColor,
    } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      )
    }

    const newScene = await db
      .insert(schema.commercialLightingScenes)
      .values({
        systemId: systemId || null,
        name,
        description: description || null,
        externalId: externalId || null,
        triggerDeviceId: triggerDeviceId || null,
        triggerButtonId: triggerButtonId || null,
        sceneData: sceneData ? JSON.stringify(sceneData) : null,
        category: category || 'general',
        bartenderVisible: bartenderVisible !== false,
        isFavorite: isFavorite || false,
        iconName: iconName || null,
        iconColor: iconColor || null,
      })
      .returning()

    logger.info('[LIGHTING] Created scene', {
      id: newScene[0].id,
      name,
      systemId,
    })

    return NextResponse.json({
      success: true,
      data: newScene[0],
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to create scene', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to create scene' },
      { status: 500 }
    )
  }
}
