'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

import { logger } from '@/lib/logger'
interface LogEntry {
  timestamp: string
  level: string
  message: string
  raw: string
}

export default function CECMonitor() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/cec/monitor')
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
        setLastUpdate(new Date().toLocaleTimeString())
      }
    } catch (error) {
      logger.error('Failed to fetch CEC logs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchLogs()
    }, 3000) // Refresh every 3 seconds

    return () => clearInterval(interval)
  }, [autoRefresh])

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'DEBUG':
        return 'text-blue-300 bg-blue-900/20'
      case 'INFO':
        return 'text-cyan-300 bg-cyan-900/20'
      case 'SUCCESS':
        return 'text-green-300 bg-green-900/20'
      case 'ERROR':
        return 'text-red-300 bg-red-900/20'
      default:
        return 'text-gray-300 bg-gray-900/20'
    }
  }

  return (
    <div className="min-h-screen bg-sports-gradient p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="card mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-100 mb-2">
                  🔍 CEC Command Monitor
                </h1>
                <p className="text-slate-300">
                  Real-time monitoring of CEC commands and TV responses
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-slate-200">Auto-refresh</span>
                </label>
                <button
                  onClick={fetchLogs}
                  disabled={loading}
                  className="btn-primary flex items-center space-x-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
            {lastUpdate && (
              <p className="text-sm text-slate-400 mt-2">
                Last updated: {lastUpdate}
              </p>
            )}
          </div>
        </div>

        {/* Logs Display */}
        <div className="card">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-100">
                Recent CEC Activity ({logs.length} entries)
              </h2>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-400" />
                <p className="text-slate-300">Loading CEC logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/50 rounded-lg">
                <p className="text-slate-300 mb-2">No CEC activity logged yet</p>
                <p className="text-sm text-slate-400">
                  Send a CEC command to see it appear here
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 hover:bg-slate-800/70 transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      <span
                        className={`text-xs font-mono px-2 py-1 rounded ${getLevelColor(
                          log.level
                        )}`}
                      >
                        {log.level}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-slate-200 break-all">
                          {log.message}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="card mt-6">
          <div className="p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-3">
              📖 What You'll See Here
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-blue-900/20 rounded-lg p-3">
                <p className="font-medium text-blue-300 mb-1">
                  Executing CEC command
                </p>
                <p className="text-slate-400">
                  Shows when a command is sent to the TV (on, standby, volume, etc.)
                </p>
              </div>
              <div className="bg-green-900/20 rounded-lg p-3">
                <p className="font-medium text-green-300 mb-1">CEC stdout</p>
                <p className="text-slate-400">
                  Raw output from cec-client showing TV responses
                </p>
              </div>
              <div className="bg-purple-900/20 rounded-lg p-3">
                <p className="font-medium text-purple-300 mb-1">
                  deviceResponded
                </p>
                <p className="text-slate-400">
                  True if TV acknowledged the command, false if no response
                </p>
              </div>
              <div className="bg-yellow-900/20 rounded-lg p-3">
                <p className="font-medium text-yellow-300 mb-1">
                  power status
                </p>
                <p className="text-slate-400">
                  Current power state reported by the TV (on/standby)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
