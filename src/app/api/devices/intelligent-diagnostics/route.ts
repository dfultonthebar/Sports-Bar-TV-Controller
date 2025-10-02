import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceType = searchParams.get('deviceType')
    const deviceId = searchParams.get('deviceId')

    const db = await connectToDatabase()
    
    // Build query based on filters
    const query: any = {}
    if (deviceType && deviceType !== 'all') {
      query.deviceType = deviceType
    }
    if (deviceId) {
      query.deviceId = deviceId
    }

    // Get diagnostics from database
    const diagnostics = await db.collection('diagnostics')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray()

    return NextResponse.json({
      success: true,
      diagnostics: diagnostics.map(d => ({
        id: d._id.toString(),
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        deviceType: d.deviceType,
        issue: d.issue,
        severity: d.severity,
        status: d.status,
        detectedAt: d.timestamp || d.detectedAt,
        description: d.description,
        suggestedFix: d.suggestedFix,
        autoFixAvailable: d.autoFixAvailable || false
      })),
      total: diagnostics.length
    })

  } catch (error) {
    console.error('Intelligent diagnostics error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch diagnostics' },
      { status: 500 }
    )
  }
}
