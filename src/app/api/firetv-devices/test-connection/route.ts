
// Fire TV Test Connection API - Direct ADB connection with keep-alive support

import { NextRequest, NextResponse } from 'next/server'
import { ADBClient } from '@/lib/firecube/adb-client'

export async function POST(request: NextRequest) {
  let adbClient: ADBClient | null = null
  
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
    
    // Create ADB client with keep-alive enabled (30 second interval)
    adbClient = new ADBClient(ip, devicePort, {
      keepAliveInterval: 30000, // 30 seconds
      connectionTimeout: 5000    // 5 second timeout
    })
    
    // Test connection
    const connected = await adbClient.testConnection()
    
    if (!connected) {
      console.log('[FIRE CUBE] ❌ Connection test failed')
      return NextResponse.json({
        success: false,
        message: 'Failed to connect to Fire TV device',
        data: {
          suggestions: [
            'Verify ADB debugging is enabled on the Fire TV device',
            'Check that the IP address and port are correct',
            'Ensure the device is powered on and connected to the network',
            'Try restarting the Fire TV device'
          ]
        }
      })
    }
    
    // Get device information
    const deviceInfo = await adbClient.getDeviceInfo()
    
    console.log('[FIRE CUBE] ✅ Connection successful!')
    console.log('[FIRE CUBE] Device Info:', deviceInfo)
    
    // Note: We don't call cleanup() here to keep the connection alive
    // The keep-alive mechanism will maintain the connection
    
    return NextResponse.json({
      success: true,
      message: 'Successfully connected to Fire TV device',
      data: {
        connected: true,
        deviceModel: deviceInfo.model || 'Unknown',
        serialNumber: deviceInfo.serialNumber || 'Unknown',
        softwareVersion: deviceInfo.softwareVersion || 'Unknown',
        keepAliveEnabled: true,
        keepAliveInterval: '30 seconds'
      }
    })
    
  } catch (error: any) {
    console.error('[FIRE CUBE] ❌ Connection error:', error)
    
    // Cleanup on error
    if (adbClient) {
      adbClient.cleanup()
    }
    
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
