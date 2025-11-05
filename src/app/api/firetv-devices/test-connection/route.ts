
// Fire TV Test Connection API - Direct ADB connection with keep-alive support

import { NextRequest, NextResponse } from 'next/server'
import { connectionManager } from '@/services/firetv-connection-manager'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.connectionTest)
  if (!bodyValidation.success) return bodyValidation.error


  // Security: use validated data
  const { deviceId, ipAddress, port } = bodyValidation.data

  try {
    
    
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('🔍 [FIRE CUBE] Testing connection')
    logger.info(`   Device ID: ${deviceId}`)
    logger.info(`   IP: ${ipAddress}`)
    logger.info(`   Port: ${port}`)
    logger.info(`   Timestamp: ${new Date().toISOString()}`)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    if (!ipAddress || !port) {
      logger.info('[FIRE CUBE] ❌ Missing required fields')
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
    
    logger.info('[FIRE CUBE] ✅ Connection successful!')
    logger.info('[FIRE CUBE] Device Info:', deviceInfo)
    
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
    logger.error('[FIRE CUBE] ❌ Connection error:', error)
    
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
