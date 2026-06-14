/**
 * DropTracker — per-game observability for the channel guide (Wave 1b-i).
 *
 * The guide builds the bartender "what game is on what channel" list from 6+
 * injection paths. Today the only trace of a dropped game is an AGGREGATE
 * counter ("3 skipped, no channel match"), so when a bartender says "the
 * Brewers game is missing" the only way to find out why is to read 1700 lines
 * and guess (the v2.55.44 silent-drop class). This records WHY each candidate
 * game was dropped — crucially the broadcast_networks that were TRIED but
 * didn't resolve, which is the exact signal Wave 4 (league-data enrichment)
 * needs ("'Bally Sports Wisconsin+' isn't resolving to ch 308 via the alias
 * table"). Pure observability: it changes no guide output.
 */
import { logger } from '@sports-bar/logger'

export interface DropRecord {
  /** which injection path dropped it: 'gs-cable' | 'gs-stream' | 'catalog' | 'rail' | 'preset-filter' | 'age-filter' | 'nfhs' | ... */
  source: string
  /** human label, normally `${away} @ ${home}` (or a raw title if teams are missing) */
  game: string
  /** stable machine reason: 'gs-no-channel' | 'gs-dupe' | 'gs-stream-no-app' | 'preset-filter' | 'age-filter' | ... */
  reason: string
  /** channel we tried / had (for dupe + preset-filter cases) */
  triedChannel?: string | number | null
  /** the broadcast_networks tried — THE Wave-4 signal for 'gs-no-channel' */
  triedNetworks?: string[] | null
  /** ISO start time, for time-sensitive drops */
  startTime?: string | null
}

export class DropTracker {
  private drops: DropRecord[] = []

  drop(r: DropRecord): void {
    this.drops.push(r)
  }

  get total(): number {
    return this.drops.length
  }

  get records(): ReadonlyArray<DropRecord> {
    return this.drops
  }

  /**
   * Emit one structured reconciliation line per request. The per-game detail is
   * gated behind a debug flag so normal iPad traffic stays quiet; the summary
   * counts always log. Returns the {dropped, byReason, sample} object so the
   * caller can optionally embed it in the JSON response under a debug flag.
   */
  summarize(requestId: string, finalProgramCount: number, debug: boolean): {
    dropped: number
    byReason: Record<string, number>
    sample: DropRecord[]
  } {
    const byReason: Record<string, number> = {}
    for (const d of this.drops) byReason[d.reason] = (byReason[d.reason] || 0) + 1

    const reasonStr = Object.entries(byReason).map(([k, v]) => `${k}=${v}`).join(' ') || 'none'
    logger.info(`[GUIDE-RECON ${requestId}] programs=${finalProgramCount} dropped=${this.total} {${reasonStr}}`)

    if (debug && this.drops.length > 0) {
      const sample = this.drops.slice(0, 40).map(d => {
        const ch = d.triedChannel != null ? ` ch=${d.triedChannel}` : ''
        const nets = d.triedNetworks && d.triedNetworks.length ? ` nets=[${d.triedNetworks.join(',')}]` : ''
        return `${d.game} [${d.source}:${d.reason}${ch}${nets}]`
      })
      logger.info(`[GUIDE-RECON ${requestId}] dropped-detail: ${sample.join(' | ')}`)
    }

    return { dropped: this.total, byReason, sample: this.drops.slice(0, 40) }
  }
}
