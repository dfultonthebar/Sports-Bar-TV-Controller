
// Fire TV Test Connection API - Direct ADB connection with keep-alive support

import { NextRequest, NextResponse } from 'next/server'
import { connectionManager } from '@/services/firetv-connection-manager'

export async function POST(request: NextRequest) {
  try {
    const { deviceId, ipAddress, port } = await request.json()
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔍 [FIRE CUBE] Testing connection')
    console.log(`   Device ID: ${deviceId}`)
    console.log(`   IP: ${ipAddress}`)
    console.log(`   Port: ${port}`)
    console.log(`   Timestamp: ${new Date().toISOString()}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    if (!ipAddress || !port) {
      console.log('[FIRE CUBE] ❌ Missing required fields')
      return NextResponse.json(
        { 
          success: false, 
          message: 'IP address and port are required'
        },
        { status: 400 }
      )
    }
    
    const ip = ipAddress.trim()
    const devicePort = parseInt(port.toString())
    
    // Use connection manager to get or create connection
    const adbClient = await connectionManager.getOrCreateConnection(deviceId, ip, devicePort)
    
    // Test connection by getting device info
    const deviceInfo = await adbClient.getDeviceInfo()
    
    console.log('[FIRE CUBE] ✅ Connection successful!')
    console.log('[FIRE CUBE] Device Info:', deviceInfo)
    
    // Get connection status
    const connectionStatus = connectionManager.getConnectionStatus(deviceId)
    
    return NextResponse.json({
      success: true,
      message: 'Successfully connected to Fire TV device',
      data: {
        connected: true,
        deviceModel: deviceInfo.model || 'Unknown',
        serialNumber: deviceInfo.serialNumber || 'Unknown',
        softwareVersion: deviceInfo.softwareVersion || 'Unknown',
        keepAliveEnabled: true,
        keepAliveInterval: '30 seconds',
        managedByConnectionManager: true,
        connectionStatus: connectionStatus?.status || 'unknown'
      }
    })
    
  } catch (error: any) {
    console.error('[FIRE CUBE] ❌ Connection error:', error)
    
    let errorMessage = 'Connection test failed'
    const suggestions: string[] = []
    
    if (error.message && error.message.includes('ADB command-line tool not installed')) {
      errorMessage = 'ADB is not installed on the server'
      suggestions.push('Install ADB: sudo apt-get install adb')
    } else if (error.message && error.message.includes('timeout')) {
      errorMessage = 'Connection timeout'
      suggestions.push('Check if the Fire TV device is powered on')
      suggestions.push('Verify the device is on the same network')
      suggestions.push('Ensure ADB debugging is enabled')
    } else if (error.message && error.message.includes('refused')) {
      errorMessage = 'Connection refused'
      suggestions.push('Enable ADB debugging: Settings → My Fire TV → Developer Options → ADB Debugging')
      suggestions.push('Ensure port 5555 is not blocked by a firewall')
    }
    
    return NextResponse.json({
      success: false,
      message: errorMessage,
      data: {
        error: error.message,
        suggestions: suggestions.length > 0 ? suggestions : [
          'Verify ADB debugging is enabled on the Fire TV device',
          'Check network connectivity between server and Fire TV',
          'Ensure the correct IP address and port are used',
          'Try manually connecting via command line: adb connect <ip>:5555'
        ]
      }
    }, { status: 500 })
  }
}
