

import { NextRequest, NextResponse } from 'next/server'
import { irDatabaseService } from '@/lib/services/ir-database'
import { logDatabaseOperation } from '@/lib/database-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

/**
 * GET /api/ir/database/types?brand=xxx
 * Get device types for a brand, or all types if no brand specified
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 [IR DATABASE API] Fetching types')
  console.log('   Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const { searchParams } = new URL(request.url)
    const brand = searchParams.get('brand')

    if (brand) {
      console.log('   Brand:', brand)
      const types = await irDatabaseService.getBrandTypes(brand)
      
      console.log('✅ [IR DATABASE API] Brand types fetched successfully')
      console.log('   Count:', types.length)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE_API', 'get_brand_types', {
        brand,
        count: types.length
      })

      return NextResponse.json({ success: true, types })
    } else {
      const types = await irDatabaseService.getTypes()
      
      console.log('✅ [IR DATABASE API] Types fetched successfully')
      console.log('   Count:', types.length)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      logDatabaseOperation('IR_DATABASE_API', 'get_types', {
        count: types.length
      })

      return NextResponse.json({ success: true, types })
    }
  } catch (error: any) {
    console.error('❌ [IR DATABASE API] Error fetching types:', error)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DATABASE_API', 'get_types_error', {
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
