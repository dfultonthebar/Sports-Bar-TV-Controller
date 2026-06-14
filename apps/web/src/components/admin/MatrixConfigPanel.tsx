'use client'

/**
 * MatrixConfigPanel — surfaces the Wolf Pack `outputOffset` value in the
 * admin UI and flags single-card chassis that are misconfigured with a
 * non-zero offset.
 *
 * Why this exists (CLAUDE.md Gotcha #4):
 *   `MatrixConfiguration.outputOffset` is ADDED to every output number
 *   before routing commands hit the Wolf Pack. If wrong, every "output 1"
 *   request lands on a physical output it shouldn't — silently. Lucky's
 *   1313 shipped in April 2026 with `outputOffset=26` on a single-card
 *   WP-36X36 and ran for weeks routing every "1" to physical 27 before
 *   anyone caught it. Until this panel landed, the value was visible only
 *   over SSH.
 *
 * Status logic:
 *   - MISMATCH (amber): `MATRIX_SINGLE_CARD=true` in the location's .env
 *     AND `outputOffset != 0`. This is the verify-install.sh enforcement
 *     condition and the operator-stated rule.
 *   - OK (green): everything else. Multi-card chassis are wiring-specific;
 *     any non-zero value on them is accepted without warning.
 *
 * Fix-to-0 button only renders on MISMATCH and PATCHes
 * `/api/matrix/config` with the row id + outputOffset=0.
 */

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react'
import { logger } from '@sports-bar/logger'

interface MatrixConfigRow {
  id: string
  name: string
  model: string
  outputOffset: number
  audioOutputCount: number
}

interface MatrixConfigResponse {
  configs?: MatrixConfigRow[]
  config?: MatrixConfigRow | null
  singleCardModeEnabled?: boolean
}

interface RowState {
  row: MatrixConfigRow
  status: 'ok' | 'mismatch'
  reason: string | null
}

export default function MatrixConfigPanel() {
  const [rows, setRows] = useState<MatrixConfigRow[]>([])
  const [singleCardEnabled, setSingleCardEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fixingId, setFixingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/matrix/config', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: MatrixConfigResponse = await res.json()
      const list = (data.configs && data.configs.length > 0)
        ? data.configs
        : data.config
          ? [data.config]
          : []
      setRows(list as MatrixConfigRow[])
      setSingleCardEnabled(!!data.singleCardModeEnabled)
    } catch (err) {
      logger.error('[MatrixConfigPanel] load failed:', err)
      setMessage({ kind: 'error', text: 'Failed to load matrix configuration. Are you signed in?' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const fixToZero = async (id: string) => {
    if (!confirm('Set outputOffset to 0 for this row?\n\nThis is the correct value for single-card Wolf Pack chassis. Routing commands will start landing on the physical output numbers shown in the UI (no hidden offset added).')) {
      return
    }
    setFixingId(id)
    setMessage(null)
    try {
      const res = await fetch('/api/matrix/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, outputOffset: 0 }),
      })
      const data = await res.json()
      if (!res.ok) {
        const detail = data?.error || data?.details || `HTTP ${res.status}`
        throw new Error(detail)
      }
      setMessage({
        kind: 'success',
        text: `outputOffset set to 0 (was ${data.previousOutputOffset}). Re-test routing from the bartender remote.`,
      })
      await load()
    } catch (err) {
      logger.error('[MatrixConfigPanel] fix-to-0 failed:', err)
      const text = err instanceof Error ? err.message : 'Unknown error'
      setMessage({ kind: 'error', text: `Failed to update: ${text}` })
    } finally {
      setFixingId(null)
    }
  }

  // Compute per-row status. Single-card enforcement only fires when the
  // operator has set MATRIX_SINGLE_CARD=true — same gate as verify-install.
  const evaluated: RowState[] = rows.map(row => {
    if (singleCardEnabled && (row.outputOffset ?? 0) !== 0) {
      return {
        row,
        status: 'mismatch',
        reason: `MATRIX_SINGLE_CARD=true in .env but outputOffset=${row.outputOffset}. Single-card chassis MUST use 0 or every routing command lands on output (n + ${row.outputOffset}) instead of n.`,
      }
    }
    return { row, status: 'ok', reason: null }
  })

  const anyMismatch = evaluated.some(e => e.status === 'mismatch')

  return (
    <div className="space-y-4">
      {/* Header / explainer */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-100">Wolf Pack Matrix Configuration</h3>
            <p className="text-sm text-slate-400 mt-1">
              Shows the <code className="bg-slate-900/50 px-1.5 py-0.5 rounded text-slate-200">outputOffset</code> value
              that gets ADDED to every output number before routing commands hit the Wolf Pack. Single-card chassis
              must use 0; multi-card setups depend on physical wiring.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Single-card enforcement is{' '}
              <span className={singleCardEnabled ? 'text-green-300 font-semibold' : 'text-slate-400'}>
                {singleCardEnabled ? 'ENABLED' : 'disabled'}
              </span>{' '}
              for this location ({singleCardEnabled
                ? 'MATRIX_SINGLE_CARD=true in .env — mismatches flagged below'
                : 'MATRIX_SINGLE_CARD unset — any value is accepted; check this location against CLAUDE.md §4 manually'}).
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-100 text-sm flex items-center gap-2 transition-colors"
            aria-label="Reload matrix configuration"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Reload
          </button>
        </div>
      </div>

      {/* Message banner */}
      {message && (
        <div
          className={`rounded-lg border p-4 text-sm flex items-start gap-3 ${
            message.kind === 'success'
              ? 'border-green-700 bg-green-900/20 text-green-200'
              : 'border-red-700 bg-red-900/20 text-red-200'
          }`}
        >
          {message.kind === 'success'
            ? <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-green-400" />
            : <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-400" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Global MISMATCH banner — repeats the operator-stated rule */}
      {anyMismatch && (
        <div className="rounded-lg border border-amber-600 bg-amber-900/20 p-4 text-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-400" />
            <div className="space-y-2 text-amber-100">
              <p className="font-semibold">Misconfigured outputOffset detected</p>
              <p className="text-amber-200/90">
                Canonical fix: single-card Wolf Pack chassis must have{' '}
                <code className="bg-slate-900/50 px-1.5 py-0.5 rounded">outputOffset = 0</code>.
                Use the "Fix to 0" button on the affected row(s). Verify routing from the bartender remote
                afterward — output 1 should land on physical output 1.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading matrix configurations…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No active Wolf Pack matrix configuration found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/40">
                  <th className="text-left py-3 px-4 font-semibold text-slate-300">Location / Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-300">Model</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-300">outputOffset</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-300">audioOutputCount</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-300">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-300">Action</th>
                </tr>
              </thead>
              <tbody>
                {evaluated.map(({ row, status, reason }) => {
                  const isMismatch = status === 'mismatch'
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-800 last:border-b-0 ${
                        isMismatch ? 'bg-amber-900/10' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-slate-100 font-medium">{row.name}</td>
                      <td className="py-3 px-4 text-slate-300 font-mono text-xs">{row.model}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-mono text-sm ${
                            isMismatch ? 'text-amber-300 font-bold' : 'text-slate-200'
                          }`}
                        >
                          {row.outputOffset ?? 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono text-xs">
                        {row.audioOutputCount ?? 0}
                      </td>
                      <td className="py-3 px-4">
                        {isMismatch ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-amber-900/40 text-amber-200 border border-amber-700"
                            title={reason || undefined}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            MISMATCH
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-green-900/30 text-green-300 border border-green-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            OK
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isMismatch ? (
                          <button
                            type="button"
                            onClick={() => fixToZero(row.id)}
                            disabled={fixingId === row.id}
                            className="min-h-[44px] px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center gap-2 transition-colors"
                          >
                            {fixingId === row.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Fixing…
                              </>
                            ) : (
                              'Fix to 0'
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Per-row MISMATCH detail (collapsed below table for readability) */}
      {evaluated.filter(e => e.status === 'mismatch').length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Mismatch details
          </p>
          {evaluated
            .filter(e => e.status === 'mismatch')
            .map(({ row, reason }) => (
              <div key={row.id} className="text-xs text-slate-400">
                <span className="text-amber-300 font-semibold">{row.name}</span> ({row.model}):{' '}
                <span className="text-slate-300">{reason}</span>
              </div>
            ))}
        </div>
      )}

      {/* Reference footer */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 text-xs text-slate-500 leading-relaxed">
        <p className="font-semibold text-slate-400 mb-1">Reference (CLAUDE.md §4 — Matrix Config Per-Location Values):</p>
        <p>
          Single-card chassis (one card fills all outputs): <code className="text-slate-300">outputOffset = 0</code>.
          Multi-card chassis (multiple daughter cards in one frame): per-card value depends on physical wiring —
          ask the installer or check the per-location row in CLAUDE.md before changing.
        </p>
      </div>
    </div>
  )
}
