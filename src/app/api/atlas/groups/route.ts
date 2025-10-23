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

    console.log(`[Atlas Groups API] Fetching groups from ${processorIp}:5321`)

    const client = new AtlasTCPClient({
      ipAddress: processorIp,
      tcpPort: 5321,
      timeout: 5000
    })

    await client.connect()
    console.log(`[Atlas Groups API] Connected to Atlas processor`)

    // Get group information
    const groups: any[] = []
    
    for (let i = 0; i < 8; i++) {
      const [nameResult, activeResult, sourceResult, gainResult, muteResult] = await Promise.all([
        client.sendCommand({ method: 'get', param: `GroupName_${i}`, format: 'str' }).catch((err) => {
          console.error(`[Atlas Groups API] Error fetching GroupName_${i}:`, err)
          return null
        }),
        client.sendCommand({ method: 'get', param: `GroupActive_${i}`, format: 'val' }).catch((err) => {
          console.error(`[Atlas Groups API] Error fetching GroupActive_${i}:`, err)
          return null
        }),
        client.sendCommand({ method: 'get', param: `GroupSource_${i}`, format: 'val' }).catch((err) => {
          console.error(`[Atlas Groups API] Error fetching GroupSource_${i}:`, err)
          return null
        }),
        client.sendCommand({ method: 'get', param: `GroupGain_${i}`, format: 'val' }).catch((err) => {
          console.error(`[Atlas Groups API] Error fetching GroupGain_${i}:`, err)
          return null
        }),
        client.sendCommand({ method: 'get', param: `GroupMute_${i}`, format: 'val' }).catch((err) => {
          console.error(`[Atlas Groups API] Error fetching GroupMute_${i}:`, err)
          return null
        })
      ])

      // Atlas returns responses in format: { result: [{ param: "GroupName_0", str: "Main Bar" }] }
      // Extract values from the result array
      const name = nameResult?.result?.[0]?.str || `Group ${i + 1}`
      const isActive = activeResult?.result?.[0]?.val === 1
      const source = sourceResult?.result?.[0]?.val ?? -1
      const gain = gainResult?.result?.[0]?.val ?? -10
      const muted = muteResult?.result?.[0]?.val === 1

      console.log(`[Atlas Groups API] Group ${i}: name="${name}", active=${isActive}, source=${source}, gain=${gain}, muted=${muted}`)

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
    console.log(`[Atlas Groups API] Successfully fetched ${groups.length} groups`)

    return NextResponse.json({
      success: true,
      groups,
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('[Atlas Groups API] Error fetching groups:', error)
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
