/**
 * Maintenance-chat AI for the hub dashboard.
 *
 * Builds a compact FLEET STATUS context from the hub's own time-series DB
 * (the data every location's agent already pushes) and asks the shared local
 * model — the same Ollama on the Hermes box (CT 212) that Hermes itself runs
 * on. No cloud, no per-location round-trips: the hub answers from the data it
 * already aggregates.
 *
 * Env:
 *   HUB_OLLAMA_BASE   default http://100.70.56.34:11434  (CT 212 `hermes`, tailnet)
 *   HUB_OLLAMA_MODEL  default llama3.2:3b  (small model: co-resides with the
 *                     trading bot's phi4-trader "Phil" on CT212's ~15GB T4 —
 *                     llama3.1:8b/5.3GB evicts Phil, llama3.2:3b/2.6GB does not)
 */
import { listLocations, latestHealthByLocation, latestMetricsByLocation, recentErrors } from './repo'

const OLLAMA_BASE = process.env.HUB_OLLAMA_BASE || 'http://100.70.56.34:11434'
const OLLAMA_MODEL = process.env.HUB_OLLAMA_MODEL || 'llama3.2:3b'

export type ChatMsg = { role: 'user' | 'assistant' | 'system'; content: string }

function ago(ts?: number | null): string {
  if (!ts) return 'never'
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}

/** A plain-text snapshot of the fleet the model can reason over verbatim. */
export function buildFleetContext(): string {
  const locations = listLocations()
  const health = latestHealthByLocation()
  const metrics = latestMetricsByLocation()
  const errs = recentErrors(Date.now() - 24 * 3600_000)

  const lines: string[] = [`FLEET STATUS — ${locations.length} location(s):`]
  for (const loc of locations) {
    const h = health.get(loc.id)
    const m = metrics.get(loc.id)
    lines.push(
      `- ${loc.name} [${loc.id}]: status=${h?.overallStatus ?? 'unknown'}, ` +
        `devices=${h?.devicesOnline ?? '?'}/${h?.devicesTotal ?? '?'} online, ` +
        `cpu=${m?.cpuUsagePct ?? '?'}%, mem=${m?.memUsedPct ?? '?'}%, disk=${m?.diskUsedPct ?? '?'}%, ` +
        `last seen ${ago(loc.lastSeenAt)} ago`,
    )
  }

  if (errs.length === 0) {
    lines.push('', 'ERRORS (last 24h): none.')
  } else {
    // Group by source+signature so the model sees "X ×N across these locations",
    // not 500 near-identical rows (which would blow the context and hide the shape).
    const byKey = new Map<string, { count: number; sev: string; sample: string; locs: Set<string> }>()
    for (const e of errs) {
      const k = `${e.source}:${e.signature}`
      const g = byKey.get(k) ?? { count: 0, sev: e.severity, sample: e.sample ?? '', locs: new Set<string>() }
      g.count++
      g.locs.add(e.locationId)
      byKey.set(k, g)
    }
    lines.push('', `ERRORS (last 24h — ${errs.length} events, grouped):`)
    for (const [k, g] of [...byKey.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 15)) {
      lines.push(`- [${g.sev}] ${k} ×${g.count} @ ${[...g.locs].join(',')} — ${g.sample.slice(0, 100)}`)
    }
  }
  return lines.join('\n')
}

const SYSTEM = `You are the SBCC fleet maintenance assistant for a multi-location sports-bar TV control system.
Answer the operator's question using ONLY the FLEET STATUS data below. Be concise and practical — the
operator is technical but busy. If the data does not contain the answer, say so plainly; never invent
location names, device counts, or errors. When something looks wrong (offline devices, high cpu/mem/disk,
error spikes), call it out and suggest the next diagnostic step.`

/** Ask the shared local model, grounding the system prompt with the live fleet snapshot. */
export async function askFleet(messages: ChatMsg[]): Promise<string> {
  const sys = `${SYSTEM}\n\n${buildFleetContext()}`
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      options: { temperature: 0.2, num_predict: 512 },
      messages: [{ role: 'system', content: sys }, ...messages],
    }),
  })
  if (!res.ok) throw new Error(`ollama ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const j = await res.json()
  return j?.message?.content?.trim() || '(no response)'
}
