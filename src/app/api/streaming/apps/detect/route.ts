
/**
 * API Route: Detect Installed Streaming Apps
 * 
 * Detects which streaming apps are installed on a Fire TV device
 */

import { NextRequest, NextResponse } from 'next/server'
import { streamingManager } from '@/services/streaming-service-manager'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  try {
    const { deviceId, ipAddress, port = 5555, forceRefresh = false } = bodyValidation.data

    if (!deviceId || !ipAddress) {
      return NextResponse.json(
        { error: 'deviceId and ipAddress are required' },
        { status: 400 }
      )
    }

    logger.info(`[API] Detecting streaming apps on device ${deviceId}`)

    const installedApps = await streamingManager.getInstalledApps(
      deviceId,
      ipAddress,
      port,
      forceRefresh
    )

    const installedCount = installedApps.filter(a => a.isInstalled).length
    const totalCount = installedApps.length

    return NextResponse.json({
      success: true,
      deviceId,
      installedCount,
      totalCount,
      apps: installedApps
    })
  } catch (error: any) {
    logger.error('[API] Error detecting streaming apps:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to detect streaming apps',
        message: error.message
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Return all available streaming apps in database
    const allApps = streamingManager.getAllApps()
    const sportsApps = streamingManager.getSportsApps()
    const appsWithApis = streamingManager.getAppsWithApis()

    return NextResponse.json({
      success: true,
      apps: {
        all: allApps,
        sports: sportsApps,
        withApis: appsWithApis
      }
    })
  } catch (error: any) {
    logger.error('[API] Error getting streaming apps:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get streaming apps',
        message: error.message
      },
      { status: 500 }
    )
  }
}
