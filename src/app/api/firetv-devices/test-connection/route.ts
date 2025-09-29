

import { NextRequest, NextResponse } from 'next/server'

async function testFireTVConnection(ip: string, port: number): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    console.log(`Testing Fire TV connection to ${ip}:${port}`)
    
    // Method 1: Try ADB bridge service
    try {
      const adbBridgeUrl = `http://localhost:8081/adb/test-connection`
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)
      
      const response = await fetch(adbBridgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target: `${ip}:${port}`,
          timeout: 5000
        }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const result = await response.json()
        return {
          success: result.connected,
          message: result.connected ? 'Fire TV device connected via ADB' : 'Fire TV device not responding',
          data: {
            method: 'ADB Bridge',
            ip,
            port,
            response: result,
            adbEnabled: result.adbEnabled,
            deviceInfo: result.deviceInfo
          }
        }
      }
    } catch (bridgeError) {
      console.log('ADB bridge unavailable, trying direct connection test')
    }
    
    // Method 2: Basic network connectivity test
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    try {
      // Test if port is open using a simple HTTP request
      // Fire TV devices respond to HTTP requests on port 5555 with connection info
      const testUrl = `http://${ip}:${port}/`
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Sports-Bar-Controller/1.0'
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      // Even if we get an error response, it means the port is open
      return {
        success: true,
        message: 'Fire TV device is reachable',
        data: {
          method: 'Network Test',
          ip,
          port,
          status: response.status,
          reachable: true,
          note: 'Device detected but ADB status unknown. Enable ADB debugging for full control.'
        }
      }
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          message: 'Connection test timed out',
          data: {
            method: 'Network Test',
            ip,
            port,
            error: 'timeout',
            suggestions: [
              'Check if the Fire TV device is powered on',
              'Verify the IP address is correct',
              'Ensure the device is connected to the same network',
              'Check if ADB debugging is enabled in Developer Options'
            ]
          }
        }
      }
      
      throw error
    }
    
  } catch (error) {
    console.error('Fire TV connection test error:', error)
    
    let errorMessage = 'Connection failed'
    let suggestions = []
    
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
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
      } else if (error.message.includes('ETIMEDOUT')) {
        errorMessage = 'Connection timed out'
        suggestions = [
          'Device may be offline or sleeping',
          'Try waking the device with the remote',
          'Check network connectivity'
        ]
      } else {
        errorMessage = error.message
        suggestions = [
          'Check device power and network status',
          'Verify ADB debugging is enabled',
          'Ensure correct IP address and port'
        ]
      }
    }
    
    return {
      success: false,
      message: errorMessage,
      data: {
        method: 'Error',
        ip,
        port,
        error: errorMessage,
        suggestions
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

