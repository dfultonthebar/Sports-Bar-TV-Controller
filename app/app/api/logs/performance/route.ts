
import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { operation, duration, metadata, component } = body

    await enhancedLogger.logPerformanceMetric(
      operation,
      duration,
      {
        ...metadata,
        component
      }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to log performance metric:', error)
    return NextResponse.json(
      { error: 'Failed to log performance' },
      { status: 500 }
    )
  }
}
