
import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceType, deviceId, action, success, details, component } = body

    await enhancedLogger.logHardwareOperation(
      deviceType,
      deviceId,
      action,
      success,
      {
        ...details,
        component
      }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to log device interaction:', error)
    return NextResponse.json(
      { error: 'Failed to log device interaction' },
      { status: 500 }
    )
  }
}
