import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@sports-bar/logger'
import { reportToFlywheel } from '@/lib/flywheel'

/**
 * v2.82.42 — Scout play-result sink. Scout (com.sportsbar.scout, v2.2.12+) POSTs the outcome of
 * every PLAY_GAME attempt here on the device's LOCAL box (serverUrl is per-location). Closes the
 * Scout feedback loop: outcomes are logged + fed to the Honcho ops flywheel so Hermes learns which
 * titles/apps/devices reliably reach playback vs silently fail. No new table — the flywheel is the
 * learning channel; the logger gives PM2 visibility.
 *
 * Body: { deviceId, deviceName, ipAddress, scoutVersion, result, message, matchedText,
 *         targetPackage, tokens, attempts }
 * result ∈ clicked | click_failed | no_match | bad_tokens
 */
export async function POST(request: NextRequest) {
  try {
    const b: any = await request.json().catch(() => ({}))
    const dev = b?.deviceName || b?.deviceId || b?.ipAddress || 'device'
    const result = String(b?.result || 'unknown')
    const ok = result === 'clicked'
    const line =
      `Scout play-result: ${dev} (Scout ${b?.scoutVersion || '?'}) → ${result} ` +
      `on ${b?.targetPackage || '?'} | tokens=[${b?.tokens || ''}] ` +
      `matched="${String(b?.matchedText || '').slice(0, 80)}"` +
      (b?.message ? ` | ${b.message}` : '')
    logger[ok ? 'info' : 'warn'](`[SCOUT-RESULT] ${line}`)
    // Feed the ops flywheel (best-effort, fire-and-forget) so Hermes accumulates Scout reliability.
    reportToFlywheel('hermes-scout-results', line)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    logger.error('[SCOUT-RESULT] error handling play-result:', err)
    return NextResponse.json({ success: false, error: err?.message || 'error' }, { status: 500 })
  }
}
