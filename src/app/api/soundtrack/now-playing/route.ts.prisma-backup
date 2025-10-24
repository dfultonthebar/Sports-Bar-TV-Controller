export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server'
import prisma from "@/lib/prisma"
import { getSoundtrackAPI } from '@/lib/soundtrack-your-brand'


// GET - Fetch now playing for a player
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get('playerId')

    if (!playerId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Player ID is required' 
      }, { status: 400 })
    }

    // Get API key from config
    const config = await prisma.soundtrackConfig.findFirst()
    
    if (!config) {
      return NextResponse.json({ 
        success: false, 
        error: 'Soundtrack not configured' 
      }, { status: 404 })
    }

    const api = getSoundtrackAPI(config.apiKey)
    const nowPlaying = await api.getNowPlaying(playerId)

    return NextResponse.json({ success: true, nowPlaying })
  } catch (error: any) {
    console.error('Error fetching now playing:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}

