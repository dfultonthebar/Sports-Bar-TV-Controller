
import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { join } from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
/**
 * Layout Storage API - Enhanced to support background images
 * 
 * The layout object now supports:
 * - name: Layout name
 * - zones: Array of TV zones/positions
 * - backgroundImage: URL to the uploaded layout image (for visual reference)
 * 
 * This allows the frontend to display the uploaded layout image as a background
 * while positioning TV outputs on top of it.
 */

const LAYOUT_FILE = join(process.cwd(), 'data', 'tv-layout.json')

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = join(process.cwd(), 'data')
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    await ensureDataDir()
    const data = await fs.readFile(LAYOUT_FILE, 'utf8')
    let layout
    try {
      layout = JSON.parse(data || '{}')
    } catch (parseError) {
      logger.error('Failed to parse bartender layout file:', { error: parseError, data: { preview: data?.substring(0, 100) } })
      // Return default layout if parse fails
      return NextResponse.json({
        layout: {
          name: 'Bar Layout',
          zones: [] as any[],
          backgroundImage: null
        }
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }
    return NextResponse.json({ layout }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    // Return default layout if file doesn't exist
    return NextResponse.json({
      layout: {
        name: 'Bar Layout',
        zones: [] as any[],
        backgroundImage: null // Support for layout background image
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    const { data } = bodyValidation
    const { layout } = data
    await ensureDataDir()
    await fs.writeFile(LAYOUT_FILE, JSON.stringify(layout, null, 2))
    
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error saving layout:', error)
    return NextResponse.json(
      { error: 'Failed to save layout' },
      { status: 500 }
    )
  }
}
