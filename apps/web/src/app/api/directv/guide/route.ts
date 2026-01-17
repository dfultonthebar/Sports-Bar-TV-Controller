/**
 * DirecTV Guide API
 *
 * GET /api/directv/guide
 *
 * Fetches program guide data from DirecTV receivers
 *
 * Query Parameters:
 * - deviceId (optional): DirecTV device ID. If not provided, uses first online device
 * - channels (optional): Comma-separated list of channel numbers (e.g., "206,212,219")
 *                        If not provided, fetches all active DirecTV presets
 *
 * Response:
 * {
 *   "success": true,
 *   "device": { "id": "...", "name": "...", "ipAddress": "..." },
 *   "results": [
 *     {
 *       "success": true,
 *       "channel": "206",
 *       "channelName": "ESPN",
 *       "programInfo": {
 *         "title": "SportsCenter",
 *         "callsign": "ESPN",
 *         "duration": 3600,
 *         "startTime": 1234567890,
 *         "isOffAir": false,
 *         "major": 206,
 *         "minor": 1
 *       }
 *     }
 *   ],
 *   "fetchedAt": "2025-01-15T12:00:00Z",
 *   "cached": false
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateQueryParams, isValidationError } from '@/lib/validation'
import { z } from 'zod'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import {
  fetchDirecTVGuide,
  getDirecTVDevice,
  type DirecTVGuideOptions
} from '@/lib/directv-guide-service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Query parameter validation schema
const querySchema = z.object({
  deviceId: z.string().optional(),
  channels: z.string().optional(), // Comma-separated channel numbers
  timeout: z.coerce.number().int().min(1000).max(30000).optional().default(5000),
  useCache: z.coerce.boolean().optional().default(true)
})

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Validate query parameters
    const queryValidation = validateQueryParams(request, querySchema)
    if (isValidationError(queryValidation)) {
      return queryValidation.error
    }

    const { deviceId, channels, timeout, useCache } = queryValidation.data

    logger.info(`[DIRECTV_GUIDE_API] Request - deviceId: ${deviceId || 'auto'}, channels: ${channels || 'all presets'}`)

    // Parse channel numbers
    let channelList: string[] = []

    if (channels) {
      // Use provided channels
      channelList = channels.split(',').map(c => c.trim()).filter(Boolean)
    } else {
      // Load active DirecTV presets from database
      logger.info('[DIRECTV_GUIDE_API] Loading active DirecTV channel presets')
      const presets = await db
        .select()
        .from(schema.channelPresets)
        .where(and(
          eq(schema.channelPresets.deviceType, 'directv'),
          eq(schema.channelPresets.isActive, true)
        ))

      channelList = presets.map(p => p.channelNumber)
      logger.info(`[DIRECTV_GUIDE_API] Found ${channelList.length} active DirecTV presets`)

      if (channelList.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No active DirecTV channel presets found. Please add presets or specify channels.',
          device: null,
          results: [],
          fetchedAt: new Date().toISOString()
        }, { status: 400 })
      }
    }

    // Get device info for response
    const device = getDirecTVDevice(deviceId)
    if (!device) {
      return NextResponse.json({
        success: false,
        error: deviceId
          ? `DirecTV device not found: ${deviceId}`
          : 'No online DirecTV devices available',
        device: null,
        results: [],
        fetchedAt: new Date().toISOString()
      }, { status: 404 })
    }

    // Fetch guide data
    const options: DirecTVGuideOptions = {
      deviceId,
      channels: channelList,
      timeout,
      useCache,
      cacheTTL: 30000 // 30 second cache
    }

    const results = await fetchDirecTVGuide(options)

    // Check if any results were successful
    const successCount = results.filter(r => r.success).length
    const totalCount = results.length

    logger.info(`[DIRECTV_GUIDE_API] Completed - ${successCount}/${totalCount} channels fetched successfully`)

    return NextResponse.json({
      success: successCount > 0,
      device: {
        id: device.id,
        name: device.name,
        ipAddress: device.ipAddress,
        port: device.port
      },
      results,
      summary: {
        total: totalCount,
        successful: successCount,
        failed: totalCount - successCount
      },
      fetchedAt: new Date().toISOString(),
      cached: useCache
    })

  } catch (error: any) {
    logger.error('[DIRECTV_GUIDE_API] Error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch DirecTV guide data',
      details: error.message,
      device: null,
      results: [],
      fetchedAt: new Date().toISOString()
    }, { status: 500 })
  }
}
