

import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const FIRETV_DEVICES_FILE = join(process.cwd(), 'data', 'firetv-devices.json')

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = join(process.cwd(), 'data')
  
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true })
  }
}

async function loadFireTVDevices() {
  try {
    await ensureDataDir()
    const data = await readFile(FIRETV_DEVICES_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    return { devices: [] }
  }
}

async function saveFireTVDevices(devices: any[]) {
  await ensureDataDir()
  await writeFile(FIRETV_DEVICES_FILE, JSON.stringify({ devices }, null, 2))
}

export async function GET() {
  try {
    const data = await loadFireTVDevices()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error loading Fire TV devices:', error)
    return NextResponse.json({ error: 'Failed to load Fire TV devices' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const newDevice = await request.json()
    const data = await loadFireTVDevices()
    
    // Validate required fields
    if (!newDevice.name || !newDevice.ipAddress) {
      return NextResponse.json({ error: 'Name and IP address are required' }, { status: 400 })
    }
    
    // Validate IP address format
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/
    if (!ipRegex.test(newDevice.ipAddress)) {
      return NextResponse.json({ error: 'Invalid IP address format' }, { status: 400 })
    }
    
    // Add timestamp and ensure device has required fields
    const device = {
      ...newDevice,
      id: newDevice.id || `firetv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      port: newDevice.port || 5555, // Default ADB port for Fire TV
      deviceType: newDevice.deviceType || 'Fire TV Cube',
      isOnline: newDevice.isOnline || false,
      adbEnabled: newDevice.adbEnabled || false,
      addedAt: new Date().toISOString()
    }
    
    // Check for duplicate IP addresses
    const existingDevice = data.devices.find((d: any) => d.ipAddress === device.ipAddress && d.port === device.port)
    if (existingDevice) {
      return NextResponse.json({ error: 'Device with this IP address and port already exists' }, { status: 409 })
    }
    
    data.devices.push(device)
    await saveFireTVDevices(data.devices)
    
    return NextResponse.json({ message: 'Fire TV device added successfully', device })
  } catch (error) {
    console.error('Error adding Fire TV device:', error)
    return NextResponse.json({ error: 'Failed to add Fire TV device' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const updatedDevice = await request.json()
    const data = await loadFireTVDevices()
    
    const index = data.devices.findIndex((d: any) => d.id === updatedDevice.id)
    if (index >= 0) {
      // Preserve original creation timestamp
      const originalDevice = data.devices[index]
      data.devices[index] = { 
        ...originalDevice, 
        ...updatedDevice, 
        addedAt: originalDevice.addedAt,
        updatedAt: new Date().toISOString() 
      }
      
      await saveFireTVDevices(data.devices)
      return NextResponse.json({ message: 'Fire TV device updated successfully', device: data.devices[index] })
    } else {
      return NextResponse.json({ error: 'Fire TV device not found' }, { status: 404 })
    }
  } catch (error) {
    console.error('Error updating Fire TV device:', error)
    return NextResponse.json({ error: 'Failed to update Fire TV device' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('id')
    
    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID required' }, { status: 400 })
    }
    
    const data = await loadFireTVDevices()
    const originalLength = data.devices.length
    const deviceToDelete = data.devices.find((d: any) => d.id === deviceId)
    
    if (!deviceToDelete) {
      return NextResponse.json({ error: 'Fire TV device not found' }, { status: 404 })
    }
    
    data.devices = data.devices.filter((d: any) => d.id !== deviceId)
    
    await saveFireTVDevices(data.devices)
    return NextResponse.json({ 
      message: 'Fire TV device deleted successfully', 
      deletedDevice: { name: deviceToDelete.name, ipAddress: deviceToDelete.ipAddress }
    })
  } catch (error) {
    console.error('Error deleting Fire TV device:', error)
    return NextResponse.json({ error: 'Failed to delete Fire TV device' }, { status: 500 })
  }
}

