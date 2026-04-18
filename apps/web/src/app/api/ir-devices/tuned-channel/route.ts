/**
 * POST /api/ir-devices/tuned-channel
 *
 * Called by the bartender's Cable Box remote AFTER the user completes a
 * digit-by-digit channel tune (on Enter press or after the 3-second
 * auto-clear timeout that catches Spectrum's auto-tune). Updates the
 * InputCurrentChannel table so the routing-matrix view and bartender
 * channel guide reflect what the bartender actually tuned.
 *
 * This closes the gap where /api/ir/commands/send fires per-digit and can't
 * know when the user is "done" — only the client knows the final channel.
 * Cable via IR is the only path that needs this: preset recall and DirecTV
 * IP tuning already write InputCurrentChannel server-side (they send the
 * full channel as a single command).
 */
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { findFirst, update } from '@/lib/db-helpers'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, z } from '@/lib/validation'

const TunedChannelSchema = z.object({
  deviceId: z.string().min(1),
  channelNumber: z.string().min(1).max(10),
  channelName: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, TunedChannelSchema)
  if (!bodyValidation.success) return bodyValidation.error

  const { deviceId, channelNumber, channelName } = bodyValidation.data

  try {
    // Look up the IRDevice to get its matrixInput + label for the upsert.
    // Without these we can't identify which input row to update.
    const device = await findFirst('irDevices', {
      where: eq(schema.irDevices.id, deviceId),
    })

    if (!device) {
      logger.warn(`[TUNED-CHANNEL] Unknown deviceId: ${deviceId}`)
      return NextResponse.json(
        { success: false, error: 'Unknown device' },
        { status: 404 },
      )
    }

    if (!device.matrixInput) {
      logger.warn(`[TUNED-CHANNEL] Device ${device.name} has no matrixInput mapping — cannot track`)
      return NextResponse.json(
        { success: false, error: 'Device has no matrix input assignment' },
        { status: 400 },
      )
    }

    const now = new Date()
    // Align the 2-hour manual-override window with channel-presets/tune so
    // the scheduler's auto-route logic honors bartender manual tunes the
    // same way regardless of whether the bartender used a preset or typed
    // the channel digit-by-digit.
    const manualOverrideUntil = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const nowIso = now.toISOString()

    const existing = await findFirst('inputCurrentChannels', {
      where: eq(schema.inputCurrentChannels.inputNum, device.matrixInput),
    })

    if (existing) {
      await update(
        'inputCurrentChannels',
        eq(schema.inputCurrentChannels.id, existing.id),
        {
          channelNumber,
          channelName: channelName || null,
          presetId: null, // manual tune clears any preset association
          lastTuned: nowIso,
          updatedAt: nowIso,
          manualOverrideUntil: manualOverrideUntil.toISOString(),
          lastManualChangeBy: 'bartender',
          lastManualChangeAt: nowIso,
          deviceType: 'cable',
          deviceId: device.id,
        },
      )
    } else {
      await db.insert(schema.inputCurrentChannels).values({
        id: crypto.randomUUID(),
        inputNum: device.matrixInput,
        inputLabel: device.matrixInputLabel || device.name,
        deviceType: 'cable',
        deviceId: device.id,
        channelNumber,
        channelName: channelName || null,
        presetId: null,
        lastTuned: nowIso,
        updatedAt: nowIso,
        manualOverrideUntil: manualOverrideUntil.toISOString(),
        lastManualChangeBy: 'bartender',
        lastManualChangeAt: nowIso,
      })
    }

    logger.info(
      `[TUNED-CHANNEL] ${device.name} (input ${device.matrixInput}) -> channel ${channelNumber}`,
    )

    return NextResponse.json({
      success: true,
      inputNum: device.matrixInput,
      channelNumber,
    })
  } catch (error: any) {
    logger.error('[TUNED-CHANNEL] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal error' },
      { status: 500 },
    )
  }
}
