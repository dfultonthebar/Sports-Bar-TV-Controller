
import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, stack, context, details, url, userAgent } = body

    await enhancedLogger.error(
      'system',
      context || 'frontend',
      'client_error',
      message,
      {
        ...details,
        url,
        userAgent
      },
      stack
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to log error:', error)
    return NextResponse.json(
      { error: 'Failed to log error' },
      { status: 500 }
    )
  }
}
