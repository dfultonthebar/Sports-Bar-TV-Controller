'use client'

/**
 * Fire TV Streaming Apps Panel
 *
 * Admin view for discovering which streaming / sports / music apps are
 * installed on each Amazon Fire TV Cube at the current location.
 *
 * The apps list only renders when an Amazon box is actively selected —
 * the "no device selected" state is intentional so the panel doesn't
 * feel like a persistent status wall.
 *
 * Data source: GET /api/device-subscriptions?deviceType=firetv (cached
 * JSON in data/device-subscriptions.json). POST /api/device-subscriptions/poll
 * re-polls a single device via ADB `pm list packages`.
 */

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Tv, Music, Trophy, Monitor, AlertCircle } from 'lucide-react'
import { logger } from '@sports-bar/logger'

interface Subscription {
  id: string
  name: string
  type: 'streaming' | 'sports' | 'music' | string
  status: 'active' | 'inactive' | 'expired' | string
  provider?: string
  packageName?: string
  description?: string
}

interface DeviceSubscriptionEntry {
  deviceId: string
  deviceType: 'firetv' | 'directv' | string
  deviceName: string
  subscriptions: Subscription[]
  lastPolled: string
  pollStatus: 'success' | 'error' | 'pending' | string
  error?: string
}

interface FireTVDevice {
  id: string
  name: string
  ipAddress: string
  isOnline?: boolean
}

const TYPE_ORDER: Array<{ key: string; label: string; icon: any; color: string }> = [
  { key: 'streaming', label: 'Streaming',  icon: Monitor, color: 'text-blue-400' },
  { key: 'sports',    label: 'Sports',     icon: Trophy,  color: 'text-amber-400' },
  { key: 'music',     label: 'Music',      icon: Music,   color: 'text-purple-400' },
]

function groupByType(subs: Subscription[]): Record<string, Subscription[]> {
  const groups: Record<string, Subscription[]> = {}
  for (const s of subs) {
    const key = (s.type || 'other').toLowerCase()
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  }
  for (const k of Object.keys(groups)) {
    groups[k].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }
  return groups
}

function formatLastPolled(iso: string | undefined): string {
  if (!iso) return 'never'
  try {
    const d = new Date(iso)
    const mins = Math.floor((Date.now() - d.getTime()) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins} min ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} hr ago`
    const days = Math.floor(hours / 24)
    return `${days} day${days > 1 ? 's' : ''} ago`
  } catch {
    return iso
  }
}

export default function FireTVStreamingAppsPanel() {
  const [devices, setDevices] = useState<FireTVDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [subscriptionsByDevice, setSubscriptionsByDevice] = useState<Record<string, DeviceSubscriptionEntry>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load Fire TV device list + cached subscription data in parallel
  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [devResp, subResp] = await Promise.all([
        fetch('/api/firetv-devices'),
        fetch('/api/device-subscriptions?deviceType=firetv'),
      ])
      const devData = await devResp.json()
      const subData = await subResp.json()

      const deviceList: FireTVDevice[] = Array.isArray(devData?.devices)
        ? devData.devices.map((d: any) => ({
            id: d.id,
            name: d.name,
            ipAddress: d.ipAddress || d.ip_address || '',
            isOnline: d.isOnline ?? d.is_online ?? undefined,
          }))
        : []

      const subMap: Record<string, DeviceSubscriptionEntry> = {}
      for (const entry of subData?.devices || []) {
        subMap[entry.deviceId] = entry
      }

      setDevices(deviceList)
      setSubscriptionsByDevice(subMap)
    } catch (e: any) {
      logger.error('[FireTVStreamingAppsPanel] load failed', e)
      setError(e?.message || 'Failed to load Fire TV devices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const refreshSelected = useCallback(async () => {
    if (!selectedDeviceId) return
    try {
      setRefreshing(true)
      setError(null)
      const res = await fetch('/api/device-subscriptions/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDeviceId,
          deviceType: 'firetv',
          force: true,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Failed to refresh device')
        return
      }
      // Re-fetch the GET endpoint to pick up the updated entry
      const subResp = await fetch('/api/device-subscriptions?deviceType=firetv')
      const subData = await subResp.json()
      const subMap: Record<string, DeviceSubscriptionEntry> = {}
      for (const entry of subData?.devices || []) subMap[entry.deviceId] = entry
      setSubscriptionsByDevice(subMap)
    } catch (e: any) {
      logger.error('[FireTVStreamingAppsPanel] refresh failed', e)
      setError(e?.message || 'Failed to refresh device')
    } finally {
      setRefreshing(false)
    }
  }, [selectedDeviceId])

  const selectedDevice = devices.find(d => d.id === selectedDeviceId) || null
  const selectedEntry = selectedDeviceId ? subscriptionsByDevice[selectedDeviceId] : null
  const groups = selectedEntry ? groupByType(selectedEntry.subscriptions || []) : {}
  const totalApps = selectedEntry?.subscriptions?.length ?? 0

  // If there are no Fire TVs at this location, don't render the panel at all
  if (!loading && devices.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Tv className="h-5 w-5 text-blue-400" />
          Amazon Fire TV Streaming Apps
        </h3>
        {selectedDeviceId && (
          <button
            onClick={refreshSelected}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded border border-slate-600 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Polling…' : 'Refresh Apps'}
          </button>
        )}
      </div>
      <p className="text-sm text-slate-400 mb-4">
        Select an Amazon box to see which streaming / sports / music apps are installed on it. Data is polled via ADB <code className="text-slate-300">pm list packages</code>.
      </p>

      {/* Device selector */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-400 mb-2">Device</label>
        <div className="flex flex-wrap gap-2">
          {loading && (
            <span className="text-sm text-slate-400">Loading Fire TV devices…</span>
          )}
          {!loading && devices.map(d => {
            const isSelected = d.id === selectedDeviceId
            const entry = subscriptionsByDevice[d.id]
            const appCount = entry?.subscriptions?.length ?? 0
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDeviceId(isSelected ? null : d.id)}
                className={
                  'px-4 py-2 rounded-lg border text-sm transition-colors ' +
                  (isSelected
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800/50 border-slate-600 text-slate-300 hover:bg-slate-700')
                }
              >
                <div className="font-medium">{d.name}</div>
                <div className={`text-xs ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                  {d.ipAddress || 'no ip'} · {appCount} app{appCount === 1 ? '' : 's'}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-950/30 p-3 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-300">{error}</div>
        </div>
      )}

      {/* Empty state — no device selected */}
      {!selectedDeviceId && !loading && (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-800/30 p-8 text-center">
          <Tv className="h-10 w-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            Select an Amazon Fire TV above to see its installed apps.
          </p>
        </div>
      )}

      {/* Device details */}
      {selectedDeviceId && selectedDevice && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <div>
              <span className="text-slate-300 font-medium">{selectedDevice.name}</span>
              {' · '}
              <span className="font-mono">{selectedDevice.ipAddress}</span>
              {' · '}
              <span>{totalApps} app{totalApps === 1 ? '' : 's'} installed</span>
            </div>
            <div className="text-xs">
              {selectedEntry
                ? `polled ${formatLastPolled(selectedEntry.lastPolled)}`
                : 'never polled — click Refresh Apps'}
            </div>
          </div>

          {selectedEntry && selectedEntry.pollStatus === 'error' && (
            <div className="rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-300">
              Last poll failed: {selectedEntry.error || 'unknown error'}
            </div>
          )}

          {!selectedEntry && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 text-sm text-slate-400">
              No cached data yet. Click <span className="text-slate-200 font-medium">Refresh Apps</span> to poll this device.
            </div>
          )}

          {selectedEntry && selectedEntry.subscriptions.length === 0 && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 text-sm text-slate-400">
              No known streaming apps detected. Either the device truly has none installed, or the package is not in our detection dictionary — add it to{' '}
              <code className="text-slate-300">packages/firecube/src/subscription-polling.ts</code>.
            </div>
          )}

          {selectedEntry && selectedEntry.subscriptions.length > 0 && (
            <div className="space-y-4">
              {TYPE_ORDER.map(({ key, label, icon: Icon, color }) => {
                const apps = groups[key] || []
                if (apps.length === 0) return null
                return (
                  <div key={key}>
                    <h4 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${color}`}>
                      <Icon className="h-4 w-4" />
                      {label}
                      <span className="text-xs text-slate-500 font-normal">({apps.length})</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {apps.map(app => (
                        <div
                          key={app.id || app.packageName}
                          className="rounded border border-slate-700 bg-slate-800/50 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium text-white truncate">{app.name}</div>
                              {app.provider && (
                                <div className="text-xs text-slate-400 truncate">{app.provider}</div>
                              )}
                              {app.packageName && (
                                <div className="text-[10px] text-slate-500 font-mono truncate" title={app.packageName}>
                                  {app.packageName}
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 flex-shrink-0">
                              installed
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
