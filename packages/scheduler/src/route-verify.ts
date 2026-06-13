/**
 * route-verify.ts — Wave 3 / 3b: closed-loop matrix route verification.
 *
 * STATUS: helper only — NOT yet wired into the scheduler's tune path. Wave 3c
 * wires `verifyAndRetryRoute` + `persistVerifyState` into scheduler-service.ts's
 * route loop (deliberately held for an off-hours canary, since 3c also changes
 * TCP route success-determination). Until then these exports have no production
 * callers (only `scripts/test-route-verify.ts`). The flow described below is
 * what 3c will do.
 *
 * After the scheduler issues a Wolf Pack route command and the command is
 * ACKed (parseHardwareResult.ok), this module reads the route state back off
 * the hardware and confirms the targeted output is ACTUALLY carrying the input
 * we asked for. On mismatch it re-issues the route a bounded number of times,
 * then records the outcome on the allocation row.
 *
 * ADVISORY ONLY (Standing Rule 3): nothing here throws into the tune path or
 * rolls back an allocation. A failed verify logs loud, sets `verify_state`, and
 * is surfaced for escalation (3e) — but the TV is never yanked off a feed
 * because verification couldn't confirm it. Verify answers "did the route we
 * issued take effect on the crossbar?", not "is the route correct" — that's the
 * scheduler's job upstream.
 *
 * ── outputOffset: why this compare applies NONE (read before changing) ──
 * There are TWO route-send functions in @sports-bar/wolfpack and they handle
 * offset DIFFERENTLY:
 *   • routeMatrix() (matrix-control.ts) — what the scheduler uses via
 *     POST /api/matrix/route. Sends to physical output == outputNumber with
 *     NO outputOffset applied (HTTP: outputNum-1; TCP: `${in}X${out}.`).
 *   • routeWolfpackToMatrix() (wolfpack-matrix-service.ts) — Atlas AUDIO path
 *     only. Applies `offset + matrixOutputNumber`. The scheduler's video routes
 *     never go through this.
 * The o2ox read-back array (queryWolfpackRouteState) is PHYSICAL-indexed,
 * 0-based, with 0-based input values (-1 == disconnected/sentinel). Because the
 * scheduler's send (routeMatrix) targets physical output == outputNumber with
 * no offset, the matching read index is simply `outputNumber - 1`, and the
 * stored value is `matrixInput - 1`. So the verify compare is:
 *
 *     routingArray[outputNumber - 1] === matrixInput - 1
 *
 * NO offset term. Adding `+ outputOffset` here (as an earlier plan draft and a
 * literal read of Gotcha #4 suggested) would FALSE-ALARM on multi-card boxes
 * like Graystone (offset +32 for its audio card) — the scheduler routes video
 * outputs 1-32 which are 1:1 physical, and the +32 belongs only to the audio
 * path the scheduler doesn't touch. Confirmed empirically against live Holmgren
 * o2ox state (offset 0) 2026-06-12. If routeMatrix is ever changed to apply
 * offset, change this compare to match it — the rule is "verify mirrors the
 * send exactly".
 */

import { db, sql } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'
import { queryWolfpackRouteState, type MatrixConfiguration } from '@sports-bar/wolfpack'

export type VerifyState = 'unverified' | 'verified' | 'failed' | 'unsupported'

export interface RouteVerifyResult {
  state: VerifyState
  /** Number of route RESENDS the verifier issued (0 = matched on first read). */
  attempts: number
  /** Diagnostic detail on failure/unsupported; null when verified. */
  error: string | null
  /** 1-based input actually found on the output, for the escalation surface. */
  actualInput: number | null
}

/** What queryWolfpackRouteState needs — ipAddress + optional credentials. */
type VerifyConfig = Pick<MatrixConfiguration, 'ipAddress' | 'credentials'>

const DEFAULT_MAX_RETRIES = 2
const DEFAULT_SETTLE_MS = 800

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Pure compare — no I/O, fully unit-testable. Given a physical-indexed o2ox
 * array (0-based input values, -1 = disconnected), decide whether 1-based
 * logical `outputNumber` is carrying 1-based logical `matrixInput`.
 *
 * `outputNumber` is treated as the physical output (routeMatrix applies no
 * offset — see file header). Out-of-range or disconnected → not matched,
 * actualInput null.
 */
export function checkRouteMatch(
  routingArray: number[],
  matrixInput: number,
  outputNumber: number,
): { matched: boolean; actualInput: number | null } {
  const idx = outputNumber - 1
  if (idx < 0 || idx >= routingArray.length) {
    return { matched: false, actualInput: null }
  }
  const raw = routingArray[idx] // 0-based input value, -1 = disconnected/sentinel
  if (raw < 0) {
    return { matched: false, actualInput: null }
  }
  return { matched: raw === matrixInput - 1, actualInput: raw + 1 }
}

/**
 * One read-back + compare. Distinguishes "couldn't read the hardware back"
 * (read threw → caller treats as 'unsupported', no point resending) from
 * "read fine, route doesn't match" (caller may resend + retry).
 */
async function verifyRouteOnce(
  matrixInput: number,
  outputNumber: number,
  config: VerifyConfig,
): Promise<{ ok: true; matched: boolean; actualInput: number | null } | { ok: false; error: string }> {
  try {
    const routingArray = await queryWolfpackRouteState({
      ipAddress: config.ipAddress,
      // Mirror /api/matrix/routes' default — the Wolf Pack web UI login.
      credentials: config.credentials || { username: 'admin', password: 'admin' },
    })
    const { matched, actualInput } = checkRouteMatch(routingArray, matrixInput, outputNumber)
    return { ok: true, matched, actualInput }
  } catch (err) {
    return { ok: false, error: (err as Error)?.message || String(err) }
  }
}

/** One read-back attempt — Ok with match info, or a read failure. */
type ReadResult =
  | { ok: true; matched: boolean; actualInput: number | null }
  | { ok: false; error: string }

/**
 * The verify/retry orchestration, decoupled from BOTH I/O sources (`read` and
 * `resend` are injected) so it's fully unit-testable without hardware. Public
 * callers use verifyAndRetryRoute(); tests drive this directly with mocks.
 *
 * Outcomes:
 *   • first read fails        → 'unsupported' (can't confirm, don't resend)
 *   • read matches            → 'verified'
 *   • mismatch, resend, match → 'verified' (attempts = # resends issued)
 *   • mismatch persists       → 'failed' after maxRetries
 *   • resend fails / read flaps mid-retry → 'failed' (we DID see a mismatch)
 */
export async function runVerifyLoop(
  matrixInput: number,
  outputNumber: number,
  read: () => Promise<ReadResult>,
  resend: () => Promise<boolean>,
  opts: { maxRetries?: number; settleMs?: number } = {},
): Promise<RouteVerifyResult> {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES
  const settleMs = opts.settleMs ?? DEFAULT_SETTLE_MS

  const first = await read()
  if (!first.ok) {
    // Read-back unavailable (e.g. HTTP web UI unreachable). Can't confirm —
    // don't cry wolf, don't resend. Advisory: tune already happened.
    return { state: 'unsupported', attempts: 0, error: first.error, actualInput: null }
  }

  let matched = first.matched
  let actualInput = first.actualInput
  let attempts = 0

  while (!matched && attempts < maxRetries) {
    attempts++
    let resent = false
    try {
      resent = await resend()
    } catch (err) {
      logger.warn(
        `[ROUTE-VERIFY] resend threw for input ${matrixInput} → output ${outputNumber} (attempt ${attempts}): ${(err as Error)?.message}`,
      )
    }
    if (!resent) {
      // Couldn't re-issue the route — stop; last known state was a mismatch.
      break
    }
    if (settleMs > 0) await sleep(settleMs)
    const re = await read()
    if (!re.ok) {
      // Read flapped mid-retry. We already have a confirmed first mismatch, so
      // report failed (not unsupported) — we DID see the hardware disagree.
      break
    }
    matched = re.matched
    actualInput = re.actualInput
  }

  if (matched) {
    return { state: 'verified', attempts, error: null, actualInput }
  }
  return {
    state: 'failed',
    attempts,
    error: `output ${outputNumber} shows input ${actualInput ?? 'none'}, expected ${matrixInput}`,
    actualInput,
  }
}

/**
 * Verify a route took effect; on mismatch, re-issue it (via the caller-supplied
 * `resend` thunk) up to `maxRetries` times, re-reading after each. Never throws.
 *
 * `resend` is decoupled so the scheduler can pass its own route-send (the same
 * POST /api/matrix/route the tune loop uses) and tests can pass a mock. Returns
 * a result the caller persists with persistVerifyState().
 */
export async function verifyAndRetryRoute(
  matrixInput: number,
  outputNumber: number,
  config: VerifyConfig,
  resend: () => Promise<boolean>,
  opts: { maxRetries?: number; settleMs?: number } = {},
): Promise<RouteVerifyResult> {
  return runVerifyLoop(
    matrixInput,
    outputNumber,
    () => verifyRouteOnce(matrixInput, outputNumber, config),
    resend,
    opts,
  )
}

/**
 * Persist a verify result onto the allocation row (the 3a columns). Best-effort:
 * a write failure logs but never propagates into the tune path. `verified_at` is
 * stamped only on success (per the column's "last verify PASS" semantics);
 * verify_attempts/verify_error always reflect the latest attempt.
 */
export async function persistVerifyState(
  allocationId: string,
  result: RouteVerifyResult,
): Promise<void> {
  const verifiedAt = result.state === 'verified' ? Math.floor(Date.now() / 1000) : null
  try {
    await db.run(sql`
      UPDATE input_source_allocations
      SET verify_state = ${result.state},
          verified_at = ${verifiedAt},
          verify_attempts = ${result.attempts},
          verify_error = ${result.error},
          updated_at = ${Math.floor(Date.now() / 1000)}
      WHERE id = ${allocationId}
    `)
  } catch (err) {
    logger.error(
      `[ROUTE-VERIFY] failed to persist verify_state for allocation ${allocationId}: ${(err as Error)?.message}`,
    )
  }
}
