

import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { cacheService, CacheKeys, CacheTTL } from '@/lib/cache-service'
import { FireTVDevice } from '@/lib/firetv-utils'

export const dynamic = 'force-dynamic'

interface DeviceGuideRequest {
  inputNumber: number
  deviceType: 'cable' | 'satellite' | 'streaming'
  deviceId?: string
  startTime?: string
  endTime?: string
}

export async function POST(request: NextRequest) {
  try {
    const { inputNumber, deviceType, deviceId, startTime, endTime }: DeviceGuideRequest = await request.json()

    if (!inputNumber || !deviceType) {
      return NextResponse.json({ 
        error: 'Input number and device type are required' 
      }, { status: 400 })
    }

    const start = startTime || new Date().toISOString()
    const end = endTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    let guideData: any = null

    switch (deviceType) {
      case 'cable':
        guideData = await getCableGuideData(inputNumber, start, end)
        break
      case 'satellite':
        guideData = await getSatelliteGuideData(inputNumber, deviceId, start, end)
        break
      case 'streaming':
        guideData = await getStreamingGuideData(inputNumber, deviceId, start, end)
        break
      default:
        return NextResponse.json({ 
          error: `Unsupported device type: ${deviceType}` 
        }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      inputNumber,
      deviceType,
      deviceId,
      timeRange: { start, end },
      lastUpdated: new Date().toISOString(),
      ...guideData
    })

  } catch (error) {
    console.error('Channel guide API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch channel guide data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Cable TV guide data (Spectrum Business API)
async function getCableGuideData(inputNumber: number, startTime: string, endTime: string) {
  try {
    // Load Spectrum configuration to check if API is configured
    const spectrumConfigResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/tv-guide/spectrum-business`, {
      method: 'GET'
    })
    
    const spectrumData = await spectrumConfigResponse.json()
    
    if (spectrumData.success && spectrumData.programs) {
      const sportsPrograms = spectrumData.programs
        .filter((prog: any) => prog.isSports)
        .map((prog: any) => ({
          id: prog.id,
          league: prog.sportsInfo?.league || 'Cable TV',
          homeTeam: prog.sportsInfo?.homeTeam || '',
          awayTeam: prog.sportsInfo?.awayTeam || '',
          gameTime: new Date(prog.startTime).toLocaleTimeString(),
          startTime: prog.startTime,
          endTime: prog.endTime,
          channel: {
            id: prog.channelId || `channel-${prog.channelNumber || 'unknown'}`,
            name: prog.channelName || prog.title,
            number: prog.channelNumber,
            type: 'cable' as const,
            cost: 'subscription' as const,
            platforms: ['Spectrum'],
            channelNumber: prog.channelNumber
          },
          description: prog.description || prog.title,
          isSports: true,
          isLive: prog.isLive || false,
          venue: prog.sportsInfo?.venue
        }))

      return {
        type: 'cable',
        channels: [] as any[],
        programs: sportsPrograms
      }
    } else {
      // Return empty data if Spectrum API is not configured
      return {
        type: 'cable',
        channels: [] as any[],
        programs: [] as any[],
        message: 'Configure Spectrum Business API in TV Guide Config to view real data'
      }
    }
  } catch (error) {
    console.error('Error fetching cable guide data:', error)
    return {
      type: 'cable',
      channels: [] as any[],
      programs: [] as any[],
      error: error instanceof Error ? error.message : 'Failed to fetch cable guide data'
    }
  }
}

// DirecTV satellite guide data
async function getSatelliteGuideData(inputNumber: number, deviceId: string | undefined, startTime: string, endTime: string) {
  try {
    // First, get DirecTV devices to find the device for this input
    const deviceResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/directv-devices`)
    const deviceData = await deviceResponse.json()
    
    let targetDevice: any = null
    if (deviceId) {
      targetDevice = deviceData.devices?.find((d: any) => d.id === deviceId)
    } else {
      // Find device by input channel
      targetDevice = deviceData.devices?.find((d: any) => d.inputChannel === inputNumber)
    }

    if (!targetDevice) {
      throw new Error(`No DirecTV device found for input ${inputNumber}`)
    }

    // Get sports programming from unified TV guide
    const guideResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/tv-guide/unified?action=sports&startTime=${startTime}&endTime=${endTime}`)
    const guideData = await guideResponse.json()

    if (guideData.success && guideData.programs) {
      const programs = guideData.programs.map((prog: any) => ({
        id: prog.id,
        league: prog.sportsInfo?.league || 'DirecTV',
        homeTeam: prog.sportsInfo?.homeTeam || '',
        awayTeam: prog.sportsInfo?.awayTeam || '',
        gameTime: new Date(prog.startTime).toLocaleTimeString(),
        startTime: prog.startTime,
        endTime: prog.endTime,
        channel: {
          id: prog.channelId || prog.id,
          name: prog.title,
          type: 'satellite' as const,
          cost: 'subscription' as const,
          platforms: ['DirecTV'],
          channelNumber: prog.channelNumber || '000'
        },
        description: prog.description,
        isSports: prog.isSports || false,
        isLive: prog.isLive || false
      }))

      return {
        type: 'satellite',
        device: targetDevice,
        channels: [] as any[],
        programs
      }
    } else {
      return {
        type: 'satellite',
        device: targetDevice,
        channels: [] as any[],
        programs: [] as any[],
        message: 'No guide data available for DirecTV'
      }
    }
  } catch (error) {
    console.error('Error fetching DirecTV guide data:', error)
    return {
      type: 'satellite',
      channels: [] as any[],
      programs: [] as any[],
      error: error instanceof Error ? error.message : 'Failed to fetch DirecTV guide data'
    }
  }
}

// Fire TV streaming guide data
async function getStreamingGuideData(inputNumber: number, deviceId: string | undefined, startTime: string, endTime: string) {
  try {
    // Get Fire TV devices
    const deviceResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/firetv-devices`)
    const deviceData = await deviceResponse.json()
    
    let targetDevice: FireTVDevice | undefined = undefined
    if (deviceId) {
      targetDevice = deviceData.devices?.find((d: FireTVDevice) => d.id === deviceId)
    } else {
      // Find device by input channel
      targetDevice = deviceData.devices?.find((d: FireTVDevice) => d.inputChannel === inputNumber)
    }

    if (!targetDevice) {
      throw new Error(`No Fire TV device found for input ${inputNumber}`)
    }

    // Get Fire TV guide data
    const guideResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/firetv-devices/guide-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: targetDevice.id,
        ipAddress: targetDevice.ipAddress,
        port: targetDevice.port,
        startTime,
        endTime
      })
    })

    const guideData = await guideResponse.json()

    if (guideData.success && guideData.programs) {
      // Filter for sports content and format for our interface
      const sportsPrograms = guideData.programs
        .filter((prog: any) => prog.category === 'Sports' || prog.streamingService?.toLowerCase().includes('sport'))
        .map((prog: any) => ({
          id: prog.id,
          league: prog.streamingService || 'Streaming',
          homeTeam: '',
          awayTeam: '',
          gameTime: new Date(prog.startTime).toLocaleTimeString(),
          startTime: prog.startTime,
          endTime: prog.endTime,
          channel: {
            id: prog.appName?.toLowerCase().replace(/\s+/g, '-') || 'unknown-app',
            name: prog.appName || prog.streamingService,
            type: 'streaming' as const,
            cost: 'subscription' as const,
            platforms: [prog.streamingService || prog.appName],
            packageName: prog.packageName,
            appCommand: prog.packageName ? `monkey -p ${prog.packageName} 1` : undefined
          },
          description: prog.description,
          isSports: true,
          isLive: prog.isLive || false
        }))

      // Get available sports apps
      const sportsApps = [
        { packageName: 'com.espn.score_center', displayName: 'ESPN', category: 'Sports', sportsContent: true },
        { packageName: 'com.fox.now', displayName: 'FOX Sports', category: 'Sports', sportsContent: true },
        { packageName: 'com.google.android.youtube.tv', displayName: 'YouTube TV', category: 'Sports', sportsContent: true },
        { packageName: 'com.hulu.plus', displayName: 'Hulu Live TV', category: 'Sports', sportsContent: true },
        { packageName: 'com.nba.game', displayName: 'NBA League Pass', category: 'Sports', sportsContent: true },
        { packageName: 'com.bamnetworks.mobile.android.gameday.mlb', displayName: 'MLB.TV', category: 'Sports', sportsContent: true },
        { packageName: 'com.amazon.avod.thirdpartyclient', displayName: 'Prime Video', category: 'Sports', sportsContent: true },
        { packageName: 'com.fubo.android', displayName: 'FuboTV', category: 'Sports', sportsContent: true },
        { packageName: 'com.sling', displayName: 'Sling TV', category: 'Sports', sportsContent: true }
      ]

      return {
        type: 'streaming',
        device: targetDevice,
        channels: [] as any[],
        programs: sportsPrograms,
        apps: sportsApps
      }
    } else {
      // Return available sports apps but no programs
      const sportsApps = [
        { packageName: 'com.espn.score_center', displayName: 'ESPN', category: 'Sports', sportsContent: true },
        { packageName: 'com.fox.now', displayName: 'FOX Sports', category: 'Sports', sportsContent: true },
        { packageName: 'com.google.android.youtube.tv', displayName: 'YouTube TV', category: 'Sports', sportsContent: true },
        { packageName: 'com.hulu.plus', displayName: 'Hulu Live TV', category: 'Sports', sportsContent: true },
        { packageName: 'com.nba.game', displayName: 'NBA League Pass', category: 'Sports', sportsContent: true },
        { packageName: 'com.bamnetworks.mobile.android.gameday.mlb', displayName: 'MLB.TV', category: 'Sports', sportsContent: true },
        { packageName: 'com.amazon.avod.thirdpartyclient', displayName: 'Prime Video', category: 'Sports', sportsContent: true },
        { packageName: 'com.fubo.android', displayName: 'FuboTV', category: 'Sports', sportsContent: true },
        { packageName: 'com.sling', displayName: 'Sling TV', category: 'Sports', sportsContent: true }
      ]
      
      return {
        type: 'streaming',
        device: targetDevice,
        channels: [] as any[],
        programs: [] as any[],
        apps: sportsApps,
        message: 'No streaming guide data available'
      }
    }
  } catch (error) {
    console.error('Error fetching Fire TV guide data:', error)
    return {
      type: 'streaming',
      channels: [] as any[],
      programs: [] as any[],
      apps: [] as any[],
      error: error instanceof Error ? error.message : 'Failed to fetch Fire TV guide data'
    }
  }
}
