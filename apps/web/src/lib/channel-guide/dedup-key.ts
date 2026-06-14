/**
 * Wave 1b-ii — canonical dedup for channel-guide game injection.
 *
 * The channel-guide route injects games from several independent paths (Rail
 * Media, local-channel overrides, game_schedules cable+streaming, the Fire TV
 * catalog walker, ESPN-rail streaming, NFHS). Each path historically built its
 * own ad-hoc dedup check with subtly different team casing, time handling, and
 * channel comparison — so the SAME game could slip past every path's check and
 * appear twice.
 *
 * Dedup model (used by the single post-pass in route.ts):
 *  - `teamChannelKey()` groups entries by normalized teams + channel (NO time).
 *  - Within a group, two entries are the SAME game iff their start times are
 *    within `SAME_GAME_TOLERANCE_MS`. This is tolerance-based on purpose: fixed
 *    time-buckets split two near-identical times that straddle a bucket edge, so
 *    minor cross-path skew (paths parse `listing.time` vs the DB datetime
 *    differently, ~minutes) would dodge the dedup. Tolerance also correctly
 *    KEEPS a doubleheader (same teams/channel, >2h apart) as two rows.
 *  - Channel is part of the group key, so the same game legitimately listed on
 *    two different channels stays two rows (preserves existing behavior).
 */

/** Same teams + same channel within this window = the same game (skew-tolerant; keeps doubleheaders apart). */
export const SAME_GAME_TOLERANCE_MS = 2 * 60 * 60 * 1000

/** Time-free group key: normalized away|home|channel. Entries sharing this key are time-compared. */
export function teamChannelKey(p: {
  homeTeam?: string
  awayTeam?: string
  channel?: string | number | null
}): string {
  const normTeam = (t?: string) => (t || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const normChan = (c?: string | number | null) =>
    String(c ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${normTeam(p.awayTeam)}|${normTeam(p.homeTeam)}|${normChan(p.channel)}`
}

/** Parse an injected entry's startTime to epoch ms, or NaN if absent/unparseable. */
export function startMs(startTime?: string | number | Date | null): number {
  if (startTime == null || startTime === '') return NaN
  if (startTime instanceof Date) return startTime.getTime()
  if (typeof startTime === 'number') return startTime
  return Date.parse(String(startTime))
}
