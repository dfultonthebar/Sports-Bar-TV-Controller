
import { NextRequest, NextResponse } from 'next/server'

interface DirecTVInfo {
  model?: string
  version?: string
  serialNumber?: string
  clientAddress?: string
}

async function testDirecTVConnection(ip: string, port: number): Promise<{ connected: boolean; deviceInfo?: DirecTVInfo; error?: string }> {
  try {
    // First, try to get device info
    const infoUrl = `http://${ip}:${port}/info/getOptions`
    
    console.log(`Testing DirecTV connection: ${infoUrl}`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout
    
    try {
      const infoResponse = await fetch(infoUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Sports-Bar-Controller/1.0'
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (infoResponse.ok) {
        const infoText = await infoResponse.text()
        console.log('DirecTV info response:', infoText)
        
        // Parse device info from response
        const deviceInfo: DirecTVInfo = {}
        
        // Try to extract useful information from the response
        if (infoText.includes('model')) {
          const modelMatch = infoText.match(/model["\s]*[:=]\s*["']?([^"',\s]+)/i)
          if (modelMatch) deviceInfo.model = modelMatch[1]
        }
        
        if (infoText.includes('version')) {
          const versionMatch = infoText.match(/version["\s]*[:=]\s*["']?([^"',\s]+)/i)
          if (versionMatch) deviceInfo.version = versionMatch[1]
        }
        
        return { connected: true, deviceInfo }
      }
    } catch (error) {
      console.log('Info request failed, trying basic connectivity test')
    }
    
    // If info request fails, try a simple key command to test connectivity
    const testUrl = `http://${ip}:${port}/remote/processKey?key=KEY_INFO&hold=keyPress`
    
    const controller2 = new AbortController()
    const timeoutId2 = setTimeout(() => controller2.abort(), 5000) // 5 second timeout
    
    const testResponse = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Sports-Bar-Controller/1.0'
      },
      signal: controller2.signal
    })
    
    clearTimeout(timeoutId2)
    
    console.log(`DirecTV test response: ${testResponse.status}`)
    
    if (testResponse.ok || testResponse.status === 200) {
      return { connected: true, deviceInfo: { model: 'DirecTV Receiver' } }
    } else {
      return { 
        connected: false, 
        error: `HTTP ${testResponse.status}: ${testResponse.statusText}` 
      }
    }
    
  } catch (error) {
    console.error('DirecTV connection test error:', error)
    
    let errorMessage = 'Unknown error'
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out - device may be offline'
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Connection refused - check IP address and ensure device is online'
      } else if (error.message.includes('ENETUNREACH')) {
        errorMessage = 'Network unreachable - check network connectivity'
      } else if (error.message.includes('ETIMEDOUT')) {
        errorMessage = 'Connection timed out - device may be offline'
      } else {
        errorMessage = error.message
      }
    }
    
    return { connected: false, error: errorMessage }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ipAddress, port } = await request.json()

    if (!ipAddress) {
      return NextResponse.json(
        { error: 'IP address is required' },
        { status: 400 }
      )
    }

    const targetPort = port || 8080
    
    console.log(`Testing DirecTV connection to ${ipAddress}:${targetPort}`)
    
    const result = await testDirecTVConnection(ipAddress, targetPort)
    
    if (result.connected) {
      return NextResponse.json({
        connected: true,
        message: 'DirecTV device is online and responding',
        deviceInfo: result.deviceInfo,
        testedAt: new Date().toISOString()
      })
    } else {
      return NextResponse.json(
        {
          connected: false,
          message: 'DirecTV device is not responding',
          error: result.error,
          testedAt: new Date().toISOString()
        },
        { status: 200 } // Still return 200 so frontend can handle the disconnected state
      )
    }

  } catch (error) {
    console.error('DirecTV Connection Test API Error:', error)
    return NextResponse.json(
      { 
        connected: false,
        error: error instanceof Error ? error.message : 'Failed to test DirecTV connection',
        testedAt: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
