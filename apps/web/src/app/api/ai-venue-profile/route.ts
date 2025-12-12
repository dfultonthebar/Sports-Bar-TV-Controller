/**
 * API Route: AI Venue Profile
 *
 * Manages venue settings for the AI Game Plan:
 * - Bar hours (open/close times)
 * - Filler content when no games are on
 * - Auto-run settings
 * - Team display preferences
 * - Conflict resolution strategy
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'

// GET - Get the venue profile (there's only one)
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    // Get the first (and only) venue profile
    const profile = await db
      .select()
      .from(schema.aiVenueProfiles)
      .limit(1)
      .get()

    if (!profile) {
      // Return defaults if no profile exists
      return NextResponse.json({
        success: true,
        profile: null,
        defaults: {
          openTime: '11:00',
          closeTime: '02:00',
          timezone: 'America/New_York',
          fillerChannels: [],
          fillerApps: [],
          defaultFillerMode: 'sports_network',
          autoRunEnabled: false,
          autoRunTime: '09:00',
          alwaysShowLocalTeams: true,
          nationalGameBoost: 20,
          playoffBoost: 30,
          conflictStrategy: 'priority'
        }
      })
    }

    // Parse JSON fields
    const parsedProfile = {
      ...profile,
      fillerChannels: profile.fillerChannels ? JSON.parse(profile.fillerChannels) : [],
      fillerApps: profile.fillerApps ? JSON.parse(profile.fillerApps) : []
    }

    return NextResponse.json({
      success: true,
      profile: parsedProfile
    })
  } catch (error: any) {
    logger.error('[AI_VENUE_PROFILE] Error getting profile:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get venue profile',
      details: error.message
    }, { status: 500 })
  }
}

// POST - Create or update the venue profile
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, z.object({
    openTime: z.string().optional().default('11:00'),
    closeTime: z.string().optional().default('02:00'),
    timezone: z.string().optional().default('America/New_York'),
    fillerChannels: z.array(z.string()).optional().default([]),
    fillerApps: z.array(z.string()).optional().default([]),
    defaultFillerMode: z.enum(['sports_network', 'local_news', 'music']).optional().default('sports_network'),
    autoRunEnabled: z.boolean().optional().default(false),
    autoRunTime: z.string().optional().default('09:00'),
    alwaysShowLocalTeams: z.boolean().optional().default(true),
    nationalGameBoost: z.number().min(0).max(100).optional().default(20),
    playoffBoost: z.number().min(0).max(100).optional().default(30),
    conflictStrategy: z.enum(['priority', 'round_robin', 'audience_request']).optional().default('priority')
  }))

  if (isValidationError(bodyValidation)) return bodyValidation.error

  const data = bodyValidation.data

  try {
    const now = new Date().toISOString()

    // Check if profile exists
    const existing = await db
      .select()
      .from(schema.aiVenueProfiles)
      .limit(1)
      .get()

    const profileData = {
      openTime: data.openTime,
      closeTime: data.closeTime,
      timezone: data.timezone,
      fillerChannels: JSON.stringify(data.fillerChannels),
      fillerApps: JSON.stringify(data.fillerApps),
      defaultFillerMode: data.defaultFillerMode,
      autoRunEnabled: data.autoRunEnabled,
      autoRunTime: data.autoRunTime,
      alwaysShowLocalTeams: data.alwaysShowLocalTeams,
      nationalGameBoost: data.nationalGameBoost,
      playoffBoost: data.playoffBoost,
      conflictStrategy: data.conflictStrategy,
      updatedAt: now
    }

    let profile
    if (existing) {
      // Update existing profile
      await db
        .update(schema.aiVenueProfiles)
        .set(profileData)
        .where(eq(schema.aiVenueProfiles.id, existing.id))
        .run()

      profile = { ...existing, ...profileData }
      logger.info('[AI_VENUE_PROFILE] Updated venue profile')
    } else {
      // Create new profile
      const newProfile = {
        ...profileData,
        createdAt: now
      }

      await db.insert(schema.aiVenueProfiles).values(newProfile).run()
      profile = newProfile
      logger.info('[AI_VENUE_PROFILE] Created venue profile')
    }

    // Parse JSON fields for response
    const responseProfile = {
      ...profile,
      fillerChannels: data.fillerChannels,
      fillerApps: data.fillerApps
    }

    return NextResponse.json({
      success: true,
      profile: responseProfile,
      message: 'Venue profile saved successfully'
    })
  } catch (error: any) {
    logger.error('[AI_VENUE_PROFILE] Error saving profile:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to save venue profile',
      details: error.message
    }, { status: 500 })
  }
}
