'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/cards'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { logger } from '@/lib/logger'
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  RefreshCw,
  Filter,
  Download,
  AlertTriangle,
  Zap,
  Calendar,
  Search,
} from 'lucide-react'

interface CableBox {
  id: string
  name: string
  devicePath?: string
  provider: string
  model: string
  lastChannel?: string
  isOnline: boolean
}

interface CommandLog {
  id: string
  cecDeviceId: string
  cableBoxId: string
  command: string
  cecCode?: string
  success: boolean
  responseTime?: number
  timestamp: string
  errorMessage?: string
  deviceName?: string
}

interface CommandStats {
  overall: {
    totalCommands: number
    successfulCommands: number
    failedCommands: number
    avgResponseTime: number
  }
  byDevice: Array<{
    deviceId: string
    totalCommands: number
    successfulCommands: number
    avgResponseTime: number
  }>
  popularCommands: Array<{
    command: string
    count: number
    successRate: number
  }>
}

interface TimeRangeOption {
  label: string
  value: 'hour' | 'day' | 'week' | 'month' | 'all'
  hours: number | null
}

const TIME_RANGES: TimeRangeOption[] = [
  { label: 'Last Hour', value: 'hour', hours: 1 },
  { label: 'Last 24 Hours', value: 'day', hours: 24 },
  { label: 'Last Week', value: 'week', hours: 168 },
  { label: 'Last Month', value: 'month', hours: 720 },
  { label: 'All Time', value: 'all', hours: null },
]

export default function CECMonitoringDashboard() {
  const [cableBoxes, setCableBoxes] = useState<CableBox[]>([])
  const [commandLogs, setCommandLogs] = useState<CommandLog[]>([])
  const [stats, setStats] = useState<CommandStats>({
    overall: {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      avgResponseTime: 0,
    },
    byDevice: [],
    popularCommands: [],
  })
  const [loading, setLoading] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<'hour' | 'day' | 'week' | 'month' | 'all'>('day')
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchData()
    }, 5000) // Refresh every 5 seconds

    return () => clearInterval(interval)
  }, [autoRefresh, selectedDevice, timeRange])

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchCableBoxes(), fetchCommandLogs(), fetchStats()])
    } catch (error) {
      logger.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCableBoxes = async () => {
    try {
      const response = await fetch('/api/cec/cable-box')
      const data = await response.json()
      if (data.success) {
        setCableBoxes(data.cableBoxes)
      }
    } catch (error) {
      logger.error('Error fetching cable boxes:', error)
    }
  }

  const fetchCommandLogs = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedDevice !== 'all') {
        params.append('cableBoxId', selectedDevice)
      }
      if (timeRange !== 'all') {
        const range = TIME_RANGES.find((r) => r.value === timeRange)
        if (range?.hours) {
          const since = new Date(Date.now() - range.hours * 60 * 60 * 1000).toISOString()
          params.append('since', since)
        }
      }
      params.append('limit', '100')

      const response = await fetch(`/api/cec/cable-box/logs?${params}`)
      const data = await response.json()
      if (data.success) {
        setCommandLogs(data.logs)
      }
    } catch (error) {
      logger.error('Error fetching command logs:', error)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/cec/cable-box/stats')
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      logger.error('Error fetching stats:', error)
    }
  }

  const calculateSuccessRate = (successful: number, total: number): number => {
    if (total === 0) return 0
    return Math.round((successful / total) * 100)
  }

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return date.toLocaleString()
  }

  const getHealthStatus = (deviceId: string): 'healthy' | 'warning' | 'critical' => {
    const deviceStats = stats.byDevice.find((d) => d.deviceId === deviceId)
    if (!deviceStats) return 'warning'

    const successRate = calculateSuccessRate(
      deviceStats.successfulCommands,
      deviceStats.totalCommands
    )

    if (successRate >= 95) return 'healthy'
    if (successRate >= 80) return 'warning'
    return 'critical'
  }

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Device', 'Command', 'CEC Code', 'Success', 'Response Time', 'Error'].join(','),
      ...commandLogs.map((log) =>
        [
          log.timestamp,
          log.deviceName || log.cableBoxId,
          log.command,
          log.cecCode || '',
          log.success ? 'Yes' : 'No',
          log.responseTime ? `${log.responseTime}ms` : '',
          log.errorMessage || '',
        ].join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cec-logs-${new Date().toISOString()}.csv`
    a.click()
  }

  const successRate = calculateSuccessRate(
    stats.overall.successfulCommands,
    stats.overall.totalCommands
  )

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <BarChart3 className="w-8 h-8" />
          CEC Monitoring Dashboard
        </h1>
        <div className="flex gap-2">
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
          >
            <Activity className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
            {autoRefresh ? 'Auto-Refresh On' : 'Auto-Refresh Off'}
          </Button>
          <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={exportLogs} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Logs
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Device:</label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="all">All Devices</option>
                {cableBoxes.map((box) => (
                  <option key={box.id} value={box.id}>
                    {box.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Time Range:</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="px-3 py-1 border rounded-md text-sm"
              >
                {TIME_RANGES.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Commands</p>
                <p className="text-2xl font-bold">{stats.overall.totalCommands}</p>
              </div>
              <Zap className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p
                  className={`text-2xl font-bold ${
                    successRate >= 95
                      ? 'text-green-600'
                      : successRate >= 80
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}
                >
                  {successRate}%
                </p>
              </div>
              {successRate >= 95 ? (
                <TrendingUp className="w-8 h-8 text-green-600" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-600" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Response Time</p>
                <p className="text-2xl font-bold">{Math.round(stats.overall.avgResponseTime)}ms</p>
              </div>
              <Clock className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed Commands</p>
                <p className="text-2xl font-bold text-red-600">{stats.overall.failedCommands}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Device Health Status */}
      <Card>
        <CardHeader>
          <CardTitle>Device Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cableBoxes.map((box) => {
              const deviceStats = stats.byDevice.find((d) => d.deviceId === box.id)
              const health = getHealthStatus(box.id)
              const deviceSuccessRate = deviceStats
                ? calculateSuccessRate(deviceStats.successfulCommands, deviceStats.totalCommands)
                : 0

              return (
                <div
                  key={box.id}
                  className={`p-4 rounded-lg border-2 ${
                    health === 'healthy'
                      ? 'border-green-200 bg-green-50'
                      : health === 'warning'
                      ? 'border-yellow-200 bg-yellow-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">{box.name}</h3>
                    <Badge variant={box.isOnline ? 'default' : 'secondary'}>
                      {box.isOnline ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Commands:</span>
                      <span className="font-medium">{deviceStats?.totalCommands || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Success Rate:</span>
                      <span
                        className={`font-medium ${
                          deviceSuccessRate >= 95
                            ? 'text-green-600'
                            : deviceSuccessRate >= 80
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      >
                        {deviceSuccessRate}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Response:</span>
                      <span className="font-medium">
                        {deviceStats ? Math.round(deviceStats.avgResponseTime) : 0}ms
                      </span>
                    </div>
                  </div>
                  {health === 'critical' && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Requires attention</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Popular Commands */}
      <Card>
        <CardHeader>
          <CardTitle>Most Used Commands</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.popularCommands.slice(0, 10).map((cmd, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-8 text-center font-bold text-muted-foreground">{index + 1}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-medium">{cmd.command}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{cmd.count} uses</span>
                      <Badge
                        variant={
                          cmd.successRate >= 95 ? 'default' : cmd.successRate >= 80 ? 'secondary' : 'destructive'
                        }
                      >
                        {Math.round(cmd.successRate)}% success
                      </Badge>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        cmd.successRate >= 95
                          ? 'bg-green-600'
                          : cmd.successRate >= 80
                          ? 'bg-yellow-600'
                          : 'bg-red-600'
                      }`}
                      style={{ width: `${cmd.successRate}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Command Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Commands</CardTitle>
            <Badge variant="outline">{commandLogs.length} logs</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {commandLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No command logs found</p>
                <p className="text-sm">Commands will appear here as they are executed</p>
              </div>
            ) : (
              commandLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded-lg border ${
                    log.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {log.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">{log.command}</span>
                          {log.cecCode && (
                            <Badge variant="outline" className="text-xs">
                              {log.cecCode}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>{log.deviceName || 'Unknown Device'}</span>
                          <span>•</span>
                          <span>{formatTimestamp(log.timestamp)}</span>
                          {log.responseTime && (
                            <>
                              <span>•</span>
                              <span>{log.responseTime}ms</span>
                            </>
                          )}
                        </div>
                        {log.errorMessage && (
                          <p className="text-xs text-red-600 mt-1">{log.errorMessage}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
