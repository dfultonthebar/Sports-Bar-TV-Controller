
// Fire TV Devices API - CRUD operations (No Prisma, uses JSON file storage)

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'data', 'firetv-devices.json')

interface FireTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  deviceType: string
  isOnline: boolean
  adbEnabled?: boolean
  addedAt: string
  updatedAt?: string
  inputChannel?: number
  serialNumber?: string
  deviceModel?: string
  softwareVersion?: string
  lastSeen?: string
  keepAwakeEnabled?: boolean
  keepAwakeStart?: string
  keepAwakeEnd?: string
}

async function readDevices(): Promise<{ devices: FireTVDevice[] }> {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading devices file:', error)
    return { devices: [] }
  }
}

async function writeDevices(data: { devices: FireTVDevice[] }): Promise<void> {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error writing devices file:', error)
    throw error
  }
}

// GET - List all Fire TV devices
export async function GET(request: NextRequest) {
  try {
    console.log('[FIRETV API] GET request - fetching all devices')
    const data = await readDevices()
    
    console.log(`[FIRETV API] Found ${data.devices.length} devices`)
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[FIRETV API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load devices', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Add new Fire TV device
export async function POST(request: NextRequest) {
  try {
    console.log('[FIRETV API] POST request - adding new device')
    const newDevice: FireTVDevice = await request.json()
    
    const data = await readDevices()
    
    // Set timestamps
    newDevice.addedAt = new Date().toISOString()
    newDevice.updatedAt = new Date().toISOString()
    
    // Add device to list
    data.devices.push(newDevice)
    
    await writeDevices(data)
    
    console.log(`[FIRETV API] Device added successfully: ${newDevice.name} (${newDevice.id})`)
    return NextResponse.json({ success: true, device: newDevice })
  } catch (error: any) {
    console.error('[FIRETV API] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to add device', details: error.message },
      { status: 500 }
    )
  }
}

// PUT - Update existing Fire TV device
export async function PUT(request: NextRequest) {
  try {
    console.log('[FIRETV API] PUT request - updating device')
    const updatedDevice: FireTVDevice = await request.json()
    
    const data = await readDevices()
    const deviceIndex = data.devices.findIndex(d => d.id === updatedDevice.id)
    
    if (deviceIndex === -1) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      )
    }
    
    // Update timestamp
    updatedDevice.updatedAt = new Date().toISOString()
    
    // Replace device
    data.devices[deviceIndex] = updatedDevice
    
    await writeDevices(data)
    
    console.log(`[FIRETV API] Device updated successfully: ${updatedDevice.name} (${updatedDevice.id})`)
    return NextResponse.json({ success: true, device: updatedDevice })
  } catch (error: any) {
    console.error('[FIRETV API] PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update device', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Remove Fire TV device
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('id')
    
    console.log(`[FIRETV API] DELETE request - removing device: ${deviceId}`)
    
    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID required' },
        { status: 400 }
      )
    }
    
    const data = await readDevices()
    const deviceIndex = data.devices.findIndex(d => d.id === deviceId)
    
    if (deviceIndex === -1) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      )
    }
    
    const removedDevice = data.devices[deviceIndex]
    data.devices.splice(deviceIndex, 1)
    
    await writeDevices(data)
    
    console.log(`[FIRETV API] Device removed successfully: ${removedDevice.name} (${deviceId})`)
    return NextResponse.json({ success: true, message: 'Device deleted successfully' })
  } catch (error: any) {
    console.error('[FIRETV API] DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete device', details: error.message },
      { status: 500 }
    )
  }
}
