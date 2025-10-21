
/**
 * Atlas Trigger Scene API Endpoint
 * 
 * POST /api/atlas/trigger-scene
 * Recall a preset scene on the Atlas processor
 * 
 * Request body:
 * {
 *   processorId: string,
 *   sceneIndex: number (0-based)
 * }
 * 
 * OR use app-friendly name:
 * {
 *   processorId: string,
 *   appKey: string (e.g., 'quietHoursScene', 'gameTimeScene')
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/drizzle'
import { audioProcessors, atlasMappings } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { createAtlasClient } from '@/lib/atlasClient'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { processorId, sceneIndex, appKey } = body

    // Validate required fields
    if (!processorId) {
      return NextResponse.json(
        { success: false, error: 'processorId is required' },
        { status: 400 }
      )
    }

    if (sceneIndex === undefined && !appKey) {
      return NextResponse.json(
        { success: false, error: 'Either sceneIndex or appKey is required' },
        { status: 400 }
      )
    }

    // Get processor details
    const processor = await db.query.audioProcessors.findFirst({
      where: eq(audioProcessors.id, processorId)
    })

    if (!processor) {
      return NextResponse.json(
        { success: false, error: 'Audio processor not found' },
        { status: 404 }
      )
    }

    // Determine scene index
    let actualSceneIndex = sceneIndex

    if (appKey) {
      // Look up mapping
      const mapping = await db.query.atlasMappings.findFirst({
        where: and(
          eq(atlasMappings.processorId, processorId),
          eq(atlasMappings.appKey, appKey)
        )
      })

      if (!mapping) {
        return NextResponse.json(
          { success: false, error: `No mapping found for appKey: ${appKey}` },
          { status: 404 }
        )
      }

      // Extract scene index from Atlas parameter (e.g., RecallScene_3 -> 3)
      const match = mapping.atlasParam.match(/_(\d+)$/)
      if (match) {
        actualSceneIndex = parseInt(match[1])
      }
    }

    // Create Atlas client and send command
    const client = await createAtlasClient({
      ipAddress: processor.ipAddress,
      port: processor.tcpPort
    })

    try {
      // Send recall scene command
      const response = await client.recallScene(actualSceneIndex)

      client.disconnect()

      return NextResponse.json({
        success: true,
        data: {
          processorId,
          appKey,
          sceneIndex: actualSceneIndex,
          response
        }
      })
    } catch (error) {
      client.disconnect()
      throw error
    }
  } catch (error) {
    console.error('[Atlas Trigger Scene] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to trigger scene' 
      },
      { status: 500 }
    )
  }
}
