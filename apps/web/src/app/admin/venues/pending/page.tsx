/**
 * /admin/venues/pending — Operator triage UI for auto-discovered
 * NeighborhoodVenues awaiting review.
 *
 * Backend was shipped in v2.53.4 (GET /api/admin/venues/pending +
 * POST /api/admin/venues/[id]/review). Until now the only client was the
 * readline CLI at apps/web/scripts/review-pending-venues.ts — fine for the
 * developer, painful for the operator at 94 pending venues.
 *
 * Same field surface as the CLI: name, category, distance, source, event
 * count, latest event. Approve/Decline/Merge per row.
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MapPin, RefreshCw } from 'lucide-react'
import SportsBarHeader from '@/components/SportsBarHeader'
import SportsBarLayout from '@/components/SportsBarLayout'
import SafeBoundary from '@/components/SafeBoundary'
import { logger } from '@sports-bar/logger'

type PendingVenue = {
  id: string
  name: string
  category: string
  distanceMi: number | null
  discoverySource: string
  createdAt: number
  eventCount: number
  latestEvent: { name: string; startTime: number } | null
}

function formatDistance(mi: number | null): string {
  if (mi == null) return '—'
  return `${mi.toFixed(1)} mi`
}

function formatEventTime(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function VenueRow({
  venue,
  busy,
  onAction,
}: {
  venue: PendingVenue
  busy: boolean
  onAction: (action: 'approve' | 'decline' | 'merge', targetId?: string) => void
}) {
  const [mergeMode, setMergeMode] = useState(false)
  const [mergeTarget, setMergeTarget] = useState('')

  return (
    <tr className="border-b border-slate-700 hover:bg-slate-800/50">
      <td className="px-3 py-3 text-white">
        <div className="font-medium">{venue.name}</div>
        {venue.latestEvent && (
          <div className="text-xs text-slate-400 mt-0.5">
            Latest: {venue.latestEvent.name} ({formatEventTime(venue.latestEvent.startTime)})
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-slate-300 text-sm">{venue.category}</td>
      <td className="px-3 py-3 text-slate-300 text-sm text-right">{formatDistance(venue.distanceMi)}</td>
      <td className="px-3 py-3 text-slate-400 text-xs">
        <span className="rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5">
          {venue.discoverySource}
        </span>
      </td>
      <td className="px-3 py-3 text-slate-300 text-sm text-right">{venue.eventCount}</td>
      <td className="px-3 py-3">
        {mergeMode ? (
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="target venue id"
              value={mergeTarget}
              onChange={(e) => setMergeTarget(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-white text-xs rounded px-2 py-1 w-48"
              disabled={busy}
            />
            <button
              onClick={() => onAction('merge', mergeTarget)}
              disabled={busy || !mergeTarget.trim()}
              className="bg-amber-600/80 hover:bg-amber-600 disabled:opacity-40 text-white text-xs px-3 py-1 rounded"
            >
              Confirm
            </button>
            <button
              onClick={() => { setMergeMode(false); setMergeTarget('') }}
              disabled={busy}
              className="text-slate-400 hover:text-white text-xs px-2 py-1"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => onAction('approve')}
              disabled={busy}
              className="bg-emerald-600/80 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs px-3 py-1 rounded"
            >
              Approve
            </button>
            <button
              onClick={() => onAction('decline')}
              disabled={busy}
              className="bg-red-600/80 hover:bg-red-600 disabled:opacity-40 text-white text-xs px-3 py-1 rounded"
            >
              Decline
            </button>
            <button
              onClick={() => setMergeMode(true)}
              disabled={busy}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 text-xs px-3 py-1 rounded"
            >
              Merge…
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

function PendingVenuesPanel() {
  const [venues, setVenues] = useState<PendingVenue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/venues/pending?limit=200', { cache: 'no-store' })
      if (res.status === 401 || res.status === 403) {
        setError('Not authorized. Sign in with an ADMIN PIN.')
        setVenues([])
        return
      }
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Failed to load')
        return
      }
      setVenues(data.venues || [])
    } catch (e: any) {
      setError(e?.message ?? 'Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleAction = async (
    venueId: string,
    action: 'approve' | 'decline' | 'merge',
    targetVenueId?: string,
  ) => {
    setBusyId(venueId)
    setToast(null)
    try {
      const body: Record<string, unknown> = { action }
      if (action === 'merge') body.targetVenueId = targetVenueId
      const res = await fetch(`/api/admin/venues/${venueId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) {
        setToast(`Error: ${data.error || res.statusText}`)
        return
      }
      setVenues((prev) => prev.filter((v) => v.id !== venueId))
      if (action === 'merge' && typeof data.eventsMoved === 'number') {
        setToast(`Merged — ${data.eventsMoved} events moved.`)
      } else {
        setToast(`${action.charAt(0).toUpperCase()}${action.slice(1)}d.`)
      }
    } catch (e: any) {
      logger.error('[venues-admin] action failed', { error: e?.message })
      setToast(`Error: ${e?.message ?? 'Network error'}`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-400" />
          Pending Neighborhood Venues
          {!loading && (
            <span className="ml-2 text-sm font-normal text-slate-400">({venues.length})</span>
          )}
        </h2>
        <button
          onClick={load}
          disabled={loading}
          className="text-slate-300 hover:text-white text-sm flex items-center gap-1 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {toast && (
        <div className="mb-4 rounded border border-blue-500/30 bg-blue-500/10 text-blue-300 px-3 py-2 text-sm">
          {toast}
        </div>
      )}

      {error && (
        <div className="rounded border border-red-500/40 bg-red-950/30 text-red-300 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!error && !loading && venues.length === 0 && (
        <div className="text-slate-400 text-sm py-8 text-center">
          No venues pending review. New auto-discovered venues will appear here when scrapers run.
        </div>
      )}

      {!error && venues.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-3 py-2 font-medium">Venue</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium text-right">Distance</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium text-right">Events</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <VenueRow
                  key={v.id}
                  venue={v}
                  busy={busyId === v.id}
                  onAction={(action, targetId) => handleAction(v.id, action, targetId)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 text-xs text-slate-500 leading-relaxed">
        Auto-discovered venues from Ticketmaster Discovery API + OSM Overpass scrapers. <strong>Approve</strong> = venue is real and within RF range; events will flow into the shift-brief.{' '}
        <strong>Decline</strong> = not a real event-generating venue (deactivates AND marks declined per v2.53.5 belt-and-suspenders). <strong>Merge</strong> = duplicate of an existing venue; type the target venue id and events get re-pointed.
      </div>
    </div>
  )
}

export default function PendingVenuesPage() {
  return (
    <SportsBarLayout>
      <div className="min-h-screen bg-gradient-to-br from-sportsBar-900 via-sportsBar-800 to-sportsBar-900">
        <SportsBarHeader
          title="Pending Venue Review"
          subtitle="Triage auto-discovered neighborhood venues for the RF/shift-brief pipeline"
          icon={<MapPin className="w-8 h-8" />}
        />

        <main className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <Link
              href="/admin"
              className="inline-flex items-center space-x-2 text-slate-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Admin</span>
            </Link>
          </div>

          <div className="max-w-6xl mx-auto">
            <SafeBoundary label="Pending Venue Review">
              <PendingVenuesPanel />
            </SafeBoundary>
          </div>
        </main>
      </div>
    </SportsBarLayout>
  )
}
