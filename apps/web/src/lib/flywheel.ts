/**
 * Fleet-ops flywheel capture. Fire-and-forget POST of a task/tune outcome to the Honcho
 * fleet-ops-log session (CT213) so the local fleet-ops model learns from EVERY task a
 * bartender or the system performs — not just scheduled probes. Never throws, never blocks.
 *
 * peer convention: 'fleet-firetv-tune' (streaming/Fire TV tunes), 'fleet-cable-tune'
 * (cable/DirecTV), 'hermes-firetv-profiler' (probe), 'fleet-ops' (AI Suggest / general).
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
    /* best-effort — capture must never affect the tune */
  }
}
