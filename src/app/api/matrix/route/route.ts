
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { routeMatrix } from '@/lib/matrix-control'


export async function POST(request: NextRequest) {
  try {
    const { input, output } = await request.json()

    // Validate input parameters
    if (!input || !output || input < 1 || output < 1 || input > 32 || output > 32) {
      return NextResponse.json(
        { error: 'Invalid input or output channel' },
        { status: 400 }
      )
    }

    // Use shared matrix routing logic
    const success = await routeMatrix(input, output)

    if (!success) {
      return NextResponse.json({
        error: `Failed to route input ${input} to output ${output}`,
        success: false
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Successfully routed input ${input} to output ${output}`,
      command: `${input}X${output}.`,
      route: { input, output }
    })

  } catch (error) {
    logger.error('Error routing signal:', error)
    return NextResponse.json(
      { error: 'Failed to route signal' },
      { status: 500 }
    )
  }
}
