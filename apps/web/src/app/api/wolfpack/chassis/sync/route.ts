/**
 * POST /api/wolfpack/chassis/sync - Sync JSON driver file → database
 *
 * Creates/updates matrixConfigurations rows from wolfpack-devices.json.
 * Seeds matrixInputs and matrixOutputs for each chassis.
 */

import { NextResponse, NextRequest } from 'next/server'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { loadChassis, invalidateChassisCache } from '@/lib/wolfpack/chassis-loader'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    // Force reload from disk
    invalidateChassisCache()
    const chassisList = loadChassis()

    if (chassisList.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No chassis found in wolfpack-devices.json',
        synced: 0,
        created: 0,
        updated: 0,
      })
    }

    let created = 0
    let updated = 0

    for (const chassis of chassisList) {
      // Check if a DB row already exists for this chassisId
      const existing = await db.select()
        .from(schema.matrixConfigurations)
        .where(eq(schema.matrixConfigurations.chassisId, chassis.id))
        .limit(1)
        .get()

      const now = new Date().toISOString()

      if (existing) {
        // Update existing row with latest JSON data
        await db.update(schema.matrixConfigurations)
          .set({
            name: chassis.name,
            model: chassis.model,
            ipAddress: chassis.ipAddress,
            protocol: chassis.protocol,
            tcpPort: chassis.tcpPort,
            udpPort: chassis.udpPort,
            inputCount: chassis.inputs.length,
            outputCount: chassis.outputs.length,
            outputOffset: chassis.outputOffset || 0,
            isActive: chassis.isPrimary,
            updatedAt: now,
          })
          .where(eq(schema.matrixConfigurations.id, existing.id))

        await syncInputsAndOutputs(existing.id, chassis, now)
        updated++
      } else {
        // Create new row
        const newId = crypto.randomUUID()
        await db.insert(schema.matrixConfigurations).values({
          id: newId,
          chassisId: chassis.id,
          name: chassis.name,
          model: chassis.model,
          ipAddress: chassis.ipAddress,
          protocol: chassis.protocol,
          tcpPort: chassis.tcpPort,
          udpPort: chassis.udpPort,
          inputCount: chassis.inputs.length,
          outputCount: chassis.outputs.length,
          outputOffset: chassis.outputOffset || 0,
          isActive: chassis.isPrimary,
          createdAt: now,
          updatedAt: now,
        })

        await syncInputsAndOutputs(newId, chassis, now)
        created++
      }
    }

    logger.info(`[WOLFPACK-CHASSIS] Sync complete: ${created} created, ${updated} updated`)

    return NextResponse.json({
      success: true,
      message: `Synced ${chassisList.length} chassis`,
      synced: chassisList.length,
      created,
      updated,
    })
  } catch (error) {
    logger.error('[WOLFPACK-CHASSIS] Sync error:', { error })
    return NextResponse.json(
      { error: 'Failed to sync chassis' },
      { status: 500 }
    )
  }
}

/**
 * Sync matrix inputs and outputs from chassis JSON to DB.
 * Upserts based on configId + channelNumber.
 */
async function syncInputsAndOutputs(
  configId: string,
  chassis: ReturnType<typeof loadChassis>[number],
  now: string
) {
  // Sync inputs
  for (const input of chassis.inputs) {
    const existing = await db.select()
      .from(schema.matrixInputs)
      .where(eq(schema.matrixInputs.configId, configId))
      .all()

    const match = existing.find(e => e.channelNumber === input.channel)

    if (match) {
      await db.update(schema.matrixInputs)
        .set({
          label: input.label,
          deviceType: input.deviceType,
          isActive: input.isActive,
          updatedAt: now,
        })
        .where(eq(schema.matrixInputs.id, match.id))
    } else {
      await db.insert(schema.matrixInputs).values({
        configId,
        channelNumber: input.channel,
        label: input.label,
        inputType: 'HDMI',
        deviceType: input.deviceType,
        status: input.isActive ? 'active' : 'inactive',
        isActive: input.isActive,
        powerOn: false,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  // Sync outputs
  for (const output of chassis.outputs) {
    const existing = await db.select()
      .from(schema.matrixOutputs)
      .where(eq(schema.matrixOutputs.configId, configId))
      .all()

    const match = existing.find(e => e.channelNumber === output.channel)

    if (match) {
      await db.update(schema.matrixOutputs)
        .set({
          label: output.label,
          isActive: output.isActive,
          updatedAt: now,
        })
        .where(eq(schema.matrixOutputs.id, match.id))
    } else {
      await db.insert(schema.matrixOutputs).values({
        id: crypto.randomUUID(),
        configId,
        channelNumber: output.channel,
        label: output.label,
        resolution: '1080p',
        status: output.isActive ? 'active' : 'inactive',
        isActive: output.isActive,
        powerOn: false,
        createdAt: now,
        updatedAt: now,
      })
    }
  }
}
