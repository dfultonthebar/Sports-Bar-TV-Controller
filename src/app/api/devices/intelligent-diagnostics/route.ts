export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const deviceType = searchParams.get('deviceType')
    const deviceId = searchParams.get('deviceId')

    // Mock diagnostics data
    const allDiagnostics = [
      {
        id: '1',
        deviceId: '1',
        deviceName: 'Main Bar DirecTV',
        deviceType: 'directv',
        issue: 'Channel Change Latency',
        severity: 'medium',
        status: 'active',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        detectedAt: new Date(Date.now() - 3600000).toISOString(),
        description: 'Channel switching takes 15% longer than optimal during peak hours',
        suggestedFix: 'Optimize network buffer settings and enable fast channel switching',
        autoFixAvailable: true
      },
      {
        id: '2',
        deviceId: '2',
        deviceName: 'Corner Booth Fire TV',
        deviceType: 'firetv',
        issue: 'WiFi Disconnections',
        severity: 'high',
        status: 'active',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        detectedAt: new Date(Date.now() - 7200000).toISOString(),
        description: 'Device loses WiFi connection 3-4 times per day',
        suggestedFix: 'Switch to 5GHz network and check signal strength',
        autoFixAvailable: false
      },
      {
        id: '3',
        deviceId: '2',
        deviceName: 'Corner Booth Fire TV',
        deviceType: 'firetv',
        issue: 'App Launch Delays',
        severity: 'medium',
        status: 'active',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        detectedAt: new Date(Date.now() - 1800000).toISOString(),
        description: 'Sports streaming apps take 20+ seconds to launch',
        suggestedFix: 'Clear app cache and restart device',
        autoFixAvailable: true
      },
      {
        id: '4',
        deviceId: '3',
        deviceName: 'Samsung TV #1',
        deviceType: 'ir',
        issue: 'IR Blaster Positioning',
        severity: 'low',
        status: 'active',
        timestamp: new Date(Date.now() - 14400000).toISOString(),
        detectedAt: new Date(Date.now() - 14400000).toISOString(),
        description: 'IR commands occasionally fail due to suboptimal positioning',
        suggestedFix: 'Reposition IR blaster for direct line of sight',
        autoFixAvailable: false
      },
      {
        id: '5',
        deviceId: '1',
        deviceName: 'Main Bar DirecTV',
        deviceType: 'directv',
        issue: 'Favorites List Outdated',
        severity: 'low',
        status: 'resolved',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        detectedAt: new Date(Date.now() - 86400000).toISOString(),
        description: 'Sports favorites list needs seasonal update',
        suggestedFix: 'Update favorites with current season channels',
        autoFixAvailable: false
      }
    ]

    // Filter diagnostics based on query parameters
    let filteredDiagnostics = allDiagnostics
    
    if (deviceType && deviceType !== 'all') {
      filteredDiagnostics = filteredDiagnostics.filter(d => d.deviceType === deviceType)
    }
    
    if (deviceId) {
      filteredDiagnostics = filteredDiagnostics.filter(d => d.deviceId === deviceId)
    }

    // Sort by timestamp (most recent first) and limit to 100
    filteredDiagnostics = filteredDiagnostics
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 100)

    return NextResponse.json({
      success: true,
      diagnostics: filteredDiagnostics,
      total: filteredDiagnostics.length
    })

  } catch (error) {
    console.error('Intelligent diagnostics error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch diagnostics' },
      { status: 500 }
    )
  }
}
