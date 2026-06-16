import { recentErrors, listLocations } from '@/lib/repo'

export const dynamic = 'force-dynamic'

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#eab308',
  low: '#38bdf8',
  info: '#64748b',
}

function ago(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}

export default async function Errors({
  searchParams,
}: {
  searchParams: Promise<{ location?: string; source?: string; severity?: string; hours?: string }>
}) {
  const sp = await searchParams
  const hours = Math.max(1, Math.min(720, Number(sp.hours) || 24))
  const since = Date.now() - hours * 3600_000
  let rows = recentErrors(since, sp.location)
  if (sp.source) rows = rows.filter((r) => r.source === sp.source)
  if (sp.severity) rows = rows.filter((r) => r.severity === sp.severity)

  const locations = listLocations()
  const locName = (id: string) => locations.find((l) => l.id === id)?.name || id

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Fleet Error Feed</h1>
        <a href="/" style={{ color: '#38bdf8', fontSize: 14 }}>← Fleet</a>
      </div>
      <p style={{ color: '#94a3b8', marginTop: 0 }}>
        {rows.length} event{rows.length === 1 ? '' : 's'} · last {hours}h
        {sp.location ? ` · ${locName(sp.location)}` : ''}
        {sp.source ? ` · ${sp.source}` : ''}
        {sp.severity ? ` · ${sp.severity}` : ''}
      </p>

      {rows.length === 0 ? (
        <div style={{ border: '1px solid #1e293b', borderRadius: 8, padding: 16, color: '#94a3b8' }}>
          No errors in the selected window. 🎉
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #1e293b' }}>
              <th style={{ padding: '6px 8px' }}>When</th>
              <th style={{ padding: '6px 8px' }}>Location</th>
              <th style={{ padding: '6px 8px' }}>Source</th>
              <th style={{ padding: '6px 8px' }}>Sev</th>
              <th style={{ padding: '6px 8px' }}>Signature</th>
              <th style={{ padding: '6px 8px' }}>Sample</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #0f172a' }}>
                <td style={{ padding: '6px 8px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{ago(r.occurredAt)} ago</td>
                <td style={{ padding: '6px 8px' }}>{locName(r.locationId)}</td>
                <td style={{ padding: '6px 8px', color: '#cbd5e1' }}>{r.source}</td>
                <td style={{ padding: '6px 8px', color: SEV_COLOR[r.severity] || '#94a3b8', fontWeight: 600 }}>
                  {r.severity}
                </td>
                <td style={{ padding: '6px 8px', fontFamily: 'ui-monospace, monospace', color: '#e2e8f0' }}>{r.signature}</td>
                <td style={{ padding: '6px 8px', color: '#94a3b8', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.sample}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
