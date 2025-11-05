import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
import {
  detectBrandFromOSD,
  getCachedBrandDetection,
  cacheBrandDetection,
  BrandDetectionResult
} from '@/lib/tv-brands-config'

const execAsync = promisify(exec)

export const dynamic = 'force-dynamic'

/**
 * Detect TV brand using CEC OSD name query
 * Opcode 0x46 (Give OSD Name)
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error
  const body = bodyValidation.data

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error

  try {
    const { cecAddress, forceRefresh } = body

    if (!cecAddress) {
      return NextResponse.json(
        { error: 'CEC address is required' },
        { status: 400 }
      )
    }

    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cached = getCachedBrandDetection(cecAddress)
      if (cached) {
        return NextResponse.json({
          success: true,
          cached: true,
          detection: cached,
        })
      }
    }

    // Query OSD name via CEC
    // Command format: echo 'tx <destination> 0x46' | cec-client -s -d 1
    const destination = cecAddress.replace(':', '')
    const cecCommand = `echo 'tx ${destination} 46' | cec-client -s -d 1`

    let osdName = ''
    try {
      const { stdout, stderr } = await execAsync(cecCommand, {
        timeout: 5000,
      })

      // Parse CEC response for OSD name
      // Expected format: "TRAFFIC [<destination>]: set osd name to '<name>'"
      const osdMatch = stdout.match(/set osd name to '([^']+)'/i)
      if (osdMatch && osdMatch[1]) {
        osdName = osdMatch[1]
      } else {
        // Try alternative parsing
        const altMatch = stdout.match(/OSD name:\s*(.+)/i)
        if (altMatch && altMatch[1]) {
          osdName = altMatch[1].trim()
        }
      }

      if (!osdName) {
        return NextResponse.json({
          success: false,
          error: 'Could not retrieve OSD name from CEC device',
          cecOutput: stdout,
        }, { status: 500 })
      }
    } catch (execError: any) {
      logger.error('CEC command error:', execError)
      return NextResponse.json({
        success: false,
        error: 'Failed to execute CEC command',
        details: execError.message,
      }, { status: 500 })
    }

    // Detect brand from OSD name
    const detection = detectBrandFromOSD(osdName)

    if (!detection) {
      return NextResponse.json({
        success: false,
        error: 'Could not detect brand from OSD name',
        osdName,
      }, { status: 500 })
    }

    // Cache the result
    cacheBrandDetection(cecAddress, detection)

    return NextResponse.json({
      success: true,
      cached: false,
      detection,
    })
  } catch (error: any) {
    logger.error('Error in TV brand detection:', error)
    return NextResponse.json(
      {
        error: 'Failed to detect TV brand',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * Get cached brand detection
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  try {
    const { searchParams } = new URL(request.url)
    const cecAddress = searchParams.get('cecAddress')

    if (!cecAddress) {
      return NextResponse.json(
        { error: 'CEC address is required' },
        { status: 400 }
      )
    }

    const cached = getCachedBrandDetection(cecAddress)

    if (!cached) {
      return NextResponse.json({
        success: false,
        cached: false,
        message: 'No cached detection found',
      })
    }

    return NextResponse.json({
      success: true,
      cached: true,
      detection: cached,
    })
  } catch (error: any) {
    logger.error('Error getting cached brand detection:', error)
    return NextResponse.json(
      {
        error: 'Failed to get cached detection',
        details: error.message
      },
      { status: 500 }
    )
  }
}
