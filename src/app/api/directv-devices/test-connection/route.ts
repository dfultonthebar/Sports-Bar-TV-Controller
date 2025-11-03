
import { NextRequest, NextResponse } from 'next/server'
import { direcTVLogger, DirecTVOperation, LogLevel, withTiming } from '@/lib/directv-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

interface DirecTVInfo {
  model?: string
  version?: string
  serialNumber?: string
  clientAddress?: string
}

async function testDirecTVConnection(ip: string, port: number, deviceId?: string, deviceName?: string): Promise<{ connected: boolean; deviceInfo?: DirecTVInfo; error?: string }> {
  const logDeviceId = deviceId || 'test-device'
  const logDeviceName = deviceName || 'Test Device'

  await direcTVLogger.log({
    level: LogLevel.INFO,
    operation: DirecTVOperation.CONNECTION_TEST,
    deviceId: logDeviceId,
    deviceName: logDeviceName,
    ipAddress: ip,
    port,
    message: `Initiating connection test for ${logDeviceName}`,
    details: {
      testType: 'multi-endpoint',
      endpoints: [
        `/info/getOptions`,
        `/remote/processKey`
      ]
    }
  })

  try {
    // First, try to get device info
    const infoUrl = `http://${ip}:${port}/info/getOptions`
    
    await direcTVLogger.log({
      level: LogLevel.DEBUG,
      operation: DirecTVOperation.CONNECTION_TEST,
      deviceId: logDeviceId,
      deviceName: logDeviceName,
      ipAddress: ip,
      port,
      message: `Attempting primary connection test via getOptions endpoint`,
      request: {
        url: infoUrl,
        method: 'GET',
        timeout: 8000
      }
    })
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout
    
    try {
      const { result: infoResponse, duration: infoDuration } = await withTiming(async () => {
        return await fetch(infoUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Sports-Bar-Controller/1.0'
          },
          signal: controller.signal
        })
      })
      
      clearTimeout(timeoutId)
      
      await direcTVLogger.logApiRequest(
        DirecTVOperation.CONNECTION_TEST,
        logDeviceName,
        ip,
        port,
        infoUrl,
        'GET',
        infoResponse.ok,
        infoResponse.status,
        undefined,
        infoDuration
      )
      
      if (infoResponse.ok) {
        const infoText = await infoResponse.text()
        
        await direcTVLogger.log({
          level: LogLevel.INFO,
          operation: DirecTVOperation.CONNECTION_TEST,
          deviceId: logDeviceId,
          deviceName: logDeviceName,
          ipAddress: ip,
          port,
          message: `Connection test SUCCESSFUL via getOptions endpoint (${infoDuration}ms)`,
          response: {
            status: infoResponse.status,
            statusText: infoResponse.statusText,
            body: infoText.substring(0, 200) + (infoText.length > 200 ? '...' : ''),
            duration: infoDuration
          }
        })
        
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
        
        await direcTVLogger.log({
          level: LogLevel.DEBUG,
          operation: DirecTVOperation.CONNECTION_TEST,
          deviceId: logDeviceId,
          deviceName: logDeviceName,
          ipAddress: ip,
          port,
          message: 'Extracted device information from response',
          details: { deviceInfo }
        })
        
        return { connected: true, deviceInfo }
      }
    } catch (error) {
      await direcTVLogger.log({
        level: LogLevel.WARNING,
        operation: DirecTVOperation.CONNECTION_TEST,
        deviceId: logDeviceId,
        deviceName: logDeviceName,
        ipAddress: ip,
        port,
        message: 'Primary connection test failed, attempting fallback test',
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          code: (error as any).code
        } : undefined
      })
    }
    
    // If info request fails, try a simple key command to test connectivity
    const testUrl = `http://${ip}:${port}/remote/processKey?key=KEY_INFO&hold=keyPress`
    
    await direcTVLogger.log({
      level: LogLevel.DEBUG,
      operation: DirecTVOperation.CONNECTION_TEST,
      deviceId: logDeviceId,
      deviceName: logDeviceName,
      ipAddress: ip,
      port,
      message: 'Attempting fallback connection test via processKey endpoint',
      request: {
        url: testUrl,
        method: 'GET',
        timeout: 5000
      }
    })
    
    const controller2 = new AbortController()
    const timeoutId2 = setTimeout(() => controller2.abort(), 5000) // 5 second timeout
    
    const { result: testResponse, duration: testDuration } = await withTiming(async () => {
      return await fetch(testUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Sports-Bar-Controller/1.0'
        },
        signal: controller2.signal
      })
    })
    
    clearTimeout(timeoutId2)
    
    await direcTVLogger.logApiRequest(
      DirecTVOperation.CONNECTION_TEST,
      logDeviceName,
      ip,
      port,
      testUrl,
      'GET',
      testResponse.ok || testResponse.status === 200,
      testResponse.status,
      undefined,
      testDuration
    )
    
    if (testResponse.ok || testResponse.status === 200) {
      await direcTVLogger.log({
        level: LogLevel.INFO,
        operation: DirecTVOperation.CONNECTION_TEST,
        deviceId: logDeviceId,
        deviceName: logDeviceName,
        ipAddress: ip,
        port,
        message: `Connection test SUCCESSFUL via fallback endpoint (${testDuration}ms)`,
        response: {
          status: testResponse.status,
          statusText: testResponse.statusText,
          duration: testDuration
        }
      })
      return { connected: true, deviceInfo: { model: 'DirecTV Receiver' } }
    } else {
      const errorMsg = `HTTP ${testResponse.status}: ${testResponse.statusText}`
      await direcTVLogger.log({
        level: LogLevel.ERROR,
        operation: DirecTVOperation.CONNECTION_TEST,
        deviceId: logDeviceId,
        deviceName: logDeviceName,
        ipAddress: ip,
        port,
        message: 'Connection test FAILED - Both endpoints returned errors',
        response: {
          status: testResponse.status,
          statusText: testResponse.statusText,
          duration: testDuration
        }
      })
      return { 
        connected: false, 
        error: errorMsg
      }
    }
    
  } catch (error) {
    let errorMessage = 'Unknown error'
    let errorCode = ''
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out - device may be offline'
        errorCode = 'TIMEOUT'
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Connection refused - check IP address and ensure device is online'
        errorCode = 'ECONNREFUSED'
      } else if (error.message.includes('ENETUNREACH')) {
        errorMessage = 'Network unreachable - check network connectivity'
        errorCode = 'ENETUNREACH'
      } else if (error.message.includes('ETIMEDOUT')) {
        errorMessage = 'Connection timed out - device may be offline'
        errorCode = 'ETIMEDOUT'
      } else if (error.message.includes('EHOSTUNREACH')) {
        errorMessage = 'Host unreachable - device not found on network'
        errorCode = 'EHOSTUNREACH'
      } else if (error.message.includes('ENOTFOUND')) {
        errorMessage = 'DNS resolution failed - invalid hostname or IP'
        errorCode = 'ENOTFOUND'
      } else {
        errorMessage = error.message
        errorCode = (error as any).code || 'UNKNOWN'
      }
    }
    
    await direcTVLogger.log({
      level: LogLevel.ERROR,
      operation: DirecTVOperation.CONNECTION_TEST,
      deviceId: logDeviceId,
      deviceName: logDeviceName,
      ipAddress: ip,
      port,
      message: `Connection test FAILED with exception: ${errorMessage}`,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: errorCode
      } : undefined,
      diagnostics: {
        networkReachable: !errorCode.includes('ENETUNREACH'),
        dnsResolved: !errorCode.includes('ENOTFOUND'),
        portOpen: !errorCode.includes('ECONNREFUSED')
      }
    })
    
    console.error('DirecTV connection test error:', error)
    
    return { connected: false, error: errorMessage }
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { ipAddress, port, deviceId, deviceName } = await request.json()

    if (!ipAddress) {
      await direcTVLogger.log({
        level: LogLevel.ERROR,
        operation: DirecTVOperation.CONNECTION_TEST,
        message: 'Connection test request missing required IP address'
      })
      return NextResponse.json(
        { error: 'IP address is required' },
        { status: 400 }
      )
    }

    const targetPort = port || 8080
    
    await direcTVLogger.log({
      level: LogLevel.INFO,
      operation: DirecTVOperation.CONNECTION_TEST,
      deviceId: deviceId || 'unknown',
      deviceName: deviceName || 'Unknown Device',
      ipAddress,
      port: targetPort,
      message: `Received connection test request`,
      details: {
        requestSource: 'API',
        clientInfo: {
          userAgent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
        }
      }
    })
    
    console.log(`Testing DirecTV connection to ${ipAddress}:${targetPort}`)
    
    const result = await testDirecTVConnection(ipAddress, targetPort, deviceId, deviceName)
    
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
    await direcTVLogger.log({
      level: LogLevel.CRITICAL,
      operation: DirecTVOperation.CONNECTION_TEST,
      message: 'Unhandled exception in connection test API',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    })
    
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
