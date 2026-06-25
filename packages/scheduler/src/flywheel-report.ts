/**
 * Fleet-ops flywheel capture for the SCHEDULER package. Self-contained twin of
 * apps/web/src/lib/flywheel.ts — the scheduler runs in @sports-bar/scheduler and
 * CANNOT import the web app's @/lib/flywheel. Fire-and-forget POST of a scheduled
 * auto-tune outcome to the Honcho fleet-ops-log session (CT213) so the local
 * fleet-ops model learns from EVERY scheduled tune — success, failure, and the
 * "tuned but on 0 TVs" mode (2026-06-24 Greenville Brewers). Never throws, never blocks.
 *
 * peer convention: 'fleet-scheduler' (scheduled auto-tune outcomes).
 */
const HONCHO_BASE = process.env.HONCHO_BASE || 'http://100.90.175.125:8000'

export function reportSchedulerToFlywheel(peer: string, content: string): void {
  try {
    void fetch(`${HONCHO_BASE}/v3/workspaces/sports-bar/sessions/fleet-ops-log/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ peer_id: peer, content }] }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {})
  } catch {
    /* best-effort — capture must never affect the tune */
  }
}
