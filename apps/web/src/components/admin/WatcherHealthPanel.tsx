'use client'

/**
 * Watcher Health Panel
 *
 * Three-card dashboard for the in-process RF/audio watchers (SDR, Shure
 * SLX-D, Atlas). Polls /api/system/watchers/status every 30s. Pre-fix,
 * operators had to SSH and `pm2 logs | grep WATCHER` to verify the
 * pollers were alive — this surface makes it a one-glance check.
 *
 * Alive-state mirrors the API:
 *   alive=true  -> green dot, "Running"
 *   alive=false -> red dot, "Not running"
 *
 * No actions exposed yet (read-only). Future iteration may add a
 * "Restart" button per watcher; for now PM2 restart is the recovery
 * path so we don't surface a clicker that could confuse operators.
 */

import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, Radio, Mic, Volume2, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface WatcherStatus {
  alive: boolean
  lastEventAt: string | null
  lastStartupAt: string | null
  eventCount24h: number
}

interface WatchersResponse {
  success: boolean
  now?: string
  sdr?: WatcherStatus
  shure?: WatcherStatus
  atlas?: WatcherStatus
  error?: string
}

const POLL_INTERVAL_MS = 30_000

interface WatcherCardConfig {
  key: 'sdr' | 'shure' | 'atlas'
  title: string
  subtitle: string
  Icon: typeof Radio
  iconColor: string
}

const WATCHERS: ReadonlyArray<WatcherCardConfig> = [
  {
    key: 'sdr',
    title: 'SDR Spectrum',
    subtitle: 'rtl_power sweep — sdr_carriers table',
    Icon: Radio,
    iconColor: 'text-purple-400',
  },
  {
    key: 'shure',
    title: 'Shure SLX-D',
    subtitle: 'TCP 2202 receiver poll — shure_rf_events table',
    Icon: Mic,
    iconColor: 'text-cyan-400',
  },
  {
    key: 'atlas',
    title: 'Atlas Priority/Drop',
    subtitle: 'Input/output meter poll — atlas_priority_events table',
    Icon: Volume2,
    iconColor: 'text-amber-400',
  },
]

/**
 * Render a timestamp as "5 min ago" / "3 hours ago" / "just now".
 * Returns "never" for null/empty.
 */
function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return 'never'
  const deltaSec = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (deltaSec < 10) return 'just now'
  if (deltaSec < 60) return `${deltaSec} sec ago`
  if (deltaSec < 3600) {
    const m = Math.floor(deltaSec / 60)
    return `${m} min ago`
  }
  if (deltaSec < 86400) {
    const h = Math.floor(deltaSec / 3600)
    return `${h} hour${h === 1 ? '' : 's'} ago`
  }
  const d = Math.floor(deltaSec / 86400)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

function StatusDot({ alive }: { alive: boolean }) {
  return (
    <span
      className={
        alive
          ? 'inline-block h-3 w-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse'
          : 'inline-block h-3 w-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
      }
      aria-label={alive ? 'alive' : 'not running'}
    />
  )
}

function WatcherCard({
  config,
  status,
  loading,
}: {
  config: WatcherCardConfig
  status: WatcherStatus | undefined
  loading: boolean
}) {
  const { title, subtitle, Icon, iconColor } = config

  if (loading && !status) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6 space-y-3">
        <div className="flex items-center gap-3">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }

  const alive = status?.alive ?? false
  const lastEvent = status?.lastEventAt ?? null
  const lastStartup = status?.lastStartupAt ?? null
  const count = status?.eventCount24h ?? 0

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Icon className={`h-5 w-5 flex-shrink-0 ${iconColor}`} />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-100 truncate">{title}</h3>
            <p className="text-xs text-slate-400 truncate">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusDot alive={alive} />
          <span
            className={
              alive
                ? 'text-sm font-medium text-green-400'
                : 'text-sm font-medium text-red-400'
            }
          >
            {alive ? 'Running' : 'Not running'}
          </span>
        </div>
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-400">Last event</dt>
          <dd className="text-slate-200 font-mono text-right">
            {relativeTime(lastEvent)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-400">Last boot</dt>
          <dd className="text-slate-200 font-mono text-right">
            {relativeTime(lastStartup)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-400">Events (24h)</dt>
          <dd className="text-slate-200 font-mono text-right">
            {count.toLocaleString()}
          </dd>
        </div>
      </dl>

      {!alive && !loading && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-700/50 bg-amber-900/20 p-3 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            No recent events. Check{' '}
            <code className="font-mono">pm2 logs sports-bar-tv-controller</code> for
            startup errors, or verify the device hardware is online.
          </span>
        </div>
      )}
    </div>
  )
}

export default function WatcherHealthPanel() {
  const [data, setData] = useState<WatchersResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function fetchStatus() {
      try {
        const res = await fetch('/api/system/watchers/status', {
          cache: 'no-store',
        })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const json: WatchersResponse = await res.json()
        if (cancelled) return
        if (json.success === false) {
          setError(json.error ?? 'Unknown error')
        } else {
          setData(json)
          setError(null)
        }
      } catch (err) {
        if (cancelled) return
        setError((err as Error)?.message ?? 'Failed to fetch watcher status')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchStatus()
    const id = setInterval(fetchStatus, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [refreshTick])

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              Watcher Health
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Live status of the three background watchers. Polls every 30 seconds.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshTick((t) => t + 1)}
            className="inline-flex items-center gap-2 rounded-md border border-slate-600 bg-slate-700/60 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 active:bg-slate-600 min-h-[44px] min-w-[44px]"
            aria-label="Refresh watcher status now"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-700/50 bg-red-900/20 p-3 text-sm text-red-200">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Status fetch failed:</strong> {error}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {WATCHERS.map((cfg) => (
          <WatcherCard
            key={cfg.key}
            config={cfg}
            status={data?.[cfg.key]}
            loading={loading}
          />
        ))}
      </div>
    </div>
  )
}
