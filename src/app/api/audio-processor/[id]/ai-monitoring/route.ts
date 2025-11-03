
import { NextRequest, NextResponse } from 'next/server'
import { aiGainService } from '@/lib/ai-gain-service'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

// GET: Get monitoring status
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const params = await context.params
    const processorId = params.id

    const status = await aiGainService.getAIGainStatus(processorId)

    return NextResponse.json({ 
      success: true,
      processorId,
      status
    })

  } catch (error) {
    console.error('Error fetching AI monitoring status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch monitoring status' },
      { status: 500 }
    )
  }
}

// POST: Start/stop monitoring
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const params = await context.params
    const processorId = params.id
    const { action } = await request.json()

    if (!action || !['start', 'stop'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "start" or "stop"' },
        { status: 400 }
      )
    }

    if (action === 'start') {
      await aiGainService.startMonitoring(processorId)
      return NextResponse.json({ 
        success: true,
        message: 'AI gain monitoring started'
      })
    } else {
      aiGainService.stopMonitoring(processorId)
      return NextResponse.json({ 
        success: true,
        message: 'AI gain monitoring stopped'
      })
    }

  } catch (error) {
    console.error('Error controlling AI monitoring:', error)
    return NextResponse.json(
      { error: 'Failed to control monitoring' },
      { status: 500 }
    )
  }
}
