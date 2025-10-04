
import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { pollRealDirecTVSubscriptions, pollRealFireTVSubscriptions, Subscription as RealSubscription } from '@/lib/real-device-subscriptions'
import { cacheService, CacheKeys, CacheTTL } from '@/lib/cache-service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const SUBSCRIPTIONS_FILE = join(process.cwd(), 'data', 'device-subscriptions.json')

// Use the same Subscription interface from real-device-subscriptions
type Subscription = RealSubscription

interface DeviceSubscription {
  deviceId: string
  deviceType: 'firetv' | 'directv'
  deviceName: string
  subscriptions: Subscription[]
  lastPolled: string
  pollStatus: 'success' | 'error' | 'pending'
  error?: string
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
    return { devices: [] as any[] }
  }
}

/**
 * Real device subscription polling - no mock data
 * Connects to actual devices to detect installed apps and packages
 */

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
      // Check cache first (unless forced)
      const cacheKey = CacheKeys.deviceSubscriptions(deviceId)
      let subscriptions: Subscription[] = []
      
      if (!force) {
        const cached = cacheService.get<Subscription[]>(cacheKey)
        if (cached) {
          return NextResponse.json({
            success: true,
            message: 'Subscriptions from cache',
            subscriptions: cached,
            cached: true,
            lastPolled: existingEntry?.lastPolled
          })
        }
      }
      
      // Poll subscriptions based on device type (REAL DATA)
      if (deviceType === 'directv') {
        subscriptions = await pollRealDirecTVSubscriptions(device)
      } else if (deviceType === 'firetv') {
        subscriptions = await pollRealFireTVSubscriptions(device)
      } else {
        throw new Error(`Unsupported device type: ${deviceType}`)
      }
      
      // Cache the results for 1 hour
      cacheService.set(cacheKey, subscriptions, CacheTTL.HOUR)

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
