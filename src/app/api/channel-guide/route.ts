

import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

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
        channels: [],
        programs: sportsPrograms
      }
    } else {
      // Return sample cable guide data if Spectrum API is not available
      return generateSampleCableGuide(inputNumber, startTime, endTime)
    }
  } catch (error) {
    console.error('Error fetching cable guide data:', error)
    return generateSampleCableGuide(inputNumber, startTime, endTime)
  }
}

// DirecTV satellite guide data
async function getSatelliteGuideData(inputNumber: number, deviceId: string | undefined, startTime: string, endTime: string) {
  try {
    // First, get DirecTV devices to find the device for this input
    const deviceResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/directv-devices`)
    const deviceData = await deviceResponse.json()
    
    let targetDevice = null
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
        channels: [],
        programs
      }
    } else {
      return generateSampleSatelliteGuide(inputNumber, startTime, endTime, targetDevice)
    }
  } catch (error) {
    console.error('Error fetching DirecTV guide data:', error)
    return generateSampleSatelliteGuide(inputNumber, startTime, endTime)
  }
}

// Fire TV streaming guide data
async function getStreamingGuideData(inputNumber: number, deviceId: string | undefined, startTime: string, endTime: string) {
  try {
    // Get Fire TV devices
    const deviceResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/firetv-devices`)
    const deviceData = await deviceResponse.json()
    
    let targetDevice = null
    if (deviceId) {
      targetDevice = deviceData.devices?.find((d: any) => d.id === deviceId)
    } else {
      // Find device by input channel
      targetDevice = deviceData.devices?.find((d: any) => d.inputChannel === inputNumber)
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
        channels: [],
        programs: sportsPrograms,
        apps: sportsApps
      }
    } else {
      return generateSampleStreamingGuide(inputNumber, startTime, endTime, targetDevice)
    }
  } catch (error) {
    console.error('Error fetching Fire TV guide data:', error)
    return generateSampleStreamingGuide(inputNumber, startTime, endTime)
  }
}

// Generate sample cable guide data
function generateSampleCableGuide(inputNumber: number, startTime: string, endTime: string) {
  const now = new Date()
  const samplePrograms = [
    {
      id: `cable-${inputNumber}-1`,
      league: 'NFL',
      homeTeam: 'Green Bay Packers',
      awayTeam: 'Chicago Bears',
      gameTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toLocaleTimeString(),
      startTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString(),
      channel: {
        id: 'espn',
        name: 'ESPN',
        number: '206',
        type: 'cable' as const,
        cost: 'subscription' as const,
        platforms: ['Spectrum'],
        channelNumber: '206'
      },
      description: 'NFL Sunday Night Football',
      isSports: true,
      isLive: false
    },
    {
      id: `cable-${inputNumber}-2`,
      league: 'NBA',
      homeTeam: 'Milwaukee Bucks',
      awayTeam: 'Boston Celtics',
      gameTime: new Date(now.getTime() + 4 * 60 * 60 * 1000).toLocaleTimeString(),
      startTime: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 6.5 * 60 * 60 * 1000).toISOString(),
      channel: {
        id: 'tnt',
        name: 'TNT',
        number: '245',
        type: 'cable' as const,
        cost: 'subscription' as const,
        platforms: ['Spectrum'],
        channelNumber: '245'
      },
      description: 'NBA Regular Season Game',
      isSports: true,
      isLive: false
    }
  ]

  return {
    type: 'cable',
    channels: [],
    programs: samplePrograms
  }
}

// Generate sample satellite guide data
function generateSampleSatelliteGuide(inputNumber: number, startTime: string, endTime: string, device?: any) {
  const now = new Date()
  const samplePrograms = [
    {
      id: `satellite-${inputNumber}-1`,
      league: 'NFL',
      homeTeam: 'Dallas Cowboys',
      awayTeam: 'New York Giants',
      gameTime: new Date(now.getTime() + 1 * 60 * 60 * 1000).toLocaleTimeString(),
      startTime: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      channel: {
        id: 'fox-sports',
        name: 'FOX Sports',
        number: '219',
        type: 'satellite' as const,
        cost: 'subscription' as const,
        platforms: ['DirecTV'],
        channelNumber: '219'
      },
      description: 'NFL Sunday Game',
      isSports: true,
      isLive: false
    }
  ]

  return {
    type: 'satellite',
    device,
    channels: [],
    programs: samplePrograms
  }
}

// Generate sample streaming guide data
function generateSampleStreamingGuide(inputNumber: number, startTime: string, endTime: string, device?: any) {
  const now = new Date()
  const samplePrograms = [
    {
      id: `streaming-${inputNumber}-1`,
      league: 'Prime Video',
      homeTeam: '',
      awayTeam: '',
      gameTime: new Date(now.getTime() + 1 * 60 * 60 * 1000).toLocaleTimeString(),
      startTime: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      channel: {
        id: 'prime-video',
        name: 'Prime Video',
        type: 'streaming' as const,
        cost: 'subscription' as const,
        platforms: ['Prime Video'],
        packageName: 'com.amazon.avod.thirdpartyclient',
        appCommand: 'monkey -p com.amazon.avod.thirdpartyclient 1'
      },
      description: 'Thursday Night Football',
      isSports: true,
      isLive: false
    },
    {
      id: `streaming-${inputNumber}-2`,
      league: 'ESPN+',
      homeTeam: '',
      awayTeam: '',
      gameTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toLocaleTimeString(),
      startTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      channel: {
        id: 'espn-plus',
        name: 'ESPN',
        type: 'streaming' as const,
        cost: 'subscription' as const,
        platforms: ['ESPN'],
        packageName: 'com.espn.score_center',
        appCommand: 'monkey -p com.espn.score_center 1'
      },
      description: 'UFC Fight Night',
      isSports: true,
      isLive: false
    }
  ]

  const sportsApps = [
    { packageName: 'com.espn.score_center', displayName: 'ESPN', category: 'Sports', sportsContent: true },
    { packageName: 'com.fox.now', displayName: 'FOX Sports', category: 'Sports', sportsContent: true },
    { packageName: 'com.google.android.youtube.tv', displayName: 'YouTube TV', category: 'Sports', sportsContent: true },
    { packageName: 'com.hulu.plus', displayName: 'Hulu Live TV', category: 'Sports', sportsContent: true },
    { packageName: 'com.amazon.avod.thirdpartyclient', displayName: 'Prime Video', category: 'Sports', sportsContent: true }
  ]

  return {
    type: 'streaming',
    device,
    channels: [],
    programs: samplePrograms,
    apps: sportsApps
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Channel Guide API',
    description: 'Provides device-specific channel guide data for bartender remote',
    endpoints: {
      'POST /api/channel-guide': 'Get channel guide data for specific device type and input',
    },
    supportedDeviceTypes: ['cable', 'satellite', 'streaming'],
    requiredParams: {
      inputNumber: 'number - Matrix input number',
      deviceType: 'string - Device type (cable, satellite, streaming)',
      deviceId: 'string - Optional device ID',
      startTime: 'string - Optional ISO start time',
      endTime: 'string - Optional ISO end time'
    }
  })
}
