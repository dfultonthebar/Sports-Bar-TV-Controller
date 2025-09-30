
import { NextRequest, NextResponse } from 'next/server'
import { getSoundtrackAPI } from '@/lib/soundtrack-your-brand'

export async function GET(request: NextRequest) {
  try {
    const api = getSoundtrackAPI()
    const players = await api.listPlayers()
    return NextResponse.json({ success: true, players })
  } catch (error: any) {
    console.error('Soundtrack players error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { playerId, ...data } = body

    if (!playerId) {
      return NextResponse.json(
        { success: false, error: 'Player ID required' },
        { status: 400 }
      )
    }

    const api = getSoundtrackAPI()
    const player = await api.updatePlayer(playerId, data)
    return NextResponse.json({ success: true, player })
  } catch (error: any) {
    console.error('Soundtrack player update error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
