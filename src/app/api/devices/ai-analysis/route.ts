import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceFilter = searchParams.get('deviceType') || 'all'

    const db = await connectToDatabase()
    
    // Get real device data from database
    const devices = await db.collection('devices').find({}).toArray()
    
    // Get real diagnostics data
    const diagnostics = await db.collection('diagnostics').find({}).toArray()
    
    // Generate insights from real data
    const insights = []
    const recommendations = []
    const metrics: any = {}
    
    // Analyze devices for insights
    for (const device of devices) {
      const deviceDiagnostics = diagnostics.filter(d => d.deviceId === device._id.toString())
      
      if (deviceDiagnostics.length > 0) {
        const recentIssues = deviceDiagnostics.filter(d => 
          d.severity === 'high' || d.severity === 'critical'
        ).length
        
        if (recentIssues > 0) {
          insights.push({
            id: device._id.toString(),
            deviceId: device._id.toString(),
            deviceName: device.name || device.deviceId,
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
    
    // Generate recommendations based on real data
    const issueTypes = new Map()
    for (const diag of diagnostics) {
      if (diag.status !== 'resolved') {
        const key = diag.issue || diag.type
        issueTypes.set(key, (issueTypes.get(key) || 0) + 1)
      }
    }
    
    for (const [issue, count] of issueTypes.entries()) {
      if (count > 2) {
        recommendations.push({
          id: `rec-${issue.replace(/\s+/g, '-')}`,
          title: `Address recurring ${issue}`,
          description: `${count} devices are experiencing ${issue}. Consider systematic resolution.`,
          priority: count > 5 ? 'high' : 'medium',
          deviceTypes: [...new Set(diagnostics.filter(d => d.issue === issue).map(d => d.deviceType))],
          estimatedImpact: count > 5 ? 'High' : 'Medium',
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
      totalDevicesAnalyzed: devices.length
    })

  } catch (error) {
    console.error('Device AI analysis error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to analyze devices' },
      { status: 500 }
    )
  }
}
