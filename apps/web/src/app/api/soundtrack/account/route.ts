
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findFirst, or } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@sports-bar/logger'
import { getSoundtrackAPI } from '@/lib/soundtrack-your-brand'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

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
  }
}
