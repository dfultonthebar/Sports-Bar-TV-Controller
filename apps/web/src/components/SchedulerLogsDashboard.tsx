'use client'

/**
 * Scheduler Logs Dashboard
 * Comprehensive UI for viewing and filtering scheduler operation logs
 * Styled to match the Location tab design (no white backgrounds)
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@sports-bar/ui-utils'
import {
  RefreshCw,
  Download,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  Zap,
  Server,
  Calendar,
  Filter,
  TrendingUp,
  Clock,
  BarChart3,
} from 'lucide-react'

interface SchedulerLog {
  id: string
  correlationId: string
  component: string
  operation: string
  level: string
  message: string
  gameId?: string
  inputSourceId?: string
  allocationId?: string
  channelNumber?: string
  deviceType?: string
  deviceId?: string
  success: boolean
  durationMs?: number
  errorMessage?: string
  createdAt: number
  createdAtFormatted: string
  metadata?: Record<string, any>
}

interface MetricsData {
  summary: {
    totalOperations: number
    successCount: number
    failureCount: number
    successRate: number
    avgDurationMs: number
  }
  byComponent: Array<{
    component: string
    successCount: number
    failureCount: number
    totalCount: number
    avgDurationMs: number
  }>
  byOperation: Array<{
    operation: string
    successCount: number
    failureCount: number
    totalCount: number
    avgDurationMs: number
  }>
  recentErrors: Array<{
    id: string
    correlationId: string
    component: string
    operation: string
    message: string
    errorMessage: string
    createdAtFormatted: string
  }>
}

const COMPONENTS = [
  { value: 'all', label: 'All Components' },
  { value: 'bartender-remote', label: 'Bartender Remote' },
  { value: 'scheduler-service', label: 'Scheduler Service' },
  { value: 'auto-reallocator', label: 'Auto Reallocator' },
  { value: 'distribution-engine', label: 'Distribution Engine' },
  { value: 'smart-input-allocator', label: 'Smart Input Allocator' },
  { value: 'priority-calculator', label: 'Priority Calculator' },
  { value: 'conflict-detector', label: 'Conflict Detector' },
  { value: 'espn-sync', label: 'ESPN Sync' },
  { value: 'state-reader', label: 'State Reader' },
  { value: 'tournament-detector', label: 'Tournament Detector' },
  { value: 'firetv-detector', label: 'FireTV Detector' },
  { value: 'directv-api', label: 'DirecTV API' },
  { value: 'cable-ir-api', label: 'Cable IR API' },
]

const OPERATIONS = [
  { value: 'all', label: 'All Operations' },
  { value: 'tune', label: 'Tune' },
  { value: 'recover', label: 'Recover' },
  { value: 'allocate', label: 'Allocate' },
  { value: 'reallocate', label: 'Reallocate' },
  { value: 'distribute', label: 'Distribute' },
  { value: 'calculate-priority', label: 'Calculate Priority' },
  { value: 'detect-conflict', label: 'Detect Conflict' },
  { value: 'sync', label: 'Sync' },
  { value: 'cleanup', label: 'Cleanup' },
  { value: 'startup', label: 'Startup' },
  { value: 'check', label: 'Check' },
]

const LEVELS = [
  { value: 'all', label: 'All Levels' },
  { value: 'debug', label: 'Debug' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warning' },
  { value: 'error', label: 'Error' },
]

const TIME_RANGES = [
  { value: '1', label: 'Last Hour' },
  { value: '6', label: 'Last 6 Hours' },
  { value: '12', label: 'Last 12 Hours' },
  { value: '24', label: 'Last 24 Hours' },
  { value: '48', label: 'Last 2 Days' },
  { value: '168', label: 'Last Week' },
]

// Component color mapping for visual distinction
const COMPONENT_COLORS: Record<string, string> = {
  'scheduler-service': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'auto-reallocator': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'distribution-engine': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'smart-input-allocator': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'priority-calculator': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'conflict-detector': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  'espn-sync': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'state-reader': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  'tournament-detector': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'firetv-detector': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  'bartender-remote': 'bg-lime-500/20 text-lime-400 border-lime-500/30',
  'directv-api': 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  'cable-ir-api': 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30',
}

// Operation color mapping
const OPERATION_COLORS: Record<string, string> = {
  'tune': 'bg-green-500/20 text-green-400 border-green-500/30',
  'recover': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'allocate': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'reallocate': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'distribute': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'startup': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'check': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  'sync': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'cleanup': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
}

export function SchedulerLogsDashboard() {
  const [logs, setLogs] = useState<SchedulerLog[]>([])
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // Filters
  const [hours, setHours] = useState('24')
  const [component, setComponent] = useState('all')
  const [operation, setOperation] = useState('all')
  const [level, setLevel] = useState('all')
  const [correlationId, setCorrelationId] = useState('')
  const [showSuccessOnly, setShowSuccessOnly] = useState<boolean | null>(null)

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        hours,
        page: page.toString(),
        limit: '50',
      })

      if (component && component !== 'all') params.append('component', component)
      if (operation && operation !== 'all') params.append('operation', operation)
      if (level && level !== 'all') params.append('level', level)
      if (correlationId) params.append('correlationId', correlationId)
      if (showSuccessOnly !== null) params.append('success', showSuccessOnly.toString())

      const response = await fetch(`/api/scheduler/logs?${params}`)
      const data = await response.json()

      if (data.success) {
        setLogs(data.data.logs)
        setTotalPages(data.data.pagination.totalPages)
        setTotalCount(data.data.pagination.totalCount)
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
    }
  }, [hours, component, operation, level, correlationId, showSuccessOnly, page])

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`/api/scheduler/metrics?hours=${hours}`)
      const data = await response.json()

      if (data.success) {
        setMetrics(data.data)
      }
    } catch (error) {
      console.error('Error fetching metrics:', error)
    }
  }, [hours])

  // Refresh data
  const refreshData = useCallback(async () => {
    setIsLoading(true)
    await Promise.all([fetchLogs(), fetchMetrics()])
    setLastRefresh(new Date())
    setIsLoading(false)
  }, [fetchLogs, fetchMetrics])

  // Initial load and auto-refresh
  useEffect(() => {
    refreshData()
  }, [refreshData])

  // Auto-refresh every 15 seconds
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      refreshData()
    }, 15000)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshData])

  // Export logs
  const handleExport = () => {
    const params = new URLSearchParams({ hours })
    if (component && component !== 'all') params.append('component', component)
    if (operation && operation !== 'all') params.append('operation', operation)
    if (level && level !== 'all') params.append('level', level)
    if (correlationId) params.append('correlationId', correlationId)
    if (showSuccessOnly !== null) params.append('success', showSuccessOnly.toString())

    window.open(`/api/scheduler/logs/export?${params}`, '_blank')
  }

  // Get level badge with enhanced styling
  const getLevelBadge = (logLevel: string) => {
    switch (logLevel) {
      case 'error':
        return (
          <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 font-semibold px-2 py-0.5 text-xs">
            ERROR
          </Badge>
        )
      case 'warn':
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold px-2 py-0.5 text-xs">
            WARN
          </Badge>
        )
      case 'info':
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold px-2 py-0.5 text-xs">
            INFO
          </Badge>
        )
      case 'debug':
        return (
          <Badge className="bg-slate-500/20 text-slate-400 border border-slate-500/30 font-semibold px-2 py-0.5 text-xs">
            DEBUG
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="font-semibold px-2 py-0.5 text-xs">
            {logLevel.toUpperCase()}
          </Badge>
        )
    }
  }

  // Get component badge with color
  const getComponentBadge = (comp: string) => {
    const colorClass = COMPONENT_COLORS[comp] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    return (
      <Badge className={cn("border font-medium px-2 py-0.5 text-xs", colorClass)}>
        {comp}
      </Badge>
    )
  }

  // Get operation badge with color
  const getOperationBadge = (op: string) => {
    const colorClass = OPERATION_COLORS[op] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    return (
      <Badge className={cn("border font-medium px-2 py-0.5 text-xs", colorClass)}>
        {op}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Section - matching Location tab style */}
      <div className="rounded-lg border border-slate-700 p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-semibold flex items-center gap-2 mb-2">
              <Activity className="h-5 w-5 text-blue-400" />
              Scheduler Operations
            </h3>
            <p className="text-sm text-slate-400">Monitor scheduled tasks, tune operations, and system health</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={(checked) => setAutoRefresh(checked === true)}
              />
              <label htmlFor="auto-refresh" className="text-sm text-slate-400 cursor-pointer">
                Auto-refresh
              </label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              disabled={isLoading}
              className="border-slate-600 hover:bg-slate-700"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="border-slate-600 hover:bg-slate-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Summary Stats - inline style like Location tab */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg bg-slate-800/50 p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-xs text-slate-400">Total Operations</p>
                <p className="text-2xl font-bold">{metrics?.summary.totalOperations || 0}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              <div>
                <p className="text-xs text-slate-400">Success Rate</p>
                <p className="text-2xl font-bold text-green-400">{metrics?.summary.successRate || 0}%</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-cyan-400" />
              <div>
                <p className="text-xs text-slate-400">Avg Duration</p>
                <p className="text-2xl font-bold">{metrics?.summary.avgDurationMs || 0}<span className="text-sm text-slate-400">ms</span></p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className={cn("h-5 w-5", (metrics?.recentErrors.length || 0) > 0 ? "text-red-400" : "text-slate-400")} />
              <div>
                <p className="text-xs text-slate-400">Recent Errors</p>
                <p className={cn("text-2xl font-bold", (metrics?.recentErrors.length || 0) > 0 ? "text-red-400" : "")}>
                  {metrics?.recentErrors.length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="rounded-lg border border-slate-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-slate-400" />
          <h3 className="text-lg font-semibold">Filters</h3>
          {lastRefresh && (
            <span className="text-xs text-slate-500 ml-auto">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-slate-400 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Time Range
            </label>
            <Select value={hours} onValueChange={(v) => { setHours(v); setPage(1) }}>
              <SelectTrigger className="bg-slate-800 border-slate-600">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map(range => (
                  <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400 flex items-center gap-1">
              <Server className="h-3 w-3" /> Component
            </label>
            <Select value={component} onValueChange={(v) => { setComponent(v); setPage(1) }}>
              <SelectTrigger className="bg-slate-800 border-slate-600">
                <SelectValue placeholder="Component" />
              </SelectTrigger>
              <SelectContent>
                {COMPONENTS.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400 flex items-center gap-1">
              <Zap className="h-3 w-3" /> Operation
            </label>
            <Select value={operation} onValueChange={(v) => { setOperation(v); setPage(1) }}>
              <SelectTrigger className="bg-slate-800 border-slate-600">
                <SelectValue placeholder="Operation" />
              </SelectTrigger>
              <SelectContent>
                {OPERATIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400 flex items-center gap-1">
              <Activity className="h-3 w-3" /> Level
            </label>
            <Select value={level} onValueChange={(v) => { setLevel(v); setPage(1) }}>
              <SelectTrigger className="bg-slate-800 border-slate-600">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map(l => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400 flex items-center gap-1">
              <Search className="h-3 w-3" /> Correlation ID
            </label>
            <Input
              placeholder="Search..."
              value={correlationId}
              onChange={(e) => { setCorrelationId(e.target.value); setPage(1) }}
              className="bg-slate-800 border-slate-600"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Status
            </label>
            <Select
              value={showSuccessOnly === null ? 'all' : showSuccessOnly.toString()}
              onValueChange={(v) => {
                setShowSuccessOnly(v === 'all' ? null : v === 'true')
                setPage(1)
              }}
            >
              <SelectTrigger className="bg-slate-800 border-slate-600">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="true">Success Only</SelectItem>
                <SelectItem value="false">Failures Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-400" />
            Operation Logs
          </h3>
          <p className="text-sm text-slate-400">
            Showing {logs.length} of {totalCount} logs
          </p>
        </div>

        <div className="rounded-lg border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800">
                <tr>
                  <th className="p-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Time</th>
                  <th className="p-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Level</th>
                  <th className="p-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Component</th>
                  <th className="p-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Operation</th>
                  <th className="p-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Message</th>
                  <th className="p-3 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                  <th className="p-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="h-8 w-8 text-slate-600" />
                        <p>No logs found matching the current filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((log, index) => (
                    <tr
                      key={log.id}
                      className={cn(
                        "transition-colors",
                        index % 2 === 0 ? "bg-slate-800/30" : "bg-slate-800/50",
                        "hover:bg-slate-700/50",
                        log.level === 'error' && "bg-red-950/30 hover:bg-red-950/40",
                        log.level === 'warn' && "bg-amber-950/20 hover:bg-amber-950/30"
                      )}
                    >
                      <td className="p-3 whitespace-nowrap">
                        <span className="text-sm font-mono text-slate-300">
                          {new Date(log.createdAt * 1000).toLocaleTimeString()}
                        </span>
                      </td>
                      <td className="p-3">{getLevelBadge(log.level)}</td>
                      <td className="p-3">{getComponentBadge(log.component)}</td>
                      <td className="p-3">{getOperationBadge(log.operation)}</td>
                      <td className="p-3 max-w-md">
                        <p className="text-sm text-slate-200 truncate" title={log.message}>
                          {log.message}
                        </p>
                        {log.errorMessage && (
                          <p className="text-xs text-red-400 truncate mt-1" title={log.errorMessage}>
                            {log.errorMessage}
                          </p>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {log.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-400 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                        )}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {log.durationMs !== null && log.durationMs !== undefined && (
                          <span className={cn(
                            "text-sm font-mono",
                            log.durationMs > 100 ? "text-amber-400" : "text-slate-400"
                          )}>
                            {log.durationMs}ms
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
          <p className="text-sm text-slate-400">
            Page {page} of {totalPages || 1}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="border-slate-600 hover:bg-slate-700"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="border-slate-600 hover:bg-slate-700"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Component Performance - styled like "What Gets Backed Up" section */}
      {metrics?.byComponent && metrics.byComponent.length > 0 && (
        <div className="rounded-lg border border-slate-700 p-6">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Server className="h-5 w-5 text-purple-400" />
            Component Performance (Last Hour)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.byComponent.map((c) => {
              const successRate = c.totalCount > 0
                ? ((c.successCount / c.totalCount) * 100).toFixed(0)
                : '0'
              return (
                <div
                  key={c.component}
                  className="rounded-lg bg-slate-800/50 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    {getComponentBadge(c.component)}
                    <span className="text-xs text-slate-400">{successRate}% success</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-2xl font-bold">{c.totalCount}</p>
                      <p className="text-xs text-slate-400">total operations</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-400">{c.successCount}</span>
                        <span className="text-slate-500">/</span>
                        <span className="text-red-400">{c.failureCount}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        avg {c.avgDurationMs}ms
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Errors */}
      {metrics?.recentErrors && metrics.recentErrors.length > 0 && (
        <div className="rounded-lg border border-red-900/50 p-6">
          <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5" />
            Recent Errors ({metrics.recentErrors.length})
          </h3>
          <div className="space-y-3">
            {metrics.recentErrors.map((error) => (
              <div
                key={error.id}
                className="rounded-lg bg-red-950/20 border border-red-900/30 p-4"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getComponentBadge(error.component)}
                    {getOperationBadge(error.operation)}
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {error.createdAtFormatted}
                  </span>
                </div>
                <p className="text-sm text-slate-200 mb-1">{error.message}</p>
                {error.errorMessage && (
                  <p className="text-sm text-red-400 font-mono bg-red-950/30 p-2 rounded mt-2">
                    {error.errorMessage}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-2 font-mono">
                  Correlation: {error.correlationId}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
