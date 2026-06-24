export const dynamic = 'force-dynamic'

type OpsEvent = { content: string; createdAt: string | null; peer: string }
type OpsData = { ok: boolean; total?: number; workspace?: string; session?: string; events?: OpsEvent[]; error?: string }

async function getOps(): Promise<OpsData> {
  try {
    const base = process.env.HUB_SELF_BASE || 'http://localhost:3010'
    const res = await fetch(`${base}/api/honcho`, { cache: 'no-store' })
    return (await res.json()) as OpsData
  } catch (e: any) {
    return { ok: false, error: e?.message || 'unreachable', events: [] }
  }
}

function ago(ts: string | null): string {
  if (!ts) return ''
  const t = Date.parse(ts)
  if (Number.isNaN(t)) return ''
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

// crude category tint so the feed scans fast
function tint(content: string): string {
  const c = content.toLowerCase()
  if (/🔴|down|fail|error|rollback|conflict/.test(c)) return '#ef4444'
  if (/🟢|recovered|success|ok\b|pass|complete/.test(c)) return '#22c55e'
  if (/⚠|warn|stall|skip/.test(c)) return '#f59e0b'
  return '#38bdf8'
}

export default async function HonchoOps() {
  const data = await getOps()
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>SBCC Hub — AI Ops</h1>
      <p style={{ color: '#94a3b8', marginTop: 0 }}>
        Honcho fleet-ops flywheel{data.total != null ? ` · ${data.total} events captured` : ''}
        {' · '}
        <a href="/" style={{ color: '#38bdf8' }}>← fleet</a>
        {' · '}
        <a href="/chat" style={{ color: '#38bdf8' }}>chat →</a>
      </p>

      {!data.ok ? (
        <div style={{ border: '1px solid #7f1d1d', borderRadius: 8, padding: 16, background: '#1a0f12', color: '#fca5a5' }}>
          Honcho unreachable: {data.error || 'unknown error'}. The flywheel lives on CT213
          (<code>HONCHO_BASE</code>) — check it&apos;s up + reachable over Tailscale.
        </div>
      ) : (data.events || []).length === 0 ? (
        <div style={{ border: '1px solid #1e293b', borderRadius: 8, padding: 16, color: '#94a3b8' }}>
          No ops events in the flywheel yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(data.events || []).map((e, i) => (
            <div
              key={i}
              style={{ border: '1px solid #1e293b', borderLeft: `3px solid ${tint(e.content)}`, borderRadius: 6, padding: '10px 12px', background: '#0f172a' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#64748b', fontSize: 12, marginBottom: 4 }}>
                <span>{e.peer || 'fleet-ops'}</span>
                <span>{ago(e.createdAt)}</span>
              </div>
              <div style={{ fontSize: 13, color: '#e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{e.content}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
