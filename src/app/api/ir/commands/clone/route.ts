import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

/**
 * POST /api/ir/commands/clone
 * Clone all IR commands from one device to another (or multiple other devices)
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const bodyValidation = await validateRequestBody(request, z.object({
    sourceDeviceId: z.string().uuid(),
    targetDeviceIds: z.array(z.string().uuid()).min(1).max(10)
  }))

  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { sourceDeviceId, targetDeviceIds } = bodyValidation.data

  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('📋 [IR CLONE] Starting command clone operation')
  logger.info('   Source Device:', { data: sourceDeviceId })
  logger.info('   Target Devices:', { data: targetDeviceIds })
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    // Verify source device exists
    const sourceDevice = await db.select()
      .from(schema.irDevices)
      .where(eq(schema.irDevices.id, sourceDeviceId))
      .limit(1)
      .get()

    if (!sourceDevice) {
      logger.info('❌ [IR CLONE] Source device not found')
      return NextResponse.json({
        success: false,
        error: 'Source device not found'
      }, { status: 404 })
    }

    // Verify all target devices exist
    const targetDevices = await db.select()
      .from(schema.irDevices)
      .where(eq(schema.irDevices.id, targetDeviceIds[0]))
      .all()

    // Get all target devices (need to query each separately due to Drizzle limitation)
    const allTargetDevices = []
    for (const targetId of targetDeviceIds) {
      const device = await db.select()
        .from(schema.irDevices)
        .where(eq(schema.irDevices.id, targetId))
        .limit(1)
        .get()

      if (device) {
        allTargetDevices.push(device)
      }
    }

    if (allTargetDevices.length !== targetDeviceIds.length) {
      logger.info('❌ [IR CLONE] One or more target devices not found')
      return NextResponse.json({
        success: false,
        error: 'One or more target devices not found'
      }, { status: 404 })
    }

    // Get all commands from source device
    const sourceCommands = await db.select()
      .from(schema.irCommands)
      .where(eq(schema.irCommands.deviceId, sourceDeviceId))
      .all()

    logger.info('📦 [IR CLONE] Source commands loaded')
    logger.info('   Command count:', { data: sourceCommands.length })

    if (sourceCommands.length === 0) {
      logger.info('⚠️  [IR CLONE] No commands to clone')
      return NextResponse.json({
        success: false,
        error: 'Source device has no commands to clone'
      }, { status: 400 })
    }

    // Clone commands to each target device
    const results = []

    for (const targetDevice of allTargetDevices) {
      logger.info(`🎯 [IR CLONE] Cloning to device: ${targetDevice.name}`)

      // Get existing commands for target device to avoid duplicates
      const existingCommands = await db.select()
        .from(schema.irCommands)
        .where(eq(schema.irCommands.deviceId, targetDevice.id))
        .all()

      const existingFunctionNames = new Set(
        existingCommands.map(cmd => cmd.functionName.toLowerCase())
      )

      let added = 0
      let skipped = 0

      // Insert commands that don't already exist
      for (const sourceCmd of sourceCommands) {
        if (existingFunctionNames.has(sourceCmd.functionName.toLowerCase())) {
          skipped++
          continue
        }

        await db.insert(schema.irCommands).values({
          id: uuidv4(),
          deviceId: targetDevice.id,
          functionName: sourceCmd.functionName,
          irCode: sourceCmd.irCode,
          hexCode: sourceCmd.hexCode,
          codeSetId: sourceCmd.codeSetId,
          category: sourceCmd.category,
          description: sourceCmd.description,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })

        added++
      }

      results.push({
        deviceId: targetDevice.id,
        deviceName: targetDevice.name,
        added,
        skipped,
        total: sourceCommands.length
      })

      logger.info(`✅ [IR CLONE] Cloned to ${targetDevice.name}`)
      logger.info(`   Added: ${added}, Skipped: ${skipped}`)
    }

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('🎉 [IR CLONE] Clone operation complete')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json({
      success: true,
      sourceDevice: {
        id: sourceDevice.id,
        name: sourceDevice.name,
        commandCount: sourceCommands.length
      },
      results
    })

  } catch (error) {
    logger.error('❌ [IR CLONE] Error cloning commands:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clone commands'
    }, { status: 500 })
  }
}
