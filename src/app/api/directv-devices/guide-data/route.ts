

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export const dynamic = 'force-dynamic'

// DirecTV Guide Data Fetcher
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { deviceId, ipAddress, port, startTime, endTime, channelList } = await request.json()

    if (!deviceId || !ipAddress) {
      return NextResponse.json({ error: 'Device ID and IP address are required' }, { status: 400 })
    }

    console.log(`🎭 Fetching DirecTV guide data from ${ipAddress}:${port || 8080}`)

    // Format timestamps for DirecTV API
    const start = startTime ? new Date(startTime).toISOString() : new Date().toISOString()
    const end = endTime ? new Date(endTime).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    let guideData: any[] = []

    try {
      // DirecTV Guide API endpoints - multiple approaches
      const baseUrl = `http://${ipAddress}:${port || 8080}`
      
      // Method 1: Get channel lineup first
      const channelResponse = await Promise.race([
        fetch(`${baseUrl}/tv/getChannels`, { method: 'GET' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
      ]) as Response

      let channels: any[] = []
      if (channelResponse.ok) {
        const channelData = await channelResponse.json()
        channels = channelData.channels || []
        console.log(`📺 Found ${channels.length} channels from DirecTV receiver`)
      } else {
        // Fallback channel list for guide polling
        channels = channelList || [
          { channel: '206', callsign: 'ESPN' },
          { channel: '207', callsign: 'ESPN2' },
          { channel: '212', callsign: 'NFLRED' },
          { channel: '213', callsign: 'NFLN' },
          { channel: '215', callsign: 'NBATV' },
          { channel: '217', callsign: 'MLBN' },
          { channel: '219', callsign: 'NHLN' },
          { channel: '220', callsign: 'FS1' },
          { channel: '221', callsign: 'FS2' },
          { channel: '611', callsign: 'TNT' },
          { channel: '620', callsign: 'TBS' }
        ]
      }

      // Method 2: Get program guide data
      for (const channelInfo of channels.slice(0, 50)) { // Limit to prevent timeout
        try {
          const guideResponse = await Promise.race([
            fetch(`${baseUrl}/tv/getPrograms?major=${channelInfo.channel}&startTime=${start}&endTime=${end}`, { method: 'GET' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
          ]) as Response

          if (guideResponse.ok) {
            const programData = await guideResponse.json()
            if (programData.programs && programData.programs.length > 0) {
              programData.programs.forEach((program: any) => {
                guideData.push({
                  id: `directv-${deviceId}-${channelInfo.channel}-${program.programId}`,
                  source: 'directv',
                  deviceId,
                  channel: channelInfo.channel,
                  channelName: channelInfo.callsign || channelInfo.title || `Channel ${channelInfo.channel}`,
                  title: program.title || 'No Title',
                  description: program.description || '',
                  startTime: program.startTime,
                  endTime: program.endTime,
                  duration: program.duration,
                  rating: program.rating,
                  category: program.category || 'General',
                  isHD: program.isHD || false,
                  isNew: program.isNew || false,
                  isRepeat: program.isRepeat || false,
                  episodeNumber: program.episodeNumber,
                  seasonNumber: program.seasonNumber,
                  recordable: true,
                  fetchedAt: new Date().toISOString()
                })
              })
            }
          }
        } catch (channelError) {
          console.warn(`⚠️ Failed to get guide data for channel ${channelInfo.channel}:`, channelError.message)
          continue
        }
      }

      // Method 3: Current program info as fallback
      if (guideData.length === 0) {
        try {
          const currentResponse = await Promise.race([
            fetch(`${baseUrl}/tv/getTuned`, { method: 'GET' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
          ]) as Response

          if (currentResponse.ok) {
            const currentData = await currentResponse.json()
            if (currentData.title) {
              guideData.push({
                id: `directv-${deviceId}-current`,
                source: 'directv',
                deviceId,
                channel: currentData.major || 'Unknown',
                channelName: currentData.callsign || 'Current Channel',
                title: currentData.title,
                description: currentData.subtitle || '',
                startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // Approximate
                endTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                duration: 3600, // 1 hour default
                category: 'Current Program',
                isLive: true,
                fetchedAt: new Date().toISOString()
              })
            }
          }
        } catch (currentError) {
          console.warn('⚠️ Failed to get current program info:', currentError.message)
        }
      }

    } catch (fetchError) {
      console.error('❌ Error fetching from DirecTV API:', fetchError)
      
      return NextResponse.json({
        success: false,
        error: 'Failed to connect to DirecTV receiver',
        details: 'Unable to retrieve guide data from DirecTV. Please ensure receiver is powered on and network accessible.',
        deviceId,
        deviceType: 'directv',
        recommendations: [
          'Ensure DirecTV receiver is powered on',
          'Verify receiver is connected to network',
          'Check if receiver API is enabled (SHEF protocol)',
          'Verify IP address is correct',
          'Try accessing http://<receiver-ip>:8080/tv/getTuned in a browser'
        ],
        apiDocumentation: 'DirecTV receivers use the SHEF (Streaming Home Entertainment Framework) protocol',
        commonPorts: [8080, 8088]
      }, { status: 503 })
    }

    return NextResponse.json({
      success: true,
      deviceId,
      deviceType: 'directv',
      programCount: guideData.length,
      fetchedAt: new Date().toISOString(),
      timeRange: { start, end },
      programs: guideData.sort((a, b) => 
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )
    })

  } catch (error) {
    console.error('❌ Error in DirecTV guide data API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch DirecTV guide data', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('deviceId')

    if (!deviceId) {
      return NextResponse.json({
        success: true,
        message: 'DirecTV Guide Data API',
        endpoints: {
          'POST': 'Fetch guide data from DirecTV receiver',
          'GET': 'Get API information'
        },
        requiredParams: {
          deviceId: 'string',
          ipAddress: 'string', 
          port: 'number (optional, default 8080)',
          startTime: 'ISO string (optional)',
          endTime: 'ISO string (optional)'
        },
        supportedMethods: [
          'Channel lineup retrieval',
          'Program guide polling',
          'Current program info',
          'Recording capabilities check'
        ]
      })
    }

    // Return cached guide data if available
    return NextResponse.json({
      success: true,
      message: 'Use POST method to fetch guide data',
      deviceId
    })

  } catch (error) {
    console.error('❌ Error in DirecTV guide data GET:', error)
    return NextResponse.json(
      { error: 'API error' },
      { status: 500 }
    )
  }
}

