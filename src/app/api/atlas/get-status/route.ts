
/**
 * Atlas Get Status API Endpoint
 * 
 * GET /api/atlas/get-status?processorId=xxx&appKey=yyy
 * OR
 * GET /api/atlas/get-status?processorId=xxx&atlasParam=ZoneGain_0
 * 
 * Get current value of a parameter
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/drizzle'
import { audioProcessors, atlasMappings } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { createAtlasClient } from '@/lib/atlasClient'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const processorId = searchParams.get('processorId')
    const appKey = searchParams.get('appKey')
    const atlasParam = searchParams.get('atlasParam')
    const format = searchParams.get('format') || 'val'

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
    let paramFormat = format as 'val' | 'pct' | 'str'

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
      paramFormat = mapping.format as 'val' | 'pct' | 'str'
    }

    // Create Atlas client and send command
    const client = await createAtlasClient({
      ipAddress: processor.ipAddress,
      port: processor.tcpPort
    })

    try {
      // Send get command
      const response = await client.getParameter(paramName!, paramFormat)

      client.disconnect()

      return NextResponse.json({
        success: true,
        data: {
          processorId,
          appKey,
          atlasParam: paramName,
          format: paramFormat,
          value: response.data?.result,
          response
        }
      })
    } catch (error) {
      client.disconnect()
      throw error
    }
  } catch (error) {
    console.error('[Atlas Get Status] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get status' 
      },
      { status: 500 }
    )
  }
}
