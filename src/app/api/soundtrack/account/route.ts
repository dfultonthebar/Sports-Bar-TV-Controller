
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findFirst, or } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { getSoundtrackAPI } from '@/lib/soundtrack-your-brand'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get API key from config
    const config = await findFirst('soundtrackConfigs')
    
    if (!config || !config.apiKey) {
      return NextResponse.json(
        { success: false, error: 'Soundtrack Your Brand API key not configured' },
        { status: 404 }
      )
    }

    const api = getSoundtrackAPI(config.apiKey)
    const account = await api.getAccount()
    return NextResponse.json({ success: true, account })
  } catch (error: any) {
    logger.error('Soundtrack account error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
