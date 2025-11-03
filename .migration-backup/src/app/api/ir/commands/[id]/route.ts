import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { deleteRecord } from '@/lib/db-helpers'
import { irCommands } from '@/db/schema'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
/**
 * DELETE /api/ir/commands/[id]
 * Delete an IR command
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const { id: commandId } = await params

  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('🗑️  [IR COMMANDS] Deleting IR command')
  logger.info('   Command ID:', commandId)
  logger.info('   Timestamp:', new Date().toISOString())
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
