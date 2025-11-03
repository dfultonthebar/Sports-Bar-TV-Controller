import { NextRequest, NextResponse } from 'next/server'
import { AtlasTCPClient } from '@/lib/atlasClient'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

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

    // Get source information (Atlas typically has 14 sources: 0-13)
    const sources: any[] = []
    
    for (let i = 0; i < 14; i++) {
      const nameResult = await client.getParameter(`SourceName_${i}`, 'str').catch((err) => {
        console.error(`Error getting SourceName_${i}:`, err)
        return { success: false }
      })

      // Extract the source name from the response
      const name = (nameResult.success && nameResult.data?.value !== undefined && nameResult.data?.value !== null && nameResult.data?.value !== '') 
        ? nameResult.data.value 
        : `Source ${i + 1}`

      sources.push({
        index: i,
        name
      })
    }

    await client.disconnect()

    return NextResponse.json({
      success: true,
      sources,
      totalSources: sources.length,
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('Error fetching sources:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch sources' 
      },
      { status: 500 }
    )
  }
}
