'use client'

/**
 * System Logs Viewer
 * Comprehensive UI for viewing and filtering system-wide logs
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
  Search,
  ChevronLeft,
  ChevronRight,
  Server,
  Calendar,
  Filter,
  TrendingUp,
  Clock,
  BarChart3,
  FileText,
  Wifi,
  Monitor,
  Settings,
  Shield,
  Zap,
  Users,
} from 'lucide-react'

interface SystemLog {
  id: string
  timestamp: string
  level: string
  category: string
  source: string
  action: string
  message: string
  details?: any
  userId?: string
  sessionId?: string
  deviceType?: string
  deviceId?: string
  success: boolean
  duration?: number
  errorStack?: string
  tags?: string[]
  metadata?: Record<string, any>
}

interface LogsResponse {
  success: boolean
  data: {
    logs: SystemLog[]
    pagination: {
      page: number
      limit: number
      totalCount: number
      totalPages: number
      hasMore: boolean
    }
    filters: {
      hours: number
      category?: string
      level?: string
      source?: string
      search?: string
      success?: string
    }
    availableFilters: {
      sources: string[]
      categories: string[]
    }
  }
}

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'user_interaction', label: 'User Interaction' },
  { value: 'system', label: 'System' },
  { value: 'api', label: 'API' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'configuration', label: 'Configuration' },
  { value: 'performance', label: 'Performance' },
  { value: 'security', label: 'Security' },
  { value: 'cec', label: 'CEC' },
]

const LEVELS = [
  { value: 'all', label: 'All Levels' },
  { value: 'debug', label: 'Debug' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'critical', label: 'Critical' },
]

const TIME_RANGES = [
  { value: '1', label: 'Last Hour' },
  { value: '6', label: 'Last 6 Hours' },
  { value: '12', label: 'Last 12 Hours' },
  { value: '24', label: 'Last 24 Hours' },
  { value: '48', label: 'Last 2 Days' },
  { value: '168', label: 'Last Week' },
]

// Category color mapping for visual distinction
const CATEGORY_COLORS: Record<string, string> = {
  'user_interaction': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'system': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'api': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'hardware': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'configuration': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'performance': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  'security': 'bg-red-500/20 text-red-400 border-red-500/30',
  'cec': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
}

// Category icons
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'user_interaction': <Users className="h-3 w-3" />,
  'system': <Server className="h-3 w-3" />,
  'api': <Wifi className="h-3 w-3" />,
  'hardware': <Monitor className="h-3 w-3" />,
  'configuration': <Settings className="h-3 w-3" />,
  'performance': <Zap className="h-3 w-3" />,
  'security': <Shield className="h-3 w-3" />,
  'cec': <Monitor className="h-3 w-3" />,
}

export function SystemLogsViewer() {
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [availableSources, setAvailableSources] = useState<string[]>([])

  // Stats
  const [totalCount, setTotalCount] = useState(0)
  const [successCount, setSuccessCount] = useState(0)
  const [failureCount, setFailureCount] = useState(0)

  // Filters
  const [hours, setHours] = useState('24')
  const [category, setCategory] = useState('all')
  const [level, setLevel] = useState('all')
  const [source, setSource] = useState('all')
  const [search, setSearch] = useState('')
  const [showSuccessOnly, setShowSuccessOnly] = useState<string>('all')

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [displayCount, setDisplayCount] = useState(0)

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        hours,
        page: page.toString(),
        limit: '50',
      })

      if (category && category !== 'all') params.append('category', category)
      if (level && level !== 'all') params.append('level', level)
      if (source && source !== 'all') params.append('source', source)
      if (search) params.append('search', search)
      if (showSuccessOnly !== 'all') params.append('success', showSuccessOnly)

      const response = await fetch(`/api/logs/entries?${params}`)
      const data: LogsResponse = await response.json()

      if (data.success) {
        setLogs(data.data.logs)
        setTotalPages(data.data.pagination.totalPages)
        setTotalCount(data.data.pagination.totalCount)
        setDisplayCount(data.data.logs.length)
        setAvailableSources(data.data.availableFilters.sources || [])

        // Calculate success/failure counts from current page
        const successes = data.data.logs.filter(l => l.success).length
        const failures = data.data.logs.filter(l => !l.success).length
        setSuccessCount(successes)
        setFailureCount(failures)
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
    }
  }, [hours, category, level, source, search, showSuccessOnly, page])

  // Refresh data
  const refreshData = useCallback(async () => {
    setIsLoading(true)
    await fetchLogs()
    setLastRefresh(new Date())
    setIsLoading(false)
  }, [fetchLogs])

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
    const params = new URLSearchParams({ hours, limit: '10000' })
    if (category && category !== 'all') params.append('category', category)
    if (level && level !== 'all') params.append('level', level)
    if (source && source !== 'all') params.append('source', source)
    if (search) params.append('search', search)
    if (showSuccessOnly !== 'all') params.append('success', showSuccessOnly)

    // Create a blob download
    fetch(`/api/logs/entries?${params}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const blob = new Blob([JSON.stringify(data.data.logs, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `system-logs-${new Date().toISOString()}.json`
          a.click()
          URL.revokeObjectURL(url)
        }
      })
  }

  // Get level badge with enhanced styling
  const getLevelBadge = (logLevel: string) => {
    switch (logLevel) {
      case 'critical':
        return (
          <Badge className="bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 font-semibold px-2 py-0.5 text-xs">
            CRITICAL
          </Badge>
        )
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

  // Get category badge with color and icon
  const getCategoryBadge = (cat: string) => {
    const colorClass = CATEGORY_COLORS[cat] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    const icon = CATEGORY_ICONS[cat] || <FileText className="h-3 w-3" />
    return (
      <Badge className={cn("border font-medium px-2 py-0.5 text-xs flex items-center gap-1", colorClass)}>
        {icon}
        {cat.replace('_', ' ')}
      </Badge>
    )
  }

  // Format timestamp
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  return (
    <div className="space-y-6">
      {/* Header Section - matching Location tab style */}
      <div className="rounded-lg border border-slate-700 p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-semibold flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-green-400" />
              System Event Logs
            </h3>
            <p className="text-sm text-slate-400">View all system events, errors, user actions, and hardware operations</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="auto-refresh-system"
                checked={autoRefresh}
                onCheckedChange={(checked) => setAutoRefresh(checked === true)}
              />
              <label htmlFor="auto-refresh-system" className="text-sm text-slate-400 cursor-pointer">
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
                <p className="text-xs text-slate-400">Total Events</p>
                <p className="text-2xl font-bold">{totalCount}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              <div>
                <p className="text-xs text-slate-400">Successful (this page)</p>
                <p className="text-2xl font-bold text-green-400">{successCount}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-400" />
              <div>
                <p className="text-xs text-slate-400">Failures (this page)</p>
                <p className="text-2xl font-bold text-red-400">{failureCount}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-cyan-400" />
              <div>
                <p className="text-xs text-slate-400">Time Range</p>
                <p className="text-lg font-bold">{TIME_RANGES.find(t => t.value === hours)?.label}</p>
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
              <Server className="h-3 w-3" /> Category
            </label>
            <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1) }}>
              <SelectTrigger className="bg-slate-800 border-slate-600">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
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
              <Zap className="h-3 w-3" /> Source
            </label>
            <Select value={source} onValueChange={(v) => { setSource(v); setPage(1) }}>
              <SelectTrigger className="bg-slate-800 border-slate-600">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {availableSources.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400 flex items-center gap-1">
              <Search className="h-3 w-3" /> Search
            </label>
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="bg-slate-800 border-slate-600"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Status
            </label>
            <Select
              value={showSuccessOnly}
              onValueChange={(v) => {
                setShowSuccessOnly(v)
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
            <BarChart3 className="h-5 w-5 text-green-400" />
            Event Logs
          </h3>
          <p className="text-sm text-slate-400">
            Showing {displayCount} of {totalCount} logs
          </p>
        </div>

        <div className="rounded-lg border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800">
                <tr>
                  <th className="p-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Time</th>
                  <th className="p-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Level</th>
                  <th className="p-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Category</th>
                  <th className="p-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Source</th>
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
                        log.level === 'critical' && "bg-fuchsia-950/30 hover:bg-fuchsia-950/40",
                        log.level === 'warn' && "bg-amber-950/20 hover:bg-amber-950/30"
                      )}
                    >
                      <td className="p-3 whitespace-nowrap">
                        <span className="text-sm font-mono text-slate-300">
                          {formatTime(log.timestamp)}
                        </span>
                      </td>
                      <td className="p-3">{getLevelBadge(log.level)}</td>
                      <td className="p-3">{getCategoryBadge(log.category)}</td>
                      <td className="p-3">
                        <span className="text-sm text-slate-300 font-mono">{log.source}</span>
                      </td>
                      <td className="p-3 max-w-md">
                        <p className="text-sm text-slate-200 truncate" title={log.message}>
                          {log.message}
                        </p>
                        {log.action && (
                          <p className="text-xs text-slate-400 mt-1">
                            Action: {log.action}
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
                        {log.duration !== null && log.duration !== undefined && (
                          <span className={cn(
                            "text-sm font-mono",
                            log.duration > 1000 ? "text-red-400" : log.duration > 100 ? "text-amber-400" : "text-slate-400"
                          )}>
                            {log.duration}ms
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

      {/* Category Breakdown Section */}
      <div className="rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Server className="h-5 w-5 text-purple-400" />
          Log Categories
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(CATEGORY_COLORS).map(([cat, colorClass]) => (
            <button
              key={cat}
              onClick={() => { setCategory(cat); setPage(1) }}
              className={cn(
                "rounded-lg p-4 text-left transition-all hover:scale-105",
                category === cat ? "ring-2 ring-blue-500" : "",
                colorClass.replace('bg-', 'bg-').replace('/20', '/10')
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                {CATEGORY_ICONS[cat]}
                <span className="text-sm font-medium capitalize">{cat.replace('_', ' ')}</span>
              </div>
              <p className="text-xs text-slate-400">Click to filter</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
