
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSoundtrackAPI } from '@/lib/soundtrack-your-brand'

const prisma = new PrismaClient()

// GET - Fetch available stations/playlists
export async function GET() {
  try {
    // Get API key from config
    const config = await prisma.soundtrackConfig.findFirst()
    
    if (!config) {
      return NextResponse.json({ 
        success: false, 
        error: 'Soundtrack not configured' 
      }, { status: 404 })
    }

    const api = getSoundtrackAPI(config.apiKey)
    const stations = await api.listStations()

    return NextResponse.json({ success: true, stations })
  } catch (error: any) {
    console.error('Error fetching Soundtrack stations:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}

