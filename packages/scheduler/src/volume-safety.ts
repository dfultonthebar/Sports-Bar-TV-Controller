/**
 * Volume Safety Manager
 *
 * Enforces safe volume transitions for automated audio changes.
 * Prevents jarring volume jumps by ramping in controlled increments,
 * applies hard ceilings for auto-set volumes, and enforces quiet-hour caps.
 *
 * Rules:
 * - Never jump more than 10% in one step
 * - Ramp up: 5% every 10 seconds
 * - Ramp down: 5% every 5 seconds (faster -- lowering is safe)
 * - Hard ceiling: 85% max for auto-set volumes
 * - Quiet hours (before 11 AM, after midnight): cap at 50%
 */

import { logger } from '@sports-bar/logger'

// ============================================================================
// Types
// ============================================================================

export interface SafetyCheckResult {
  safe: boolean;
  adjustedTarget?: number;
  reason?: string;
}

export interface RampPlan {
  steps: number[];
  intervalMs: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum percentage a single step can change */
const MAX_STEP_PERCENT = 10;

/** Ramp increment size (percentage points per step) */
const RAMP_INCREMENT = 5;

/** Interval between ramp-up steps (ms) */
const RAMP_UP_INTERVAL_MS = 10_000; // 10 seconds

/** Interval between ramp-down steps (ms) */
const RAMP_DOWN_INTERVAL_MS = 5_000; // 5 seconds

/** Absolute maximum volume for automated changes */
const AUTO_VOLUME_CEILING = 85;

/** Maximum volume during quiet hours */
const QUIET_HOURS_CEILING = 50;

/** Quiet hours start (midnight, inclusive) */
const QUIET_HOUR_START = 0;

/** Quiet hours end (11 AM, exclusive) */
const QUIET_HOUR_END = 11;

// ============================================================================
// Volume Safety Manager Class
// ============================================================================

export class VolumeSafetyManager {

  /**
   * Check if a proposed volume change is safe and return an adjusted target
   * if the original target violates safety rules.
   *
   * @param currentVolume - Current volume level (0-100)
   * @param targetVolume  - Desired volume level (0-100)
   * @returns SafetyCheckResult with safe flag and optional adjusted target/reason
   */
  isChangeSafe(currentVolume: number, targetVolume: number): SafetyCheckResult {
    // Clamp inputs to valid range
    const current = Math.max(0, Math.min(100, Math.round(currentVolume)));
    let target = Math.max(0, Math.min(100, Math.round(targetVolume)));
    const reasons: string[] = [];

    // Apply hard ceiling for auto-set volumes
    if (target > AUTO_VOLUME_CEILING) {
      target = AUTO_VOLUME_CEILING;
      reasons.push(`Capped at ${AUTO_VOLUME_CEILING}% (auto-set ceiling)`);
    }

    // Apply quiet hours cap
    const currentHour = new Date().getHours();
    const isQuietHours = currentHour >= QUIET_HOUR_START && currentHour < QUIET_HOUR_END;
    if (isQuietHours && target > QUIET_HOURS_CEILING) {
      target = QUIET_HOURS_CEILING;
      reasons.push(`Capped at ${QUIET_HOURS_CEILING}% (quiet hours: before ${QUIET_HOUR_END} AM)`);
    }

    // Check if the jump exceeds the max single-step threshold
    const delta = Math.abs(target - current);
    if (delta > MAX_STEP_PERCENT) {
      reasons.push(`Volume change of ${delta}% exceeds ${MAX_STEP_PERCENT}% single-step limit; use ramp`);
    }

    const adjusted = target !== Math.round(targetVolume) ? target : undefined;

    if (reasons.length === 0) {
      return { safe: true };
    }

    // If the only issue is the step size but the target itself is fine,
    // the change is still "safe" in terms of the target -- caller should ramp.
    const targetWasAdjusted = adjusted !== undefined;
    const onlyStepSize = reasons.length === 1 && delta > MAX_STEP_PERCENT && !targetWasAdjusted;

    if (onlyStepSize) {
      return {
        safe: true,
        reason: reasons.join('; '),
      };
    }

    return {
      safe: !targetWasAdjusted,
      adjustedTarget: adjusted,
      reason: reasons.join('; '),
    };
  }

  /**
   * Generate ramp steps for transitioning from current to target volume.
   * Steps are 5% increments. The interval depends on direction:
   * - Ramp up: 10 seconds between steps
   * - Ramp down: 5 seconds between steps (faster, lowering is safe)
   *
   * The final step always lands exactly on the target.
   *
   * @param current - Current volume level (0-100)
   * @param target  - Target volume level (0-100)
   * @returns RampPlan with array of intermediate volume levels and interval in ms
   */
  getRampSteps(current: number, target: number): RampPlan {
    const from = Math.max(0, Math.min(100, Math.round(current)));
    const to = Math.max(0, Math.min(100, Math.round(target)));

    // No change needed
    if (from === to) {
      return { steps: [], intervalMs: 0 };
    }

    const isRampUp = to > from;
    const intervalMs = isRampUp ? RAMP_UP_INTERVAL_MS : RAMP_DOWN_INTERVAL_MS;
    const steps: number[] = [];

    if (isRampUp) {
      for (let v = from + RAMP_INCREMENT; v < to; v += RAMP_INCREMENT) {
        steps.push(v);
      }
    } else {
      for (let v = from - RAMP_INCREMENT; v > to; v -= RAMP_INCREMENT) {
        steps.push(v);
      }
    }

    // Always include the final target as the last step
    steps.push(to);

    logger.debug(
      `[VOLUME-SAFETY] Ramp plan: ${from}% -> ${to}% in ${steps.length} steps ` +
      `(${isRampUp ? 'up' : 'down'}, ${intervalMs}ms interval)`
    );

    return { steps, intervalMs };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const volumeSafetyManager = new VolumeSafetyManager()
