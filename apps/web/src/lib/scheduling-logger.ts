/**
 * Scheduling Dedicated Log File Writer
 *
 * Writes scheduling events (manual bartender-remote schedules, AI Suggest
 * auto-tunes, auto-reallocator decisions, and the resulting routing
 * commands) to a daily-rotating dedicated log file. Operator requested
 * 2026-06-10 after two silent failures (Greenville Brewers + Holmgren
 * Timber Rattlers) where the bartender's POST didn't visibly fail in the
 * UI and the only trace was a buried [WARN] in the main PM2 log.
 *
 * Path:     /home/ubuntu/sports-bar-data/logs/scheduling-YYYY-MM-DD.log
 * Format:   ISO_TS | LEVEL | SOURCE | ACTION | game | targets | outcome | note
 * Rotation: daily (new file at midnight local), 30-day retention
 *
 * Writes are mirrored through @sports-bar/logger so they still surface
 * in `pm2 logs` for general visibility. The dedicated file is the
 * source of truth for scheduling auditing — operator can diff days,
 * grep for a team, see exactly what the bartender tried.
 */

import { promises as fs } from 'fs'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { logger } from '@sports-bar/logger'

const LOG_DIR = process.env.SCHEDULING_LOG_DIR || '/home/ubuntu/sports-bar-data/logs'
const FILE_PREFIX = 'scheduling-'
const RETENTION_DAYS = 30

export type SchedulingLogLevel = 'info' | 'warn' | 'error' | 'debug'

/** Who initiated the scheduling action. */
export type SchedulingSource =
  | 'manual'         // bartender remote, /api/schedules/bartender-schedule
  | 'ai'             // AI Suggest approve flow
  | 'auto'           // auto-reallocator, scheduled job
  | 'override-learn' // bartender manual override on a live TV
  | 'unknown'

/** What's happening in this log line. */
export type SchedulingAction =
  | 'attempt'             // request received, before any lookup
  | 'game_lookup_ok'      // matched a game_schedules row
  | 'game_lookup_fail'    // 404 / no match found (the silent-fail class)
  | 'game_lookup_synthetic' // no ESPN match — synthesized a game_schedules row
                            // from channel-guide data (MILB / USFL / indie /
                            // any non-ESPN-covered Rail source) — v2.55.39
  | 'allocation_created'  // input_source_allocations row inserted
  | 'allocation_updated'  // PATCH on an existing allocation
  | 'allocation_canceled'
  | 'conflict_detected'
  | 'route_command'       // wolfpack/atlas/DirecTV/Fire TV routing command sent
  | 'route_ok'            // routing command succeeded
  | 'route_fail'          // routing command failed
  | 'tune_complete'       // end-to-end success — TV showing the right channel
  | 'tune_fail'           // end-to-end failure

export interface SchedulingLogEntry {
  level: SchedulingLogLevel
  source: SchedulingSource
  action: SchedulingAction
  /** Game info — homeTeam vs awayTeam, optionally league + start time */
  game?: {
    home?: string
    away?: string
    league?: string
    startLocal?: string
  }
  /** Target output IDs (matrix TVs) and the input/channel chosen */
  targets?: {
    tvOutputIds?: number[]
    inputSourceId?: string
    inputSourceType?: string  // 'cable'/'directv'/'firetv'
    channelNumber?: string
    appName?: string
  }
  /** Outcome flags */
  outcome?: {
    status?: 'pending' | 'completed' | 'failed' | 'canceled' | 'unknown'
    allocationId?: string
    httpStatus?: number
    errorMessage?: string
  }
  /** Free-form note (operator-facing) */
  note?: string
  /** Request correlation ID (so a single bartender POST can be traced
   *  through allocation → routing → completion in the log) */
  requestId?: string
}

let dirEnsured = false

function ensureLogDir(): void {
  if (dirEnsured) return
  if (!existsSync(LOG_DIR)) {
    try {
      mkdirSync(LOG_DIR, { recursive: true })
    } catch (err) {
      logger.warn(
        `[SCHEDULING-LOG] could not create log dir ${LOG_DIR}: ${(err as Error).message}`,
      )
      return
    }
  }
  dirEnsured = true
}

function currentLogPath(now: Date = new Date()): string {
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return path.join(LOG_DIR, `${FILE_PREFIX}${yyyy}-${mm}-${dd}.log`)
}

function gameStr(g: SchedulingLogEntry['game']): string {
  if (!g) return '-'
  const matchup = g.away || g.home
    ? `${g.away ?? '?'} @ ${g.home ?? '?'}`
    : ''
  const meta = [g.league, g.startLocal].filter(Boolean).join(' ')
  return [matchup, meta].filter(Boolean).join(' ') || '-'
}

function targetStr(t: SchedulingLogEntry['targets']): string {
  if (!t) return '-'
  const parts: string[] = []
  if (t.tvOutputIds && t.tvOutputIds.length > 0) parts.push(`TVs=${t.tvOutputIds.join(',')}`)
  if (t.inputSourceType) parts.push(`src=${t.inputSourceType}`)
  if (t.channelNumber) parts.push(`ch=${t.channelNumber}`)
  if (t.appName) parts.push(`app=${t.appName}`)
  if (t.inputSourceId) parts.push(`srcId=${t.inputSourceId.slice(0, 8)}`)
  return parts.join(' ') || '-'
}

function outcomeStr(o: SchedulingLogEntry['outcome']): string {
  if (!o) return '-'
  const parts: string[] = []
  if (o.status) parts.push(`status=${o.status}`)
  if (o.httpStatus) parts.push(`http=${o.httpStatus}`)
  if (o.allocationId) parts.push(`alloc=${o.allocationId.slice(0, 8)}`)
  if (o.errorMessage) parts.push(`err="${o.errorMessage.slice(0, 200)}"`)
  return parts.join(' ') || '-'
}

function formatLine(entry: SchedulingLogEntry, now: Date = new Date()): string {
  const ts = now.toISOString()
  const fields = [
    ts,
    entry.level.toUpperCase().padEnd(5),
    entry.source.toUpperCase().padEnd(15),
    entry.action.padEnd(20),
    entry.requestId ? `req=${entry.requestId.slice(0, 8)}` : '-',
    gameStr(entry.game),
    targetStr(entry.targets),
    outcomeStr(entry.outcome),
    entry.note || '',
  ]
  return fields.join(' | ') + '\n'
}

/**
 * Append a single entry to today's log file. Best-effort — disk full /
 * read-only mirrors to console.error and keeps going. The routes
 * calling this MUST NOT throw on a dead disk.
 */
export async function logSchedulingEvent(entry: SchedulingLogEntry): Promise<void> {
  ensureLogDir()
  const now = new Date()
  const line = formatLine(entry, now)

  // Mirror to PM2-visible logger so this still surfaces in normal
  // operator triage. (Same `this`-binding caveat as shure-rf-logger.)
  const tag = `[SCHEDULING][${entry.source}/${entry.action}]`
  const summary = [
    gameStr(entry.game) !== '-' ? gameStr(entry.game) : null,
    entry.outcome?.status ? `status=${entry.outcome.status}` : null,
    entry.outcome?.errorMessage ? `err=${entry.outcome.errorMessage.slice(0, 100)}` : null,
    entry.note,
  ].filter(Boolean).join(' | ')
  const msg = `${tag} ${summary}`
  switch (entry.level) {
    case 'error': logger.error(msg); break
    case 'warn':  logger.warn(msg);  break
    case 'debug': logger.debug(msg); break
    case 'info':
    default:      logger.info(msg);  break
  }

  if (!dirEnsured) return
  try {
    await fs.appendFile(currentLogPath(now), line, 'utf8')
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[SCHEDULING-LOG] appendFile failed: ${(err as Error).message}`)
  }
}

/**
 * Convenience helper for the common "request received" entry at the
 * top of a scheduling route. Generates a request ID for correlation.
 */
export function newSchedulingRequestId(): string {
  return Math.random().toString(36).slice(2, 10)
}

/** Resolve the current log path — exposed for ops queries. */
export function getCurrentSchedulingLogPath(): string {
  return currentLogPath()
}

/**
 * Delete log files older than RETENTION_DAYS. Called from
 * scheduler-service boot. Non-fatal if it fails.
 */
export async function pruneOldSchedulingLogs(): Promise<{ kept: number; removed: number }> {
  ensureLogDir()
  if (!dirEnsured) return { kept: 0, removed: 0 }
  try {
    const files = await fs.readdir(LOG_DIR)
    const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
    let kept = 0
    let removed = 0
    for (const f of files) {
      if (!f.startsWith(FILE_PREFIX) || !f.endsWith('.log')) continue
      const full = path.join(LOG_DIR, f)
      try {
        const stat = await fs.stat(full)
        if (stat.mtimeMs < cutoffMs) {
          await fs.unlink(full)
          removed += 1
        } else {
          kept += 1
        }
      } catch {
        // skip files we can't stat
      }
    }
    if (removed > 0) {
      logger.info(
        `[SCHEDULING-LOG] Pruned ${removed} log files older than ${RETENTION_DAYS}d (${kept} kept)`,
      )
    }
    return { kept, removed }
  } catch (err) {
    logger.warn(`[SCHEDULING-LOG] prune failed: ${(err as Error).message}`)
    return { kept: 0, removed: 0 }
  }
}
