
/**
 * API Route: Get Statistics
 */

import { NextRequest, NextResponse } from 'next/server'
import { changeManager } from '../../services/changeManager'

export async function GET(request: NextRequest) {
  try {
    const statistics = changeManager.getStatistics()
    return NextResponse.json({ statistics })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}
