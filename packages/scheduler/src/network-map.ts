/**
 * Broadcast-network → streaming-app name normalization.
 *
 * `game_schedules.broadcast_networks` and `game.primaryNetwork` carry raw
 * ESPN broadcast strings ("ESPN+", "ESPN2", "NBC", "CBS", "FS1"). The
 * `input_sources.available_networks` JSON column carries streaming app
 * catalog `name` values ("ESPN", "Peacock", "Paramount+", "Fox Sports").
 *
 * A direct `availableNetworks.includes(broadcastNetwork)` always misses
 * these cross-domain pairs and silently excludes capable inputs from
 * allocation / conflict detection. Pre-fix at v2.32.92 every ESPN+
 * game silently excluded every Fire TV input despite ESPN+ being
 * playable in the ESPN app.
 *
 * Use `normalizeBroadcastNetworkForAvailable(network)` before any
 * `availableNetworks.includes(...)` check.
 */

const BROADCAST_TO_APP_NAME: Record<string, string> = {
  // ESPN family — all play through the unified ESPN app
  ESPN: 'ESPN',
  ESPN2: 'ESPN',
  ESPNU: 'ESPN',
  'ESPN+': 'ESPN',
  // NBC family
  NBC: 'Peacock',
  NBCSN: 'Peacock',
  Peacock: 'Peacock',
  // CBS family
  CBS: 'Paramount+',
  'Paramount+': 'Paramount+',
  // Fox family
  FOX: 'Fox Sports',
  FS1: 'Fox Sports',
  FS2: 'Fox Sports',
  'FOX Sports 1': 'Fox Sports',
  'FOX Sports 2': 'Fox Sports',
  // Warner Bros Discovery family — TNT/TBS sports stream via Max.
  // v2.32.93 added after the v2.32.92 audit flagged the gap. Affects
  // NBA playoffs (TNT), MLB postseason (TBS), March Madness (TNT/TBS/truTV),
  // some college football (TNT/TBS). Without these entries, allocator
  // silently excludes any Cube with Max installed from being a candidate
  // for TNT/TBS games — same root-cause class as the v2.32.92 ESPN+ bug.
  TNT: 'Max',
  TBS: 'Max',
  truTV: 'Max',
  'TNT Sports': 'Max',
}

/**
 * Returns the streaming-app `name` value that matches `available_networks`
 * for the given broadcast network. Returns the input unchanged when no
 * mapping exists — e.g. "Amazon Prime Video" (already a catalog name) and
 * cable-only networks (FanDuel SN WI, Bally Sports Wisconsin+) pass
 * through untouched, preserving direct-match semantics for those.
 */
export function normalizeBroadcastNetworkForAvailable(network: string): string {
  return BROADCAST_TO_APP_NAME[network] || network
}

/**
 * Convenience: filter `availableNetworks` against a target network with
 * normalization applied. Useful as a one-liner replacement for
 * `availableNetworks.includes(network)`.
 */
export function availableNetworksMatch(
  availableNetworks: string[],
  network: string,
): boolean {
  return availableNetworks.includes(normalizeBroadcastNetworkForAvailable(network))
}
