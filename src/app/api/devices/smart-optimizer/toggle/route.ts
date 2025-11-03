
import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { id, isActive } = await request.json()

    // Log the optimization rule toggle
    console.log(`Optimization rule ${id} ${isActive ? 'activated' : 'deactivated'}`)

    // In a real implementation, this would:
    // 1. Update the database with the new state
    // 2. Start/stop the actual automation process
    // 3. Log the change for audit purposes

    return NextResponse.json({
      success: true,
      message: `Optimization rule ${isActive ? 'activated' : 'deactivated'} successfully`,
      id,
      isActive,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Toggle optimization error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to toggle optimization rule' },
      { status: 500 }
    )
  }
}
