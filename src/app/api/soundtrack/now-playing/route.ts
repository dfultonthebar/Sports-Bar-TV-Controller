
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
    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get('playerId')

    if (!playerId) {
      return NextResponse.json(
        { success: false, error: 'Player ID required' },
        { status: 400 }
      )
    }

    const api = await getAPI()
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
