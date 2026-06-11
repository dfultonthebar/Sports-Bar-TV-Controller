/**
 * parseHardwareResult — the ONE place that interprets a hardware-control API
 * response under the {success: boolean} contract.
 *
 * The fleet's hardware-route endpoints (matrix `/api/matrix/route`, tune
 * `/api/channel-presets/tune`, audio, etc.) return HTTP 200 with a JSON body
 * whose `success` field is the only source of truth. A raw `if (response.ok)`
 * check is the "OR-gate" bug class: an HTTP 200 carrying `{success:false}`
 * (a soft failure) reads as success, so the system believes a TV tuned/routed
 * when the hardware never moved — green log row, wrong game on the TV. Proven
 * repeatedly (v2.55.41/.43; the Greenville Brewers incident). Use this helper
 * everywhere a hardware route/tune/revert response is interpreted, instead of
 * touching `response.ok` directly.
 *
 * Fields:
 *   ok          — body.success === true. The ONLY success signal.
 *   malformedOk — HTTP 200 but no explicit success flag (neither true nor
 *                 false). This is NOT a success: a route endpoint has drifted
 *                 off the {success:true|false} contract. The caller MUST log it
 *                 loudly and treat it as a FAILURE (fall through to the failure
 *                 branch) — never report the TV as tuned/reverted on this weak
 *                 signal.
 *   status, body, error
 */
export interface HardwareResult {
  ok: boolean
  malformedOk: boolean
  status: number
  body: any
  error?: string
}

export async function parseHardwareResult(response: Response): Promise<HardwareResult> {
  const status = response.status
  const body: any = await response.json().catch(() => ({}))
  const ok = body?.success === true
  // HTTP 200, not an explicit success, and NOT an explicit failure → contract drift.
  const malformedOk = !ok && response.ok && body?.success !== false
  const error = ok
    ? undefined
    : body?.error ||
      (malformedOk ? 'HTTP 200 but no success flag (contract drift)' : `HTTP ${status}`)
  return { ok, malformedOk, status, body, error }
}
