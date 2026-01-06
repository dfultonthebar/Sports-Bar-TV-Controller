
'use client'

import { useState, useEffect } from 'react'
import { StreamingApp } from '@/lib/streaming/streaming-apps-database'

interface InstalledApp {
  app: StreamingApp
  isInstalled: boolean
  deviceId: string
  lastChecked: Date
}

interface StreamingAppsPanelProps {
  deviceId: string
  ipAddress: string
  port?: number
}

export function StreamingAppsPanel({ deviceId, ipAddress, port = 5555 }: StreamingAppsPanelProps) {
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [launchingApp, setLaunchingApp] = useState<string | null>(null)

  useEffect(() => {
    detectApps()
  }, [deviceId, ipAddress])

  const detectApps = async (forceRefresh: boolean = false) => {
    setIsDetecting(true)
    setError(null)

    try {
      const response = await fetch('/api/streaming/apps/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, ipAddress, port, forceRefresh })
      })

      const data = await response.json()

      if (data.success) {
        setInstalledApps(data.apps)
      } else {
        setError(data.error || 'Failed to detect apps')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to detect apps')
    } finally {
      setIsDetecting(false)
    }
  }

  const launchApp = async (appId: string) => {
    setLaunchingApp(appId)
    setError(null)

    try {
      const response = await fetch('/api/streaming/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, ipAddress, appId, port })
      })

      const data = await response.json()

      if (!data.success) {
        setError(data.error || 'Failed to launch app')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to launch app')
    } finally {
      setLaunchingApp(null)
    }
  }

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'sports': return 'bg-green-100 text-green-800'
      case 'live-tv': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const installedCount = installedApps.filter(a => a.isInstalled).length
  const appsWithApi = installedApps.filter(a => a.isInstalled && a.app.hasPublicApi).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Streaming Apps</h3>
          <p className="text-sm text-gray-600">
            {installedCount} installed • {appsWithApi} with API access
          </p>
        </div>
        <button
          onClick={() => detectApps(true)}
          disabled={isDetecting}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isDetecting ? 'Detecting...' : 'Refresh'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Apps Grid */}
      {isDetecting && installedApps.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Detecting installed apps...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {installedApps.map(({ app, isInstalled }) => (
            <div
              key={app.id}
              className={`p-4 border rounded-lg ${
                isInstalled ? 'bg-white border-green-300' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{app.name}</h4>
                    {isInstalled && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                        Installed
                      </span>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${getCategoryBadgeColor(app.category)}`}>
                    {app.category}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {app.description}
              </p>

              <div className="space-y-2 mb-3">
                {app.hasPublicApi && (
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>API Available</span>
                  </div>
                )}

                {app.requiresSubscription && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <span>Subscription Required</span>
                  </div>
                )}

                <div className="text-xs text-gray-500">
                  <span className="font-medium">Sports:</span> {app.sports.slice(0, 3).join(', ')}
                  {app.sports.length > 3 && ` +${app.sports.length - 3} more`}
                </div>
              </div>

              {isInstalled && (
                <button
                  onClick={() => launchApp(app.id)}
                  disabled={launchingApp === app.id}
                  className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {launchingApp === app.id ? 'Launching...' : 'Launch App'}
                </button>
              )}

              {!isInstalled && (
                <div className="text-xs text-gray-500 text-center py-2">
                  Not installed on device
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
