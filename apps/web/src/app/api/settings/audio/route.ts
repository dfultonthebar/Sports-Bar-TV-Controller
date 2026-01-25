/**
 * API Route: Audio Visibility Settings
 *
 * Controls whether HTD and other audio controls appear on the Bartender Remote
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

const SETTING_KEYS = {
  HTD_ENABLED: 'htd_audio_enabled',
}

// Default values if settings don't exist
const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.HTD_ENABLED]: 'false',
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
        description: description || `Audio setting: ${key}`,
        updatedAt: new Date().toISOString(),
      })
      .run()
  }
}

export async function GET() {
  try {
    const htdEnabled = await getSetting(SETTING_KEYS.HTD_ENABLED)

    return NextResponse.json({
      success: true,
      data: {
        htdEnabled: htdEnabled === 'true',
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`[SETTINGS] Error fetching audio settings: ${errorMessage}`)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { htdEnabled } = body

    const updates: Promise<void>[] = []

    if (typeof htdEnabled === 'boolean') {
      updates.push(
        setSetting(
          SETTING_KEYS.HTD_ENABLED,
          htdEnabled.toString(),
          'Enable HTD Whole-House Audio controls on Bartender Remote'
        )
      )
    }

    await Promise.all(updates)

    // Fetch updated values
    const updatedHtdEnabled = await getSetting(SETTING_KEYS.HTD_ENABLED)

    logger.info(`[SETTINGS] Audio settings updated: htdEnabled=${updatedHtdEnabled === 'true'}`)

    return NextResponse.json({
      success: true,
      data: {
        htdEnabled: updatedHtdEnabled === 'true',
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`[SETTINGS] Error updating audio settings: ${errorMessage}`)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
