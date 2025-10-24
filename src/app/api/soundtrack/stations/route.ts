
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findFirst, or } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { getSoundtrackAPI } from '@/lib/soundtrack-your-brand'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'

// GET - Fetch available stations/playlists
export async function GET() {
  try {
    // Get API key from config
    const config = await findFirst('soundtrackConfigs')
    
    if (!config) {
      return NextResponse.json({ 
        success: false, 
        error: 'Soundtrack not configured' 
      }, { status: 404 })
    }

    const api = getSoundtrackAPI(config.apiKey)
    
    // First get the account info
    const account = await api.getAccount()
    
    // Get stations for the first available account
    const accountId = account.accounts?.[0]?.id || account.id
    const stations = await api.listStations(accountId)

    return NextResponse.json({ success: true, stations })
  } catch (error: any) {
    logger.error('Error fetching Soundtrack stations:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}

