import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, ValidationSchemas } from '@/lib/validation'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * TV Power Control by Wolf Pack Output Number
 *
 * Resolves: outputNumber → MatrixOutput → NetworkTVDevice → power command
 * Used by the bartender remote layout where TVs are identified by output number.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ outputNumber: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const { outputNumber: outputNumberStr } = await params
  const outputNumber = parseInt(outputNumberStr, 10)

  if (isNaN(outputNumber) || outputNumber < 1) {
    return NextResponse.json(
      { success: false, error: 'Invalid output number' },
      { status: 400 }
    )
  }

  const bodyValidation = await validateRequestBody(request, ValidationSchemas.tvPowerControl)
  if (!bodyValidation.success) return bodyValidation.error
  const { action } = bodyValidation.data

  try {
    // Find the matrix output with this channel number
    const matrixOutputs = await db.select()
      .from(schema.matrixOutputs)
      .where(eq(schema.matrixOutputs.channelNumber, outputNumber))
      .limit(1)

    if (matrixOutputs.length === 0) {
      return NextResponse.json(
        { success: false, error: `No matrix output found for output ${outputNumber}` },
        { status: 404 }
      )
    }

    const matrixOutput = matrixOutputs[0]

    // Find the network TV device linked to this matrix output
    const tvDevices = await db.select()
      .from(schema.networkTVDevices)
      .where(eq(schema.networkTVDevices.matrixOutputId, matrixOutput.id))
      .limit(1)

    if (tvDevices.length === 0) {
      return NextResponse.json(
        { success: false, error: `No TV device linked to output ${outputNumber}` },
        { status: 404 }
      )
    }

    const tvDevice = tvDevices[0]

    // Forward to the main power control endpoint
    const powerUrl = new URL(
      `/api/tv-control/${tvDevice.id}/power`,
      request.url
    )

    logger.info(`[TV-CONTROL] Output ${outputNumber} → TV ${tvDevice.id} (${tvDevice.brand} @ ${tvDevice.ipAddress}) → power ${action}`)

    const powerResponse = await fetch(powerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    })

    const result = await powerResponse.json()
    return NextResponse.json({
      ...result,
      outputNumber,
      tvName: tvDevice.name,
      tvBrand: tvDevice.brand
    }, { status: powerResponse.status })

  } catch (error: any) {
    logger.error(`[TV-CONTROL] Power by output ${outputNumber} failed:`, error)
    return NextResponse.json(
      { success: false, error: error.message || 'Power control failed' },
      { status: 500 }
    )
  }
}
