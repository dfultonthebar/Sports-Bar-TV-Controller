/**
 * LLM Performance Logger
 *
 * Records one line per Ollama generation (AI Suggest, shift-brief) so we can
 * tune `num_predict` + timeout PER BOX from real data instead of guessing.
 * The key fields are `out` (actual output tokens — num_predict is only a
 * ceiling, so this tells us whether real calls ever approach the cap) and
 * `done` (`stop` = the model finished naturally; `length` = it was TRUNCATED
 * at the cap, i.e. the suggestion is incomplete — a silent quality bug).
 *
 * Path:     /home/ubuntu/sports-bar-data/logs/llm-perf-YYYY-MM-DD.log
 * Format:   ISO_TS | feature | model=… | box=… | out=N prompt=N done=… cap=N | tok_s=X total_ms=N | outcome
 * Rotation: daily file; analysis = grep/awk across days + boxes.
 *
 * Best-effort: a file-write failure never blocks the request; everything also
 * mirrors to @sports-bar/logger ([LLM-PERF]) for PM2 visibility.
 */
import { promises as fs } from 'fs'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { logger } from '@sports-bar/logger'

const LOG_DIR = process.env.SCHEDULING_LOG_DIR || '/home/ubuntu/sports-bar-data/logs'
const FILE_PREFIX = 'llm-perf-'

export interface LlmPerfEntry {
  feature: 'ai-suggest' | 'shift-brief' | string
  model: string
  totalMs: number                 // wall-clock for the Ollama call
  evalCount?: number              // output tokens produced
  promptEvalCount?: number        // prompt tokens processed
  doneReason?: string             // 'stop' = natural end; 'length' = hit num_predict cap (truncated)
  numPredict?: number             // the configured ceiling for this call
  outcome?: 'ok' | 'timeout' | 'error'
  note?: string
}

function todayFile(): string {
  const d = new Date()
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return path.join(LOG_DIR, `${FILE_PREFIX}${ymd}.log`)
}

export async function logLlmPerf(e: LlmPerfEntry): Promise<void> {
  const box = process.env.LOCATION_NAME || process.env.LOCATION_ID || 'unknown'
  // Real-world throughput: output tokens / total wall-clock. Includes prompt
  // processing + any queue wait, so it's lower than raw decode tok/s — which is
  // exactly what we want for sizing num_predict against the timeout.
  const tokS = e.evalCount && e.totalMs ? e.evalCount / (e.totalMs / 1000) : 0
  const truncated = e.doneReason === 'length'
  const line =
    `${new Date().toISOString()} | ${e.feature} | model=${e.model} | box=${box} | ` +
    `out=${e.evalCount ?? '?'} prompt=${e.promptEvalCount ?? '?'} done=${e.doneReason ?? '?'}` +
    `${truncated ? ' [TRUNCATED@cap]' : ''} cap=${e.numPredict ?? '?'} | ` +
    `tok_s=${tokS.toFixed(1)} total_ms=${e.totalMs} | ${e.outcome ?? 'ok'}${e.note ? ' — ' + e.note : ''}`

  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })
    await fs.appendFile(todayFile(), line + '\n')
  } catch {
    /* best-effort — the logger.info below still records it */
  }
  if (truncated) {
    logger.warn(`[LLM-PERF] ${line}`)
  } else {
    logger.info(`[LLM-PERF] ${line}`)
  }
}
