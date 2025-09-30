
import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, details, userId, component, userAgent, url } = body

    await enhancedLogger.logUserInteraction(
      action,
      {
        ...details,
        component,
        url,
        userAgent
      },
      userId,
      request.headers.get('x-session-id') || undefined
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to log user action:', error)
    return NextResponse.json(
      { error: 'Failed to log action' },
      { status: 500 }
    )
  }
}
