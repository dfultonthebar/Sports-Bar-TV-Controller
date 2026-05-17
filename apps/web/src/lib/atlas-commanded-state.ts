/**
 * Shared in-memory record of what we last commanded the Atlas to do.
 *
 * Used by atlas-drop-watcher to distinguish "operator-initiated source
 * changes" from "priority override / Atlas firmware-initiated source
 * changes". Without this distinction, every operator source-change
 * would false-positive as a priority event on the next poll.
 *
 * The control route calls recordCommandedSource() inside the success
 * branch of action='source' writes; the drop watcher calls
 * wasRecentlyCommandedSource() before flagging a source override.
 *
 * Process-local — does not survive restart. The watcher's first poll
 * after restart seeds lastSeen but emits no events, so a torn write
 * across a restart produces at worst one false positive.
 */

const TTL_SECS = 10

const commandedSources = new Map<string, { value: number; at: number }>()

function key(processorId: string, zoneIndex0: number): string {
  return `${processorId}:${zoneIndex0}`
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

export function recordCommandedSource(processorId: string, zoneIndex0: number, value: number): void {
  commandedSources.set(key(processorId, zoneIndex0), { value, at: nowSec() })
}

export function wasRecentlyCommandedSource(
  processorId: string,
  zoneIndex0: number,
  observedValue: number
): boolean {
  const entry = commandedSources.get(key(processorId, zoneIndex0))
  if (!entry) return false
  if (nowSec() - entry.at > TTL_SECS) return false
  return entry.value === observedValue
}
