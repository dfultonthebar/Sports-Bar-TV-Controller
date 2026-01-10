/**
 * Commercial Lighting Scene API
 * GET /api/commercial-lighting/scenes/[id] - Get scene details
 * PUT /api/commercial-lighting/scenes/[id] - Update scene
 * DELETE /api/commercial-lighting/scenes/[id] - Delete scene
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET - Get scene details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const scene = await db
      .select({
        id: schema.commercialLightingScenes.id,
        name: schema.commercialLightingScenes.name,
        description: schema.commercialLightingScenes.description,
        externalId: schema.commercialLightingScenes.externalId,
        triggerDeviceId: schema.commercialLightingScenes.triggerDeviceId,
        triggerButtonId: schema.commercialLightingScenes.triggerButtonId,
        sceneData: schema.commercialLightingScenes.sceneData,
        category: schema.commercialLightingScenes.category,
        bartenderVisible: schema.commercialLightingScenes.bartenderVisible,
        isFavorite: schema.commercialLightingScenes.isFavorite,
        iconName: schema.commercialLightingScenes.iconName,
        iconColor: schema.commercialLightingScenes.iconColor,
        usageCount: schema.commercialLightingScenes.usageCount,
        lastUsed: schema.commercialLightingScenes.lastUsed,
        systemId: schema.commercialLightingScenes.systemId,
        createdAt: schema.commercialLightingScenes.createdAt,
        updatedAt: schema.commercialLightingScenes.updatedAt,
        systemName: schema.commercialLightingSystems.name,
        systemType: schema.commercialLightingSystems.systemType,
      })
      .from(schema.commercialLightingScenes)
      .leftJoin(
        schema.commercialLightingSystems,
        eq(schema.commercialLightingScenes.systemId, schema.commercialLightingSystems.id)
      )
      .where(eq(schema.commercialLightingScenes.id, id))
      .get()

    if (!scene) {
      return NextResponse.json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      )
    }

    // Parse sceneData if it's JSON
    const parsedScene = {
      ...scene,
      sceneData: scene.sceneData ? JSON.parse(scene.sceneData) : null,
    }

    return NextResponse.json({
      success: true,
      data: parsedScene,
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to fetch scene', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scene' },
      { status: 500 }
    )
  }
}

// PUT - Update scene
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    const {
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

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }

    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (externalId !== undefined) updateData.externalId = externalId
    if (triggerDeviceId !== undefined) updateData.triggerDeviceId = triggerDeviceId
    if (triggerButtonId !== undefined) updateData.triggerButtonId = triggerButtonId
    if (sceneData !== undefined) {
      updateData.sceneData = typeof sceneData === 'string' ? sceneData : JSON.stringify(sceneData)
    }
    if (category !== undefined) updateData.category = category
    if (bartenderVisible !== undefined) updateData.bartenderVisible = bartenderVisible
    if (isFavorite !== undefined) updateData.isFavorite = isFavorite
    if (iconName !== undefined) updateData.iconName = iconName
    if (iconColor !== undefined) updateData.iconColor = iconColor

    const updated = await db
      .update(schema.commercialLightingScenes)
      .set(updateData)
      .where(eq(schema.commercialLightingScenes.id, id))
      .returning()

    if (updated.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      )
    }

    logger.info('[LIGHTING] Updated scene', { id, updates: Object.keys(updateData) })

    return NextResponse.json({
      success: true,
      data: updated[0],
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to update scene', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to update scene' },
      { status: 500 }
    )
  }
}

// DELETE - Delete scene
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const deleted = await db
      .delete(schema.commercialLightingScenes)
      .where(eq(schema.commercialLightingScenes.id, id))
      .returning()

    if (deleted.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      )
    }

    logger.info('[LIGHTING] Deleted scene', { id })

    return NextResponse.json({
      success: true,
      message: 'Scene deleted successfully',
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to delete scene', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to delete scene' },
      { status: 500 }
    )
  }
}
