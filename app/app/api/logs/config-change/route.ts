
import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { component, setting, oldValue, newValue, userId } = body

    await enhancedLogger.logConfigurationChange(
      component,
      setting,
      oldValue,
      newValue,
      userId
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to log configuration change:', error)
    return NextResponse.json(
      { error: 'Failed to log config change' },
      { status: 500 }
    )
  }
}
