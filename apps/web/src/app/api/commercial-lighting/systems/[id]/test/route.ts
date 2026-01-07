/**
 * Commercial Lighting System Test Connection API
 * POST /api/commercial-lighting/systems/[id]/test - Test connection to system
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import {
  commercialLightingManager,
  LutronLIPClient,
  HueClient,
} from '@sports-bar/commercial-lighting'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST - Test connection to system
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Get system from database
    const system = await db
      .select()
      .from(schema.commercialLightingSystems)
      .where(eq(schema.commercialLightingSystems.id, id))
      .get()

    if (!system) {
      return NextResponse.json(
        { success: false, error: 'System not found' },
        { status: 404 }
      )
    }

    let connected = false
    let message = ''
    let details: Record<string, unknown> = {}

    const startTime = Date.now()

    try {
      if (system.systemType.startsWith('lutron-')) {
        // Test Lutron connection
        const client = new LutronLIPClient({
          host: system.ipAddress,
          port: system.port || 23,
          username: system.username || undefined,
          password: system.password || undefined,
        })

        await client.connect()
        connected = true
        message = 'Successfully connected to Lutron system'
        details = {
          protocol: 'telnet',
          port: system.port || 23,
        }

        // Disconnect after test
        client.disconnect()
      } else if (system.systemType === 'philips-hue') {
        // Test Hue connection
        if (!system.applicationKey) {
          return NextResponse.json({
            success: true,
            data: {
              connected: false,
              message: 'Hue bridge requires pairing - no application key set',
              needsPairing: true,
            },
          })
        }

        const client = new HueClient({
          bridgeIp: system.ipAddress,
          applicationKey: system.applicationKey,
          port: system.port || 443,
        })

        connected = await client.testConnection()
        message = connected ? 'Successfully connected to Hue bridge' : 'Failed to connect to Hue bridge'

        if (connected) {
          const lights = await client.getLights()
          const rooms = await client.getRooms()
          details = {
            lightsCount: lights.length,
            roomsCount: rooms.length,
          }
        }
      } else {
        return NextResponse.json(
          { success: false, error: `Unsupported system type: ${system.systemType}` },
          { status: 400 }
        )
      }
    } catch (error) {
      connected = false
      message = error instanceof Error ? error.message : 'Connection failed'
    }

    const responseTime = Date.now() - startTime

    // Update system status in database
    await db
      .update(schema.commercialLightingSystems)
      .set({
        status: connected ? 'online' : 'offline',
        lastSeen: connected ? new Date().toISOString() : system.lastSeen,
        lastError: connected ? null : message,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.commercialLightingSystems.id, id))

    logger.info('[LIGHTING] Connection test completed', {
      id,
      systemType: system.systemType,
      connected,
      responseTime,
    })

    return NextResponse.json({
      success: true,
      data: {
        connected,
        message,
        responseTime,
        details,
      },
    })
  } catch (error) {
    logger.error('[LIGHTING] Connection test failed', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to test connection' },
      { status: 500 }
    )
  }
}
