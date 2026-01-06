import { NextRequest, NextResponse } from 'next/server'
import { AtlasTCPClient } from '@/lib/atlasClient'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error

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
      timeout: 3000,      // 3 seconds for UI responsiveness
      maxRetries: 1       // Single retry
    })

    await client.connect()

    // Get group information
    const groups: any[] = []

    for (let i = 0; i < 8; i++) {
      const [nameResult, activeResult, sourceResult, gainResult, muteResult] = await Promise.all([
        client.getParameter(`GroupName_${i}`, 'str').catch((err) => {
          logger.error(`Error getting GroupName_${i}:`, err)
          return { success: false }
        }),
        client.getParameter(`GroupActive_${i}`, 'val').catch((err) => {
          logger.error(`Error getting GroupActive_${i}:`, err)
          return { success: false }
        }),
        client.getParameter(`GroupSource_${i}`, 'val').catch((err) => {
          logger.error(`Error getting GroupSource_${i}:`, err)
          return { success: false }
        }),
        client.getParameter(`GroupGain_${i}`, 'val').catch((err) => {
          logger.error(`Error getting GroupGain_${i}:`, err)
          return { success: false }
        }),
        client.getParameter(`GroupMute_${i}`, 'val').catch((err) => {
          logger.error(`Error getting GroupMute_${i}:`, err)
          return { success: false }
        })
      ])

      logger.info(`Group ${i} results:`, {
        data: {
          nameResult,
          activeResult,
          sourceResult,
          gainResult,
          muteResult
        }
      })

      // Extract values from the response structure
      // Response format: { success: true, data: { ...response, value: extractedValue } }
      const name = (nameResult.success && 'data' in nameResult && nameResult.data?.value !== undefined && nameResult.data?.value !== null && nameResult.data?.value !== '')
        ? nameResult.data.value
        : `Group ${i + 1}`
      const isActive = (activeResult.success && 'data' in activeResult && activeResult.data?.value === 1)
      const source = (sourceResult.success && 'data' in sourceResult && sourceResult.data?.value !== undefined) ? sourceResult.data.value : -1
      const gain = (gainResult.success && 'data' in gainResult && gainResult.data?.value !== undefined) ? gainResult.data.value : -10
      const muted = (muteResult.success && 'data' in muteResult && muteResult.data?.value === 1)

      logger.info(`Group ${i} extracted values:`, { data: { name, isActive, source, gain, muted } })

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

    // Count active groups
    const activeGroups = groups.filter(g => g.isActive)

    return NextResponse.json({
      success: true,
      groups,
      totalGroups: groups.length,
      activeGroups: activeGroups.length,
      timestamp: Date.now()
    })
  } catch (error) {
    logger.error('Error fetching groups:', error)
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
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error

  try {
    const body = bodyValidation.data
    const processorIp = String(body.processorIp || '')
    const groupIndex = body.groupIndex
    const action = String(body.action || '')
    const value = body.value

    if (!processorIp || groupIndex === undefined) {
      return NextResponse.json(
        { success: false, error: 'Processor IP and group index are required' },
        { status: 400 }
      )
    }

    // Convert unknown types to numbers
    const groupIndexNum = Number(groupIndex)
    const valueNum = Number(value)

    const client = new AtlasTCPClient({
      ipAddress: processorIp,
      tcpPort: 5321,
      timeout: 3000,      // 3 seconds for faster failure
      maxRetries: 1       // Single retry for UI responsiveness
    })

    await client.connect()

    let result
    switch (action) {
      case 'setActive':
        result = await client.setGroupActive(groupIndexNum, Boolean(valueNum))
        break

      case 'setSource':
        // Need to add setGroupSource method to atlasClient
        result = await client.setGroupSource(groupIndexNum, valueNum)
        break

      case 'setGain':
        // Need to add setGroupVolume method to atlasClient
        result = await client.setGroupVolume(groupIndexNum, valueNum)
        break

      case 'setMute':
        // Need to add setGroupMute method to atlasClient
        result = await client.setGroupMute(groupIndexNum, Boolean(valueNum))
        break
      
      default:
        await client.disconnect()
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }

    await client.disconnect()

    // Check if command was successful
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to control group',
        timestamp: Date.now()
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      result: result.data,
      timestamp: Date.now()
    })
  } catch (error) {
    logger.error('Error controlling group:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to control group' 
      },
      { status: 500 }
    )
  }
}
