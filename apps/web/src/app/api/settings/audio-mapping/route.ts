/**
 * Audio Zone Mapping API
 *
 * Stores and retrieves the mapping between Wolf Pack audio matrix outputs (37-40)
 * and AtlasIED audio source indices / zones. When the Wolf Pack routes a cable box
 * to an audio output (e.g. output 37), the Atlas needs to know which Atlas source
 * index that output feeds, and which Atlas zones should receive that source.
 *
 * GET  /api/settings/audio-mapping  — Returns current audio zone mapping
 * PUT  /api/settings/audio-mapping  — Save audio zone mapping
 *
 * Storage: SystemSettings table with key 'audio_zone_mapping', JSON value.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, z } from '@/lib/validation'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

const SETTING_KEY = 'audio_zone_mapping'

// --- Zod schemas ---

const audioOutputMappingSchema = z.object({
  atlasSourceIndex: z.number().int().min(0),
  atlasSourceName: z.string(),
  zones: z.array(z.number().int().min(0)),
})

const audioZoneMappingSchema = z.record(z.string(), audioOutputMappingSchema)

// --- Types ---

interface AudioOutputMapping {
  atlasSourceIndex: number
  atlasSourceName: string
  zones: number[]
}

type AudioZoneMapping = Record<string, AudioOutputMapping>

// --- Default empty mapping ---

const DEFAULT_MAPPING: AudioZoneMapping = {}

// --- Helpers ---

async function loadMapping(): Promise<AudioZoneMapping> {
  const setting = await db
    .select()
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, SETTING_KEY))
    .limit(1)
    .get()

  if (!setting) {
    return { ...DEFAULT_MAPPING }
  }

  try {
    return JSON.parse(setting.value) as AudioZoneMapping
  } catch {
    logger.warn('[AUDIO_MAPPING] Corrupt JSON in SystemSettings, returning empty mapping')
    return { ...DEFAULT_MAPPING }
  }
}

async function saveMapping(mapping: AudioZoneMapping): Promise<void> {
  const now = new Date().toISOString()
  const valueJson = JSON.stringify(mapping)

  const existing = await db
    .select()
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, SETTING_KEY))
    .limit(1)
    .get()

  if (existing) {
    await db
      .update(schema.systemSettings)
      .set({
        value: valueJson,
        updatedAt: now,
      })
      .where(eq(schema.systemSettings.key, SETTING_KEY))
  } else {
    await db.insert(schema.systemSettings).values({
      id: crypto.randomUUID(),
      key: SETTING_KEY,
      value: valueJson,
      description: 'Mapping between Wolf Pack audio outputs and AtlasIED source indices / zones',
      updatedAt: now,
    })
  }
}

// =============================================================================
// GET — Return current audio zone mapping
// =============================================================================

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    logger.info('[AUDIO_MAPPING] Retrieving audio zone mapping')
    const mapping = await loadMapping()

    return NextResponse.json({
      success: true,
      mapping,
    })
  } catch (error: any) {
    logger.error('[AUDIO_MAPPING] Error retrieving mapping:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve audio zone mapping' },
      { status: 500 }
    )
  }
}

// =============================================================================
// PUT — Save audio zone mapping
// =============================================================================

export async function PUT(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, audioZoneMappingSchema)
  if (!bodyValidation.success) return bodyValidation.error

  const mapping = bodyValidation.data

  try {
    logger.info('[AUDIO_MAPPING] Saving audio zone mapping', {
      outputCount: Object.keys(mapping).length,
      outputs: Object.keys(mapping),
    })

    await saveMapping(mapping as AudioZoneMapping)

    // Read back saved mapping
    const saved = await loadMapping()

    return NextResponse.json({
      success: true,
      message: 'Audio zone mapping saved',
      mapping: saved,
    })
  } catch (error: any) {
    logger.error('[AUDIO_MAPPING] Error saving mapping:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save audio zone mapping' },
      { status: 500 }
    )
  }
}
