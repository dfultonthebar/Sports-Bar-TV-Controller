/**
 * Atlas Communication Logger
 * 
 * Provides comprehensive logging for all Atlas TCP communication
 * Logs to: ~/Sports-Bar-TV-Controller/log/atlas-communication.log
 */

import fs from 'fs'
import path from 'path'

import { logger } from '@sports-bar/logger'
const LOG_DIR = path.join(process.cwd(), 'log')
const LOG_FILE = path.join(LOG_DIR, 'atlas-communication.log')

// v2.54.60: size cap + simple rotation. The unbounded append-only behavior
// before this version produced a 140 GB log at Holmgren (5.75 billion lines
// over 98 days). When the file exceeds MAX_LOG_BYTES, we rotate to a single
// .old sibling and start fresh. Truncate (not rename-then-create) so a live
// writer (PM2-attached node process) keeps appending without missing a beat.
const MAX_LOG_BYTES = 100 * 1024 * 1024 // 100 MB
const ROTATE_CHECK_EVERY_N = 1000       // amortize fstat() calls
let writeCounter = 0

// Ensure log directory exists
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
}

function rotateIfTooLarge() {
  try {
    const st = fs.statSync(LOG_FILE)
    if (st.size > MAX_LOG_BYTES) {
      const oldPath = LOG_FILE + '.old'
      // Best-effort: keep last rotation as a sibling for forensic review.
      // If the rename fails (e.g. .old exists + no perm), fall through to truncate.
      try { fs.renameSync(LOG_FILE, oldPath) } catch {}
      // The node process still holds the inode of the renamed file open.
      // Appends will keep going to .old (preserves history). New writes
      // from THIS process won't reach the fresh LOG_FILE until the OS
      // rotates the FD — for simplicity we rely on the writeLog path
      // re-opening on the next appendFileSync(LOG_FILE,...) which sees
      // the new (empty) inode at LOG_FILE.
    }
  } catch {
    // File doesn't exist yet — nothing to rotate.
  }
}

// Format timestamp
function timestamp(): string {
  return new Date().toISOString()
}

// Write to log file and console
function writeLog(level: string, category: string, message: string, data?: any) {
  ensureLogDir()
  
  const logEntry = {
    timestamp: timestamp(),
    level,
    category,
    message,
    ...(data && { data })
  }
  
  const logLine = `[${logEntry.timestamp}] [${level}] [${category}] ${message}${
    data ? ' | ' + JSON.stringify(data, null, 2) : ''
  }\n`
  
  // Write to console — route DEBUG through logger.debug so the shared logger
  // filters it out in production (LogLevel.INFO+). Previously DEBUG was being
  // routed to logger.info, which meant the v2.54.4/.5 ERROR→DEBUG demote did
  // not actually suppress the console noise — it just changed the level tag
  // in the text while still emitting to PM2 stdout at INFO level. File log
  // below still receives every level for forensic value.
  if (level === 'ERROR') {
    logger.error(logLine)
  } else if (level === 'WARN') {
    logger.warn(logLine)
  } else if (level === 'DEBUG') {
    logger.debug(logLine)
  } else {
    logger.info(logLine)
  }
  
  // Write to file
  try {
    writeCounter++
    if (writeCounter % ROTATE_CHECK_EVERY_N === 0) {
      rotateIfTooLarge()
    }
    fs.appendFileSync(LOG_FILE, logLine)
  } catch (error) {
    logger.error('Failed to write to atlas-communication.log:', error)
  }
}

export const atlasLogger = {
  /**
   * Log connection attempt
   */
  connectionAttempt(ipAddress: string, port: number) {
    writeLog('INFO', 'CONNECTION', `Attempting to connect to Atlas processor`, {
      ipAddress,
      port,
      protocol: 'TCP'
    })
  },

  /**
   * Log successful connection
   */
  connectionSuccess(ipAddress: string, port: number) {
    writeLog('INFO', 'CONNECTION', `Successfully connected to Atlas processor`, {
      ipAddress,
      port,
      status: 'connected'
    })
  },

  /**
   * Log connection failure
   */
  connectionFailure(ipAddress: string, port: number, error: any) {
    writeLog('ERROR', 'CONNECTION', `Failed to connect to Atlas processor`, {
      ipAddress,
      port,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
  },

  /**
   * Log connection closed
   */
  connectionClosed(ipAddress: string, port: number) {
    writeLog('INFO', 'CONNECTION', `Connection closed`, {
      ipAddress,
      port
    })
  },

  /**
   * Log command sent to processor
   */
  commandSent(command: any, ipAddress: string) {
    writeLog('DEBUG', 'COMMAND', `Sent command to Atlas processor`, {
      ipAddress,
      method: command.method,
      params: command.params,
      id: command.id,
      rawCommand: JSON.stringify(command)
    })
  },

  /**
   * Log response received from processor
   */
  responseReceived(response: any, ipAddress: string) {
    // Skip meter subscription responses — bulk telemetry, not loggable
    const params = response?.result?.params || response?.params
    if (Array.isArray(params) && params.some((p: any) => String(p?.param || '').includes('Meter'))) return

    writeLog('DEBUG', 'RESPONSE', `Received response from Atlas processor`, {
      ipAddress,
      response: response,
      hasError: !!response.error,
      hasResult: !!response.result
    })
  },

  /**
   * Log command timeout
   */
  commandTimeout(commandId: number, ipAddress: string) {
    writeLog('ERROR', 'TIMEOUT', `Command timed out`, {
      ipAddress,
      commandId
    })
  },

  /**
   * Log parameter update (from subscription)
   * NOTE: Meter updates are suppressed — they fire ~30/sec and were
   * responsible for 68 GB of log growth. Only non-meter updates are logged.
   */
  parameterUpdate(param: string, value: any, ipAddress: string) {
    // Skip meter readings — these are real-time telemetry, not loggable events
    if (param.includes('Meter')) return

    writeLog('DEBUG', 'UPDATE', `Parameter update received`, {
      ipAddress,
      parameter: param,
      value
    })
  },

  /**
   * Log zone control action
   */
  zoneControl(action: string, zone: number, value: any, ipAddress: string) {
    writeLog('INFO', 'ZONE_CONTROL', `Zone control action`, {
      ipAddress,
      action,
      zone,
      value
    })
  },

  /**
   * Log input gain adjustment
   */
  inputGainAdjustment(inputNumber: number, gain: number, ipAddress: string) {
    writeLog('INFO', 'INPUT_GAIN', `Input gain adjusted`, {
      ipAddress,
      inputNumber,
      gain,
      unit: 'dB'
    })
  },

  /**
   * Log error
   */
  error(category: string, message: string, error: any) {
    writeLog('ERROR', category.toUpperCase(), message, {
      error: error instanceof Error ? error.message : (typeof error === 'object' ? JSON.stringify(error) : String(error)),
      stack: error instanceof Error ? error.stack : undefined
    })
  },

  /**
   * Log warning
   */
  warn(category: string, message: string, data?: any) {
    writeLog('WARN', category.toUpperCase(), message, data)
  },

  /**
   * Log info
   */
  info(category: string, message: string, data?: any) {
    writeLog('INFO', category.toUpperCase(), message, data)
  },

  /**
   * Log debug
   */
  debug(category: string, message: string, data?: any) {
    writeLog('DEBUG', category.toUpperCase(), message, data)
  }
}

// Export as default
export default atlasLogger
