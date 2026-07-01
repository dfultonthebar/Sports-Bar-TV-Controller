import { listLocations, latestHealthByLocation, latestMetricsByLocation, recentErrors, getFleetTarget } from '@/lib/repo'

export const dynamic = 'force-dynamic'

const STATUS_COLOR: Record<string, string> = {
  healthy: '#22c55e',
  degraded: '#f59e0b',
  critical: '#ef4444',
  unknown: '#64748b',
}

function ago(ts?: number | null): string {
  if (!ts) return 'never'
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  return `${Math.round(s / 3600)}h ago`
}

export default function Home() {
  const locations = listLocations()
  const health = latestHealthByLocation()
  const metrics = latestMetricsByLocation()
  const errors24h = recentErrors(Date.now() - 24 * 3600_000)
  const target = getFleetTarget()
  const driftCount = target
    ? locations.filter((loc) => {
        const v = health.get(loc.id)?.version
        return v && v !== target.targetVersion
      }).length
    : 0

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>SBCC Hub — Fleet</h1>
      <p style={{ color: '#94a3b8', marginTop: 0 }}>
        {locations.length} location{locations.length === 1 ? '' : 's'} ·{' '}
        <a href="/errors" style={{ color: '#38bdf8' }}>
          {errors24h.length} error{errors24h.length === 1 ? '' : 's'} in 24h →
        </a>
        {' · '}
        <a href="/chat" style={{ color: '#38bdf8' }}>
          maintenance chat →
        </a>
        {' · '}
        <a href="/honcho" style={{ color: '#38bdf8' }}>
          AI ops →
        </a>
      </p>
      <p style={{ color: '#94a3b8', marginTop: 0, fontSize: 13 }}>
        {target ? (
          <>
            Target version: <strong style={{ color: '#e2e8f0' }}>{target.targetVersion}</strong>
            {driftCount > 0 ? (
              <span style={{ color: '#f59e0b' }}> · {driftCount} box{driftCount === 1 ? '' : 'es'} behind</span>
            ) : (
              <span style={{ color: '#22c55e' }}> · fleet converged</span>
            )}
            {' · '}set by {target.setBy} {ago(target.setAt)}
          </>
        ) : (
          <span>
            No fleet target pinned — POST /api/fleet-target {'{ targetVersion }'} to enable drift detection.
          </span>
        )}
      </p>

      {locations.length === 0 ? (
        <div style={{ border: '1px solid #1e293b', borderRadius: 8, padding: 16, color: '#94a3b8' }}>
          No locations registered yet. POST to <code>/api/locations</code> with{' '}
          <code>{'{ id, name, hmacSecret }'}</code>, then point that location&apos;s hub-agent here.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {locations.map((loc) => {
            const h = health.get(loc.id)
            const m = metrics.get(loc.id)
            const status = h?.overallStatus || 'unknown'
            const isBehind = !!(target && h?.version && h.version !== target.targetVersion)
            return (
              <a
                key={loc.id}
                href={`/locations/${loc.id}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block', border: isBehind ? '1px solid #f59e0b' : '1px solid #1e293b', borderRadius: 8, padding: 14, background: '#0f172a' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{loc.name}</strong>
                  <span style={{ color: STATUS_COLOR[status], fontWeight: 600, fontSize: 13 }}>● {status}</span>
                </div>
                <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>
                  {loc.id} · seen {ago(loc.lastSeenAt)}
                  {h?.version ? (
                    <>
                      {' · v'}
                      {h.version}
                      {isBehind && <span style={{ color: '#f59e0b' }}> (target v{target?.targetVersion})</span>}
                    </>
                  ) : null}
                </div>
                <div style={{ fontSize: 13, color: '#cbd5e1' }}>
                  Devices: {h?.devicesOnline ?? '—'}/{h?.devicesTotal ?? '—'}
                  {' · '}CPU {m?.cpuUsagePct ?? '—'}%{' · '}Mem {m?.memUsedPct ?? '—'}%{' · '}Disk{' '}
                  {m?.diskUsedPct ?? '—'}%
                </div>
              </a>
            )
          })}
        </div>
      )}
    </main>
  )
}
