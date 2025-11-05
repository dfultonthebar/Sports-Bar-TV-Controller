
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
// Force dynamic rendering
export const dynamic = 'force-dynamic'

const SUBSCRIPTIONS_FILE = join(process.cwd(), 'data', 'device-subscriptions.json')

export async function GET(request: NextRequest) {
  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  try {
    const url = new URL(request.url || 'http://localhost/api/device-subscriptions')
    const deviceId = url.searchParams.get('deviceId')
    const deviceType = url.searchParams.get('deviceType')

    const data = await readFile(SUBSCRIPTIONS_FILE, 'utf8')
    const subscriptionsData = JSON.parse(data)

    // Filter by device if specified
    let devices = subscriptionsData.devices || []
    
    if (deviceId) {
      devices = devices.filter((d: any) => d.deviceId === deviceId)
    }
    
    if (deviceType) {
      devices = devices.filter((d: any) => d.deviceType === deviceType)
    }

    return NextResponse.json({
      success: true,
      devices
    })

  } catch (error) {
    logger.error('Error loading subscription data:', error)
    return NextResponse.json({
      success: true,
      devices: [] as any[]
    })
  }
}
