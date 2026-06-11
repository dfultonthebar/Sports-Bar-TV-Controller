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
 */
import { promises as fs } from 'fs'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { getDistributionEngine } from '@/lib/scheduler/distribution-engine'
import type { GameInfo } from '@/lib/scheduler/priority-calculator'
import { logger } from '@sports-bar/logger'

const LOG_DIR = process.env.SCHEDULING_LOG_DIR || '/home/ubuntu/sports-bar-data/logs'

export interface ShadowInputs {
  requestId: string
  filteredGames: any[]   // the SAME list buildPrompt/parse saw (1-based gameIndex)
  inputSources: any[]
  tvOutputs: any[]
  llmSuggestions: any[]  // { gameIndex, suggestedInput, suggestedOutputs[], ... }
}

const gameKey = (home: any, away: any): string =>
  `${String(away || '').toLowerCase().trim()}@${String(home || '').toLowerCase().trim()}`

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
    const { requestId, filteredGames, inputSources, tvOutputs, llmSuggestions } = inp

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

    const allowedInputs = inputSources
      .filter(s => s.type === 'cable' || s.type === 'directv' || s.type === 'satellite')
      .map(s => Number(s.matrixInputId))
      .filter(n => Number.isFinite(n))
    const allowedOutputs = tvOutputs
      .map(o => Number(o.channelNumber))
      .filter(n => Number.isFinite(n))

    const plan = await getDistributionEngine().createDistributionPlan(engineGames, {
      allowedInputs: allowedInputs.length ? allowedInputs : undefined,
      allowedOutputs: allowedOutputs.length ? allowedOutputs : undefined,
    })

    // Index the LLM suggestions by game content key (gameIndex → filteredGames).
    // If the LLM proposed the same game on >1 input (alternates), keep the one
    // with the most outputs as the primary for comparison.
    const llmByKey = new Map<string, { input: string | null; outputs: number[] }>()
    for (const s of llmSuggestions || []) {
      const idx = (s.gameIndex || 0) - 1
      const g = filteredGames[idx]
      if (!g) continue
      const k = gameKey(g.homeTeam, g.awayTeam)
      const outs = Array.isArray(s.suggestedOutputs) ? s.suggestedOutputs.map(Number).filter(Number.isFinite) : []
      const prev = llmByKey.get(k)
      if (!prev || outs.length > prev.outputs.length) {
        llmByKey.set(k, { input: s.suggestedInput ?? null, outputs: outs })
      }
    }

    const perGame: any[] = []
    let inputMatches = 0, jaccSum = 0, comparable = 0, onlyEngine = 0, engineMinMet = 0
    const engineKeys = new Set<string>()

    for (const ga of plan.games) {
      const k = gameKey(ga.game.homeTeam, ga.game.awayTeam)
      engineKeys.add(k)
      const engineInput = ga.assignments[0]?.inputLabel ?? null
      const engineOutputs = ga.assignments.map(a => a.outputNumber)
      if (ga.minTVsMet) engineMinMet++
      const llm = llmByKey.get(k)
      if (!llm) {
        onlyEngine++
        perGame.push({ key: k, llm: false, engineInput, engineOutCount: engineOutputs.length, engineMinMet: ga.minTVsMet })
        continue
      }
      comparable++
      const inputsAgree = !!engineInput && !!llm.input && engineInput.toLowerCase() === llm.input.toLowerCase()
      if (inputsAgree) inputMatches++
      const jac = jaccard(engineOutputs, llm.outputs)
      jaccSum += jac
      perGame.push({
        key: k,
        isHome: (ga.priority as any)?.isHomeTeamGame ?? null,
        engineInput, llmInput: llm.input, inputsAgree,
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
    }

    logger.info(
      `[AI-SUGGEST-SOLVER:SHADOW ${requestId}] inputAgree=${comparison.inputAgreementPct}% ` +
      `avgJaccard=${comparison.avgJaccard} engineGames=${comparison.engineGames} llmGames=${comparison.llmGames} ` +
      `onlyEngine=${onlyEngine} onlyLLM=${onlyLLM} engineMinMet=${engineMinMet}`
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
