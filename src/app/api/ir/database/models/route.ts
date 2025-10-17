

import { NextRequest, NextResponse } from 'next/server'
import { irDatabaseService } from '@/lib/services/ir-database'
import { logDatabaseOperation } from '@/lib/database-logger'

/**
 * GET /api/ir/database/models?brand=xxx&type=xxx
 * Get models for a specific brand and device type
 */
export async function GET(request: NextRequest) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 [IR DATABASE API] Fetching models')
  console.log('   Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const { searchParams } = new URL(request.url)
    const brand = searchParams.get('brand')
    const type = searchParams.get('type')

    if (!brand || !type) {
      console.log('❌ [IR DATABASE API] Brand and type are required')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      return NextResponse.json(
        { success: false, error: 'Brand and type are required' },
        { status: 400 }
      )
    }

    console.log('   Brand:', brand)
    console.log('   Type:', type)

    const models = await irDatabaseService.getModels(brand, type)

    console.log('✅ [IR DATABASE API] Models fetched successfully')
    console.log('   Count:', models.length)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DATABASE_API', 'get_models', {
      brand,
      type,
      count: models.length
    })

    return NextResponse.json({ success: true, models })
  } catch (error: any) {
    console.error('❌ [IR DATABASE API] Error fetching models:', error)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DATABASE_API', 'get_models_error', {
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
