
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'


export async function GET() {
  try {
    // Get CEC configuration from database or return default
    const cecConfig = await prisma.cECConfiguration.findFirst()
    
    return NextResponse.json({
      success: true,
      config: cecConfig || {
        cecInputChannel: null,
        cecServerIP: '192.168.1.100',
        cecPort: 8080,
        isEnabled: false,
        powerOnDelay: 2000,
        powerOffDelay: 1000
      }
    })
  } catch (error) {
    console.error('Error loading CEC configuration:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to load CEC configuration' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const config = await request.json()

    // Save or update CEC configuration
    const savedConfig = await prisma.cECConfiguration.upsert({
      where: { id: config.id || 'default' },
      update: {
        cecInputChannel: config.cecInputChannel,
        cecServerIP: config.cecServerIP,
        cecPort: config.cecPort,
        isEnabled: config.isEnabled,
        powerOnDelay: config.powerOnDelay || 2000,
        powerOffDelay: config.powerOffDelay || 1000
      },
      create: {
        id: 'default',
        cecInputChannel: config.cecInputChannel,
        cecServerIP: config.cecServerIP,
        cecPort: config.cecPort,
        isEnabled: config.isEnabled,
        powerOnDelay: config.powerOnDelay || 2000,
        powerOffDelay: config.powerOffDelay || 1000
      }
    })

    return NextResponse.json({ 
      success: true, 
      config: savedConfig 
    })
  } catch (error) {
    console.error('Error saving CEC configuration:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to save CEC configuration' 
    }, { status: 500 })
  }
}
