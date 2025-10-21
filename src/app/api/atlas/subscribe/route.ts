/**
 * Atlas Subscribe API Endpoint
 * 
 * POST /api/atlas/subscribe
 * Subscribe to parameter updates
 * 
 * Request body:
 * {
 *   processorId: string,
 *   appKey?: string,
 *   atlasParam?: string,
 *   format?: 'val' | 'pct' | 'str',
 *   subscribe: boolean (true to subscribe, false to unsubscribe)
 * }
 * 
 * GET /api/atlas/subscribe?processorId=xxx
 * Get all active subscriptions for a processor
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/drizzle'
import { audioProcessors, atlasMappings, atlasSubscriptions } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { createAtlasClient } from '@/lib/atlasClient'

// GET - Fetch all subscriptions for a processor
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const processorId = searchParams.get('processorId')

    if (!processorId) {
      return NextResponse.json(
        { success: false, error: 'processorId is required' },
        { status: 400 }
      )
    }

    const subs = await db.query.atlasSubscriptions.findMany({
      where: eq(atlasSubscriptions.processorId, processorId),
      orderBy: (atlasSubscriptions, { asc }) => [asc(atlasSubscriptions.paramName)]
    })

    return NextResponse.json({
      success: true,
      data: subs
    })
  } catch (error) {
    console.error('[Atlas Subscribe GET] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch subscriptions' 
      },
      { status: 500 }
    )
  }
}

// POST - Subscribe or unsubscribe to parameter updates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { processorId, appKey, atlasParam, format = 'val', subscribe: shouldSubscribe = true } = body

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
    let paramFormat = format

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
      paramFormat = mapping.format
    }

    // Create Atlas client and send command
    const client = await createAtlasClient({
      ipAddress: processor.ipAddress,
      port: processor.tcpPort
    })

    try {
      let response
      if (shouldSubscribe) {
        // Subscribe
        response = await client.subscribe(paramName!, paramFormat as any)

        // Record subscription in database
        const existingSub = await db.query.atlasSubscriptions.findFirst({
          where: and(
            eq(atlasSubscriptions.processorId, processorId),
            eq(atlasSubscriptions.paramName, paramName!),
            eq(atlasSubscriptions.format, paramFormat)
          )
        })

        if (existingSub) {
          // Update existing subscription
          await db.update(atlasSubscriptions)
            .set({
              isActive: true,
              updatedAt: new Date().toISOString()
            })
            .where(eq(atlasSubscriptions.id, existingSub.id))
        } else {
          // Create new subscription record
          await db.insert(atlasSubscriptions).values({
            processorId,
            paramName: paramName!,
            format: paramFormat,
            subscriptionType: 'tcp',
            isActive: true
          })
        }
      } else {
        // Unsubscribe
        response = await client.unsubscribe(paramName!, paramFormat as any)

        // Update subscription record in database
        await db.update(atlasSubscriptions)
          .set({
            isActive: false,
            updatedAt: new Date().toISOString()
          })
          .where(and(
            eq(atlasSubscriptions.processorId, processorId),
            eq(atlasSubscriptions.paramName, paramName!),
            eq(atlasSubscriptions.format, paramFormat)
          ))
      }

      client.disconnect()

      return NextResponse.json({
        success: true,
        data: {
          processorId,
          appKey,
          atlasParam: paramName,
          format: paramFormat,
          subscribed: shouldSubscribe,
          response
        }
      })
    } catch (error) {
      client.disconnect()
      throw error
    }
  } catch (error) {
    console.error('[Atlas Subscribe] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to manage subscription' 
      },
      { status: 500 }
    )
  }
}
