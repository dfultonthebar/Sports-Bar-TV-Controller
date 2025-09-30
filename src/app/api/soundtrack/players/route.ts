
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { SoundtrackYourBrandAPI } from '@/lib/soundtrack-your-brand'

const prisma = new PrismaClient()

async function getAPI() {
  const config = await prisma.soundtrackConfig.findFirst({
    orderBy: { createdAt: 'desc' }
  })
  
  if (!config || !config.apiKey) {
    throw new Error('Soundtrack Your Brand not configured')
  }
  
  return new SoundtrackYourBrandAPI(config.apiKey)
}

export async function GET(request: NextRequest) {
  try {
    const api = await getAPI()
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

    const api = await getAPI()
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
