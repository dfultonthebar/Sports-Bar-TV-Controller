import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

const SETTING_KEY = 'ai-scheduler-allowed-outputs'

// GET - Retrieve allowed outputs for AI scheduler
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
      // Return empty array if no setting exists (means all outputs allowed)
      return NextResponse.json({
        success: true,
        allowedOutputs: [],
        message: 'No restriction set - all outputs allowed'
      })
    }

    const allowedOutputs = JSON.parse(setting.value)
    logger.info(`[AI_ALLOWED_OUTPUTS] Retrieved ${allowedOutputs.length} allowed outputs`)

    return NextResponse.json({
      success: true,
      allowedOutputs,
      updatedAt: setting.updatedAt
    })
  } catch (error: any) {
    logger.error('[AI_ALLOWED_OUTPUTS] Error retrieving allowed outputs:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST - Save allowed outputs for AI scheduler
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const body = await request.json()
    const { allowedOutputs } = body

    if (!Array.isArray(allowedOutputs)) {
      return NextResponse.json(
        { success: false, error: 'allowedOutputs must be an array of channel numbers' },
        { status: 400 }
      )
    }

    // Validate all entries are numbers
    const validOutputs = allowedOutputs.filter(n => typeof n === 'number')
    const outputsJson = JSON.stringify(validOutputs)

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
          value: outputsJson,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.systemSettings.key, SETTING_KEY))
    } else {
      // Insert new
      await db.insert(schema.systemSettings).values({
        id: crypto.randomUUID(),
        key: SETTING_KEY,
        value: outputsJson,
        description: 'TV outputs allowed for AI game scheduler (channel numbers)',
        updatedAt: new Date().toISOString()
      })
    }

    logger.info(`[AI_ALLOWED_OUTPUTS] Saved ${validOutputs.length} allowed outputs: [${validOutputs.join(', ')}]`)

    return NextResponse.json({
      success: true,
      allowedOutputs: validOutputs,
      message: `Saved ${validOutputs.length} allowed outputs`
    })
  } catch (error: any) {
    logger.error('[AI_ALLOWED_OUTPUTS] Error saving allowed outputs:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
