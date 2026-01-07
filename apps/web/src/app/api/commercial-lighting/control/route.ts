/**
 * Commercial Lighting Quick Control API
 * POST /api/commercial-lighting/control - Quick actions (all on, all off, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { LutronLIPClient, HueClient } from '@sports-bar/commercial-lighting'

// POST - Execute quick control action
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, systemId, triggeredBy } = body

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'action is required (all_on, all_off)' },
        { status: 400 }
      )
    }

    const validActions = ['all_on', 'all_off']
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      )
    }

    // Get systems to control
    let systems
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
      systems = [system]
    } else {
      // Get all online systems
      systems = await db
        .select()
        .from(schema.commercialLightingSystems)
        .where(eq(schema.commercialLightingSystems.status, 'online'))
    }

    if (systems.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No online systems found',
      }, { status: 404 })
    }

    const results: Array<{ systemId: string; systemName: string; success: boolean; error?: string }> = []

    for (const system of systems) {
      try {
        let success = false

        if (system.systemType.startsWith('lutron-')) {
          // Get all zones for this system
          const zones = await db
            .select()
            .from(schema.commercialLightingZones)
            .where(eq(schema.commercialLightingZones.systemId, system.id))

          if (zones.length === 0) {
            results.push({ systemId: system.id, systemName: system.name, success: false, error: 'No zones configured' })
            continue
          }

          const client = new LutronLIPClient({
            host: system.ipAddress,
            port: system.port || 23,
            username: system.username || undefined,
            password: system.password || undefined,
          })

          await client.connect()

          const level = action === 'all_on' ? 100 : 0

          for (const zone of zones) {
            if (zone.externalId) {
              await client.setOutputLevel(parseInt(zone.externalId, 10), level)
            }
          }

          client.disconnect()
          success = true

          // Update zone states in database
          await db
            .update(schema.commercialLightingZones)
            .set({
              currentLevel: level,
              isOn: level > 0,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.commercialLightingZones.systemId, system.id))

        } else if (system.systemType === 'philips-hue') {
          if (!system.applicationKey) {
            results.push({ systemId: system.id, systemName: system.name, success: false, error: 'Bridge not paired' })
            continue
          }

          const client = new HueClient({
            bridgeIp: system.ipAddress,
            applicationKey: system.applicationKey,
            port: system.port || 443,
          })

          if (action === 'all_on') {
            success = await client.allOn()
          } else {
            success = await client.allOff()
          }

          // Update zone states in database
          if (success) {
            await db
              .update(schema.commercialLightingZones)
              .set({
                currentLevel: action === 'all_on' ? 100 : 0,
                isOn: action === 'all_on',
                updatedAt: new Date().toISOString(),
              })
              .where(eq(schema.commercialLightingZones.systemId, system.id))
          }
        }

        results.push({ systemId: system.id, systemName: system.name, success })

        // Log execution
        await db.insert(schema.commercialLightingLogs).values({
          systemId: system.id,
          actionType: action === 'all_on' ? 'power_toggle' : 'power_toggle',
          targetId: null,
          targetName: 'All zones',
          value: action,
          success,
          triggeredBy: triggeredBy || 'api',
        })

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        results.push({ systemId: system.id, systemName: system.name, success: false, error: message })
      }
    }

    const allSuccess = results.every(r => r.success)
    const successCount = results.filter(r => r.success).length

    logger.info('[LIGHTING] Quick control executed', {
      action,
      systemCount: systems.length,
      successCount,
      triggeredBy,
    })

    return NextResponse.json({
      success: allSuccess,
      message: `${action} completed on ${successCount}/${systems.length} systems`,
      data: {
        results,
        successCount,
        totalCount: systems.length,
      },
    })
  } catch (error) {
    logger.error('[LIGHTING] Quick control failed', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to execute control action' },
      { status: 500 }
    )
  }
}
