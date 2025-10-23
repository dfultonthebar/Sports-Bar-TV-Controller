import { NextRequest, NextResponse } from 'next/server'
import { AtlasTCPClient } from '@/lib/atlasClient'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const processorIp = searchParams.get('processorIp')
    const showGroups = searchParams.get('showGroups') === 'true'

    if (!processorIp) {
      return NextResponse.json(
        { success: false, error: 'Processor IP is required' },
        { status: 400 }
      )
    }

    const client = new AtlasTCPClient({
      ipAddress: processorIp,
      tcpPort: 5321,
      timeout: 5000
    })

    await client.connect()

    const meters: any[] = []

    // Get zone/output meters (ZoneMeter_0 through ZoneMeter_7 for AZM8)
    const zoneMeterPromises = []
    const zoneNamePromises = []
    const zoneMutePromises = []
    
    for (let i = 0; i < 8; i++) {
      zoneMeterPromises.push(
        client.sendCommand({
          method: 'get',
          param: `ZoneMeter_${i}`,
          format: 'val'
        }).catch(() => null)
      )
      zoneNamePromises.push(
        client.sendCommand({
          method: 'get',
          param: `ZoneName_${i}`,
          format: 'str'
        }).catch(() => null)
      )
      zoneMutePromises.push(
        client.sendCommand({
          method: 'get',
          param: `ZoneMute_${i}`,
          format: 'val'
        }).catch(() => null)
      )
    }

    const [zoneMeterResults, zoneNameResults, zoneMuteResults] = await Promise.all([
      Promise.all(zoneMeterPromises),
      Promise.all(zoneNamePromises),
      Promise.all(zoneMutePromises)
    ])

    // Build zone meter data
    for (let i = 0; i < zoneMeterResults.length; i++) {
      const meterResult = zoneMeterResults[i]
      if (!meterResult || !meterResult.data) continue
      
      const level = meterResult.data.val || meterResult.data.value || -80
      const name = zoneNameResults[i]?.data?.str || `Zone ${i + 1}`
      const muted = zoneMuteResults[i]?.data?.val === 1
      
      meters.push({
        index: i,
        name,
        type: 'output',
        level,
        peak: level,
        clipping: level > -3,
        muted
      })
    }

    // Get group meters if requested
    if (showGroups) {
      const groupMeterPromises = []
      const groupNamePromises = []
      const groupMutePromises = []
      const groupActivePromises = []
      
      for (let i = 0; i < 8; i++) {
        groupMeterPromises.push(
          client.sendCommand({
            method: 'get',
            param: `GroupMeter_${i}`,
            format: 'val'
          }).catch(() => null)
        )
        groupNamePromises.push(
          client.sendCommand({
            method: 'get',
            param: `GroupName_${i}`,
            format: 'str'
          }).catch(() => null)
        )
        groupMutePromises.push(
          client.sendCommand({
            method: 'get',
            param: `GroupMute_${i}`,
            format: 'val'
          }).catch(() => null)
        )
        groupActivePromises.push(
          client.sendCommand({
            method: 'get',
            param: `GroupActive_${i}`,
            format: 'val'
          }).catch(() => null)
        )
      }

      const [groupMeterResults, groupNameResults, groupMuteResults, groupActiveResults] = await Promise.all([
        Promise.all(groupMeterPromises),
        Promise.all(groupNamePromises),
        Promise.all(groupMutePromises),
        Promise.all(groupActivePromises)
      ])

      // Build group meter data (only for active groups)
      for (let i = 0; i < groupMeterResults.length; i++) {
        const activeResult = groupActiveResults[i]
        const isActive = activeResult?.data?.val === 1
        
        if (!isActive) continue // Skip inactive groups
        
        const meterResult = groupMeterResults[i]
        if (!meterResult || !meterResult.data) continue
        
        const level = meterResult.data.val || meterResult.data.value || -80
        const name = groupNameResults[i]?.data?.str || `Group ${i + 1}`
        const muted = groupMuteResults[i]?.data?.val === 1
        
        meters.push({
          index: i,
          name,
          type: 'group',
          level,
          peak: level,
          clipping: level > -3,
          muted
        })
      }
    }

    await client.disconnect()

    return NextResponse.json({
      success: true,
      meters,
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('Error fetching output meters:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch output meters' 
      },
      { status: 500 }
    )
  }
}
