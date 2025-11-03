import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { create } from '@/lib/db-helpers'
import { irCommands } from '@/db/schema'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
/**
 * POST /api/ir/commands
 * Create a new IR command
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error


  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('➕ [IR COMMANDS] Creating new IR command')
  logger.info('   Timestamp:', new Date().toISOString())
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const body = await request.json()
    const { deviceId, functionName, irCode, hexCode, category, description } = body

    if (!deviceId || !functionName || !irCode) {
      logger.info('❌ [IR COMMANDS] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'Device ID, function name, and IR code are required' },
        { status: 400 }
      )
    }

    logger.info('   Device ID:', deviceId)
    logger.info('   Function Name:', functionName)
    logger.info('   Category:', category || 'N/A')

    // Check if command with this function name already exists for this device
    const existingCommand = await db.select()
      .from(irCommands)
      .where(
        and(
          eq(irCommands.deviceId, deviceId),
          eq(irCommands.functionName, functionName)
        )
      )
      .limit(1)
      .get()

    if (existingCommand) {
      logger.info('❌ [IR COMMANDS] Command already exists')
      return NextResponse.json(
        { success: false, error: 'A command with this name already exists for this device' },
        { status: 409 }
      )
    }

    const command = await create('irCommands', {
      deviceId,
      functionName,
      irCode,
      hexCode: hexCode || null,
      category: category || null,
      description: description || null
    })

    logger.info('✅ [IR COMMANDS] Command created successfully')
    logger.info('   ID:', command.id)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json({
      success: true,
      command
    })
  } catch (error) {
    logger.error('❌ [IR COMMANDS] Error creating command:', error)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create command' 
      },
      { status: 500 }
    )
  }
}
