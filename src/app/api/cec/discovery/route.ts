
/**
 * CEC Discovery API
 * 
 * Endpoint for discovering TV brands connected to WolfPack outputs
 */

import { NextRequest, NextResponse } from 'next/server'
import { discoverAllTVBrands, discoverSingleTV } from '@/lib/services/cec-discovery-service'
import { findMany, eq, asc } from '@/lib/db-helpers'
import { schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

/**
 * POST /api/cec/discovery
 * 
 * Run CEC discovery on all outputs or a specific output
 * 
 * Request body:
 * - outputNumber (optional): Discover specific output only
 * 
 * Response:
 * - results: Array of discovery results
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { outputNumber } = body
    
    if (outputNumber) {
      // Discover single output
      const result = await discoverSingleTV(parseInt(outputNumber))
      
      return NextResponse.json({
        success: true,
        results: [result],
        message: result.success 
          ? `Discovered ${result.brand} on output ${outputNumber}`
          : `Failed to discover TV on output ${outputNumber}`
      })
    } else {
      // Discover all outputs
      const results = await discoverAllTVBrands()
      const successCount = results.filter(r => r.success).length
      
      return NextResponse.json({
        success: true,
        results,
        message: `Discovery complete: ${successCount}/${results.length} TVs detected`
      })
    }
  } catch (error: any) {
    console.error('[CEC Discovery API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to run discovery'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cec/discovery
 * 
 * Get last discovery results from database
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const outputs = await findMany('matrixOutputs', {
      where: eq(schema.matrixOutputs.isActive, true),
      orderBy: asc(schema.matrixOutputs.channelNumber)
    })
    
    return NextResponse.json({
      success: true,
      outputs: outputs.map(o => ({
        outputNumber: o.channelNumber,
        label: o.label,
        brand: o.tvBrand,
        model: o.tvModel,
        cecAddress: o.cecAddress,
        lastDiscovery: o.lastDiscovery,
        discovered: !!o.tvBrand
      }))
    })
  } catch (error: any) {
    console.error('[CEC Discovery API] Error fetching results:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch discovery results'
      },
      { status: 500 }
    )
  }
}

