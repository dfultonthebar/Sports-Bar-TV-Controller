'use client'

import { useState, useEffect } from 'react'
import { Play, Tv2, Loader2 } from 'lucide-react'

import { logger } from '@/lib/logger'
interface StreamingApp {
  appId: string
  name: string
  packageName: string
  displayName: string
  icon: string
  enabled: boolean
  priority: number
  sports: string[]
  description: string
}

interface FireTVAppShortcutsProps {
  deviceId: string
  deviceName: string
  ipAddress: string
  port: number
  onAppLaunch?: (appId: string, appName: string) => void
}

export default function FireTVAppShortcuts({
  deviceId,
  deviceName,
  ipAddress,
  port,
  onAppLaunch
}: FireTVAppShortcutsProps) {
  const [apps, setApps] = useState<StreamingApp[]>([])
  const [loading, setLoading] = useState(true)
  const [launchingApp, setLaunchingApp] = useState<string | null>(null)

  useEffect(() => {
    loadSubscribedApps()
  }, [])

  const loadSubscribedApps = async () => {
    try {
      const response = await fetch('/api/streaming/subscribed-apps')
      const data = await response.json()
      setApps(data.apps || [])
    } catch (error) {
      logger.error('Error loading subscribed apps:', error)
    } finally {
      setLoading(false)
    }
  }

  const launchApp = async (app: StreamingApp) => {
    setLaunchingApp(app.appId)

    try {
      const response = await fetch('/api/streaming/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          ipAddress,
          port,
          appId: app.appId
        })
      })

      const result = await response.json()

      if (result.success) {
        logger.info(`✅ Launched ${app.name}`)
        onAppLaunch?.(app.appId, app.name)
      } else {
        logger.error(`❌ Failed to launch ${app.name}:`, result.error)
      }
    } catch (error) {
      logger.error('Error launching app:', error)
    } finally {
      setLaunchingApp(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
        <div className="flex items-center justify-center space-x-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading apps...</span>
        </div>
      </div>
    )
  }

  if (apps.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
        <div className="text-center text-slate-400 text-sm">
          <Tv2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No streaming apps configured</p>
          <p className="text-xs mt-1">Edit subscribed-streaming-apps.json to add apps</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
          <Tv2 className="w-4 h-4" />
          <span>Quick Launch Apps</span>
        </h3>
        <span className="text-xs text-slate-500">{deviceName}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {apps.map((app) => (
          <button
            key={app.appId}
            onClick={() => launchApp(app)}
            disabled={launchingApp === app.appId}
            className={`
              flex flex-col items-center justify-center p-3 rounded-lg
              border transition-all
              ${launchingApp === app.appId
                ? 'bg-blue-500/30 border-blue-500/50 cursor-wait'
                : 'bg-slate-700/50 border-slate-600/50 hover:bg-slate-600/50 hover:border-slate-500 active:bg-slate-500/50'
              }
              ${launchingApp && launchingApp !== app.appId ? 'opacity-50' : ''}
            `}
            title={app.description}
          >
            {launchingApp === app.appId ? (
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin mb-1" />
            ) : (
              <div className="flex items-center justify-center mb-1">
                <span className="text-2xl">{app.icon}</span>
              </div>
            )}
            <span className="text-xs text-slate-200 font-medium text-center leading-tight">
              {app.displayName}
            </span>
            {app.sports && app.sports.length > 0 && app.sports[0] !== 'all' && (
              <span className="text-[10px] text-slate-400 mt-0.5 truncate w-full text-center">
                {app.sports.slice(0, 2).join(', ')}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700/50">
        <p className="text-xs text-slate-500 text-center">
          Click an app to launch it on {deviceName}
        </p>
      </div>
    </div>
  )
}
