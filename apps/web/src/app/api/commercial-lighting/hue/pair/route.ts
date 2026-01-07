/**
 * Philips Hue Bridge Pairing API
 * POST /api/commercial-lighting/hue/pair - Pair with a Hue bridge
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { HueClient } from '@sports-bar/commercial-lighting'

// POST - Pair with Hue bridge
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { systemId, bridgeIp } = body

    if (!systemId && !bridgeIp) {
      return NextResponse.json(
        { success: false, error: 'Either systemId or bridgeIp is required' },
        { status: 400 }
      )
    }

    let targetIp = bridgeIp

    // If systemId is provided, get the IP from the database
    if (systemId) {
      const system = await db
        .select()
        .from(schema.commercialLightingSystems)
        .where(eq(schema.commercialLightingSystems.id, systemId))
        .get()

      if (!system) {
        return NextResponse.json(
          { success: false, error: 'System not found' },
          { status: 404 }
        )
      }

      if (system.systemType !== 'philips-hue') {
        return NextResponse.json(
          { success: false, error: 'System is not a Philips Hue bridge' },
          { status: 400 }
        )
      }

      targetIp = system.ipAddress
    }

    logger.info('[LIGHTING] Starting Hue bridge pairing', { bridgeIp: targetIp })

    // Create client and attempt pairing
    const client = new HueClient({ bridgeIp: targetIp })

    try {
      const applicationKey = await client.pairWithBridge()

      // If we have a systemId, update the database with the application key
      if (systemId) {
        await db
          .update(schema.commercialLightingSystems)
          .set({
            applicationKey,
            status: 'online',
            lastSeen: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.commercialLightingSystems.id, systemId))
      }

      logger.info('[LIGHTING] Hue bridge pairing successful', {
        bridgeIp: targetIp,
        hasSystemId: !!systemId,
      })

      return NextResponse.json({
        success: true,
        message: 'Pairing successful',
        data: {
          applicationKey,
          bridgeIp: targetIp,
        },
      })
    } catch (pairError) {
      const message = pairError instanceof Error ? pairError.message : 'Pairing failed'

      logger.error('[LIGHTING] Hue bridge pairing failed', {
        bridgeIp: targetIp,
        error: message,
      })

      return NextResponse.json({
        success: false,
        error: message,
        message: 'Please press the button on the Hue bridge and try again within 30 seconds',
      }, { status: 408 })
    }
  } catch (error) {
    logger.error('[LIGHTING] Hue pairing request failed', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to process pairing request' },
      { status: 500 }
    )
  }
}
