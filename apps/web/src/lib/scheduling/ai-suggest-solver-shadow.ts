/**
 * AI Suggest — deterministic solver SHADOW runner (Wave 2, intelligence roadmap).
 *
 * The research + Grok review found AI Suggest's LLM is the wrong tool for the
 * combinatorial game→TV assignment — and a deterministic DistributionEngine
 * already exists (and is used in the execution paths). Wave 2 wires that engine
 * into AI Suggest, but SAFELY: this shadow runner computes the engine's plan
 * ALONGSIDE the LLM result, logs a structured diff, and changes NOTHING the
 * operator sees. After ~a week of clean diffs the engine can be promoted to
 * primary in a separate patch. Gated by AI_SUGGEST_SOLVER=shadow.
 *
 * Hard rules (Grok): never throw into the request path (this is fired
 * after the response is sent); match games by CONTENT KEY (home@away), not
 * array index (the engine sorts by priority, the LLM list includes streaming);
 * scope to the cable/directv slice (the engine doesn't model streaming inputs).
 *
 * Audit (wf_bf9a3b6b) corrections folded in:
 *  #1 (CRITICAL) input identity: input_sources.matrixInputId is unreliable — at
 *     some locations it holds the matrix channelNumber directly, at others a UUID
 *     FK to MatrixInput.id, and it is NULL on fresh installs. The engine filters
 *     on MatrixInput.channelNumber (StateReader sets inputNumber from it). Resolve
 *     robustly via MatrixInput (both lineages), else the diff is garbage.
 *  #2 (HIGH) home-team padding mutates suggestedOutputs in place BEFORE we read it,
 *     so home-game Jaccard would be ~1.0 (both padded to minTVs). Compare against
 *     the LLM's PRE-PAD organic outputs (passed in prePadByGameId).
 *  #3 (MED) compare inputs by channel NUMBER (engine inputNumber vs the LLM input's
 *     resolved channelNumber), not engine label vs input_sources.name.
 */
import { promises as fs } from 'fs'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { db, schema } from '@/db'
import { getDistributionEngine } from '@/lib/scheduler/distribution-engine'
import type { GameInfo } from '@/lib/scheduler/priority-calculator'
import { logger } from '@sports-bar/logger'

const LOG_DIR = process.env.SCHEDULING_LOG_DIR || '/home/ubuntu/sports-bar-data/logs'

export interface ShadowInputs {
  requestId: string
  filteredGames: any[]   // the SAME list buildPrompt/parse saw (1-based gameIndex)
  inputSources: any[]
  tvOutputs: any[]
  llmSuggestions: any[]  // AISuggestion[] { gameId, homeTeam, awayTeam, suggestedInput, suggestedOutputs[], ... }
  /** gameId → the LLM's ORGANIC outputs before home-team padding (#2) */
  prePadByGameId?: Map<string, number[]>
}

const gameKey = (home: any, away: any): string =>
  `${String(away || '').toLowerCase().trim()}@${String(home || '').toLowerCase().trim()}`

const norm = (s: any): string => String(s || '').toLowerCase().trim()

function jaccard(a: number[], b: number[]): number {
  const sa = new Set(a), sb = new Set(b)
  if (sa.size === 0 && sb.size === 0) return 1
  let inter = 0
  for (const x of sa) if (sb.has(x)) inter++
  const union = sa.size + sb.size - inter
  return union === 0 ? 1 : inter / union
}

export async function runAiSuggestSolverShadow(inp: ShadowInputs): Promise<void> {
  try {
    const { requestId, filteredGames, inputSources, tvOutputs, llmSuggestions, prePadByGameId } = inp

    // cable/directv slice only — the engine doesn't model streaming inputs.
    const cableDirectvGames = filteredGames.filter(g => g.channelNumber || g.directvChannel)
    if (cableDirectvGames.length === 0) {
      logger.info(`[AI-SUGGEST-SOLVER:SHADOW ${requestId}] no cable/directv games — skipped`)
      return
    }

    const engineGames: GameInfo[] = cableDirectvGames.map(g => ({
      id: g.id,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      league: g.league,
      startTime: g.startTime || new Date().toISOString(),
      cableChannel: g.channelNumber || undefined,
      directvChannel: g.directvChannel || undefined,
    }))

    // --- #1: resolve input identity the way the engine does (MatrixInput.channelNumber) ---
    // input_sources.matrixInputId is unreliable (channelNumber at some sites, a UUID
    // FK to MatrixInput.id at others, NULL on fresh installs). Build both lookups and
    // resolve each cable/directv source to its matrix channel number.
    const matrixRows = await db.select().from(schema.matrixInputs)
    const channelById = new Map<string, number>()
    const validChannels = new Set<number>()
    for (const mi of matrixRows as any[]) {
      const ch = Number(mi.channelNumber)
      if (Number.isFinite(ch)) {
        validChannels.add(ch)
        if (mi.id != null) channelById.set(String(mi.id), ch)
      }
    }
    const resolveChannel = (s: any): number | null => {
      const raw = s?.matrixInputId
      if (raw == null || raw === '') return null
      if (channelById.has(String(raw))) return channelById.get(String(raw))!   // UUID FK lineage
      const n = Number(raw)
      if (Number.isFinite(n) && validChannels.has(n)) return n                 // direct-channelNumber lineage
      return null
    }

    const nameToChannel = new Map<string, number>() // input_sources.name → channel (#3 comparison)
    const allowedInputsArr: number[] = []
    let unresolvedInputs = 0
    for (const s of inputSources) {
      if (s.type !== 'cable' && s.type !== 'directv' && s.type !== 'satellite') continue
      const ch = resolveChannel(s)
      if (ch == null) { unresolvedInputs++; continue }
      allowedInputsArr.push(ch)
      if (s.name) nameToChannel.set(norm(s.name), ch)
    }
    const allowedInputs = [...new Set(allowedInputsArr)]

    const allowedOutputs = tvOutputs
      .map(o => Number(o.channelNumber))
      .filter(n => Number.isFinite(n))

    const plan = await getDistributionEngine().createDistributionPlan(engineGames, {
      allowedInputs: allowedInputs.length ? allowedInputs : undefined,
      allowedOutputs: allowedOutputs.length ? allowedOutputs : undefined,
    })

    // Index the LLM suggestions by game content key (gameIndex → filteredGames).
    // #2: use the PRE-PAD organic outputs (home-team padding mutated the post-pad
    // copy to minTVs, which would make home-game Jaccard a meaningless 1.0). If the
    // same game appears on >1 input (alternates), keep the one with the most outputs.
    const llmByKey = new Map<string, { inputCh: number | null; inputName: string | null; outputs: number[] }>()
    for (const s of llmSuggestions || []) {
      // AISuggestion carries homeTeam/awayTeam + gameId directly — match by content
      // key (no fragile index), and read PRE-PAD organic outputs by gameId (#2).
      const k = gameKey(s.homeTeam, s.awayTeam)
      if (k === '@') continue
      const organic = prePadByGameId?.get(s.gameId)
      const rawOuts = Array.isArray(organic) ? organic : s.suggestedOutputs
      const outs = Array.isArray(rawOuts) ? rawOuts.map(Number).filter(Number.isFinite) : []
      const prev = llmByKey.get(k)
      if (!prev || outs.length > prev.outputs.length) {
        llmByKey.set(k, {
          inputCh: s.suggestedInput ? (nameToChannel.get(norm(s.suggestedInput)) ?? null) : null,
          inputName: s.suggestedInput ?? null,
          outputs: outs,
        })
      }
    }

    const perGame: any[] = []
    let inputMatches = 0, jaccSum = 0, comparable = 0, onlyEngine = 0, engineMinMet = 0
    const engineKeys = new Set<string>()

    for (const ga of plan.games) {
      const k = gameKey(ga.game.homeTeam, ga.game.awayTeam)
      engineKeys.add(k)
      const engineInputCh = ga.assignments[0]?.inputNumber ?? null
      const engineInputLabel = ga.assignments[0]?.inputLabel ?? null
      const engineOutputs = ga.assignments.map(a => a.outputNumber)
      if (ga.minTVsMet) engineMinMet++
      const llm = llmByKey.get(k)
      if (!llm) {
        onlyEngine++
        perGame.push({ key: k, llm: false, engineInputCh, engineInputLabel, engineOutCount: engineOutputs.length, engineMinMet: ga.minTVsMet })
        continue
      }
      comparable++
      // #3: compare by channel number (label vs name was a false 0%).
      const inputsAgree = engineInputCh != null && llm.inputCh != null && engineInputCh === llm.inputCh
      if (inputsAgree) inputMatches++
      const jac = jaccard(engineOutputs, llm.outputs)
      jaccSum += jac
      perGame.push({
        key: k,
        isHome: (ga.priority as any)?.isHomeTeamGame ?? null,
        engineInputCh, llmInputCh: llm.inputCh, llmInputName: llm.inputName, inputsAgree,
        engineOutCount: engineOutputs.length, llmOutCount: llm.outputs.length,
        jaccard: Number(jac.toFixed(2)),
        engineMinMet: ga.minTVsMet,
      })
    }
    const onlyLLM = [...llmByKey.keys()].filter(k => !engineKeys.has(k)).length

    const comparison = {
      inputAgreementPct: comparable ? Math.round((100 * inputMatches) / comparable) : 0,
      avgJaccard: comparable ? Number((jaccSum / comparable).toFixed(2)) : 0,
      engineGames: plan.games.length,
      llmGames: llmByKey.size,
      onlyEngine,
      onlyLLM,
      engineMinMet,
      unresolvedInputs,
      allowedInputCount: allowedInputs.length,
    }

    logger.info(
      `[AI-SUGGEST-SOLVER:SHADOW ${requestId}] inputAgree=${comparison.inputAgreementPct}% ` +
      `avgJaccard=${comparison.avgJaccard} engineGames=${comparison.engineGames} llmGames=${comparison.llmGames} ` +
      `onlyEngine=${onlyEngine} onlyLLM=${onlyLLM} engineMinMet=${engineMinMet} ` +
      `allowedInputs=${allowedInputs.length} unresolvedInputs=${unresolvedInputs}`
    )

    // Persistent daily log for multi-day fleet comparison before the primary flip.
    try {
      if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })
      const d = new Date()
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const box = process.env.LOCATION_NAME || process.env.LOCATION_ID || 'unknown'
      await fs.appendFile(
        path.join(LOG_DIR, `ai-suggest-shadow-${ymd}.log`),
        JSON.stringify({ at: new Date().toISOString(), requestId, box, comparison, perGame }) + '\n'
      )
    } catch {
      /* best-effort */
    }
  } catch (err: any) {
    logger.warn(`[AI-SUGGEST-SOLVER:SHADOW] shadow run failed (non-fatal): ${err?.message || err?.name || 'unknown'}`)
  }
}
