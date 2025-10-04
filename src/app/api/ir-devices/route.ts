
import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const IR_DEVICES_FILE = join(process.cwd(), 'data', 'ir-devices.json')

// Ensure data directory exists
async function ensureDataDir() {
  const { mkdir } = await import('fs/promises')
  const { existsSync } = await import('fs')
  const dataDir = join(process.cwd(), 'data')
  
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true })
  }
}

async function loadDevices() {
  try {
    await ensureDataDir()
    const data = await readFile(IR_DEVICES_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    return { devices: [] as any[] }
  }
}

async function saveDevices(devices: any[]) {
  await ensureDataDir()
  await writeFile(IR_DEVICES_FILE, JSON.stringify({ devices }, null, 2))
}

export async function GET() {
  try {
    const data = await loadDevices()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error loading devices:', error)
    return NextResponse.json({ error: 'Failed to load devices' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const newDevice = await request.json()
    const data = await loadDevices()
    
    data.devices.push(newDevice)
    await saveDevices(data.devices)
    
    return NextResponse.json({ message: 'Device added successfully', device: newDevice })
  } catch (error) {
    console.error('Error adding device:', error)
    return NextResponse.json({ error: 'Failed to add device' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const updatedDevice = await request.json()
    const data = await loadDevices()
    
    const index = data.devices.findIndex((d: any) => d.id === updatedDevice.id)
    if (index >= 0) {
      data.devices[index] = updatedDevice
      await saveDevices(data.devices)
      return NextResponse.json({ message: 'Device updated successfully' })
    } else {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }
  } catch (error) {
    console.error('Error updating device:', error)
    return NextResponse.json({ error: 'Failed to update device' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('id')
    
    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID required' }, { status: 400 })
    }
    
    const data = await loadDevices()
    data.devices = data.devices.filter((d: any) => d.id !== deviceId)
    await saveDevices(data.devices)
    
    return NextResponse.json({ message: 'Device deleted successfully' })
  } catch (error) {
    console.error('Error deleting device:', error)
    return NextResponse.json({ error: 'Failed to delete device' }, { status: 500 })
  }
}
