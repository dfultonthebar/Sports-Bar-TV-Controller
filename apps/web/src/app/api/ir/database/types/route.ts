

import { NextRequest, NextResponse } from 'next/server'
import { irDatabaseService } from '@/lib/services/ir-database'
import { logDatabaseOperation } from '@/lib/database-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
/**
 * GET /api/ir/database/types?brand=xxx
 * Get device types for a brand, or all types if no brand specified
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('📋 [IR DATABASE API] Fetching types')
  logger.info('   Timestamp:', { data: new Date().toISOString() })
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const { searchParams } = new URL(request.url)
    const brand = searchParams.get('brand')

    if (brand) {
      logger.info('   Brand:', { data: brand })
      const types = await irDatabaseService.getBrandTypes(brand)
      
      logger.info('✅ [IR DATABASE API] Brand types fetched successfully')
      logger.info('   Count:', { data: types.length })
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE_API', 'get_brand_types', {
        brand,
        count: types.length
      })

      return NextResponse.json({ success: true, types })
    } else {
      const types = await irDatabaseService.getTypes()
      
      logger.info('✅ [IR DATABASE API] Types fetched successfully')
      logger.info('   Count:', { data: types.length })
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE_API', 'get_types', {
        count: types.length
      })

      return NextResponse.json({ success: true, types })
    }
  } catch (error: any) {
    logger.error('❌ [IR DATABASE API] Error fetching types:', error)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DATABASE_API', 'get_types_error', {
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
