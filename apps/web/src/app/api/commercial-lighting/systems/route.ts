/**
 * Commercial Lighting Systems API
 * GET /api/commercial-lighting/systems - List all systems
 * POST /api/commercial-lighting/systems - Create a new system
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

// GET - List all commercial lighting systems
export async function GET() {
  try {
    const systems = await db
      .select()
      .from(schema.commercialLightingSystems)
      .orderBy(schema.commercialLightingSystems.name)

    return NextResponse.json({
      success: true,
      data: systems,
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to fetch systems', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lighting systems' },
      { status: 500 }
    )
  }
}

// POST - Create a new commercial lighting system
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { name, systemType, ipAddress, port, username, password, applicationKey, certificate } = body

    if (!name || !systemType || !ipAddress) {
      return NextResponse.json(
        { success: false, error: 'Name, systemType, and ipAddress are required' },
        { status: 400 }
      )
    }

    // Validate system type
    const validTypes = ['lutron-radiora2', 'lutron-radiora3', 'lutron-caseta', 'lutron-homeworks', 'philips-hue']
    if (!validTypes.includes(systemType)) {
      return NextResponse.json(
        { success: false, error: `Invalid systemType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const newSystem = await db
      .insert(schema.commercialLightingSystems)
      .values({
        name,
        systemType,
        ipAddress,
        port: port || null,
        username: username || null,
        password: password || null,
        applicationKey: applicationKey || null,
        certificate: certificate || null,
        status: 'offline',
      })
      .returning()

    logger.info('[LIGHTING] Created commercial lighting system', {
      id: newSystem[0].id,
      name,
      systemType,
    })

    return NextResponse.json({
      success: true,
      data: newSystem[0],
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to create system', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to create lighting system' },
      { status: 500 }
    )
  }
}
