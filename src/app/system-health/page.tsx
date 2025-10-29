'use client'

import { useState, useEffect } from 'react'
import {
  Activity,
  Tv,
  Radio,
  Box,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Zap,
  TrendingUp,
  Clock,
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  Power,
  Settings
} from 'lucide-react'
import Link from 'next/link'

interface DeviceStatus {
  id: string
  name: string
  type: 'tv' | 'cable_box' | 'audio' | 'matrix' | 'other'
  status: 'online' | 'degraded' | 'offline' | 'unknown'
  health: number
  lastSeen?: Date
  responseTime?: number
  issues: string[]
  quickActions: Array<{ label: string; action: string; params?: any }>
}

interface SystemHealthReport {
  timestamp: Date
  overall: {
    status: 'healthy' | 'degraded' | 'critical'
    health: number
    devicesOnline: number
    devicesTotal: number
    activeIssues: number
  }
  categories: {
    tvs: DeviceStatus[]
    cableBoxes: DeviceStatus[]
    audioZones: DeviceStatus[]
    matrix: DeviceStatus[]
    other: DeviceStatus[]
  }
  aiSuggestions: Array<{
    priority: 'critical' | 'high' | 'medium' | 'low'
    message: string
    action?: string
    deviceId?: string
  }>
}

export default function SystemHealthPage() {
  const [healthReport, setHealthReport] = useState<SystemHealthReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [executing, setExecuting] = useState<string | null>(null)

  useEffect(() => {
    loadHealthReport()

    if (autoRefresh) {
      const interval = setInterval(loadHealthReport, 10000) // 10 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const loadHealthReport = async () => {
    try {
      const response = await fetch('/api/system/health')
      if (response.ok) {
        const data = await response.json()
        setHealthReport(data)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Error loading health report:', error)
    } finally {
      setLoading(false)
    }
  }

  const executeQuickAction = async (action: string, params?: any) => {
    setExecuting(action)
    try {
      // Route actions to appropriate endpoints
      switch (action) {
        case 'soundtrack_toggle':
          await fetch('/api/soundtrack/players', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerId: params.zoneId,
              playing: true
            })
          })
          break

        case 'directv_restart':
          // Implement DirectTV restart
          break

        case 'firetv_reconnect':
          // Implement FireTV reconnect
          break

        default:
          console.log('Action not implemented:', action, params)
      }

      // Refresh after action
      setTimeout(loadHealthReport, 1000)
    } catch (error) {
      console.error('Error executing action:', error)
    } finally {
      setExecuting(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-400 bg-green-400/20 border-green-400/50'
      case 'degraded': return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/50'
      case 'offline': return 'text-red-400 bg-red-400/20 border-red-400/50'
      default: return 'text-slate-400 bg-slate-400/20 border-slate-400/50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <CheckCircle className="w-5 h-5" />
      case 'degraded': return <AlertTriangle className="w-5 h-5" />
      case 'offline': return <AlertCircle className="w-5 h-5" />
      default: return <AlertCircle className="w-5 h-5" />
    }
  }

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'tv': return <Tv className="w-5 h-5" />
      case 'cable_box': return <Box className="w-5 h-5" />
      case 'audio': return <Radio className="w-5 h-5" />
      case 'matrix': return <Activity className="w-5 h-5" />
      default: return <Settings className="w-5 h-5" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-900/50 border-red-500 text-red-200'
      case 'high': return 'bg-orange-900/50 border-orange-500 text-orange-200'
      case 'medium': return 'bg-yellow-900/50 border-yellow-500 text-yellow-200'
      default: return 'bg-blue-900/50 border-blue-500 text-blue-200'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-sports-gradient flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Loading system health...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-sports-gradient">
      <header className="sports-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="p-2 rounded-lg bg-sportsBar-700/50 hover:bg-sportsBar-600/50 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-slate-200" />
              </Link>
              <div className="bg-primary-gradient rounded-xl p-2.5 shadow-lg">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100">System Health Dashboard</h1>
                <p className="text-sm text-slate-300">Real-time monitoring & control</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600"
                />
                <span>Auto-refresh</span>
              </label>

              <button
                onClick={loadHealthReport}
                className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                title="Refresh Now"
              >
                <RefreshCw className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Overall Status */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`card p-6 border-2 ${
            healthReport?.overall.status === 'healthy' ? 'border-green-400/50 bg-green-900/20' :
            healthReport?.overall.status === 'degraded' ? 'border-yellow-400/50 bg-yellow-900/20' :
            'border-red-400/50 bg-red-900/20'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">Overall Health</span>
              <TrendingUp className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-3xl font-bold text-slate-100 mb-1">
              {healthReport?.overall.health}%
            </div>
            <div className={`text-sm font-medium capitalize ${
              healthReport?.overall.status === 'healthy' ? 'text-green-400' :
              healthReport?.overall.status === 'degraded' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {healthReport?.overall.status}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">Devices Online</span>
              <Zap className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-3xl font-bold text-slate-100 mb-1">
              {healthReport?.overall.devicesOnline}/{healthReport?.overall.devicesTotal}
            </div>
            <div className="text-sm text-slate-400">Active devices</div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">Active Issues</span>
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="text-3xl font-bold text-slate-100 mb-1">
              {healthReport?.overall.activeIssues}
            </div>
            <div className="text-sm text-slate-400">Needs attention</div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">Last Updated</span>
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-lg font-bold text-slate-100 mb-1">
              {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
            </div>
            <div className="text-sm text-slate-400">
              {autoRefresh ? 'Auto-refreshing' : 'Manual refresh'}
            </div>
          </div>
        </div>

        {/* AI Suggestions */}
        {healthReport && healthReport.aiSuggestions.length > 0 && (
          <div className="card p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center space-x-2">
              <Zap className="w-5 h-5 text-purple-400" />
              <span>AI Suggestions</span>
            </h2>
            <div className="space-y-3">
              {healthReport.aiSuggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-l-4 ${getPriorityColor(suggestion.priority)}`}
                >
                  <div className="flex items-start justify-between">
                    <p className="flex-1">{suggestion.message}</p>
                    {suggestion.action && (
                      <button className="ml-4 px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm transition-colors">
                        Take Action
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Device Categories */}
        {healthReport && (
          <>
            {/* TVs */}
            {healthReport.categories.tvs.length > 0 && (
              <div className="card p-6">
                <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center space-x-2">
                  <Tv className="w-5 h-5 text-blue-400" />
                  <span>TV Outputs ({healthReport.categories.tvs.length})</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {healthReport.categories.tvs.map(device => (
                    <div key={device.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          {getDeviceIcon(device.type)}
                          <span className="font-medium text-slate-100">{device.name}</span>
                        </div>
                        <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs border ${getStatusColor(device.status)}`}>
                          {getStatusIcon(device.status)}
                          <span className="capitalize">{device.status}</span>
                        </div>
                      </div>

                      {device.issues.length > 0 && (
                        <div className="mb-3 space-y-1">
                          {device.issues.map((issue, idx) => (
                            <div key={idx} className="text-sm text-yellow-400 flex items-center space-x-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{issue}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {device.quickActions.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {device.quickActions.map((action, idx) => (
                            <button
                              key={idx}
                              onClick={() => executeQuickAction(action.action, action.params)}
                              disabled={executing === action.action}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-xs rounded transition-colors"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cable Boxes */}
            {healthReport.categories.cableBoxes.length > 0 && (
              <div className="card p-6">
                <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center space-x-2">
                  <Box className="w-5 h-5 text-purple-400" />
                  <span>Cable Boxes ({healthReport.categories.cableBoxes.length})</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {healthReport.categories.cableBoxes.map(device => (
                    <div key={device.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          {getDeviceIcon(device.type)}
                          <span className="font-medium text-slate-100">{device.name}</span>
                        </div>
                        <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs border ${getStatusColor(device.status)}`}>
                          {getStatusIcon(device.status)}
                          <span className="capitalize">{device.status}</span>
                        </div>
                      </div>

                      {device.lastSeen && (
                        <div className="text-xs text-slate-400 mb-2">
                          Last seen: {new Date(device.lastSeen).toLocaleTimeString()}
                        </div>
                      )}

                      {device.issues.length > 0 && (
                        <div className="mb-3 space-y-1">
                          {device.issues.map((issue, idx) => (
                            <div key={idx} className="text-sm text-yellow-400 flex items-center space-x-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{issue}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {device.quickActions.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {device.quickActions.map((action, idx) => (
                            <button
                              key={idx}
                              onClick={() => executeQuickAction(action.action, action.params)}
                              disabled={executing === action.action}
                              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white text-xs rounded transition-colors"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audio Zones */}
            {healthReport.categories.audioZones.length > 0 && (
              <div className="card p-6">
                <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center space-x-2">
                  <Radio className="w-5 h-5 text-green-400" />
                  <span>Audio Zones ({healthReport.categories.audioZones.length})</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {healthReport.categories.audioZones.map(device => (
                    <div key={device.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          {getDeviceIcon(device.type)}
                          <span className="font-medium text-slate-100">{device.name}</span>
                        </div>
                        <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs border ${getStatusColor(device.status)}`}>
                          {getStatusIcon(device.status)}
                          <span className="capitalize">{device.status}</span>
                        </div>
                      </div>

                      {device.issues.length > 0 && (
                        <div className="mb-3 space-y-1">
                          {device.issues.map((issue, idx) => (
                            <div key={idx} className="text-sm text-yellow-400 flex items-center space-x-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{issue}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {device.quickActions.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {device.quickActions.map((action, idx) => (
                            <button
                              key={idx}
                              onClick={() => executeQuickAction(action.action, action.params)}
                              disabled={executing === action.action}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-xs rounded transition-colors"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Matrix */}
            {healthReport.categories.matrix.length > 0 && (
              <div className="card p-6">
                <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-orange-400" />
                  <span>Matrix Switcher</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {healthReport.categories.matrix.map(device => (
                    <div key={device.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          {getDeviceIcon(device.type)}
                          <span className="font-medium text-slate-100">{device.name}</span>
                        </div>
                        <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs border ${getStatusColor(device.status)}`}>
                          {getStatusIcon(device.status)}
                          <span className="capitalize">{device.status}</span>
                        </div>
                      </div>

                      {device.quickActions.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {device.quickActions.map((action, idx) => (
                            <button
                              key={idx}
                              onClick={() => executeQuickAction(action.action, action.params)}
                              disabled={executing === action.action}
                              className="px-3 py-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white text-xs rounded transition-colors"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
