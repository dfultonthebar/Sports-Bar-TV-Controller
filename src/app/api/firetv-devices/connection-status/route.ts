/**
 * Fire TV Connection Status API
 * 
 * Provides real-time connection status for all Fire TV devices
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectionManager } from '@/services/firetv-connection-manager'
import { healthMonitor } from '@/services/firetv-health-monitor'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('deviceId')
    
    console.log('[CONNECTION STATUS API] GET request')
    
    if (deviceId) {
      // Get status for specific device
      const connectionStatus = connectionManager.getConnectionStatus(deviceId)
      const healthStatus = healthMonitor.getDeviceHealthStatus(deviceId)
      
      if (!connectionStatus && !healthStatus) {
        return NextResponse.json({
          success: false,
          message: 'Device not found'
        }, { status: 404 })
      }
      
      return NextResponse.json({
        success: true,
        data: {
          deviceId,
          connection: connectionStatus ? {
            status: connectionStatus.status,
            deviceAddress: connectionStatus.deviceAddress,
            lastActivity: connectionStatus.lastActivity,
            connectionAttempts: connectionStatus.connectionAttempts,
            lastError: connectionStatus.lastError
          } : null,
          health: healthStatus ? {
            isHealthy: healthStatus.isHealthy,
            lastCheck: healthStatus.lastCheck,
            error: healthStatus.error,
            reconnectAttempts: healthStatus.reconnectAttempts
          } : null
        }
      })
    } else {
      // Get status for all devices
      const allConnections = connectionManager.getAllConnectionStatuses()
      const allHealth = healthMonitor.getHealthStatus()
      const stats = healthMonitor.getStatistics()
      
      const deviceStatuses = Array.from(allConnections.entries()).map(([deviceId, connection]) => {
        const health = allHealth.get(deviceId)
        
        return {
          deviceId,
          deviceName: health?.deviceName || 'Unknown',
          deviceAddress: connection.deviceAddress,
          connection: {
            status: connection.status,
            lastActivity: connection.lastActivity,
            connectionAttempts: connection.connectionAttempts,
            lastError: connection.lastError
          },
          health: health ? {
            isHealthy: health.isHealthy,
            lastCheck: health.lastCheck,
            error: health.error,
            reconnectAttempts: health.reconnectAttempts
          } : null
        }
      })
      
      return NextResponse.json({
        success: true,
        data: {
          devices: deviceStatuses,
          statistics: stats,
          timestamp: new Date().toISOString()
        }
      })
    }
  } catch (error: any) {
    console.error('[CONNECTION STATUS API] Error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to get connection status',
      error: error.message
    }, { status: 500 })
  }
}

/**
 * Force a health check
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[CONNECTION STATUS API] POST request - forcing health check')
    
    await healthMonitor.forceHealthCheck()
    
    return NextResponse.json({
      success: true,
      message: 'Health check initiated'
    })
  } catch (error: any) {
    console.error('[CONNECTION STATUS API] Error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to initiate health check',
      error: error.message
    }, { status: 500 })
  }
}
