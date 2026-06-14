/**
 * shure-freq-utils.ts (v2.52.21 — REUSE refactor)
 *
 * Shared helpers for getting the bar's currently-tuned Shure receiver
 * freqs + building SQL clauses to filter SDR data by proximity to those
 * freqs.
 *
 * Pre-v2.52.21, three call sites independently implemented these:
 *  - packages/scheduler/src/interference-correlator.ts: getOurShureFreqsForCorrelation
 *  - packages/scheduler/src/preemptive-strike.ts: getCurrentShureFreqs
 *  - packages/scheduler/src/rf-pattern-digest.ts: inline block in gatherRawCounts
 *
 * All three were identical 15-line dynamic-import + snapshot-extract
 * patterns with identical fallbacks. Now centralized here.
 */

import { sql, type SQL } from '@sports-bar/database'

/**
 * Get the live freqs (MHz) currently tuned by every Shure receiver
 * connected on this box, via the shureSlxdClientManager globalThis
 * singleton. Dynamic-imported so locations without a Shure receiver
 * (no @sports-bar/shure-slxd installed, or no connections) just
 * return an empty array — no hard dependency.
 */
export async function getShureFreqsMhz(): Promise<number[]> {
  try {
    const mgrMod: any = await import('@sports-bar/shure-slxd').catch(() => null)
    if (!mgrMod || typeof mgrMod.shureSlxdClientManager?.getSnapshots !== 'function') return []
    const snaps = mgrMod.shureSlxdClientManager.getSnapshots()
    const freqs = new Set<number>()
    for (const s of snaps) {
      for (const ch of s.channels ?? []) {
        if (typeof ch.frequencyMhz === 'number' && ch.frequencyMhz > 0) freqs.add(ch.frequencyMhz)
      }
    }
    return Array.from(freqs)
  } catch {
    return []
  }
}

/**
 * Build a Drizzle SQL OR-clause that matches any `freq_mhz` within
 * ±toleranceMhz of any freq in the list. Returns null when the list
 * is empty (caller should short-circuit and skip the query).
 *
 * Example output for [484.7, 510.9] with 0.1 tolerance:
 *   ((freq_mhz BETWEEN 484.6 AND 484.8) OR (freq_mhz BETWEEN 510.8 AND 511.0))
 */
export function buildFreqBandClauses(freqs: number[], toleranceMhz: number): SQL | null {
  if (freqs.length === 0) return null
  const parts = freqs.map(
    (f) => sql`(freq_mhz BETWEEN ${f - toleranceMhz} AND ${f + toleranceMhz})`,
  )
  return sql.join(parts, sql` OR `)
}

/**
 * Constants shared by callers — single source of truth for tolerance.
 * Pre-v2.52.21 each call site hardcoded 0.1 separately; if we ever
 * tune this we'd drift across files.
 */
export const SHURE_FREQ_MATCH_MHZ = 0.10
