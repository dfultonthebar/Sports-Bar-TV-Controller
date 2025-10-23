import { NextRequest, NextResponse } from 'next/server'
import { AtlasTCPClient } from '@/lib/atlasClient'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const processorIp = searchParams.get('processorIp')

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

    // Get group information
    const groups: any[] = []
    
    for (let i = 0; i < 8; i++) {
      const [nameResult, activeResult, sourceResult, gainResult, muteResult] = await Promise.all([
        client.sendCommand({ method: 'get', param: `GroupName_${i}`, format: 'str' }).catch(() => null),
        client.sendCommand({ method: 'get', param: `GroupActive_${i}`, format: 'val' }).catch(() => null),
        client.sendCommand({ method: 'get', param: `GroupSource_${i}`, format: 'val' }).catch(() => null),
        client.sendCommand({ method: 'get', param: `GroupGain_${i}`, format: 'val' }).catch(() => null),
        client.sendCommand({ method: 'get', param: `GroupMute_${i}`, format: 'val' }).catch(() => null)
      ])

      const name = nameResult?.data?.str || `Group ${i + 1}`
      const isActive = activeResult?.data?.val === 1
      const source = sourceResult?.data?.val ?? -1
      const gain = gainResult?.data?.val ?? -10
      const muted = muteResult?.data?.val === 1

      groups.push({
        index: i,
        name,
        isActive,
        source,
        gain,
        muted
      })
    }

    await client.disconnect()

    return NextResponse.json({
      success: true,
      groups,
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('Error fetching groups:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch groups' 
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { processorIp, groupIndex, action, value } = body

    if (!processorIp || groupIndex === undefined) {
      return NextResponse.json(
        { success: false, error: 'Processor IP and group index are required' },
        { status: 400 }
      )
    }

    const client = new AtlasTCPClient({
      ipAddress: processorIp,
      tcpPort: 5321,
      timeout: 5000
    })

    await client.connect()

    let result
    switch (action) {
      case 'setActive':
        result = await client.sendCommand({
          method: 'set',
          param: `GroupActive_${groupIndex}`,
          value: value ? 1 : 0,
          format: 'val'
        })
        break
      
      case 'setSource':
        result = await client.sendCommand({
          method: 'set',
          param: `GroupSource_${groupIndex}`,
          value: value,
          format: 'val'
        })
        break
      
      case 'setGain':
        result = await client.sendCommand({
          method: 'set',
          param: `GroupGain_${groupIndex}`,
          value: value,
          format: 'val'
        })
        break
      
      case 'setMute':
        result = await client.sendCommand({
          method: 'set',
          param: `GroupMute_${groupIndex}`,
          value: value ? 1 : 0,
          format: 'val'
        })
        break
      
      default:
        await client.disconnect()
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }

    await client.disconnect()

    return NextResponse.json({
      success: true,
      result,
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('Error controlling group:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to control group' 
      },
      { status: 500 }
    )
  }
}
