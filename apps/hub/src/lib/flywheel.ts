/**
 * Fleet-ops flywheel capture — same pattern as apps/web/src/lib/flywheel.ts
 * (not shared as a package; it's a 10-line fire-and-forget POST, not worth an
 * extraction). Fire-and-forget POST of a labeled outcome to the Honcho
 * fleet-ops-log session (CT213) so the off-hours deriver can turn it into
 * observations — the symptom->fix->held corpus for the eventual fleet-ops LLM.
 * Never throws, never blocks the rollout engine.
 */
const HONCHO_BASE = process.env.HONCHO_BASE || 'http://100.90.175.125:8000'

export function reportToFlywheel(peer: string, content: string): void {
  try {
    void fetch(`${HONCHO_BASE}/v3/workspaces/sports-bar/sessions/fleet-ops-log/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ peer_id: peer, content }] }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {})
  } catch {
    /* best-effort — capture must never affect the rollout */
  }
}
