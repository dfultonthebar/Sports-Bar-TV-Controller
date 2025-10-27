// Fire TV Guide Data API - Placeholder for future implementation

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Guide data endpoint - To be implemented',
    data: {
      channels: [],
      programs: []
    }
  })
}
