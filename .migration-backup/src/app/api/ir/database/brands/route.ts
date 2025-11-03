

import { NextRequest, NextResponse } from 'next/server'
import { irDatabaseService } from '@/lib/services/ir-database'
import { logDatabaseOperation } from '@/lib/database-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
/**
 * GET /api/ir/database/brands
 * Get list of all brands from Global Cache IR Database
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('📋 [IR DATABASE API] Fetching brands')
  logger.info('   Timestamp:', new Date().toISOString())
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const brands = await irDatabaseService.getBrands()

    logger.info('✅ [IR DATABASE API] Brands fetched successfully')
    logger.info('   Count:', brands.length)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DATABASE_API', 'get_brands', {
      count: brands.length
    })

    return NextResponse.json({ success: true, brands })
  } catch (error: any) {
    logger.error('❌ [IR DATABASE API] Error fetching brands:', error)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DATABASE_API', 'get_brands_error', {
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
