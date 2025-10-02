import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const db = await connectToDatabase()
    
    // Get all devices
    const devices = await db.collection('devices').find({}).toArray()
    
    // Get diagnostics to identify optimization opportunities
    const diagnostics = await db.collection('diagnostics')
      .find({ status: { $ne: 'resolved' } })
      .toArray()
    
    const optimizations = []
    const suggestions = []
    
    // Analyze each device for optimization opportunities
    for (const device of devices) {
      const deviceDiagnostics = diagnostics.filter(d => d.deviceId === device._id.toString())
      
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
            id: `opt-${device._id.toString()}-${issue.replace(/\s+/g, '-')}`,
            deviceId: device._id.toString(),
            deviceName: device.name || device.deviceId,
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
    for (const device of devices) {
      if (!devicesByType.has(device.type)) {
        devicesByType.set(device.type, [])
      }
      devicesByType.get(device.type).push(device)
    }
    
    for (const [type, typeDevices] of devicesByType.entries()) {
      const typeDiagnostics = diagnostics.filter(d => d.deviceType === type)
      if (typeDiagnostics.length > 0) {
        suggestions.push({
          id: `sug-${type}`,
          title: `Optimize ${type} devices`,
          description: `${typeDiagnostics.length} issues detected across ${typeDevices.length} ${type} device(s)`,
          category: 'Device Health',
          impact: typeDiagnostics.length > 5 ? 'High' : 'Medium',
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
