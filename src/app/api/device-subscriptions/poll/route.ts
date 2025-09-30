
import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const SUBSCRIPTIONS_FILE = join(process.cwd(), 'data', 'device-subscriptions.json')

interface DeviceSubscription {
  deviceId: string
  deviceType: 'firetv' | 'directv'
  deviceName: string
  subscriptions: Subscription[]
  lastPolled: string
  pollStatus: 'success' | 'error' | 'pending'
  error?: string
}

interface Subscription {
  id: string
  name: string
  type: 'streaming' | 'premium' | 'sports' | 'addon'
  status: 'active' | 'inactive' | 'expired'
  provider?: string
  packageName?: string
  subscriptionDate?: string
  expirationDate?: string
  cost?: number
  description?: string
  logoUrl?: string
}

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = join(process.cwd(), 'data')
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true })
  }
}

async function loadSubscriptionsData() {
  try {
    await ensureDataDir()
    const data = await readFile(SUBSCRIPTIONS_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    return { devices: [] as DeviceSubscription[] }
  }
}

async function saveSubscriptionsData(data: { devices: DeviceSubscription[] }) {
  await ensureDataDir()
  await writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(data, null, 2))
}

async function loadDeviceList(type: 'firetv' | 'directv') {
  const fileName = type === 'firetv' ? 'firetv-devices.json' : 'directv-devices.json'
  const filePath = join(process.cwd(), 'data', fileName)
  try {
    const data = await readFile(filePath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    return { devices: [] }
  }
}

// Mock DirecTV subscription polling
async function pollDirecTVSubscriptions(device: any): Promise<Subscription[]> {
  // Simulate API call to DirecTV receiver
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Mock subscription data based on common DirecTV packages
  const mockSubscriptions: Subscription[] = [
    {
      id: 'directv-choice',
      name: 'DIRECTV CHOICE™',
      type: 'premium',
      status: 'active',
      provider: 'DIRECTV',
      packageName: 'CHOICE',
      cost: 84.99,
      description: '105+ channels including ESPN, Fox Sports 1, and regional sports networks',
      logoUrl: '/images/directv-logo.png'
    },
    {
      id: 'sports-pack',
      name: 'Sports Pack',
      type: 'sports',
      status: 'active',
      provider: 'DIRECTV',
      packageName: 'SPORTS',
      cost: 14.99,
      description: 'NFL RedZone, NBA TV, NHL Network, and more sports channels',
      logoUrl: '/images/sports-pack-logo.png'
    },
    {
      id: 'nfl-sunday-ticket',
      name: 'NFL Sunday Ticket',
      type: 'sports',
      status: 'active',
      provider: 'DIRECTV',
      packageName: 'NFL_ST',
      subscriptionDate: '2024-09-01',
      expirationDate: '2025-02-28',
      cost: 293.94,
      description: 'Every out-of-market NFL game, every Sunday',
      logoUrl: '/images/nfl-sunday-ticket-logo.png'
    },
    {
      id: 'regional-sports',
      name: 'Regional Sports Networks',
      type: 'sports',
      status: 'active',
      provider: 'DIRECTV',
      packageName: 'RSN',
      description: 'Local team coverage and regional sports programming',
      logoUrl: '/images/rsn-logo.png'
    }
  ]
  
  return mockSubscriptions
}

// Mock Fire TV subscription polling
async function pollFireTVSubscriptions(device: any): Promise<Subscription[]> {
  // Simulate ADB commands to get installed apps
  await new Promise(resolve => setTimeout(resolve, 800))
  
  // Mock installed streaming apps with subscription status
  const mockSubscriptions: Subscription[] = [
    {
      id: 'prime-video',
      name: 'Amazon Prime Video',
      type: 'streaming',
      status: 'active',
      provider: 'Amazon',
      packageName: 'com.amazon.avod.thirdpartyclient',
      description: 'Included with Amazon Prime membership',
      logoUrl: '/images/prime-video-logo.png'
    },
    {
      id: 'netflix',
      name: 'Netflix',
      type: 'streaming',
      status: 'active',
      provider: 'Netflix',
      packageName: 'com.netflix.ninja',
      cost: 15.49,
      description: 'Standard plan with HD streaming',
      logoUrl: '/images/netflix-logo.png'
    },
    {
      id: 'hulu-live',
      name: 'Hulu + Live TV',
      type: 'streaming',
      status: 'active',
      provider: 'Hulu',
      packageName: 'com.hulu.plus',
      cost: 69.99,
      description: 'Live TV + streaming library with ESPN and sports channels',
      logoUrl: '/images/hulu-logo.png'
    },
    {
      id: 'espn-plus',
      name: 'ESPN+',
      type: 'sports',
      status: 'active',
      provider: 'Disney',
      packageName: 'com.espn.score_center',
      cost: 10.99,
      description: 'Exclusive UFC, college sports, and original content',
      logoUrl: '/images/espn-plus-logo.png'
    },
    {
      id: 'paramount-plus',
      name: 'Paramount+',
      type: 'streaming',
      status: 'active',
      provider: 'Paramount',
      packageName: 'com.cbs.app',
      cost: 11.99,
      description: 'CBS Sports, live NFL games, and exclusive content',
      logoUrl: '/images/paramount-plus-logo.png'
    },
    {
      id: 'disney-plus',
      name: 'Disney+',
      type: 'streaming',
      status: 'active',
      provider: 'Disney',
      packageName: 'com.disney.disneyplus',
      cost: 13.99,
      description: 'Disney, Marvel, Star Wars, and National Geographic content',
      logoUrl: '/images/disney-plus-logo.png'
    },
    {
      id: 'youtube-tv',
      name: 'YouTube TV',
      type: 'streaming',
      status: 'inactive',
      provider: 'Google',
      packageName: 'com.google.android.youtube.tv',
      cost: 72.99,
      description: 'Live TV with sports channels and unlimited DVR',
      logoUrl: '/images/youtube-tv-logo.png'
    }
  ]
  
  return mockSubscriptions
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceId, deviceType, force = false } = body

    // Load current subscriptions
    const subscriptionsData = await loadSubscriptionsData()
    
    // Load device information
    const deviceData = await loadDeviceList(deviceType)
    const device = deviceData.devices.find((d: any) => d.id === deviceId)
    
    if (!device) {
      return NextResponse.json({ 
        success: false, 
        error: 'Device not found' 
      }, { status: 404 })
    }

    // Check if we should skip polling (if not forced and recently polled)
    const existingEntry = subscriptionsData.devices.find((d: DeviceSubscription) => d.deviceId === deviceId)
    const lastPolled = existingEntry ? new Date(existingEntry.lastPolled) : new Date(0)
    const now = new Date()
    const hoursSinceLastPoll = (now.getTime() - lastPolled.getTime()) / (1000 * 60 * 60)
    
    if (!force && hoursSinceLastPoll < 1) {
      return NextResponse.json({
        success: true,
        message: 'Subscriptions recently polled, use force=true to refresh',
        subscriptions: existingEntry?.subscriptions || [],
        lastPolled: existingEntry?.lastPolled
      })
    }

    // Mark as pending
    const updatedEntry: DeviceSubscription = {
      deviceId,
      deviceType,
      deviceName: device.name,
      subscriptions: existingEntry?.subscriptions || [],
      lastPolled: now.toISOString(),
      pollStatus: 'pending'
    }

    // Update or add entry
    const entryIndex = subscriptionsData.devices.findIndex(d => d.deviceId === deviceId)
    if (entryIndex >= 0) {
      subscriptionsData.devices[entryIndex] = updatedEntry
    } else {
      subscriptionsData.devices.push(updatedEntry)
    }
    await saveSubscriptionsData(subscriptionsData)

    try {
      // Poll subscriptions based on device type
      let subscriptions: Subscription[] = []
      
      if (deviceType === 'directv') {
        subscriptions = await pollDirecTVSubscriptions(device)
      } else if (deviceType === 'firetv') {
        subscriptions = await pollFireTVSubscriptions(device)
      }

      // Update with results
      updatedEntry.subscriptions = subscriptions
      updatedEntry.pollStatus = 'success'
      updatedEntry.lastPolled = new Date().toISOString()
      delete updatedEntry.error

      // Save updated data
      const finalIndex = subscriptionsData.devices.findIndex(d => d.deviceId === deviceId)
      subscriptionsData.devices[finalIndex] = updatedEntry
      await saveSubscriptionsData(subscriptionsData)

      return NextResponse.json({
        success: true,
        message: 'Subscriptions polled successfully',
        subscriptions,
        lastPolled: updatedEntry.lastPolled
      })

    } catch (pollError) {
      // Update with error
      updatedEntry.pollStatus = 'error'
      updatedEntry.error = pollError instanceof Error ? pollError.message : 'Unknown polling error'
      
      const errorIndex = subscriptionsData.devices.findIndex(d => d.deviceId === deviceId)
      subscriptionsData.devices[errorIndex] = updatedEntry
      await saveSubscriptionsData(subscriptionsData)

      return NextResponse.json({
        success: false,
        error: 'Failed to poll device subscriptions',
        details: updatedEntry.error
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error polling device subscriptions:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
