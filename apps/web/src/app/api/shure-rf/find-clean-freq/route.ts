/**
 * POST /api/shure-rf/find-clean-freq
 *
 * Software equivalent of the receiver's front-panel Group Scan, since
 * Shure SLX-D firmware 1.4.7.0 does NOT expose scan over the TCP 2202
 * control protocol (16 candidate command variants all returned
 * < REP ERR > when probed live on the Holmgren unit 2026-05-18).
 *
 * Tunes the target channel through a list of candidate frequencies
 * within the receiver's RF band, dwells 2-3 seconds at each, samples
 * the RSSI floor (no TX paired = pure ambient noise + interferer
 * level), and returns a ranked list quietest-first. The operator
 * then PATCHes the channel to the suggested freq via the existing
 * /api/shure-rf/channel endpoint.
 *
 * COST OF RUNNING:
 *   - One audio click on the swept channel for each candidate tune.
 *   - Channel is unusable during the sweep window (~30-45 seconds).
 *   - GROUP_CHAN ends up at the LAST swept freq, NOT what it was
 *     before — caller must PATCH to a final freq or accept the
 *     candidate it landed on.
 *
 * SAFETY:
 *   - ADMIN-gated.
 *   - HARDWARE rate-limit bucket.
 *   - Refuses to run if the channel currently has a TX paired
 *     (txBattBars in 1-5) — that would mute the live mic mid-event.
 *     Operator must power off the handheld first.
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

// G58 band (470-514 MHz on SLX-D US). Candidates avoid the high-power
// TV repack-era allocations that overlap G58 in Green Bay:
//   WCWF (CW 14) RF ch 14 = 470-476 MHz
//   WLUK (Fox 11) RF ch 19 = 500-506 MHz
// Spacing is 1.5-3 MHz between adjacent candidates so we sample the
// band reasonably densely without taking forever. Caller can override
// via the `candidates` body field for other RF bands or locations.
const G58_DEFAULT_CANDIDATES: number[] = [
  478.000, 481.000, 484.000, 486.500, 489.000, 491.500,
  494.500, 497.000, 498.500, 508.000, 510.500, 512.500,
]

const findCleanSchema = z.object({
  receiverId: z.string().min(1).max(64),
  channel: z.number().int().min(1).max(4),
  // Default 2s dwell per freq — the receiver pushes SAMPLE at 1Hz
  // when METER_RATE=1000, so 2s gives us 2 RSSI samples per
  // candidate. First sample is dropped (retune transient).
  dwellMs: z.number().int().min(1000).max(10_000).default(2_500),
  // Optional explicit candidate list. If omitted, use the G58 default
  // above. Useful for H55 / J50A / J52A bands or location-specific
  // exclusion lists.
  candidates: z.array(z.number().min(174).max(960)).max(40).optional(),
})

type SweepResult = {
  freq: number
  samples: number
  avgRssi: number
  maxRssi: number
  verdict: 'clean' | 'quiet' | 'moderate' | 'noisy'
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const authCheck = await requireAuth(request, 'ADMIN', { auditAction: 'shure_find_clean_freq' })
  if (!authCheck.allowed) return authCheck.response!

  const bodyValidation = await validateRequestBody(request, findCleanSchema)
  if (!bodyValidation.success) return bodyValidation.error
  const { receiverId, channel, dwellMs, candidates: customCandidates } = bodyValidation.data
  const candidates = customCandidates ?? G58_DEFAULT_CANDIDATES

  // Resolve receiver.
  const rows = await db
    .select()
    .from(schema.audioProcessors)
    .where(eq(schema.audioProcessors.id, receiverId))
    .all()
  const processor = rows[0]
  if (!processor || processor.processorType !== 'shure-slxd' || !processor.ipAddress) {
    return NextResponse.json(
      { success: false, error: 'Shure SLX-D receiver not found' },
      { status: 404 },
    )
  }

  const client = await getShureSlxdClient(receiverId, {
    ipAddress: processor.ipAddress,
    port: processor.tcpPort ?? 2202,
    receiverId,
    receiverName: processor.name || processor.ipAddress,
    autoReconnect: true,
  })

  // Refuse to sweep if a TX is currently paired — would mute a live mic.
  const stateBefore = client.getChannelState(channel)
  if (
    stateBefore?.txBattBars !== undefined &&
    stateBefore.txBattBars !== 255 &&
    stateBefore.txBattBars >= 1
  ) {
    return NextResponse.json(
      {
        success: false,
        error: 'Channel has a TX paired and powered (battery bars > 0). Sweep would mute the live mic. Power off the handheld first.',
      },
      { status: 409 },
    )
  }

  const startFreq = stateBefore?.frequencyMhz
  const startGainDb = stateBefore?.audioGainDb ?? 0
  logger.info(
    `[SHURE-FIND-CLEAN-FREQ] ${processor.name} ch${channel} sweep across ${candidates.length} freqs ` +
      `(dwell ${dwellMs}ms, start ${startFreq ?? '?'} MHz, gain ${startGainDb} dB)`,
  )

  // Safety: drop audio gain to minimum (-18 dB) before the sweep so
  // that if we land on a freq where another Shure-compatible TX is
  // active (and the receiver successfully demodulates someone else's
  // audio), the bar speakers don't get blown out. SLX-D auto-mutes
  // when TX_MODEL=UNKNOWN so this is belt-and-suspenders for the rare
  // case of another SLXD2-compatible carrier on a swept freq. Restore
  // on completion.
  await client.setAudioGain(channel, -18)
  await new Promise((r) => setTimeout(r, 300))

  const samples: Record<number, number[]> = {}
  const listener = (ch: number, state: { rssiDbm?: number; frequencyMhz?: number }) => {
    if (ch !== channel) return
    if (state.rssiDbm === undefined || state.frequencyMhz === undefined) return
    // Match to current candidate by nearest 25 kHz step.
    const matched = candidates.find((c) => Math.abs(c - state.frequencyMhz!) < 0.013)
    if (matched === undefined) return
    if (!samples[matched]) samples[matched] = []
    samples[matched].push(state.rssiDbm)
  }
  client.on('stateChange', listener)

  try {
    for (const freq of candidates) {
      samples[freq] = []
      await client.setFrequencyMhz(channel, freq)
      await new Promise((r) => setTimeout(r, dwellMs))
    }
  } finally {
    client.off('stateChange', listener)
    // Restore the channel's original audio gain. Frequency stays on
    // the last swept value — caller PATCHes to the final pick.
    await client.setAudioGain(channel, startGainDb)
  }

  // Build ranked results — drop the first sample at each freq (retune
  // transient), rank by average RSSI ascending (quietest first).
  const results: SweepResult[] = candidates.map((freq) => {
    const data = (samples[freq] ?? []).slice(1)
    if (data.length === 0) {
      return { freq, samples: 0, avgRssi: 0, maxRssi: 0, verdict: 'moderate' as const }
    }
    const avg = data.reduce((a, b) => a + b, 0) / data.length
    const max = Math.max(...data)
    const verdict: SweepResult['verdict'] =
      avg <= -98 ? 'clean' : avg <= -90 ? 'quiet' : avg <= -80 ? 'moderate' : 'noisy'
    return { freq, samples: data.length, avgRssi: avg, maxRssi: max, verdict }
  })
  results.sort((a, b) => a.avgRssi - b.avgRssi)

  const best = results.find((r) => r.samples > 0)
  logger.info(
    `[SHURE-FIND-CLEAN-FREQ] sweep complete — best ${best?.freq.toFixed(3) ?? '?'} MHz ` +
      `(${best?.avgRssi.toFixed(1) ?? '?'} dBm avg, ${best?.verdict ?? '?'})`,
  )

  return NextResponse.json({
    success: true,
    receiverId,
    channel,
    candidateCount: candidates.length,
    dwellMs,
    startFreqMhz: startFreq,
    endFreqMhz: candidates[candidates.length - 1],
    results,
    best: best
      ? { freqMhz: best.freq, avgRssi: best.avgRssi, verdict: best.verdict }
      : null,
    warnings: [
      'Channel is now tuned to the LAST swept frequency, not the original. PATCH /api/shure-rf/channel with the desired freq to apply.',
      'TX handheld will need re-SYNC via IR (Menu → SYNC on the receiver) once the final freq is applied.',
    ],
  })
}
