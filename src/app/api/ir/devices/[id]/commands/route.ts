import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and, asc } from 'drizzle-orm'
import { findMany } from '@/lib/db-helpers'
import { irCommands } from '@/db/schema'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
/**
 * GET /api/ir/devices/[id]/commands
 * Get all commands for a specific IR device
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Path parameter validation
  const resolvedParams = await params
  const paramsValidation = validatePathParams(resolvedParams, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error


  const { id: deviceId } = await params

  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('📋 [IR COMMANDS] Fetching commands for device')
  logger.info('   Device ID:', { data: deviceId })
  logger.info('   Timestamp:', { data: new Date().toISOString() })
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const commands = await findMany('irCommands', {
      where: eq(schema.irCommands.deviceId, deviceId),
      orderBy: asc(schema.irCommands.functionName)
    })

    logger.info('✅ [IR COMMANDS] Commands fetched successfully')
    logger.info('   Count:', { data: commands.length })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json({
      success: true,
      commands
    })
  } catch (error) {
    logger.error('❌ [IR COMMANDS] Error fetching commands:', error)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch commands' 
      },
      { status: 500 }
    )
  }
}
