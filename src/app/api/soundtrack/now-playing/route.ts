
import { NextRequest, NextResponse } from 'next/server'
import { getSoundtrackAPI } from '@/lib/soundtrack-your-brand'

export async function GET(request: NextRequest) {
  try {
    const playerId = request.nextUrl.searchParams.get('playerId')
    
    if (!playerId) {
      return NextResponse.json(
        { success: false, error: 'Player ID required' },
        { status: 400 }
      )
    }

    const api = getSoundtrackAPI()
    const nowPlaying = await api.getNowPlaying(playerId)
    return NextResponse.json({ success: true, nowPlaying })
  } catch (error: any) {
    console.error('Soundtrack now playing error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
