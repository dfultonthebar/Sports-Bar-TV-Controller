/**
 * CEC Device Discovery API
 *
 * POST /api/cec/cable-box/discover
 * Discover all connected Pulse-Eight USB CEC adapters
 */

import { NextRequest, NextResponse } from 'next/server'
import { CableBoxCECService } from '@/lib/cable-box-cec-service'

export async function POST(request: NextRequest) {
  try {
    console.log('[API] Discovering CEC adapters...')

    const cecService = CableBoxCECService.getInstance()
    const adapters = await cecService.discoverAdapters()

    return NextResponse.json({
      success: true,
      adapters,
      count: adapters.length,
      message: `Found ${adapters.length} CEC adapter(s)`,
    })
  } catch (error: any) {
    console.error('[API] Error discovering adapters:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to discover adapters',
        adapters: [],
      },
      { status: 500 }
    )
  }
}
