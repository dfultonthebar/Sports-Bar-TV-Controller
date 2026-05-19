/**
 * Shure RF Dedicated Log File Writer
 *
 * Writes RF/interference events to a daily-rotating dedicated log file
 * separate from the main PM2 log. Operator requested a dedicated file
 * 2026-05-17 so RF history can be diffed across game days without
 * grepping the entire app log.
 *
 * Path:    /home/ubuntu/sports-bar-data/logs/shure-rf-YYYY-MM-DD.log
 * Format:  ISO_TS | LEVEL | receiverId | ch | event | rssi_dbm | freq_mhz | tx_model | note
 * Rotation: daily (new file at midnight local), 30-day retention
 *
 * Writes are mirrored through @sports-bar/logger so they still surface
 * in `pm2 logs` for general visibility. The dedicated file is the
 * source of truth for RF auditing.
 */

import { promises as fs } from 'fs'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { logger } from '@sports-bar/logger'

const LOG_DIR = process.env.SHURE_RF_LOG_DIR || '/home/ubuntu/sports-bar-data/logs'
const FILE_PREFIX = 'shure-rf-'
const RETENTION_DAYS = 30

export type ShureRfLogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface ShureRfLogEntry {
  level: ShureRfLogLevel
  receiverId: string
  channel?: number
  event: string
  rssiDbm?: number
  frequencyMhz?: number
  txType?: string
  note?: string
}

let dirEnsured = false

function ensureLogDir(): void {
  if (dirEnsured) return
  if (!existsSync(LOG_DIR)) {
    try {
      mkdirSync(LOG_DIR, { recursive: true })
    } catch (err) {
      logger.warn(`[SHURE-RF-LOG] could not create log dir ${LOG_DIR}: ${(err as Error).message}`)
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

function formatLine(entry: ShureRfLogEntry, now: Date = new Date()): string {
  const ts = now.toISOString()
  const fields = [
    ts,
    entry.level.toUpperCase().padEnd(5),
    entry.receiverId || '-',
    entry.channel !== undefined ? `ch${entry.channel}` : '-',
    entry.event,
    entry.rssiDbm !== undefined ? `${entry.rssiDbm.toFixed(1)}dBm` : '-',
    entry.frequencyMhz !== undefined ? `${entry.frequencyMhz.toFixed(3)}MHz` : '-',
    entry.txType || '-',
    entry.note || '',
  ]
  return fields.join(' | ') + '\n'
}

/**
 * Append a single entry to today's log file. Best-effort — if the
 * filesystem is full/read-only we mirror to console.error and keep
 * going. The watcher must not crash on a dead disk.
 */
export async function logShureRfEvent(entry: ShureRfLogEntry): Promise<void> {
  ensureLogDir()
  const now = new Date()
  const line = formatLine(entry, now)

  // Mirror to PM2-visible logger so this still surfaces in normal
  // operator triage. Use matching level.
  //
  // IMPORTANT: `logger` from @sports-bar/logger is a Logger CLASS
  // instance — destructuring its methods (`const fn = logger.info`)
  // loses the `this` binding and throws "Cannot read properties of
  // undefined (reading 'logWithData')" at call time. Always call
  // methods on the instance directly. (Caught at Holmgren 2026-05-17
  // post-v2.34.1 deploy — watcher silently failed to start.)
  const tag = `[SHURE-RF] ${entry.receiverId}${entry.channel ? `:ch${entry.channel}` : ''}`
  const summary = `${entry.event}${entry.rssiDbm !== undefined ? ` (${entry.rssiDbm.toFixed(1)}dBm)` : ''}${entry.note ? ` — ${entry.note}` : ''}`
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
    console.error(`[SHURE-RF-LOG] appendFile failed: ${(err as Error).message}`)
  }
}

/**
 * Delete log files older than RETENTION_DAYS. Called once at watcher
 * boot. Non-fatal if it fails.
 */
export async function pruneOldShureRfLogs(): Promise<{ kept: number; removed: number }> {
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
      logger.info(`[SHURE-RF-LOG] Pruned ${removed} log files older than ${RETENTION_DAYS}d (${kept} kept)`)
    }
    return { kept, removed }
  } catch (err) {
    logger.warn(`[SHURE-RF-LOG] prune failed: ${(err as Error).message}`)
    return { kept: 0, removed: 0 }
  }
}

/** Resolve the current log path — exposed for the /api/shure-rf?log=path query. */
export function getCurrentShureRfLogPath(): string {
  return currentLogPath()
}
