import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { deleteRecord } from '@/lib/db-helpers'
import { irCommands } from '@/db/schema'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
/**
 * DELETE /api/ir/commands/[id]
 * Delete an IR command
 */
export async function DELETE(
  request: NextRequest,
  {  params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Path parameter validation
  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error


  const { id: commandId } = params

  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('🗑️  [IR COMMANDS] Deleting IR command')
  logger.info('   Command ID:', { data: commandId })
  logger.info('   Timestamp:', { data: new Date().toISOString() })
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    await deleteRecord('irCommands', eq(schema.irCommands.id, commandId))

    logger.info('✅ [IR COMMANDS] Command deleted successfully')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json({
      success: true,
      message: 'Command deleted successfully'
    })
  } catch (error) {
    logger.error('❌ [IR COMMANDS] Error deleting command:', error)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete command' 
      },
      { status: 500 }
    )
  }
}
