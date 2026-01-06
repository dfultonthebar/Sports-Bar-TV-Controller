import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody } from '@/lib/validation'
import { z } from 'zod'
import { logger } from '@sports-bar/logger'

const locationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Location name is required'),
  description: z.string().optional().default(''),
  address: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  zipCode: z.string().optional().default(''),
  timezone: z.string().default('America/Chicago'),
  gitBranch: z.string().optional().default(''),
  isActive: z.boolean().optional().default(true),
})

// GET - Get current location (or create default if none exists)
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    // Get the active location (there should only be one per installation)
    let location = await db.select()
      .from(schema.locations)
      .where(eq(schema.locations.isActive, true))
      .limit(1)
      .get()

    // If no location exists, return empty with defaults
    if (!location) {
      return NextResponse.json({
        success: true,
        location: null,
        message: 'No location configured. Please set up your location.'
      })
    }

    // Get gitBranch from metadata if stored there
    let gitBranch = ''
    if (location.metadata) {
      try {
        const metadata = JSON.parse(location.metadata)
        gitBranch = metadata.gitBranch || ''
      } catch {
        // Ignore parse errors
      }
    }

    return NextResponse.json({
      success: true,
      location: {
        ...location,
        gitBranch
      }
    })
  } catch (error: any) {
    logger.error('[LOCATION] Error getting location:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get location' },
      { status: 500 }
    )
  }
}

// POST - Create or update location
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, locationSchema)
  if (!bodyValidation.success) return bodyValidation.error

  const data = bodyValidation.data

  try {
    // Store gitBranch in metadata JSON
    const metadata = JSON.stringify({
      gitBranch: data.gitBranch || '',
      updatedAt: new Date().toISOString()
    })

    let location

    if (data.id) {
      // Update existing location
      await db.update(schema.locations)
        .set({
          name: data.name,
          description: data.description,
          address: data.address,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          timezone: data.timezone,
          metadata,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.locations.id, data.id))

      location = await db.select()
        .from(schema.locations)
        .where(eq(schema.locations.id, data.id))
        .get()

      logger.info('[LOCATION] Updated location:', { id: data.id, name: data.name })
    } else {
      // Create new location
      const newId = crypto.randomUUID()

      await db.insert(schema.locations).values({
        id: newId,
        name: data.name,
        description: data.description || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        zipCode: data.zipCode || '',
        timezone: data.timezone,
        isActive: true,
        metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      location = await db.select()
        .from(schema.locations)
        .where(eq(schema.locations.id, newId))
        .get()

      logger.info('[LOCATION] Created new location:', { id: newId, name: data.name })
    }

    // Parse metadata to return gitBranch
    let gitBranch = data.gitBranch || ''

    return NextResponse.json({
      success: true,
      location: {
        ...location,
        gitBranch
      },
      message: data.id ? 'Location updated successfully' : 'Location created successfully'
    })
  } catch (error: any) {
    logger.error('[LOCATION] Error saving location:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save location: ' + error.message },
      { status: 500 }
    )
  }
}
