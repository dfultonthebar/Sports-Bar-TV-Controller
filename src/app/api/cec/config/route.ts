
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findFirst, or, upsert } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'


export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Get CEC configuration from database or return default
    const cecConfig = await findFirst('cecConfigurations')
    
    return NextResponse.json({
      success: true,
      config: cecConfig || {
        cecInputChannel: null,
        usbDevicePath: '/dev/ttyACM0',
        isEnabled: false,
        powerOnDelay: 2000,
        powerOffDelay: 1000
      }
    })
  } catch (error) {
    logger.error('Error loading CEC configuration:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to load CEC configuration' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error


  try {
    const config = await request.json()

    // Save or update CEC configuration
    const savedConfig = await upsert(
      'cecConfigurations',
      eq(schema.cecConfigurations.id, config.id || 'default'),
      {
        cecInputChannel: config.cecInputChannel,
        usbDevicePath: config.usbDevicePath || '/dev/ttyACM0',
        isEnabled: config.isEnabled,
        powerOnDelay: config.powerOnDelay || 2000,
        powerOffDelay: config.powerOffDelay || 1000
      },
      {
        id: 'default',
        cecInputChannel: config.cecInputChannel,
        usbDevicePath: config.usbDevicePath || '/dev/ttyACM0',
        isEnabled: config.isEnabled,
        powerOnDelay: config.powerOnDelay || 2000,
        powerOffDelay: config.powerOffDelay || 1000
      }
    )

    return NextResponse.json({ 
      success: true, 
      config: savedConfig 
    })
  } catch (error) {
    logger.error('Error saving CEC configuration:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to save CEC configuration' 
    }, { status: 500 })
  }
}
