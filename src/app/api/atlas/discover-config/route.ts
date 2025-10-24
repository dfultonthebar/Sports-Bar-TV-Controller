import { NextRequest, NextResponse } from 'next/server'
import { AtlasTCPClient } from '@/lib/atlasClient'

/**
 * Atlas Configuration Discovery API
 * 
 * Dynamically discovers the actual configuration of an Atlas device by querying
 * for zones, groups, and sources until we get errors (indicating we've reached the limit).
 * 
 * This ensures we work with the REAL hardware configuration, not hardcoded assumptions.
 */

interface AtlasConfiguration {
  zones: {
    count: number
    names: string[]
  }
  groups: {
    count: number
    names: string[]
    activeStates: boolean[]
  }
  sources: {
    count: number
    names: string[]
  }
  timestamp: number
}

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

    // Discover zones (try up to 16, which is more than any Atlas model supports)
    const zones: string[] = []
    for (let i = 0; i < 16; i++) {
      try {
        const result = await client.sendCommand({ 
          method: 'get', 
          param: `ZoneName_${i}`, 
          format: 'str' 
        })
        
        if (result?.data?.str) {
          zones.push(result.data.str)
        } else {
          // No more zones
          break
        }
      } catch (error) {
        // Error means we've reached the limit
        break
      }
    }

    // Discover groups (try up to 16)
    const groups: string[] = []
    const groupActiveStates: boolean[] = []
    for (let i = 0; i < 16; i++) {
      try {
        const [nameResult, activeResult] = await Promise.all([
          client.sendCommand({ 
            method: 'get', 
            param: `GroupName_${i}`, 
            format: 'str' 
          }).catch(() => null),
          client.sendCommand({ 
            method: 'get', 
            param: `GroupActive_${i}`, 
            format: 'val' 
          }).catch(() => null)
        ])
        
        if (nameResult?.data?.str) {
          groups.push(nameResult.data.str)
          groupActiveStates.push(activeResult?.data?.val === 1)
        } else {
          // No more groups
          break
        }
      } catch (error) {
        // Error means we've reached the limit
        break
      }
    }

    // Discover sources (try up to 16)
    const sources: string[] = []
    for (let i = 0; i < 16; i++) {
      try {
        const result = await client.sendCommand({ 
          method: 'get', 
          param: `SourceName_${i}`, 
          format: 'str' 
        })
        
        if (result?.data?.str) {
          sources.push(result.data.str)
        } else {
          // No more sources
          break
        }
      } catch (error) {
        // Error means we've reached the limit
        break
      }
    }

    await client.disconnect()

    const configuration: AtlasConfiguration = {
      zones: {
        count: zones.length,
        names: zones
      },
      groups: {
        count: groups.length,
        names: groups,
        activeStates: groupActiveStates
      },
      sources: {
        count: sources.length,
        names: sources
      },
      timestamp: Date.now()
    }

    return NextResponse.json({
      success: true,
      configuration,
      summary: {
        zones: zones.length,
        groups: groups.length,
        activeGroups: groupActiveStates.filter(active => active).length,
        sources: sources.length
      }
    })
  } catch (error) {
    console.error('Error discovering Atlas configuration:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to discover configuration' 
      },
      { status: 500 }
    )
  }
}
