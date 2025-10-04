// Next.js route segment config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server'

/**
 * NFHS Sync Route - DISABLED
 * 
 * NFHS scraping functionality has been removed.
 * This endpoint now returns a disabled message.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: 'NFHS scraping functionality has been disabled',
    games: []
  })
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: 'NFHS scraping functionality has been disabled',
    games: []
  })
}
