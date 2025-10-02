
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Mock device data
    const mockDevices = [
      { id: '1', name: 'Main Bar DirecTV', type: 'directv', status: 'online' },
      { id: '2', name: 'Corner Booth Fire TV', type: 'firetv', status: 'online' },
      { id: '3', name: 'Samsung TV #1', type: 'ir', status: 'online' },
      { id: '4', name: 'Side Dining DirecTV', type: 'directv', status: 'online' },
      { id: '5', name: 'Main Wall Fire TV', type: 'firetv', status: 'online' }
    ]
    
    // Mock diagnostics data (unresolved issues only)
    const mockDiagnostics = [
      { deviceId: '1', issue: 'Channel Change Latency', severity: 'medium', status: 'active', deviceType: 'directv', autoFixAvailable: true },
      { deviceId: '2', issue: 'WiFi Disconnections', severity: 'high', status: 'active', deviceType: 'firetv', autoFixAvailable: false },
      { deviceId: '2', issue: 'App Launch Delays', severity: 'medium', status: 'active', deviceType: 'firetv', autoFixAvailable: true },
      { deviceId: '3', issue: 'IR Blaster Positioning', severity: 'low', status: 'active', deviceType: 'ir', autoFixAvailable: false }
    ]
    
    const optimizations = []
    const suggestions = []
    
    // Analyze each device for optimization opportunities
    for (const device of mockDevices) {
      const deviceDiagnostics = mockDiagnostics.filter(d => d.deviceId === device.id)
      
      if (deviceDiagnostics.length > 0) {
        // Group by issue type
        const issueGroups = new Map()
        for (const diag of deviceDiagnostics) {
          const issue = diag.issue || 'Unknown Issue'
          if (!issueGroups.has(issue)) {
            issueGroups.set(issue, [])
          }
          issueGroups.get(issue).push(diag)
        }
        
        // Create optimization for each issue group
        for (const [issue, diags] of issueGroups.entries()) {
          optimizations.push({
            id: `opt-${device.id}-${issue.replace(/\s+/g, '-')}`,
            deviceId: device.id,
            deviceName: device.name,
            deviceType: device.type,
            optimizationType: issue,
            currentStatus: 'Needs Attention',
            potentialImprovement: `Resolve ${diags.length} issue(s)`,
            priority: diags.some(d => d.severity === 'high' || d.severity === 'critical') ? 'high' : 'medium',
            estimatedTime: '5-15 minutes',
            autoOptimizeAvailable: diags.some(d => d.autoFixAvailable)
          })
        }
      }
    }
    
    // Generate system-wide suggestions
    const devicesByType = new Map()
    for (const device of mockDevices) {
      if (!devicesByType.has(device.type)) {
        devicesByType.set(device.type, [])
      }
      devicesByType.get(device.type).push(device)
    }
    
    for (const [type, typeDevices] of devicesByType.entries()) {
      const typeDiagnostics = mockDiagnostics.filter(d => d.deviceType === type)
      if (typeDiagnostics.length > 0) {
        suggestions.push({
          id: `sug-${type}`,
          title: `Optimize ${type} devices`,
          description: `${typeDiagnostics.length} issues detected across ${typeDevices.length} ${type} device(s)`,
          category: 'Device Health',
          impact: typeDiagnostics.length > 2 ? 'High' : 'Medium',
          effort: 'Medium',
          devicesAffected: typeDevices.length
        })
      }
    }

    return NextResponse.json({
      success: true,
      optimizations,
      suggestions,
      summary: {
        totalOptimizations: optimizations.length,
        highPriority: optimizations.filter(o => o.priority === 'high').length,
        autoOptimizeAvailable: optimizations.filter(o => o.autoOptimizeAvailable).length
      }
    })

  } catch (error) {
    console.error('Smart optimizer error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate optimizations' },
      { status: 500 }
    )
  }
}
