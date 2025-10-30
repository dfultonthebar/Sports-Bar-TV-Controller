/**
 * Test CEC Connection API
 *
 * POST /api/cec/cable-box/test
 * Test connectivity to a cable box
 */

import { NextRequest, NextResponse } from 'next/server'
import { CableBoxCECService } from '@/lib/cable-box-cec-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cableBoxId } = body

    if (!cableBoxId) {
      return NextResponse.json(
        {
          success: false,
          error: 'cableBoxId is required',
        },
        { status: 400 }
      )
    }

    console.log(`[API] Testing connection to cable box ${cableBoxId}`)

    const cecService = CableBoxCECService.getInstance()
    const result = await cecService.testConnection(cableBoxId)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Cable box is responding',
        executionTime: result.executionTime,
        responsive: true,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Cable box not responding',
          executionTime: result.executionTime,
          responsive: false,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[API] Error testing cable box:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to test connection',
      },
      { status: 500 }
    )
  }
}
