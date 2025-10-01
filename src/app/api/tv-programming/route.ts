
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// TV Programming API - NO MOCK DATA
// This API requires integration with real TV programming sources:
// - Gracenote EPG API (Electronic Programming Guide)
// - TMS (Tribune Media Services)
// - Rovi/TiVo Guide Data
// - Spectrum Business TV API
// - DirecTV Guide API

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const channelNumber = url.searchParams.get('channel')
    const days = parseInt(url.searchParams.get('days') || '7')
    
    console.log('⚠️ TV Programming API: No real data source configured')
    console.log('ℹ️ Please configure Gracenote, TMS, or Spectrum Business API for EPG data')
    
    return NextResponse.json({
      success: false,
      error: 'No TV programming data source configured',
      message: 'Please configure a real EPG (Electronic Programming Guide) data source',
      suggestedProviders: [
        'Gracenote EPG API',
        'TMS (Tribune Media Services)',
        'Rovi/TiVo Guide Data',
        'Spectrum Business TV API',
        'DirecTV Guide API via receivers'
      ],
      alternativeEndpoints: [
        '/api/sports-guide - For live sports programming',
        '/api/directv-devices/guide-data - For DirecTV receiver guide',
        '/api/firetv-devices/guide-data - For Fire TV streaming guide'
      ],
      requestedChannel: channelNumber,
      requestedDays: days
    })
  } catch (error) {
    console.error('Error in TV programming API:', error)
    return NextResponse.json({ 
      success: false,
      error: 'TV Programming API error' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('⚠️ TV Programming Update: No real data source configured')
    
    return NextResponse.json({
      success: false,
      message: 'No TV programming data source configured for updates',
      timestamp: new Date().toISOString(),
      recommendation: 'Configure Gracenote EPG, TMS, or Spectrum Business API for automated updates'
    })
  } catch (error) {
    console.error('Error updating TV programming:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to update programming' 
    }, { status: 500 })
  }
}
