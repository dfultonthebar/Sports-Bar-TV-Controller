/**
 * Rollout state-machine logic. Pure progression-DETECTION over telemetry the
 * hub already receives (fleet_update_events, health_snapshots) — this module
 * never SSHes anything itself. See schema.ts's `rollouts` doc comment for why.
 *
 * Two halves:
 *  - tick(rolloutId): re-evaluate against fresh telemetry, advance status
 *    when progress is OBSERVED (canary succeeded/failed, wave boxes resolved).
 *  - computeNextAction(rollout, boxes): what an external executor (Hermes or
 *    an operator by hand) should DO next. Advancing from "action needed" to
 *    "in progress" happens only via ackAction, once that action is actually
 *    taken — tick() alone never fabricates progress that didn't happen.
 */
import {
  getRollout,
  getRolloutBoxes,
  updateRollout,
  updateRolloutBox,
  findUpdateEventSince,
  latestHealth,
} from './repo'

export type RolloutStatus =
  | 'pending'
  | 'canary_triggered'
  | 'canary_soaking'
  | 'canary_failed'
  | 'waving'
  | 'converged'
  | 'partial_failure'
  | 'aborted'

const TERMINAL: RolloutStatus[] = ['canary_failed', 'converged', 'partial_failure', 'aborted']

/** Map a fleet_update_events.result onto a rollout_boxes / canary outcome. */
function isFailureResult(result: string): boolean {
  return result === 'rollback' || result === 'conflict' || result === 'failed'
}

export type NextAction =
  | { type: 'none' }
  | { type: 'wait'; reason: string }
  | { type: 'trigger'; role: 'canary' | 'wave'; locationIds: string[] }

export function computeNextAction(
  rollout: NonNullable<ReturnType<typeof getRollout>>,
  boxes: ReturnType<typeof getRolloutBoxes>,
): NextAction {
  if (TERMINAL.includes(rollout.status as RolloutStatus)) return { type: 'none' }

  if (rollout.status === 'pending') {
    return { type: 'trigger', role: 'canary', locationIds: [rollout.canaryLocationId] }
  }

  if (rollout.status === 'canary_triggered') {
    return { type: 'wait', reason: 'waiting for canary to report a result at the target version' }
  }

  if (rollout.status === 'canary_soaking') {
    const soakedMs = Date.now() - (rollout.canarySuccessAt ?? Date.now())
    const soakNeededMs = rollout.minSoakMinutes * 60_000
    if (soakedMs < soakNeededMs) {
      const remainMin = Math.ceil((soakNeededMs - soakedMs) / 60_000)
      return { type: 'wait', reason: `canary soaking — ${remainMin} more minute(s)` }
    }
    const health = latestHealth(rollout.canaryLocationId)
    if (health?.overallStatus !== 'healthy') {
      return {
        type: 'wait',
        reason: `soak complete but canary is currently '${health?.overallStatus ?? 'unknown'}', not healthy — holding`,
      }
    }
    return { type: 'trigger', role: 'wave', locationIds: boxes.map((b) => b.locationId) }
  }

  if (rollout.status === 'waving') {
    const pending = boxes.filter((b) => b.state === 'triggered')
    if (pending.length === 0) return { type: 'none' } // tick() should have already moved to a terminal status
    return { type: 'wait', reason: `waiting on ${pending.length} box(es): ${pending.map((b) => b.locationId).join(', ')}` }
  }

  return { type: 'none' }
}

/**
 * Caller performed the action computeNextAction described; advance state to
 * reflect it. Re-validates against computeNextAction itself (rather than a
 * separate, duplicated status check) so ackAction can NEVER advance the
 * rollout past a gate computeNextAction hasn't actually cleared — e.g. a
 * premature wave-ack can't skip the soak timer or a canary-unhealthy hold,
 * because computeNextAction only offers {type:'trigger', role:'wave'} once
 * both conditions are satisfied.
 */
export function ackAction(rolloutId: string, role: 'canary' | 'wave') {
  const rollout = getRollout(rolloutId)
  if (!rollout) throw new Error('rollout not found')
  const boxes = getRolloutBoxes(rolloutId)
  const action = computeNextAction(rollout, boxes)
  if (action.type !== 'trigger' || action.role !== role) {
    throw new Error(
      `cannot ack '${role}' — current suggested action is ${JSON.stringify(action)} (status '${rollout.status}')`,
    )
  }
  const now = Date.now()

  if (role === 'canary') {
    return updateRollout(rolloutId, { status: 'canary_triggered', canaryTriggeredAt: now })
  }

  // role === 'wave'
  for (const box of boxes) {
    updateRolloutBox(box.id, { state: 'triggered', triggeredAt: now })
  }
  return updateRollout(rolloutId, { status: 'waving', waveTriggeredAt: now })
}

/** Re-evaluate this rollout against fresh telemetry; advance status if progress is observed. */
export function tick(rolloutId: string) {
  const rollout = getRollout(rolloutId)
  if (!rollout) throw new Error('rollout not found')
  if (TERMINAL.includes(rollout.status as RolloutStatus)) return rollout

  if (rollout.status === 'canary_triggered' && rollout.canaryTriggeredAt != null) {
    const ev = findUpdateEventSince(rollout.canaryLocationId, rollout.canaryTriggeredAt, rollout.targetVersion)
    if (ev) {
      if (ev.result === 'success') {
        return updateRollout(rolloutId, { status: 'canary_soaking', canarySuccessAt: ev.occurredAt })
      }
      if (isFailureResult(ev.result)) {
        return updateRollout(rolloutId, { status: 'canary_failed' })
      }
      // 'skipped' — canary's own auto-update no-op'd (e.g. cron disabled). Leave
      // in canary_triggered; an operator needs to notice and re-trigger by hand.
    }
    return rollout
  }

  if (rollout.status === 'waving' && rollout.waveTriggeredAt != null) {
    const boxes = getRolloutBoxes(rolloutId)
    for (const box of boxes) {
      if (box.state !== 'triggered') continue
      const ev = findUpdateEventSince(box.locationId, rollout.waveTriggeredAt, rollout.targetVersion)
      if (!ev) continue
      if (ev.result === 'success') {
        updateRolloutBox(box.id, { state: 'success', resolvedAt: ev.occurredAt })
      } else if (isFailureResult(ev.result)) {
        updateRolloutBox(box.id, { state: 'rolled_back', resolvedAt: ev.occurredAt, note: ev.errorMessage ?? ev.result })
      }
      // 'skipped' rows are left 'triggered' — same reasoning as the canary case above.
    }
    const fresh = getRolloutBoxes(rolloutId)
    const allResolved = fresh.every((b) => b.state !== 'pending' && b.state !== 'triggered')
    if (allResolved) {
      const anyFailed = fresh.some((b) => b.state === 'rolled_back' || b.state === 'failed' || b.state === 'timeout')
      return updateRollout(rolloutId, { status: anyFailed ? 'partial_failure' : 'converged' })
    }
    return getRollout(rolloutId)!
  }

  return rollout
}
