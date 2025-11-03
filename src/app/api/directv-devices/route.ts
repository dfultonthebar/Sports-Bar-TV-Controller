
import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

const DIRECTV_DEVICES_FILE = join(process.cwd(), 'data', 'directv-devices.json')

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = join(process.cwd(), 'data')
  
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true })
  }
}

async function loadDirecTVDevices() {
  try {
    await ensureDataDir()
    const data = await readFile(DIRECTV_DEVICES_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    return { devices: [] as any[] }
  }
}

async function saveDirecTVDevices(devices: any[]) {
  await ensureDataDir()
  await writeFile(DIRECTV_DEVICES_FILE, JSON.stringify({ devices }, null, 2))
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const data = await loadDirecTVDevices()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error loading DirecTV devices:', error)
    return NextResponse.json({ error: 'Failed to load DirecTV devices' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const newDevice = await request.json()
    const data = await loadDirecTVDevices()
    
    // Validate required fields
    if (!newDevice.name || !newDevice.ipAddress) {
      return NextResponse.json({ error: 'Name and IP address are required' }, { status: 400 })
    }
    
    // Add timestamp and ensure device has required fields
    const device = {
      ...newDevice,
      id: newDevice.id || `directv_${Date.now()}`,
      port: newDevice.port || 8080,
      receiverType: newDevice.receiverType || 'Genie HD DVR',
      isOnline: newDevice.isOnline || false,
      addedAt: new Date().toISOString()
    }
    
    data.devices.push(device)
    await saveDirecTVDevices(data.devices)
    
    return NextResponse.json({ message: 'DirecTV device added successfully', device })
  } catch (error) {
    console.error('Error adding DirecTV device:', error)
    return NextResponse.json({ error: 'Failed to add DirecTV device' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const updatedDevice = await request.json()
    const data = await loadDirecTVDevices()
    
    const index = data.devices.findIndex((d: any) => d.id === updatedDevice.id)
    if (index >= 0) {
      data.devices[index] = { ...data.devices[index], ...updatedDevice, updatedAt: new Date().toISOString() }
      await saveDirecTVDevices(data.devices)
      return NextResponse.json({ message: 'DirecTV device updated successfully' })
    } else {
      return NextResponse.json({ error: 'DirecTV device not found' }, { status: 404 })
    }
  } catch (error) {
    console.error('Error updating DirecTV device:', error)
    return NextResponse.json({ error: 'Failed to update DirecTV device' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('id')
    
    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID required' }, { status: 400 })
    }
    
    const data = await loadDirecTVDevices()
    const originalLength = data.devices.length
    data.devices = data.devices.filter((d: any) => d.id !== deviceId)
    
    if (data.devices.length === originalLength) {
      return NextResponse.json({ error: 'DirecTV device not found' }, { status: 404 })
    }
    
    await saveDirecTVDevices(data.devices)
    return NextResponse.json({ message: 'DirecTV device deleted successfully' })
  } catch (error) {
    console.error('Error deleting DirecTV device:', error)
    return NextResponse.json({ error: 'Failed to delete DirecTV device' }, { status: 500 })
  }
}
