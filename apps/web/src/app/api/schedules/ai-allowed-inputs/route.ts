import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

const SETTING_KEY = 'ai-scheduler-allowed-inputs'

// GET - Retrieve allowed inputs for AI scheduler
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const setting = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, SETTING_KEY))
      .limit(1)
      .get()

    if (!setting) {
      // Return empty array if no setting exists (means all inputs allowed)
      return NextResponse.json({
        success: true,
        allowedInputs: [],
        message: 'No restriction set - all inputs allowed'
      })
    }

    const allowedInputs = JSON.parse(setting.value)
    logger.info(`[AI_ALLOWED_INPUTS] Retrieved ${allowedInputs.length} allowed inputs`)

    return NextResponse.json({
      success: true,
      allowedInputs,
      updatedAt: setting.updatedAt
    })
  } catch (error: any) {
    logger.error('[AI_ALLOWED_INPUTS] Error retrieving allowed inputs:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST - Save allowed inputs for AI scheduler
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const body = await request.json()
    const { allowedInputs } = body

    if (!Array.isArray(allowedInputs)) {
      return NextResponse.json(
        { success: false, error: 'allowedInputs must be an array of input numbers' },
        { status: 400 }
      )
    }

    // Validate all entries are numbers
    const validInputs = allowedInputs.filter(n => typeof n === 'number')
    const inputsJson = JSON.stringify(validInputs)

    // Check if setting exists
    const existing = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, SETTING_KEY))
      .limit(1)
      .get()

    if (existing) {
      // Update existing
      await db
        .update(schema.systemSettings)
        .set({
          value: inputsJson,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.systemSettings.key, SETTING_KEY))
    } else {
      // Insert new
      await db.insert(schema.systemSettings).values({
        id: crypto.randomUUID(),
        key: SETTING_KEY,
        value: inputsJson,
        description: 'Input sources allowed for AI game scheduler (input channel numbers)',
        updatedAt: new Date().toISOString()
      })
    }

    logger.info(`[AI_ALLOWED_INPUTS] Saved ${validInputs.length} allowed inputs: [${validInputs.join(', ')}]`)

    return NextResponse.json({
      success: true,
      allowedInputs: validInputs,
      message: `Saved ${validInputs.length} allowed inputs`
    })
  } catch (error: any) {
    logger.error('[AI_ALLOWED_INPUTS] Error saving allowed inputs:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
