
import { NextRequest, NextResponse } from 'next/server'
import { aiGainService } from '@/lib/ai-gain-service'

interface RouteContext {
  params: {
    id: string
  }
}

// GET: Get adjustment history for an input
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const processorId = context.params.id
    const { searchParams } = new URL(request.url)
    const inputNumber = parseInt(searchParams.get('inputNumber') || '')
    const limit = parseInt(searchParams.get('limit') || '100')

    if (isNaN(inputNumber)) {
      return NextResponse.json(
        { error: 'Valid input number is required' },
        { status: 400 }
      )
    }

    const history = await aiGainService.getAdjustmentHistory(
      processorId,
      inputNumber,
      limit
    )

    return NextResponse.json({ 
      success: true,
      processorId,
      inputNumber,
      history
    })

  } catch (error) {
    console.error('Error fetching adjustment history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch adjustment history' },
      { status: 500 }
    )
  }
}
