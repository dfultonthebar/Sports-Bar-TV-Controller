
'use client'

import { useState, useEffect } from 'react'
import { Eye, AlertTriangle, Activity, TrendingUp, RefreshCw, Download } from 'lucide-react'

interface LogEntry {
  timestamp: string
  type: string
  action: string
  device?: string
  success: boolean
  details?: any
  errorMessage?: string
}

interface ErrorEntry {
  timestamp: string
  level: 'error' | 'warning' | 'info'
  source: string
  message: string
  details?: any
}

interface SystemSummary {
  totalOperations: number
  successRate: number
  mostCommonOperations: Array<{ type: string, count: number }>
  errorCount: number
  patterns: Array<{ pattern: string, count: number }>
}

export default function LogMonitor() {
  const [operations, setOperations] = useState<LogEntry[]>([])
  const [errors, setErrors] = useState<ErrorEntry[]>([])
  const [summary, setSummary] = useState<SystemSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [timeRange, setTimeRange] = useState(24)
  const [activeTab, setActiveTab] = useState<'operations' | 'errors' | 'summary'>('summary')
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => {
    fetchLogs()
    let interval: NodeJS.Timeout | null = null
    
    if (autoRefresh) {
      interval = setInterval(fetchLogs, 30000) // Refresh every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [timeRange, autoRefresh])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/logs/operations?hours=${timeRange}`)
      if (response.ok) {
        const data = await response.json()
        setOperations(data.operations || [])
        setErrors(data.errors || [])
        setSummary(data.summary || null)
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadLogs = async () => {
    try {
      const response = await fetch(`/api/logs/operations?hours=${timeRange}&format=export`)
      if (response.ok) {
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `system-logs-${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Error downloading logs:', error)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const getOperationTypeColor = (type: string) => {
    switch (type) {
      case 'volume_change': return 'bg-blue-100 text-blue-800'
      case 'channel_change': return 'bg-green-100 text-green-800'
      case 'power_control': return 'bg-red-100 text-red-800'
      case 'input_switch': return 'bg-purple-100 text-purple-800'
      case 'audio_zone': return 'bg-orange-100 text-orange-800'
      case 'matrix_control': return 'bg-slate-800 or bg-slate-900 text-slate-100'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-slate-800 or bg-slate-900 text-slate-100'
    }
  }

  return (
    <div className="bg-slate-800 or bg-slate-900 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-100 flex items-center">
          <Activity className="mr-2 w-6 h-6" />
          System Activity Monitor
        </h2>
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(parseInt(e.target.value))}
            className="px-3 py-1 border border-slate-700 rounded-md text-sm"
          >
            <option value={1}>Last Hour</option>
            <option value={6}>Last 6 Hours</option>
            <option value={24}>Last 24 Hours</option>
            <option value={168}>Last Week</option>
          </select>
          
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span>Auto-refresh</span>
          </label>
          
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center space-x-1"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          
          <button
            onClick={downloadLogs}
            className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center space-x-1"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-slate-800 or bg-slate-900 p-1 rounded-lg mb-6">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
            activeTab === 'summary' 
              ? 'bg-slate-800 or bg-slate-900 text-blue-600 shadow-sm' 
              : 'text-gray-600 hover:text-slate-100'
          }`}
        >
          <TrendingUp className="inline w-4 h-4 mr-1" />
          Summary
        </button>
        <button
          onClick={() => setActiveTab('operations')}
          className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
            activeTab === 'operations' 
              ? 'bg-slate-800 or bg-slate-900 text-blue-600 shadow-sm' 
              : 'text-gray-600 hover:text-slate-100'
          }`}
        >
          <Activity className="inline w-4 h-4 mr-1" />
          Operations ({operations.length})
        </button>
        <button
          onClick={() => setActiveTab('errors')}
          className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
            activeTab === 'errors' 
              ? 'bg-slate-800 or bg-slate-900 text-red-600 shadow-sm' 
              : 'text-gray-600 hover:text-slate-100'
          }`}
        >
          <AlertTriangle className="inline w-4 h-4 mr-1" />
          Errors ({errors.length})
        </button>
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && summary && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{summary.totalOperations}</div>
              <div className="text-sm text-blue-800">Total Operations</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{summary.successRate.toFixed(1)}%</div>
              <div className="text-sm text-green-800">Success Rate</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{summary.errorCount}</div>
              <div className="text-sm text-red-800">Errors</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{summary.patterns.length}</div>
              <div className="text-sm text-purple-800">Usage Patterns</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Most Common Operations</h3>
              <div className="space-y-2">
                {summary.mostCommonOperations.slice(0, 5).map((op, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-slate-800 or bg-slate-900 rounded">
                    <span className="font-medium">{op.type}</span>
                    <span className="text-gray-600">{op.count} times</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Usage Patterns</h3>
              <div className="space-y-2">
                {summary.patterns.slice(0, 5).map((pattern, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-slate-800 or bg-slate-900 rounded">
                    <span className="font-medium">{pattern.pattern.replace('_', ' ')}</span>
                    <span className="text-gray-600">{pattern.count} occurrences</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Operations Tab */}
      {activeTab === 'operations' && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {operations.map((op, index) => (
            <div key={index} className="border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getOperationTypeColor(op.type)}`}>
                    {op.type}
                  </span>
                  <span className="font-medium">{op.action}</span>
                  {op.device && <span className="text-gray-600">on {op.device}</span>}
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    op.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {op.success ? '✓ Success' : '✗ Failed'}
                  </span>
                  <span className="text-sm text-slate-400">{formatTimestamp(op.timestamp)}</span>
                </div>
              </div>
              {op.details && (
                <details className="text-sm text-slate-300">
                  <summary className="cursor-pointer hover:text-slate-100">View Details</summary>
                  <pre className="mt-2 p-2 bg-slate-800 or bg-slate-900 rounded text-xs overflow-x-auto">
                    {JSON.stringify(op.details, null, 2)}
                  </pre>
                </details>
              )}
              {op.errorMessage && (
                <div className="text-sm text-red-600 mt-1">
                  Error: {op.errorMessage}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Errors Tab */}
      {activeTab === 'errors' && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {errors.map((error, index) => (
            <div key={index} className="border-l-4 border-red-500 bg-red-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    error.level === 'error' ? 'bg-red-200 text-red-800' :
                    error.level === 'warning' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-blue-200 text-blue-800'
                  }`}>
                    {error.level.toUpperCase()}
                  </span>
                  <span className="font-medium">{error.source}</span>
                </div>
                <span className="text-sm text-slate-400">{formatTimestamp(error.timestamp)}</span>
              </div>
              <div className="text-sm text-red-800 mb-2">{error.message}</div>
              {error.details && (
                <details className="text-sm text-red-700">
                  <summary className="cursor-pointer hover:text-red-900">View Details</summary>
                  <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-x-auto">
                    {JSON.stringify(error.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Loading...</span>
        </div>
      )}
    </div>
  )
}
