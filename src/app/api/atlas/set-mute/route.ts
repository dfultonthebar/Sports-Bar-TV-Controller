
/**
 * Atlas Set Mute API Endpoint
 * 
 * POST /api/atlas/set-mute
 * Mute/unmute a zone or source using app-friendly names
 * 
 * Request body:
 * {
 *   processorId: string,
 *   appKey: string (e.g., 'mainBarMute', 'zone1Mute'),
 *   muted: boolean
 * }
 * 
 * Alternatively, use Atlas parameter directly:
 * {
 *   processorId: string,
 *   atlasParam: string (e.g., 'ZoneMute_0'),
 *   muted: boolean
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
    const { processorId, appKey, atlasParam, muted } = body

    // Validate required fields
    if (!processorId) {
      return NextResponse.json(
        { success: false, error: 'processorId is required' },
        { status: 400 }
      )
    }

    if (!appKey && !atlasParam) {
      return NextResponse.json(
        { success: false, error: 'Either appKey or atlasParam is required' },
        { status: 400 }
      )
    }

    if (muted === undefined || muted === null) {
      return NextResponse.json(
        { success: false, error: 'muted is required' },
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

    // Determine Atlas parameter name
    let paramName = atlasParam

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

      paramName = mapping.atlasParam
    }

    // Create Atlas client and send command
    const client = await createAtlasClient({
      ipAddress: processor.ipAddress,
      port: processor.tcpPort
    })

    try {
      // Send set command (1 for muted, 0 for unmuted)
      const response = await client.sendCommand({
        method: 'set',
        param: paramName,
        value: muted ? 1 : 0,
        format: 'val'
      } as any)

      client.disconnect()

      return NextResponse.json({
        success: true,
        data: {
          processorId,
          appKey,
          atlasParam: paramName,
          muted,
          response
        }
      })
    } catch (error) {
      client.disconnect()
      throw error
    }
  } catch (error) {
    console.error('[Atlas Set Mute] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to set mute' 
      },
      { status: 500 }
    )
  }
}
