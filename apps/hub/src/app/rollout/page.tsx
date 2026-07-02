import { listRollouts, getRolloutBoxes, listLocations } from '@/lib/repo'
import { computeNextAction, tick } from '@/lib/rollout-engine'
import { startRollout, ackRollout, abortRollout } from './actions'

export const dynamic = 'force-dynamic'

const STATUS_COLOR: Record<string, string> = {
  pending: '#64748b',
  canary_triggered: '#38bdf8',
  canary_soaking: '#38bdf8',
  canary_failed: '#ef4444',
  waving: '#f59e0b',
  converged: '#22c55e',
  partial_failure: '#ef4444',
  aborted: '#64748b',
}

const BOX_STATE_COLOR: Record<string, string> = {
  pending: '#64748b',
  triggered: '#38bdf8',
  success: '#22c55e',
  rolled_back: '#ef4444',
  failed: '#ef4444',
  timeout: '#f59e0b',
}

function ago(ts?: number | null): string {
  if (!ts) return '—'
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  return `${Math.round(s / 3600)}h ago`
}

export default async function RolloutPage() {
  // tick() every active rollout so the page always shows current progress
  // (mirrors GET /api/rollout/[id]'s auto-tick — this page IS a consumer of
  // the same engine, not a wrapper around the HTTP API).
  const rollouts = listRollouts()
  for (const r of rollouts) {
    if (!['converged', 'partial_failure', 'canary_failed', 'aborted'].includes(r.status)) {
      tick(r.id)
    }
  }
  const fresh = listRollouts()
  const active = fresh.find((r) => !['converged', 'partial_failure', 'canary_failed', 'aborted'].includes(r.status))
  const history = fresh.filter((r) => r.id !== active?.id)
  const locations = listLocations()

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>SBCC Hub — Fleet Rollout</h1>
      <p style={{ color: '#94a3b8', marginTop: 0, fontSize: 13 }}>
        <a href="/" style={{ color: '#38bdf8' }}>
          ← overview
        </a>
        {'  ·  '}
        The hub has no SSH access to the fleet or to Hermes — this page tracks state and tells you (or Hermes) what
        to do next; you or Hermes perform the actual trigger (e.g. via <code>fleet-deploy.sh</code>) and confirm it
        below.
      </p>

      {active ? (
        <ActiveRollout rollout={active} boxes={getRolloutBoxes(active.id)} />
      ) : (
        <div style={{ border: '1px solid #1e293b', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <p style={{ color: '#94a3b8', margin: '0 0 12px' }}>No active rollout. Start one:</p>
          <form action={startRollout} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              name="targetVersion"
              placeholder="target version e.g. 2.95.0"
              required
              style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '6px 10px', color: '#e2e8f0' }}
            />
            <select
              name="canaryLocationId"
              defaultValue="leg-lamp"
              style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '6px 10px', color: '#e2e8f0' }}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  canary: {l.name}
                </option>
              ))}
            </select>
            <input
              name="minSoakMinutes"
              type="number"
              defaultValue={30}
              title="minutes to soak the canary before waving"
              style={{ width: 70, background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '6px 10px', color: '#e2e8f0' }}
            />
            <button
              type="submit"
              style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}
            >
              Start rollout
            </button>
          </form>
        </div>
      )}

      <h2 style={{ fontSize: 16, color: '#94a3b8', marginTop: 28 }}>History</h2>
      {history.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: 13 }}>No past rollouts.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {history.map((r) => (
            <div
              key={r.id}
              style={{ border: '1px solid #1e293b', borderRadius: 8, padding: 10, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}
            >
              <span>
                v{r.targetVersion} · canary {r.canaryLocationId} · <span style={{ color: STATUS_COLOR[r.status] }}>{r.status}</span>
              </span>
              <span style={{ color: '#64748b' }}>{ago(r.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

function ActiveRollout({
  rollout,
  boxes,
}: {
  rollout: ReturnType<typeof listRollouts>[number]
  boxes: ReturnType<typeof getRolloutBoxes>
}) {
  const nextAction = computeNextAction(rollout, boxes)

  return (
    <div style={{ border: '1px solid #1e293b', borderRadius: 8, padding: 16, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ fontSize: 18 }}>v{rollout.targetVersion}</strong>
        <span style={{ color: STATUS_COLOR[rollout.status] || '#94a3b8', fontWeight: 600 }}>{rollout.status}</span>
      </div>
      <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 12px' }}>
        canary: {rollout.canaryLocationId} · soak {rollout.minSoakMinutes}min · started {ago(rollout.createdAt)} by{' '}
        {rollout.createdBy || 'unknown'}
      </p>

      {/* Next action instruction — the operator's (or Hermes's) marching orders */}
      <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: 12, marginBottom: 12 }}>
        {nextAction.type === 'trigger' && (
          <>
            <p style={{ margin: '0 0 8px', color: '#f59e0b' }}>
              ▶ Action needed: trigger <strong>{nextAction.role}</strong> on: {nextAction.locationIds.join(', ')}
            </p>
            <code style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
              {nextAction.role === 'canary'
                ? `bash ~/.hermes/scripts/fleet-deploy.sh ${rollout.targetVersion}  # (canary only — trigger this box manually or via SSH)`
                : `TARGET=${rollout.targetVersion} bash ~/.hermes/scripts/fleet-deploy.sh  # excludes canary automatically once wired to Hermes`}
            </code>
            <form action={ackRollout.bind(null, rollout.id, nextAction.role)}>
              <button
                type="submit"
                style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}
              >
                I triggered it — advance
              </button>
            </form>
          </>
        )}
        {nextAction.type === 'wait' && <p style={{ margin: 0, color: '#38bdf8' }}>⏳ {nextAction.reason}</p>}
        {nextAction.type === 'none' && <p style={{ margin: 0, color: '#94a3b8' }}>Rollout has reached a terminal state.</p>}
      </div>

      {/* Per-box progress */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: '#64748b', textAlign: 'left' }}>
            <th style={{ padding: '4px 8px' }}>Location</th>
            <th style={{ padding: '4px 8px' }}>Role</th>
            <th style={{ padding: '4px 8px' }}>State</th>
            <th style={{ padding: '4px 8px' }}>Note</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderTop: '1px solid #1e293b' }}>
            <td style={{ padding: '4px 8px' }}>{rollout.canaryLocationId}</td>
            <td style={{ padding: '4px 8px', color: '#94a3b8' }}>canary</td>
            <td style={{ padding: '4px 8px', color: STATUS_COLOR[rollout.status] }}>{rollout.status}</td>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>
              {rollout.canarySuccessAt ? `succeeded ${ago(rollout.canarySuccessAt)}` : '—'}
            </td>
          </tr>
          {boxes.map((b) => (
            <tr key={b.id} style={{ borderTop: '1px solid #1e293b' }}>
              <td style={{ padding: '4px 8px' }}>{b.locationId}</td>
              <td style={{ padding: '4px 8px', color: '#94a3b8' }}>wave</td>
              <td style={{ padding: '4px 8px', color: BOX_STATE_COLOR[b.state] || '#94a3b8' }}>{b.state}</td>
              <td style={{ padding: '4px 8px', color: '#64748b' }}>{b.note || (b.resolvedAt ? ago(b.resolvedAt) : '—')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <form action={abortRollout.bind(null, rollout.id)} style={{ marginTop: 12 }}>
        <button
          type="submit"
          style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
        >
          Abort rollout
        </button>
      </form>
    </div>
  )
}
