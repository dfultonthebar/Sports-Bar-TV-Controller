export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  try {
    const { searchParams } = new URL(request.url)
    const deviceFilter = searchParams.get('deviceType') || 'all'

    // Mock device data for demonstration
    const mockDevices = [
      { id: '1', name: 'Main Bar DirecTV', type: 'directv', status: 'online' },
      { id: '2', name: 'Corner Booth Fire TV', type: 'firetv', status: 'online' },
      { id: '3', name: 'Samsung TV #1', type: 'ir', status: 'online' },
      { id: '4', name: 'Side Dining DirecTV', type: 'directv', status: 'online' },
      { id: '5', name: 'Main Wall Fire TV', type: 'firetv', status: 'online' }
    ]

    // Mock diagnostics data
    const mockDiagnostics = [
      { deviceId: '1', severity: 'medium', status: 'active', issue: 'Channel Change Latency', type: 'performance' },
      { deviceId: '2', severity: 'high', status: 'active', issue: 'WiFi Disconnections', type: 'connection' },
      { deviceId: '2', severity: 'medium', status: 'active', issue: 'App Launch Delays', type: 'performance' },
      { deviceId: '3', severity: 'low', status: 'active', issue: 'IR Blaster Positioning', type: 'hardware' }
    ]
    
    // Generate insights from mock data
    const insights: any[] = []
    const recommendations: any[] = []
    const metrics: any = {}
    
    // Analyze devices for insights
    for (const device of mockDevices) {
      const deviceDiagnostics = mockDiagnostics.filter(d => d.deviceId === device.id)
      
      if (deviceDiagnostics.length > 0) {
        const recentIssues = deviceDiagnostics.filter(d => 
          d.severity === 'high' || d.severity === 'critical'
        ).length
        
        if (recentIssues > 0) {
          insights.push({
            id: device.id,
            deviceId: device.id,
            deviceName: device.name,
            deviceType: device.type,
            insight: `Device has ${recentIssues} high-priority issues requiring attention`,
            severity: recentIssues > 2 ? 'high' : 'medium',
            timestamp: new Date().toISOString(),
            actionable: true
          })
        }
      }
      
      // Track metrics
      if (!metrics[device.type]) {
        metrics[device.type] = {
          totalDevices: 0,
          healthyDevices: 0,
          issuesDetected: 0,
          avgResponseTime: 0
        }
      }
      metrics[device.type].totalDevices++
      
      const deviceIssues = deviceDiagnostics.filter(d => d.status !== 'resolved').length
      if (deviceIssues === 0) {
        metrics[device.type].healthyDevices++
      } else {
        metrics[device.type].issuesDetected += deviceIssues
      }
    }
    
    // Generate recommendations based on mock data
    const issueTypes = new Map()
    for (const diag of mockDiagnostics) {
      if (diag.status !== 'resolved') {
        const key = diag.issue || diag.type
        issueTypes.set(key, (issueTypes.get(key) || 0) + 1)
      }
    }
    
    for (const [issue, count] of issueTypes.entries()) {
      if (count >= 1) {
        recommendations.push({
          id: `rec-${issue.replace(/\s+/g, '-')}`,
          title: `Address recurring ${issue}`,
          description: `${count} device(s) experiencing ${issue}. Consider systematic resolution.`,
          priority: count > 2 ? 'high' : 'medium',
          deviceTypes: [...new Set(mockDiagnostics.filter(d => d.issue === issue).map(d => mockDevices.find(dev => dev.id === d.deviceId)?.type).filter(Boolean))],
          estimatedImpact: count > 2 ? 'High' : 'Medium',
          implementationTime: '1-2 hours'
        })
      }
    }

    // Filter based on device type
    let filteredInsights = insights
    let filteredRecommendations = recommendations
    
    if (deviceFilter !== 'all') {
      filteredInsights = insights.filter(insight => insight.deviceType === deviceFilter)
      filteredRecommendations = recommendations.filter(rec => 
        rec.deviceTypes.includes(deviceFilter)
      )
    }

    return NextResponse.json({
      success: true,
      insights: filteredInsights,
      recommendations: filteredRecommendations,
      metrics: metrics,
      analysisTimestamp: new Date().toISOString(),
      totalDevicesAnalyzed: mockDevices.length
    })

  } catch (error) {
    logger.error('Device AI analysis error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to analyze devices' },
      { status: 500 }
    )
  }
}
