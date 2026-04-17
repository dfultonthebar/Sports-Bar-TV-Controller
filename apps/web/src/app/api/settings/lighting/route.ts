/**
 * API Route: Lighting Visibility Settings
 *
 * Controls whether DMX and Commercial Lighting tabs appear on the Bartender Remote
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

const SETTING_KEYS = {
  DMX_ENABLED: 'dmx_lighting_enabled',
  COMMERCIAL_ENABLED: 'commercial_lighting_enabled',
  DJ_ENABLED: 'dj_controls_enabled',
}

// Default values if settings don't exist
const DEFAULTS = {
  [SETTING_KEYS.DMX_ENABLED]: 'false',
  [SETTING_KEYS.COMMERCIAL_ENABLED]: 'false',
  [SETTING_KEYS.DJ_ENABLED]: 'false',
}

async function getSetting(key: string): Promise<string> {
  const setting = await db
    .select()
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, key))
    .get()

  return setting?.value ?? DEFAULTS[key] ?? 'false'
}

async function setSetting(key: string, value: string, description?: string): Promise<void> {
  const existing = await db
    .select()
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, key))
    .get()

  if (existing) {
    await db
      .update(schema.systemSettings)
      .set({ value, updatedAt: new Date().toISOString() })
      .where(eq(schema.systemSettings.key, key))
      .run()
  } else {
    await db
      .insert(schema.systemSettings)
      .values({
        key,
        value,
        description: description || `Lighting setting: ${key}`,
        updatedAt: new Date().toISOString(),
      })
      .run()
  }
}

export async function GET() {
  try {
    const [dmxEnabled, commercialEnabled, djEnabled] = await Promise.all([
      getSetting(SETTING_KEYS.DMX_ENABLED),
      getSetting(SETTING_KEYS.COMMERCIAL_ENABLED),
      getSetting(SETTING_KEYS.DJ_ENABLED),
    ])

    return NextResponse.json({
      success: true,
      data: {
        dmxLightingEnabled: dmxEnabled === 'true',
        commercialLightingEnabled: commercialEnabled === 'true',
        djControlsEnabled: djEnabled === 'true',
      },
    })
  } catch (error: any) {
    logger.error('[SETTINGS] Error fetching lighting settings:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { dmxLightingEnabled, commercialLightingEnabled, djControlsEnabled } = body

    const updates: Promise<void>[] = []

    if (typeof dmxLightingEnabled === 'boolean') {
      updates.push(
        setSetting(
          SETTING_KEYS.DMX_ENABLED,
          dmxLightingEnabled.toString(),
          'Enable DMX Lighting controls on Bartender Remote'
        )
      )
    }

    if (typeof commercialLightingEnabled === 'boolean') {
      updates.push(
        setSetting(
          SETTING_KEYS.COMMERCIAL_ENABLED,
          commercialLightingEnabled.toString(),
          'Enable Commercial Lighting controls on Bartender Remote'
        )
      )
    }

    if (typeof djControlsEnabled === 'boolean') {
      updates.push(
        setSetting(
          SETTING_KEYS.DJ_ENABLED,
          djControlsEnabled.toString(),
          'Enable DJ controls on Bartender Remote'
        )
      )
    }

    await Promise.all(updates)

    // Fetch updated values
    const [dmxEnabled, commercialEnabled, djEnabled] = await Promise.all([
      getSetting(SETTING_KEYS.DMX_ENABLED),
      getSetting(SETTING_KEYS.COMMERCIAL_ENABLED),
      getSetting(SETTING_KEYS.DJ_ENABLED),
    ])

    logger.info('[SETTINGS] Bartender remote settings updated', {
      dmxLightingEnabled: dmxEnabled === 'true',
      commercialLightingEnabled: commercialEnabled === 'true',
      djControlsEnabled: djEnabled === 'true',
    })

    return NextResponse.json({
      success: true,
      data: {
        dmxLightingEnabled: dmxEnabled === 'true',
        commercialLightingEnabled: commercialEnabled === 'true',
        djControlsEnabled: djEnabled === 'true',
      },
    })
  } catch (error: any) {
    logger.error('[SETTINGS] Error updating lighting settings:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
