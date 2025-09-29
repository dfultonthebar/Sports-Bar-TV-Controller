
import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const hours = parseInt(searchParams.get('hours') || '24')
    const category = searchParams.get('category') || undefined

    const analytics = await enhancedLogger.getLogAnalytics(hours)

    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Failed to get log analytics:', error)
    
    await enhancedLogger.error(
      'api',
      'logs-analytics-api',
      'fetch_analytics',
      'Failed to fetch log analytics',
      { error: error instanceof Error ? error.message : error },
      error instanceof Error ? error.stack : undefined
    )

    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
