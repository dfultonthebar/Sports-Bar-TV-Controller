/**
 * Default Source Configuration API
 *
 * Stores and retrieves default source configuration for TV outputs.
 * When no game is scheduled on a TV, it should display its default source
 * (e.g., Atmosphere TV, EverPass, a specific cable channel).
 *
 * GET  /api/settings/default-sources  — Returns current default source settings
 * PUT  /api/settings/default-sources  — Save default source configuration
 * POST /api/settings/default-sources  — Apply defaults NOW to unallocated outputs
 *
 * Storage: SystemSettings table with key 'default_sources', JSON value.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, z } from '@/lib/validation'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

const SETTING_KEY = 'default_sources'

// --- Zod schemas ---

const sourceConfigSchema = z.object({
  inputNumber: z.number().int().min(1),
  inputLabel: z.string().optional(),
  channelNumber: z.string().optional(),
})

const defaultSourcesSchema = z.object({
  globalDefault: sourceConfigSchema.optional(),
  roomDefaults: z.record(z.string(), sourceConfigSchema).optional(),
  outputDefaults: z.record(z.string(), sourceConfigSchema).optional(),
})

// --- Default empty config ---

interface SourceConfig {
  inputNumber: number
  inputLabel?: string
  channelNumber?: string
}

interface DefaultSourcesConfig {
  globalDefault?: SourceConfig
  roomDefaults?: Record<string, SourceConfig>
  outputDefaults?: Record<string, SourceConfig>
}

const EMPTY_DEFAULTS: DefaultSourcesConfig = {
  globalDefault: undefined,
  roomDefaults: {},
  outputDefaults: {},
}

// --- Helpers ---

async function loadDefaults(): Promise<DefaultSourcesConfig> {
  const setting = await db
    .select()
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, SETTING_KEY))
    .limit(1)
    .get()

  if (!setting) {
    return { ...EMPTY_DEFAULTS }
  }

  try {
    return JSON.parse(setting.value) as DefaultSourcesConfig
  } catch {
    logger.warn('[DEFAULT_SOURCES] Corrupt JSON in SystemSettings, returning empty defaults')
    return { ...EMPTY_DEFAULTS }
  }
}

async function saveDefaults(config: DefaultSourcesConfig): Promise<void> {
  const now = new Date().toISOString()
  const valueJson = JSON.stringify(config)

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
      description: 'Default source configuration for TV outputs when no games are scheduled',
      updatedAt: now,
    })
  }
}

/**
 * Resolve the effective default source for a given output.
 * Priority: outputDefaults > roomDefaults (by tvGroupId) > globalDefault
 */
function resolveDefaultForOutput(
  outputNum: number,
  tvGroupId: string | null,
  config: DefaultSourcesConfig
): SourceConfig | null {
  // 1. Output-specific override
  const outputKey = String(outputNum)
  if (config.outputDefaults && config.outputDefaults[outputKey]) {
    return config.outputDefaults[outputKey]
  }

  // 2. Room/group override
  if (tvGroupId && config.roomDefaults && config.roomDefaults[tvGroupId]) {
    return config.roomDefaults[tvGroupId]
  }

  // 3. Global default
  if (config.globalDefault) {
    return config.globalDefault
  }

  return null
}

// =============================================================================
// GET — Return current default source settings
// =============================================================================

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    logger.info('[DEFAULT_SOURCES] Retrieving default source configuration')
    const defaults = await loadDefaults()

    return NextResponse.json({
      success: true,
      defaults,
    })
  } catch (error: any) {
    logger.error('[DEFAULT_SOURCES] Error retrieving defaults:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve default sources' },
      { status: 500 }
    )
  }
}

// =============================================================================
// PUT — Save default source configuration
// =============================================================================

export async function PUT(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, defaultSourcesSchema)
  if (!bodyValidation.success) return bodyValidation.error

  const config = bodyValidation.data

  try {
    logger.info('[DEFAULT_SOURCES] Saving default source configuration', {
      hasGlobalDefault: !!config.globalDefault,
      roomDefaultCount: config.roomDefaults ? Object.keys(config.roomDefaults).length : 0,
      outputDefaultCount: config.outputDefaults ? Object.keys(config.outputDefaults).length : 0,
    })

    await saveDefaults(config as DefaultSourcesConfig)

    // Read back saved config
    const saved = await loadDefaults()

    return NextResponse.json({
      success: true,
      message: 'Default source configuration saved',
      defaults: saved,
    })
  } catch (error: any) {
    logger.error('[DEFAULT_SOURCES] Error saving defaults:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save default sources' },
      { status: 500 }
    )
  }
}

// =============================================================================
// POST — Apply defaults NOW to outputs without active game allocations
// =============================================================================

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    logger.info('[DEFAULT_SOURCES] Applying default sources to unallocated outputs')

    // 1. Load default source config
    const config = await loadDefaults()
    if (!config.globalDefault && (!config.roomDefaults || Object.keys(config.roomDefaults).length === 0) && (!config.outputDefaults || Object.keys(config.outputDefaults).length === 0)) {
      return NextResponse.json(
        { success: false, error: 'No default source configuration has been set. Configure defaults first.' },
        { status: 400 }
      )
    }

    // 2. Get all active outputs
    const activeConfig = await db
      .select()
      .from(schema.matrixConfigurations)
      .where(eq(schema.matrixConfigurations.isActive, true))
      .limit(1)
      .get()

    if (!activeConfig) {
      return NextResponse.json(
        { success: false, error: 'No active matrix configuration found' },
        { status: 404 }
      )
    }

    const outputs = await db
      .select()
      .from(schema.matrixOutputs)
      .where(
        and(
          eq(schema.matrixOutputs.configId, activeConfig.id),
          eq(schema.matrixOutputs.isActive, true)
        )
      )
      .all()

    // 3. Get currently active allocations (outputs with games scheduled)
    const activeAllocations = await db
      .select()
      .from(schema.inputSourceAllocations)
      .where(eq(schema.inputSourceAllocations.status, 'active'))
      .all()

    // Build a set of output channel numbers that have active game allocations.
    // tvOutputIds is stored as a JSON array of matrix output IDs (strings).
    const allocatedOutputIds = new Set<string>()
    for (const allocation of activeAllocations) {
      try {
        const outputIds: string[] = JSON.parse(allocation.tvOutputIds)
        for (const id of outputIds) {
          allocatedOutputIds.add(id)
        }
      } catch {
        // Skip malformed allocation entries
      }
    }

    // Also check for pending allocations that are about to start
    const pendingAllocations = await db
      .select()
      .from(schema.inputSourceAllocations)
      .where(eq(schema.inputSourceAllocations.status, 'pending'))
      .all()

    for (const allocation of pendingAllocations) {
      try {
        const outputIds: string[] = JSON.parse(allocation.tvOutputIds)
        for (const id of outputIds) {
          allocatedOutputIds.add(id)
        }
      } catch {
        // Skip malformed entries
      }
    }

    // 4. For each unallocated output, apply the default source
    const results: Array<{
      outputNum: number
      outputLabel: string
      inputNumber: number
      inputLabel: string | undefined
      status: 'routed' | 'skipped_allocated' | 'skipped_no_default' | 'failed'
      error?: string
    }> = []

    const baseUrl = request.nextUrl.origin

    for (const output of outputs) {
      const outputNum = output.channelNumber

      // Check if this output has an active game allocation
      if (allocatedOutputIds.has(output.id)) {
        results.push({
          outputNum,
          outputLabel: output.label,
          inputNumber: 0,
          inputLabel: undefined,
          status: 'skipped_allocated',
        })
        continue
      }

      // Resolve the default source for this output
      const defaultSource = resolveDefaultForOutput(
        outputNum,
        output.tvGroupId,
        config
      )

      if (!defaultSource) {
        results.push({
          outputNum,
          outputLabel: output.label,
          inputNumber: 0,
          inputLabel: undefined,
          status: 'skipped_no_default',
        })
        continue
      }

      // Route via the matrix route API
      try {
        const routeResponse = await fetch(`${baseUrl}/api/matrix/route`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: defaultSource.inputNumber,
            output: outputNum,
            source: 'system',
          }),
        })

        if (routeResponse.ok) {
          results.push({
            outputNum,
            outputLabel: output.label,
            inputNumber: defaultSource.inputNumber,
            inputLabel: defaultSource.inputLabel,
            status: 'routed',
          })
          logger.info(
            `[DEFAULT_SOURCES] Routed output ${outputNum} (${output.label}) → input ${defaultSource.inputNumber} (${defaultSource.inputLabel || 'unknown'})`
          )
        } else {
          const errorData = await routeResponse.json().catch(() => ({ error: 'Unknown error' }))
          results.push({
            outputNum,
            outputLabel: output.label,
            inputNumber: defaultSource.inputNumber,
            inputLabel: defaultSource.inputLabel,
            status: 'failed',
            error: errorData.error || `HTTP ${routeResponse.status}`,
          })
          logger.warn(
            `[DEFAULT_SOURCES] Failed to route output ${outputNum}: ${errorData.error || routeResponse.status}`
          )
        }
      } catch (routeError: any) {
        results.push({
          outputNum,
          outputLabel: output.label,
          inputNumber: defaultSource.inputNumber,
          inputLabel: defaultSource.inputLabel,
          status: 'failed',
          error: routeError.message,
        })
        logger.error(`[DEFAULT_SOURCES] Error routing output ${outputNum}:`, routeError)
      }
    }

    const routed = results.filter((r) => r.status === 'routed').length
    const skippedAllocated = results.filter((r) => r.status === 'skipped_allocated').length
    const skippedNoDefault = results.filter((r) => r.status === 'skipped_no_default').length
    const failed = results.filter((r) => r.status === 'failed').length

    logger.info(
      `[DEFAULT_SOURCES] Apply complete: ${routed} routed, ${skippedAllocated} skipped (allocated), ${skippedNoDefault} skipped (no default), ${failed} failed`
    )

    return NextResponse.json({
      success: true,
      message: `Applied defaults: ${routed} outputs routed, ${skippedAllocated} skipped (games active), ${failed} failed`,
      summary: {
        routed,
        skippedAllocated,
        skippedNoDefault,
        failed,
        total: results.length,
      },
      results,
    })
  } catch (error: any) {
    logger.error('[DEFAULT_SOURCES] Error applying defaults:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to apply default sources' },
      { status: 500 }
    )
  }
}
