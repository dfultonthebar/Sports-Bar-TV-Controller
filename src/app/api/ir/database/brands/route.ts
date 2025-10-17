

import { NextRequest, NextResponse } from 'next/server'
import { irDatabaseService } from '@/lib/services/ir-database'
import { logDatabaseOperation } from '@/lib/database-logger'

/**
 * GET /api/ir/database/brands
 * Get list of all brands from Global Cache IR Database
 */
export async function GET() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 [IR DATABASE API] Fetching brands')
  console.log('   Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const brands = await irDatabaseService.getBrands()

    console.log('✅ [IR DATABASE API] Brands fetched successfully')
    console.log('   Count:', brands.length)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DATABASE_API', 'get_brands', {
      count: brands.length
    })

    return NextResponse.json({ success: true, brands })
  } catch (error: any) {
    console.error('❌ [IR DATABASE API] Error fetching brands:', error)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DATABASE_API', 'get_brands_error', {
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
