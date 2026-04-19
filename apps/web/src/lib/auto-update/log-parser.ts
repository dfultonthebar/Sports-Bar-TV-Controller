/**
 * Parse an auto-update.sh log file into a structured run record.
 *
 * Format of each line in the log:
 *   [YYYY-MM-DD HH:MM:SS][AUTO-UPDATE] <message>
 *
 * Key markers we extract:
 *   === STEP: <name> ===
 *   Triggered by: <source> (dry-run=0)
 *   Pre-merge: branch=... sha=<sha> version=<version>
 *   Post-merge sha: <sha>
 *   Checkpoint <A|B|C>: DECISION: <GO|CAUTION|STOP> <reason>
 *   verify-install.sh output: {"status":"PASS|FAIL",...}
 *   SUCCESS: updated <branch> from <sha> to <sha> in <N>s
 *   FAIL at step '<name>': <reason>
 *   Rollback tag created: <tag>
 *
 * Step timing: each STEP marker has a timestamp prefix; the duration
 * of a step = timestamp of next step − timestamp of this step. The
 * last step's duration = timestamp of the final log line − its
 * timestamp.
 */
import * as fs from 'fs'
import * as path from 'path'

const LOG_DIR = '/home/ubuntu/sports-bar-data/update-logs'

export interface StepRecord {
  name: string
  startedAt: string // ISO
  startedUnix: number
  durationMs: number
}

export interface CheckpointRecord {
  name: 'A' | 'B' | 'C'
  decision: 'GO' | 'CAUTION' | 'STOP' | 'UNKNOWN'
  reason: string
  timestamp: string
  fullResponseLines: number
}

export interface AutoUpdateRun {
  id: string // filename without .log
  filename: string
  startedAt: string // ISO
  startedUnix: number
  finishedAt: string | null
  finishedUnix: number | null
  totalDurationMs: number | null
  triggeredBy: string | null
  preMergeBranch: string | null
  preMergeSha: string | null
  preMergeVersion: string | null
  postMergeSha: string | null
  postMergeVersion: string | null
  commitsPendingMerge: number | null
  steps: StepRecord[]
  checkpoints: CheckpointRecord[]
  verifyInstallStatus: 'PASS' | 'FAIL' | 'UNKNOWN' | null
  verifyInstallDetail: string | null
  finalResult: 'success' | 'fail' | 'unknown'
  failedStep: string | null
  rollbackTag: string | null
  logLines: number
  fileSizeBytes: number
}

const HEADER_RE = /^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\]\[AUTO-UPDATE\]\s*(.*)$/
const STEP_RE = /^=== STEP: (.+) ===\s*$/
const CHECKPOINT_DECISION_RE = /^Checkpoint ([ABC]): DECISION: (GO|CAUTION|STOP)(.*)$/
const VERIFY_OUTPUT_RE = /^verify-install\.sh output:\s*(\{.*\})$/
const PRE_MERGE_RE = /^Pre-merge:\s*branch=(\S+)\s*sha=([0-9a-f]+)\s*version=(\S+)\s*$/
const POST_MERGE_SHA_RE = /^Post-merge sha:\s*([0-9a-f]+)\s*$/
const TRIGGERED_BY_RE = /^Triggered by:\s*(\S+)/
const COMMITS_PENDING_RE = /^Commits pending merge:\s*(\d+)/
const FAIL_AT_STEP_RE = /^FAIL at step '(\S+)':/
const ROLLBACK_TAG_RE = /^Rollback tag created:\s*(\S+)/
const SUCCESS_RE = /^SUCCESS: updated/

function tsToUnix(date: string, time: string): number {
  // Interpret as local time (logs use local timezone) by leveraging Date.parse.
  const iso = `${date}T${time}`
  const ms = new Date(iso).getTime()
  return Math.floor(ms / 1000)
}

function tsToIso(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString()
}

/**
 * Parse a single log file. Returns a structured run record or null if
 * the file isn't a valid auto-update log (missing preflight step, etc.).
 */
export function parseLogFile(filePath: string): AutoUpdateRun | null {
  if (!fs.existsSync(filePath)) return null
  const stat = fs.statSync(filePath)
  const raw = fs.readFileSync(filePath, 'utf8')
  const lines = raw.split(/\r?\n/)

  const filename = path.basename(filePath, '.log')
  const run: AutoUpdateRun = {
    id: filename,
    filename: path.basename(filePath),
    startedAt: '',
    startedUnix: 0,
    finishedAt: null,
    finishedUnix: null,
    totalDurationMs: null,
    triggeredBy: null,
    preMergeBranch: null,
    preMergeSha: null,
    preMergeVersion: null,
    postMergeSha: null,
    postMergeVersion: null,
    commitsPendingMerge: null,
    steps: [],
    checkpoints: [],
    verifyInstallStatus: null,
    verifyInstallDetail: null,
    finalResult: 'unknown',
    failedStep: null,
    rollbackTag: null,
    logLines: lines.length,
    fileSizeBytes: stat.size,
  }

  let currentCheckpoint: CheckpointRecord | null = null
  let currentCheckpointBuffer: string[] = []
  let postStep: { step: StepRecord; indexAfter: number } | null = null
  let lastTimestamp: { dateStr: string; timeStr: string; unix: number } | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(HEADER_RE)
    if (!m) {
      // Not a header line — might be a continuation of a checkpoint response
      if (currentCheckpoint) {
        currentCheckpointBuffer.push(line)
      }
      continue
    }
    const [, dateStr, timeStr, msg] = m
    const unix = tsToUnix(dateStr, timeStr)
    lastTimestamp = { dateStr, timeStr, unix }

    if (!run.startedAt) {
      run.startedAt = tsToIso(dateStr, timeStr)
      run.startedUnix = unix
    }

    // End the previous step's duration if we're about to start a new one
    const stepMatch = msg.match(STEP_RE)
    if (stepMatch) {
      if (run.steps.length > 0) {
        const prev = run.steps[run.steps.length - 1]
        prev.durationMs = (unix - prev.startedUnix) * 1000
      }
      run.steps.push({
        name: stepMatch[1],
        startedAt: tsToIso(dateStr, timeStr),
        startedUnix: unix,
        durationMs: 0,
      })
      // Close any open checkpoint buffer on STEP change
      if (currentCheckpoint && currentCheckpointBuffer.length > 0) {
        currentCheckpoint.fullResponseLines = currentCheckpointBuffer.length
        currentCheckpointBuffer = []
        currentCheckpoint = null
      }
      continue
    }

    // Triggered by
    const trig = msg.match(TRIGGERED_BY_RE)
    if (trig && !run.triggeredBy) {
      run.triggeredBy = trig[1]
    }

    // Pre-merge
    const pre = msg.match(PRE_MERGE_RE)
    if (pre) {
      run.preMergeBranch = pre[1]
      run.preMergeSha = pre[2]
      run.preMergeVersion = pre[3]
    }

    // Post-merge sha
    const post = msg.match(POST_MERGE_SHA_RE)
    if (post) {
      run.postMergeSha = post[1]
    }

    // Commits pending
    const cp = msg.match(COMMITS_PENDING_RE)
    if (cp) {
      run.commitsPendingMerge = parseInt(cp[1], 10)
    }

    // Rollback tag
    const rb = msg.match(ROLLBACK_TAG_RE)
    if (rb) {
      run.rollbackTag = rb[1]
    }

    // Checkpoint decision lines (first-line summary)
    const ck = msg.match(CHECKPOINT_DECISION_RE)
    if (ck) {
      const decision = ck[2] as 'GO' | 'CAUTION' | 'STOP'
      const reason = (ck[3] || '').trim().replace(/^-\s*/, '')
      currentCheckpoint = {
        name: ck[1] as 'A' | 'B' | 'C',
        decision,
        reason,
        timestamp: tsToIso(dateStr, timeStr),
        fullResponseLines: 0,
      }
      run.checkpoints.push(currentCheckpoint)
      currentCheckpointBuffer = []
      continue
    }

    // verify-install.sh output
    const vi = msg.match(VERIFY_OUTPUT_RE)
    if (vi) {
      try {
        const parsed = JSON.parse(vi[1])
        run.verifyInstallStatus = parsed.status === 'PASS' ? 'PASS' : parsed.status === 'FAIL' ? 'FAIL' : 'UNKNOWN'
        const pass = parsed.passed ?? '?'
        const total = parsed.total ?? '?'
        const failed = Array.isArray(parsed.failed) ? parsed.failed.join(',') : ''
        run.verifyInstallDetail = `${pass}/${total}${failed ? ' failed: ' + failed : ''}`
      } catch { /* ignore malformed JSON */ }
    }

    // Success / fail sentinels
    if (SUCCESS_RE.test(msg)) {
      run.finalResult = 'success'
    }
    const failMatch = msg.match(FAIL_AT_STEP_RE)
    if (failMatch) {
      run.finalResult = 'fail'
      run.failedStep = failMatch[1]
    }
  }

  // Close the last step's duration
  if (run.steps.length > 0 && lastTimestamp) {
    const last = run.steps[run.steps.length - 1]
    if (last.durationMs === 0) {
      last.durationMs = (lastTimestamp.unix - last.startedUnix) * 1000
    }
  }

  if (lastTimestamp) {
    run.finishedUnix = lastTimestamp.unix
    run.finishedAt = tsToIso(lastTimestamp.dateStr, lastTimestamp.timeStr)
    run.totalDurationMs = (lastTimestamp.unix - run.startedUnix) * 1000
  }

  if (!run.startedUnix) return null
  return run
}

/**
 * List all recent log files, parsed into summaries. Newest first.
 * Returns at most `limit` runs.
 */
export function listRuns(limit = 50): AutoUpdateRun[] {
  if (!fs.existsSync(LOG_DIR)) return []
  const files = fs
    .readdirSync(LOG_DIR)
    .filter(f => f.startsWith('auto-update-') && f.endsWith('.log'))
    .map(f => ({ name: f, path: path.join(LOG_DIR, f), mtime: fs.statSync(path.join(LOG_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit)

  const runs: AutoUpdateRun[] = []
  for (const f of files) {
    const parsed = parseLogFile(f.path)
    if (parsed) runs.push(parsed)
  }
  return runs
}

/**
 * Return the full text of a specific log file for the live-viewer page.
 * Guards against arbitrary path access — only accepts an `id` matching
 * the `auto-update-YYYY-MM-DD-HH-MM` pattern.
 */
export function getRawLog(id: string): { content: string; bytes: number } | null {
  if (!/^auto-update-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(id)) return null
  const filePath = path.join(LOG_DIR, `${id}.log`)
  if (!fs.existsSync(filePath)) return null
  const content = fs.readFileSync(filePath, 'utf8')
  return { content, bytes: Buffer.byteLength(content, 'utf8') }
}
