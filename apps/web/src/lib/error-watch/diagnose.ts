/**
 * Hermes Layer 1 — error-watch diagnosis enrichment (scaffold).
 *
 * Plan: docs/HERMES_AUTONOMOUS_OPS_PLAN.md → "Layer 1 — Diagnosis enrichment".
 *
 * The diagnose step runs BEFORE the error-watch handler writes its TODO, gated
 * behind `DIAGNOSE_ENABLED` (default OFF). When off, the handler behaves exactly
 * as before — nothing in this module runs.
 *
 * This is the NON-LLM scaffolding pass:
 *   - `runDiagnose()` pulls matching gotchas/docs/memory via the RAG query path.
 *   - `diagnoseWithLLM()` is a STUB that returns null for now. The real LLM call
 *     lands on T4-day (see the TODO below).
 *
 * Failure isolation: every RAG/LLM call here is wrapped so a diagnose failure
 * NEVER blocks the TODO from being written. The handler treats a thrown or null
 * result as "no enrichment" and files the TODO unchanged.
 */
import { logger } from '@sports-bar/logger'
import { queryDocs } from '@/lib/rag-server/query-engine'

/** Tag added to any TODO that has been through the diagnose step so it is
 *  never re-diagnosed (mirrors the `errorwatch:<sig>` convention). */
export const DIAGNOSED_TAG = 'diagnosed:1'

/** Is the diagnose step turned on? Default OFF — when unset, the existing
 *  detect→TODO path is byte-for-byte unchanged. */
export function isDiagnoseEnabled(): boolean {
  return String(process.env.DIAGNOSE_ENABLED || '').toLowerCase() === 'true'
}

/** A single RAG source surfaced for the diagnosis (subset of QueryResult.sources). */
export interface DiagnoseSource {
  filename: string
  filepath: string
  heading?: string
  relevanceScore: number
}

/** Structured LLM diagnosis. Matches the plan's schema. Stubbed for now. */
export interface LLMDiagnosis {
  rootCauseHypothesis: string
  affectedComponent: string
  proposedFix: string
  confidence: 'high' | 'medium' | 'low'
  relevantDocs: string[]
}

export interface DiagnoseInput {
  signature: string
  sample: string
  logContext: string
}

export interface DiagnoseResult {
  /** RAG sources found for this signature/sample (may be empty). */
  ragSources: DiagnoseSource[]
  /** Structured LLM diagnosis, or null while the LLM call is stubbed. */
  llm: LLMDiagnosis | null
}

/**
 * STUB — the real LLM call lands on T4-day. For this scaffolding pass it always
 * returns null so the handler falls through to the RAG-sources-only enrichment.
 *
 * TODO(#359 T4-day): wire @sports-bar/ollama-client remote-first call here.
 * Feed {sample, logContext, ragSources} to llama3.1:8b (remote-first → T4),
 * parse the structured { rootCauseHypothesis, affectedComponent, proposedFix,
 * confidence, relevantDocs } block, and return it. Until then this is a no-op.
 */
export async function diagnoseWithLLM(_input: {
  sample: string
  logContext: string
  ragSources: DiagnoseSource[]
}): Promise<LLMDiagnosis | null> {
  // Scaffold: no LLM yet. Clearly-marked no-op.
  return null
}

/**
 * Run the diagnose step: RAG lookup + (stubbed) LLM call. NEVER throws — any
 * failure is logged and degrades to empty sources / null llm so the caller can
 * always still write the TODO.
 */
export async function runDiagnose(input: DiagnoseInput): Promise<DiagnoseResult> {
  let ragSources: DiagnoseSource[] = []

  try {
    const query = `Error signature "${input.signature}". Sample: ${input.sample}`.slice(0, 1000)
    const result = await queryDocs({ query, topK: 4 })
    ragSources = (result.sources || []).map((s) => ({
      filename: s.filename,
      filepath: s.filepath,
      heading: s.heading,
      relevanceScore: s.relevanceScore,
    }))
  } catch (err) {
    // RAG failure must never block the TODO — degrade to no sources.
    logger.debug(`[ERROR-WATCH-DIAGNOSE] RAG query skipped: ${(err as Error)?.message}`)
    ragSources = []
  }

  let llm: LLMDiagnosis | null = null
  try {
    llm = await diagnoseWithLLM({
      sample: input.sample,
      logContext: input.logContext,
      ragSources,
    })
  } catch (err) {
    logger.debug(`[ERROR-WATCH-DIAGNOSE] LLM diagnose skipped: ${(err as Error)?.message}`)
    llm = null
  }

  return { ragSources, llm }
}

/**
 * Build the "Relevant docs" suffix appended to the TODO description when the
 * diagnose step found RAG sources. Returns '' when there is nothing useful so
 * the TODO is written unchanged.
 */
export function buildDiagnosisDescription(result: DiagnoseResult): string {
  const parts: string[] = []

  if (result.llm) {
    // (Stubbed off for now — present so the T4 wiring has a home.)
    parts.push(
      `\n\nDiagnosis (auto):\n` +
        `Root cause: ${result.llm.rootCauseHypothesis}\n` +
        `Component: ${result.llm.affectedComponent}\n` +
        `Proposed fix: ${result.llm.proposedFix}\n` +
        `Confidence: ${result.llm.confidence}`,
    )
  }

  if (result.ragSources.length > 0) {
    const lines = result.ragSources
      .slice(0, 4)
      .map((s) => `- ${s.heading ? `${s.filename} › ${s.heading}` : s.filename} (${s.filepath})`)
    parts.push(`\n\nRelevant docs:\n${lines.join('\n')}`)
  }

  return parts.join('')
}
