/**
 * PATCH /api/shure-rf/channel
 *
 * Operator edits to a Shure SLX-D channel — rename, retune frequency,
 * adjust audio gain. Replaces front-panel menu navigation so stadium
 * IT changes happen from the iPad.
 *
 * Body: {
 *   receiverId: string   // AudioProcessor.id row
 *   channel:    number   // 1 or 2 on SLXD4D
 *   name?:      string   // 1-31 chars, replaces CHAN_NAME
 *   freqMhz?:   number   // e.g. 537.125 → 6-digit kHz on the wire
 *   audioGain?: number   // dB trim (-32..+32 on SLX-D)
 * }
 *
 * The receiver SILENTLY drops out-of-range SETs (no ERR frame in
 * SLX-D protocol). After SET we re-query the property and return
 * the read-back value so the UI can confirm the change took.
 *
 * Freq retune gotchas surfaced live on the Holmgren SLXD4D:
 *   - SET FREQUENCY also blanks GROUP_CHAN to '--,--' (Manual mode)
 *   - Produces an immediate audio click on that channel
 *   - The handheld TX must be RE-SYNCed via IR after the freq change
 *     (Menu → SYNC on the receiver, point at TX's IR window). The UI
 *     should warn the operator on a freq edit.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody } from '@sports-bar/validation'
import { z } from 'zod'
import { logger } from '@sports-bar/logger'
import { requireAuth } from '@/lib/auth'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { getShureSlxdClient } from '@sports-bar/shure-slxd'

// Channel-name: Shure pads to 31 chars internally. Allow operator to
// enter a clean string; the receiver pads. Reject angle/brace chars
// since they confuse the protocol's framing/braced-string syntax.
const channelPatchSchema = z.object({
  receiverId: z.string().min(1).max(64),
  channel: z.number().int().min(1).max(4),
  name: z.string().min(1).max(31).regex(/^[^<>{}]+$/).optional(),
  freqMhz: z.number().min(174).max(960).optional(),
  audioGain: z.number().int().min(-32).max(32).optional(),
})

export async function PATCH(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const authCheck = await requireAuth(request, 'ADMIN', { auditAction: 'shure_channel_edit' })
  if (!authCheck.allowed) return authCheck.response!

  const bodyValidation = await validateRequestBody(request, channelPatchSchema)
  if (!bodyValidation.success) return bodyValidation.error
  const { receiverId, channel, name, freqMhz, audioGain } = bodyValidation.data

  if (name === undefined && freqMhz === undefined && audioGain === undefined) {
    return NextResponse.json(
      { success: false, error: 'No fields to update' },
      { status: 400 },
    )
  }

  // Resolve receiver from DB.
  const rows = await db
    .select()
    .from(schema.audioProcessors)
    .where(eq(schema.audioProcessors.id, receiverId))
    .all()
  const processor = rows[0]
  if (!processor || processor.processorType !== 'shure-slxd') {
    return NextResponse.json(
      { success: false, error: 'Shure SLX-D receiver not found' },
      { status: 404 },
    )
  }
  if (!processor.ipAddress) {
    return NextResponse.json(
      { success: false, error: 'Receiver has no IP address configured' },
      { status: 400 },
    )
  }

  try {
    const client = await getShureSlxdClient(receiverId, {
      ipAddress: processor.ipAddress,
      port: processor.tcpPort ?? 2202,
      receiverId,
      receiverName: processor.name || processor.ipAddress,
      autoReconnect: true,
    })

    const applied: Record<string, unknown> = {}
    if (name !== undefined) {
      await client.setChannelName(channel, name)
      applied.name = name
      logger.info(`[SHURE-CHANNEL-EDIT] ${processor.name} ch${channel} name → "${name}"`)
    }
    if (freqMhz !== undefined) {
      await client.setFrequencyMhz(channel, freqMhz)
      applied.freqMhz = freqMhz
      logger.warn(
        `[SHURE-CHANNEL-EDIT] ${processor.name} ch${channel} freq → ${freqMhz} MHz ` +
          `(GROUP_CHAN reset to Manual; TX requires re-SYNC)`,
      )
    }
    if (audioGain !== undefined) {
      await client.setAudioGain(channel, audioGain)
      applied.audioGain = audioGain
      logger.info(`[SHURE-CHANNEL-EDIT] ${processor.name} ch${channel} gain → ${audioGain} dB`)
    }

    // Give the receiver ~400 ms to REP the new values back through
    // the existing frame handler so getChannelState reflects truth.
    await new Promise((r) => setTimeout(r, 400))
    const stateAfter = client.getChannelState(channel)

    return NextResponse.json({
      success: true,
      applied,
      state: stateAfter
        ? {
            channelName: stateAfter.channelName,
            frequencyMhz: stateAfter.frequencyMhz,
            audioGainDb: stateAfter.audioGainDb,
            groupChannel: stateAfter.groupChannel,
          }
        : null,
      warnings: freqMhz !== undefined
        ? ['Frequency change requires TX re-SYNC via IR (Menu → SYNC on the receiver)']
        : [],
    })
  } catch (err) {
    logger.error('[SHURE-CHANNEL-EDIT] failed:', (err as Error)?.message ?? err)
    return NextResponse.json(
      { success: false, error: (err as Error)?.message ?? 'channel edit failed' },
      { status: 500 },
    )
  }
}
