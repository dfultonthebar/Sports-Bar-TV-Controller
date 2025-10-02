
'use client'

import { useState, useEffect } from 'react'
import { 
  Play, 
  Square, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock,
  Filter,
  Trash2,
  Download,
  AlertCircle,
  Activity
} from 'lucide-react'
import SportsBarLayout from '@/components/SportsBarLayout'
import SportsBarHeader from '@/components/SportsBarHeader'

interface TestLog {
  id: string
  testType: string
  testName: string
  status: string
  inputChannel?: number
  outputChannel?: number
  command?: string
  response?: string
  errorMessage?: string
  duration?: number
  timestamp: string
  metadata?: string
}

interface TestResult {
  input: number
  inputLabel: string
  output: number
  outputLabel: string
  success: boolean
  response?: string
  error?: string
  duration: number
  logId: string
}

interface TestSummary {
  totalTests: number
  successCount: number
  failureCount: number
  successRate: string
  duration: number
}

export default function TestsPage() {
  const [isConnectionTesting, setIsConnectionTesting] = useState(false)
  const [isSwitchingTesting, setIsSwitchingTesting] = useState(false)
  const [connectionResult, setConnectionResult] = useState<any>(null)
  const [switchingResult, setSwitchingResult] = useState<any>(null)
  const [logs, setLogs] = useState<TestLog[]>([])
  const [filteredLogs, setFilteredLogs] = useState<TestLog[]>([])
  const [filterTestType, setFilterTestType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)

  // Load logs on mount and after tests
  useEffect(() => {
    loadLogs()
  }, [])

  // Filter logs when filters change
  useEffect(() => {
    let filtered = logs

    if (filterTestType !== 'all') {
      filtered = filtered.filter(log => log.testType === filterTestType)
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(log => log.status === filterStatus)
    }

    setFilteredLogs(filtered)
  }, [logs, filterTestType, filterStatus])

  const loadLogs = async () => {
    setIsLoadingLogs(true)
    try {
      const response = await fetch('/api/tests/logs?limit=200')
      const data = await response.json()
      
      if (data.success) {
        setLogs(data.logs)
      }
    } catch (error) {
      console.error('Error loading logs:', error)
    } finally {
      setIsLoadingLogs(false)
    }
  }

  const testConnection = async () => {
    setIsConnectionTesting(true)
    setConnectionResult(null)
    
    try {
      const response = await fetch('/api/tests/wolfpack/connection', {
        method: 'POST'
      })
      const data = await response.json()
      setConnectionResult(data)
      await loadLogs()
    } catch (error) {
      setConnectionResult({ 
        success: false, 
        error: String(error) 
      })
    } finally {
      setIsConnectionTesting(false)
    }
  }

  const testSwitching = async () => {
    setIsSwitchingTesting(true)
    setSwitchingResult(null)
    
    try {
      const response = await fetch('/api/tests/wolfpack/switching', {
        method: 'POST'
      })
      const data = await response.json()
      setSwitchingResult(data)
      await loadLogs()
    } catch (error) {
      setSwitchingResult({ 
        success: false, 
        error: String(error) 
      })
    } finally {
      setIsSwitchingTesting(false)
    }
  }

  const clearLogs = async () => {
    if (!confirm('Are you sure you want to delete all test logs?')) {
      return
    }

    try {
      const response = await fetch('/api/tests/logs', {
        method: 'DELETE'
      })
      const data = await response.json()
      
      if (data.success) {
        setLogs([])
        alert(data.message)
      }
    } catch (error) {
      console.error('Error clearing logs:', error)
      alert('Failed to clear logs')
    }
  }

  const exportLogs = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `test-logs-${new Date().toISOString()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'failed':
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />
      case 'running':
        return <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
      case 'partial':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />
      default:
        return <Clock className="w-5 h-5 text-slate-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-400 bg-green-400/10'
      case 'failed':
      case 'error':
        return 'text-red-400 bg-red-400/10'
      case 'running':
        return 'text-blue-400 bg-blue-400/10'
      case 'partial':
        return 'text-yellow-400 bg-yellow-400/10'
      default:
        return 'text-slate-400 bg-slate-400/10'
    }
  }

  return (
    <SportsBarLayout>
      <SportsBarHeader
        title="System Tests"
        subtitle="Test and validate system components"
        icon={<Activity className="w-8 h-8 text-indigo-400" />}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Wolf Pack Connection Test */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Wolf Pack Connection Test</h2>
              <p className="text-sm text-slate-400 mt-1">
                Test connectivity to the Wolf Pack matrix switcher
              </p>
            </div>
            <button
              onClick={testConnection}
              disabled={isConnectionTesting}
              className="btn-primary flex items-center space-x-2"
            >
              {isConnectionTesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Run Test</span>
                </>
              )}
            </button>
          </div>

          {connectionResult && (
            <div className={`p-4 rounded-lg ${
              connectionResult.success 
                ? 'bg-green-400/10 border border-green-400/20' 
                : 'bg-red-400/10 border border-red-400/20'
            }`}>
              <div className="flex items-start space-x-3">
                {connectionResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`font-medium ${
                    connectionResult.success ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {connectionResult.success ? 'Connection Successful' : 'Connection Failed'}
                  </p>
                  <p className="text-sm text-slate-300 mt-1">
                    {connectionResult.message || connectionResult.error}
                  </p>
                  {connectionResult.config && (
                    <div className="text-xs text-slate-400 mt-2 space-y-1">
                      <p>IP: {connectionResult.config.ipAddress}</p>
                      <p>Port: {connectionResult.config.port}</p>
                      <p>Protocol: {connectionResult.config.protocol}</p>
                      {connectionResult.duration && (
                        <p>Duration: {connectionResult.duration}ms</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wolf Pack Switching Test */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Wolf Pack Switching Test</h2>
              <p className="text-sm text-slate-400 mt-1">
                Test all input/output combinations on active channels
              </p>
            </div>
            <button
              onClick={testSwitching}
              disabled={isSwitchingTesting}
              className="btn-primary flex items-center space-x-2"
            >
              {isSwitchingTesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Run Full Test</span>
                </>
              )}
            </button>
          </div>

          {isSwitchingTesting && (
            <div className="bg-blue-400/10 border border-blue-400/20 p-4 rounded-lg">
              <div className="flex items-center space-x-3">
                <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                <div>
                  <p className="font-medium text-blue-400">Test in Progress</p>
                  <p className="text-sm text-slate-300 mt-1">
                    Testing all input/output combinations. This may take several minutes...
                  </p>
                </div>
              </div>
            </div>
          )}

          {switchingResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className={`p-4 rounded-lg ${
                switchingResult.success 
                  ? 'bg-green-400/10 border border-green-400/20' 
                  : 'bg-yellow-400/10 border border-yellow-400/20'
              }`}>
                <div className="flex items-start space-x-3">
                  {switchingResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-medium ${
                      switchingResult.success ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                      {switchingResult.message}
                    </p>
                    {switchingResult.summary && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                        <div>
                          <p className="text-xs text-slate-400">Total Tests</p>
                          <p className="text-lg font-bold text-slate-100">
                            {switchingResult.summary.totalTests}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Successful</p>
                          <p className="text-lg font-bold text-green-400">
                            {switchingResult.summary.successCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Failed</p>
                          <p className="text-lg font-bold text-red-400">
                            {switchingResult.summary.failureCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Success Rate</p>
                          <p className="text-lg font-bold text-slate-100">
                            {switchingResult.summary.successRate}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Detailed Results */}
              {switchingResult.results && switchingResult.results.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">
                    Detailed Results
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {switchingResult.results.map((result: TestResult, index: number) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg flex items-center justify-between ${
                          result.success 
                            ? 'bg-green-400/5 border border-green-400/10' 
                            : 'bg-red-400/5 border border-red-400/10'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          {result.success ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-slate-200">
                              Input {result.input} ({result.inputLabel}) → Output {result.output} ({result.outputLabel})
                            </p>
                            {result.error && (
                              <p className="text-xs text-red-400 mt-1">{result.error}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-slate-400">
                          {result.duration}ms
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Test Logs */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-100">Test Logs</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={loadLogs}
                disabled={isLoadingLogs}
                className="btn-secondary flex items-center space-x-2"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={exportLogs}
                className="btn-secondary flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
              <button
                onClick={clearLogs}
                className="btn-secondary flex items-center space-x-2 text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filterTestType}
                onChange={(e) => setFilterTestType(e.target.value)}
                className="input-field text-sm py-1"
              >
                <option value="all">All Test Types</option>
                <option value="wolfpack_connection">Connection Tests</option>
                <option value="wolfpack_switching">Switching Tests</option>
              </select>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input-field text-sm py-1"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="error">Error</option>
              <option value="running">Running</option>
              <option value="partial">Partial</option>
            </select>
          </div>

          {/* Logs Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
                    Test Name
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
                    Details
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
                    Duration
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">
                      {isLoadingLogs ? 'Loading logs...' : 'No logs found'}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(log.status)}
                          <span className={`text-xs px-2 py-1 rounded ${getStatusColor(log.status)}`}>
                            {log.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-slate-200">{log.testName}</p>
                        <p className="text-xs text-slate-400">{log.testType}</p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs text-slate-300 space-y-1">
                          {log.inputChannel && log.outputChannel && (
                            <p>Input {log.inputChannel} → Output {log.outputChannel}</p>
                          )}
                          {log.command && (
                            <p className="text-slate-400">Command: {log.command}</p>
                          )}
                          {log.errorMessage && (
                            <p className="text-red-400">{log.errorMessage}</p>
                          )}
                          {log.response && !log.errorMessage && (
                            <p className="text-green-400">{log.response}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-300">
                        {log.duration ? `${log.duration}ms` : '-'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredLogs.length > 0 && (
            <div className="mt-4 text-sm text-slate-400 text-center">
              Showing {filteredLogs.length} of {logs.length} logs
            </div>
          )}
        </div>
      </main>
    </SportsBarLayout>
  )
}
