import { getLocation, latestHealth, latestMetrics, latestScheduler, recentErrors } from '@/lib/repo'

export const dynamic = 'force-dynamic'

function ago(ts?: number | null): string {
  if (!ts) return 'never'
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  return `${Math.round(s / 3600)}h ago`
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #1e293b', borderRadius: 8, padding: 12, background: '#0f172a', minWidth: 120 }}>
      <div style={{ color: '#64748b', fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
    </div>
  )
}

export default async function LocationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const loc = getLocation(id)
  if (!loc) {
    return (
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        <a href="/" style={{ color: '#38bdf8' }}>← Fleet</a>
        <p style={{ color: '#94a3b8' }}>Unknown location: {id}</p>
      </main>
    )
  }
  const h = latestHealth(id) as any
  const m = latestMetrics(id) as any
  const s = latestScheduler(id) as any
  const errs = recentErrors(Date.now() - 24 * 3600_000, id)

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>{loc.name}</h1>
        <a href="/" style={{ color: '#38bdf8', fontSize: 14 }}>← Fleet</a>
      </div>
      <p style={{ color: '#64748b', marginTop: 0 }}>
        {loc.id} · {loc.branch || 'no branch'} · seen {ago(loc.lastSeenAt)}
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0' }}>
        <Stat label="Health" value={h?.overallStatus || '—'} />
        <Stat label="Devices" value={`${h?.devicesOnline ?? '—'}/${h?.devicesTotal ?? '—'}`} />
        <Stat label="CPU" value={`${m?.cpuUsagePct ?? '—'}%`} />
        <Stat label="Mem" value={`${m?.memUsedPct ?? '—'}%`} />
        <Stat label="Disk" value={`${m?.diskUsedPct ?? '—'}%`} />
        <Stat label="Scheduler" value={s ? `${s.successRate ?? '—'}% / ${s.totalOps ?? '—'}` : '—'} />
      </div>

      <h2 style={{ fontSize: 16, marginTop: 20 }}>
        Errors (24h) — {errs.length} · <a href={`/errors?location=${id}`} style={{ color: '#38bdf8', fontSize: 13 }}>full feed →</a>
      </h2>
      {errs.length === 0 ? (
        <div style={{ color: '#94a3b8' }}>None. 🎉</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, fontSize: 13 }}>
          {errs.slice(0, 25).map((e) => (
            <li key={e.id} style={{ padding: '6px 0', borderBottom: '1px solid #0f172a' }}>
              <span style={{ color: '#64748b' }}>{ago(e.occurredAt)}</span>{' · '}
              <span style={{ color: '#cbd5e1' }}>{e.source}</span>{' · '}
              <code style={{ color: '#e2e8f0' }}>{e.signature}</code>
              {e.sample ? <span style={{ color: '#94a3b8' }}> — {e.sample}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
