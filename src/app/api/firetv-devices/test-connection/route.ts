
import { NextRequest, NextResponse } from 'next/server'
import { ADBClient } from '@/lib/firecube/adb-client'

async function testFireTVConnection(ip: string, port: number): Promise<{ success: boolean; message: string; data?: any }> {
  const timestamp = new Date().toISOString()
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`🔍 [FIRE CUBE] Testing connection`)
  console.log(`   IP: ${ip}`)
  console.log(`   Port: ${port}`)
  console.log(`   Timestamp: ${timestamp}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  try {
    // Create ADB client instance
    const adbClient = new ADBClient(ip, port)
    
    console.log(`[FIRE CUBE] Attempting ADB connection to ${ip}:${port}...`)
    
    // Test connection using ADB client
    const connected = await adbClient.testConnection()
    
    if (connected) {
      console.log(`[FIRE CUBE] ✅ Connection successful!`)
      
      // Get device information
      let deviceInfo: any = {}
      try {
        const model = await adbClient.getModel()
        const serialNumber = await adbClient.getSerialNumber()
        const softwareVersion = await adbClient.getSoftwareVersion()
        
        deviceInfo = {
          model: model || 'Unknown',
          serialNumber: serialNumber || 'Unknown',
          softwareVersion: softwareVersion || 'Unknown'
        }
        
        console.log(`[FIRE CUBE] Device Info:`, deviceInfo)
      } catch (infoError) {
        console.log(`[FIRE CUBE] ⚠️ Could not retrieve device info:`, infoError)
      }
      
      return {
        success: true,
        message: 'Fire TV device connected successfully via ADB',
        data: {
          method: 'Direct ADB',
          ip,
          port,
          connected: true,
          adbEnabled: true,
          deviceInfo,
          testedAt: timestamp
        }
      }
    } else {
      console.log(`[FIRE CUBE] ❌ Connection failed - device not responding`)
      
      return {
        success: false,
        message: 'Fire TV device not responding to ADB commands',
        data: {
          method: 'Direct ADB',
          ip,
          port,
          connected: false,
          error: 'Device not responding',
          suggestions: [
            'Ensure ADB debugging is enabled on the Fire TV device',
            'Go to Settings → My Fire TV → Developer Options → ADB Debugging → ON',
            'Make sure the Fire TV is powered on and connected to the network',
            'Verify the IP address is correct',
            'Try restarting the Fire TV device'
          ],
          testedAt: timestamp
        }
      }
    }
  } catch (error) {
    console.error(`[FIRE CUBE] ❌ Connection test error:`, error)
    
    let errorMessage = 'Connection failed'
    let suggestions: string[] = []
    
    if (error instanceof Error) {
      errorMessage = error.message
      
      if (error.message.includes('adb') && error.message.includes('not found')) {
        errorMessage = 'ADB command-line tool not installed on server'
        suggestions = [
          'Install ADB on the server: sudo apt-get install adb',
          'Verify ADB installation: adb version',
          'Restart the application after installing ADB'
        ]
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Connection refused - ADB may be disabled'
        suggestions = [
          'Enable Developer Options on Fire TV: Settings → My Fire TV → About',
          'Enable ADB Debugging: Developer Options → ADB Debugging → ON',
          'Restart the Fire TV device after enabling ADB'
        ]
      } else if (error.message.includes('ENETUNREACH')) {
        errorMessage = 'Network unreachable - check network connectivity'
        suggestions = [
          'Ensure Fire TV and controller are on the same network',
          'Check network firewall settings',
          'Verify the IP address is correct'
        ]
      } else if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
        errorMessage = 'Connection timed out'
        suggestions = [
          'Device may be offline or sleeping',
          'Try waking the device with the remote',
          'Check network connectivity',
          'Verify ADB debugging is enabled'
        ]
      } else {
        suggestions = [
          'Check device power and network status',
          'Verify ADB debugging is enabled',
          'Ensure correct IP address and port',
          'Check server logs for detailed error information'
        ]
      }
    }
    
    return {
      success: false,
      message: errorMessage,
      data: {
        method: 'Direct ADB',
        ip,
        port,
        error: errorMessage,
        suggestions,
        testedAt: timestamp
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ipAddress, port, deviceId } = await request.json()
    
    if (!ipAddress) {
      return NextResponse.json(
        { error: 'IP address is required' },
        { status: 400 }
      )
    }
    
    const targetPort = port || 5555
    const result = await testFireTVConnection(ipAddress, targetPort)
    
    return NextResponse.json({
      ...result,
      deviceId: deviceId || null,
      testedAt: new Date().toISOString(),
      target: `${ipAddress}:${targetPort}`
    })
    
  } catch (error) {
    console.error('Fire TV Connection Test API Error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to test Fire TV connection',
        success: false 
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ipAddress = searchParams.get('ip')
    const port = searchParams.get('port')
    const deviceId = searchParams.get('deviceId')
    
    if (!ipAddress) {
      return NextResponse.json(
        { error: 'IP address is required' },
        { status: 400 }
      )
    }
    
    const targetPort = port ? parseInt(port) : 5555
    const result = await testFireTVConnection(ipAddress, targetPort)
    
    return NextResponse.json({
      ...result,
      deviceId: deviceId || null,
      testedAt: new Date().toISOString(),
      target: `${ipAddress}:${targetPort}`
    })
    
  } catch (error) {
    console.error('Fire TV Connection Test API Error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to test Fire TV connection',
        success: false 
      },
      { status: 500 }
    )
  }
}

