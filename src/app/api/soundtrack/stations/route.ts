
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
    const stations = await api.listStations()
    return NextResponse.json({ success: true, stations })
  } catch (error: any) {
    console.error('Soundtrack stations error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
