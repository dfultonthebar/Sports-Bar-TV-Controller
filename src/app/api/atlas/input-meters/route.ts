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

    // Dynamically discover sources by querying until we get an error
    const meterPromises = []
    const namePromises = []
    
    // Try up to 16 sources (more than any Atlas model supports)
    for (let i = 0; i < 16; i++) {
      meterPromises.push(
        client.sendCommand({
          method: 'get',
          param: `SourceMeter_${i}`,
          format: 'val'
        }).catch(() => null)
      )
      namePromises.push(
        client.sendCommand({
          method: 'get',
          param: `SourceName_${i}`,
          format: 'str'
        }).catch(() => null)
      )
    }

    const [meterResults, nameResults] = await Promise.all([
      Promise.all(meterPromises),
      Promise.all(namePromises)
    ])

    await client.disconnect()

    // Build meter data
    const meters = meterResults
      .map((result, index) => {
        if (!result || !result.data) return null
        
        const level = result.data.val || result.data.value || -80
        const name = nameResults[index]?.data?.str || `Input ${index + 1}`
        
        return {
          index,
          name,
          level,
          peak: level, // In real implementation, track peak over time
          clipping: level > -3
        }
      })
      .filter(m => m !== null)

    return NextResponse.json({
      success: true,
      meters,
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('Error fetching input meters:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch input meters' 
      },
      { status: 500 }
    )
  }
}
