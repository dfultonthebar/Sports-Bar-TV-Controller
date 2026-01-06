

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/cards'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Checkbox } from './ui/checkbox'
import { logger } from '@/lib/logger'
import { 
  Download, 
  FileText, 
  Database, 
  Filter, 
  Calendar,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  HardDrive,
  Activity,
  Settings,
  Eye,
  Search
} from 'lucide-react'

interface LogExportOptions {
  timeRange: string
  category: string
  level: string
  includeAnalytics: boolean
  includeAIInsights: boolean
  format: 'json' | 'csv' | 'txt'
  maxEntries: number
  dateFrom?: string
  dateTo?: string
}

interface LogStats {
  totalLogs: number
  errorRate: number
  categories: Record<string, number>
  recentActivity: number
  systemHealth: 'good' | 'warning' | 'critical'
}

export default function EnhancedLogDownloadCenter() {
  const [exportOptions, setExportOptions] = useState<LogExportOptions>({
    timeRange: '24',
    category: 'all',
    level: 'all',
    includeAnalytics: true,
    includeAIInsights: true,
    format: 'json',
    maxEntries: 1000
  })

  const [logStats, setLogStats] = useState<LogStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchLogStats()
  }, [])

  const fetchLogStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/logs/stats')
      const data = await response.json()
      setLogStats(data)
    } catch (error) {
      logger.error('Failed to fetch log stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const previewLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        hours: exportOptions.timeRange,
        category: exportOptions.category !== 'all' ? exportOptions.category : '',
        level: exportOptions.level !== 'all' ? exportOptions.level : '',
        limit: '10', // Preview only first 10 entries
        search: searchQuery
      })

      const response = await fetch(`/api/logs/preview?${params}`)
      const data = await response.json()
      setPreviewData(data)
    } catch (error) {
      logger.error('Failed to preview logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadLogs = async () => {
    try {
      setDownloading(true)
      
      const params = new URLSearchParams({
        hours: exportOptions.timeRange,
        category: exportOptions.category !== 'all' ? exportOptions.category : '',
        level: exportOptions.level !== 'all' ? exportOptions.level : '',
        format: exportOptions.format,
        maxEntries: exportOptions.maxEntries.toString(),
        includeAnalytics: exportOptions.includeAnalytics.toString(),
        includeAIInsights: exportOptions.includeAIInsights.toString(),
        search: searchQuery
      })

      if (exportOptions.dateFrom) {
        params.append('dateFrom', exportOptions.dateFrom)
      }
      if (exportOptions.dateTo) {
        params.append('dateTo', exportOptions.dateTo)
      }

      const response = await fetch(`/api/logs/export?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to export logs')
      }

      const data = await response.json()
      
      // Create and trigger download
      const blob = new Blob([data.content], { 
        type: exportOptions.format === 'json' ? 'application/json' : 
              exportOptions.format === 'csv' ? 'text/csv' : 'text/plain'
      })
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = data.filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      // Log the download action
      await fetch('/api/logs/user-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'log_download',
          details: {
            filename: data.filename,
            exportOptions,
            timestamp: new Date().toISOString()
          }
        })
      })

    } catch (error) {
      logger.error('Failed to download logs:', error)
    } finally {
      setDownloading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getHealthBadgeVariant = (health: string) => {
    switch (health) {
      case 'good': return 'default'
      case 'warning': return 'secondary'
      case 'critical': return 'destructive'
      default: return 'secondary'
    }
  }

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'good': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'critical': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Log Download Center</h2>
          <p className="text-muted-foreground">Export and analyze system logs with AI insights</p>
        </div>
        
        <Button onClick={fetchLogStats} variant="outline" disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </Button>
      </div>

      {/* System Health Overview */}
      {logStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Database className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Logs</p>
                  <p className="text-2xl font-bold">{logStats.totalLogs.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertTriangle className={`h-8 w-8 ${logStats.errorRate > 10 ? 'text-red-600' : logStats.errorRate > 5 ? 'text-yellow-600' : 'text-green-600'}`} />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                  <p className={`text-2xl font-bold ${logStats.errorRate > 10 ? 'text-red-600' : logStats.errorRate > 5 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {logStats.errorRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Activity className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Recent Activity</p>
                  <p className="text-2xl font-bold">{logStats.recentActivity}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className={`h-8 w-8 ${getHealthColor(logStats.systemHealth)}`} />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">System Health</p>
                  <Badge variant={getHealthBadgeVariant(logStats.systemHealth)} className="text-lg font-bold">
                    {logStats.systemHealth}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="export" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="export">Export Logs</TabsTrigger>
          <TabsTrigger value="preview">Preview & Search</TabsTrigger>
          <TabsTrigger value="analytics">AI Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Download className="mr-2 h-5 w-5" />
                Export Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Time Range */}
                <div className="space-y-2">
                  <Label htmlFor="timeRange">Time Range</Label>
                  <Select 
                    value={exportOptions.timeRange} 
                    onValueChange={(value) => setExportOptions(prev => ({ ...prev, timeRange: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Last 1 Hour</SelectItem>
                      <SelectItem value="6">Last 6 Hours</SelectItem>
                      <SelectItem value="24">Last 24 Hours</SelectItem>
                      <SelectItem value="168">Last 7 Days</SelectItem>
                      <SelectItem value="720">Last 30 Days</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Category Filter */}
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select 
                    value={exportOptions.category} 
                    onValueChange={(value) => setExportOptions(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="user_interaction">User Interactions</SelectItem>
                      <SelectItem value="system">System Events</SelectItem>
                      <SelectItem value="api">API Calls</SelectItem>
                      <SelectItem value="hardware">Hardware Operations</SelectItem>
                      <SelectItem value="configuration">Configuration Changes</SelectItem>
                      <SelectItem value="performance">Performance Metrics</SelectItem>
                      <SelectItem value="security">Security Events</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Log Level Filter */}
                <div className="space-y-2">
                  <Label htmlFor="level">Log Level</Label>
                  <Select 
                    value={exportOptions.level} 
                    onValueChange={(value) => setExportOptions(prev => ({ ...prev, level: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="debug">Debug</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warn">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Export Format */}
                <div className="space-y-2">
                  <Label htmlFor="format">Export Format</Label>
                  <Select 
                    value={exportOptions.format} 
                    onValueChange={(value) => setExportOptions(prev => ({ ...prev, format: value as 'json' | 'csv' | 'txt' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON (Structured)</SelectItem>
                      <SelectItem value="csv">CSV (Spreadsheet)</SelectItem>
                      <SelectItem value="txt">TXT (Human Readable)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Max Entries */}
                <div className="space-y-2">
                  <Label htmlFor="maxEntries">Max Entries</Label>
                  <Input
                    id="maxEntries"
                    type="number"
                    value={exportOptions.maxEntries}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, maxEntries: parseInt(e.target.value) || 1000 }))}
                    min="1"
                    max="10000"
                  />
                </div>
              </div>

              {/* Custom Date Range */}
              {exportOptions.timeRange === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="dateFrom">From Date</Label>
                    <Input
                      id="dateFrom"
                      type="datetime-local"
                      value={exportOptions.dateFrom || ''}
                      onChange={(e) => setExportOptions(prev => ({ ...prev, dateFrom: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateTo">To Date</Label>
                    <Input
                      id="dateTo"
                      type="datetime-local"
                      value={exportOptions.dateTo || ''}
                      onChange={(e) => setExportOptions(prev => ({ ...prev, dateTo: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {/* Export Options */}
              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="font-medium">Export Options</h4>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeAnalytics"
                      checked={exportOptions.includeAnalytics}
                      onCheckedChange={(checked) => 
                        setExportOptions(prev => ({ ...prev, includeAnalytics: !!checked }))
                      }
                    />
                    <Label htmlFor="includeAnalytics">Include Analytics Summary</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeAIInsights"
                      checked={exportOptions.includeAIInsights}
                      onCheckedChange={(checked) => 
                        setExportOptions(prev => ({ ...prev, includeAIInsights: !!checked }))
                      }
                    />
                    <Label htmlFor="includeAIInsights">Include AI Insights & Recommendations</Label>
                  </div>
                </div>
              </div>

              {/* Download Button */}
              <div className="flex justify-end">
                <Button 
                  onClick={downloadLogs} 
                  disabled={downloading}
                  className="min-w-[150px]"
                >
                  <Download className={`mr-2 h-4 w-4 ${downloading ? 'animate-pulse' : ''}`} />
                  {downloading ? 'Generating...' : 'Download Logs'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Eye className="mr-2 h-5 w-5" />
                Log Preview & Search
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Bar */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Search logs by message, action, or device..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button onClick={previewLogs} disabled={loading}>
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </Button>
              </div>

              {/* Preview Results */}
              {previewData && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing first 10 of {previewData.total} matching entries
                    </p>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {previewData.logs?.map((log: any, index: number) => (
                      <div key={index} className="p-3 border rounded-lg bg-muted/20">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={
                                log.level === 'error' || log.level === 'critical' ? 'destructive' :
                                log.level === 'warn' ? 'secondary' : 'default'
                              }>
                                {log.level}
                              </Badge>
                              <span className="text-sm text-muted-foreground">{log.category}</span>
                            </div>
                            <p className="font-medium">{log.message}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {log.source} → {log.action}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">
                              {new Date(log.timestamp).toLocaleString()}
                            </p>
                            {log.duration && (
                              <p className="text-xs text-blue-600">
                                {log.duration}ms
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="mr-2 h-5 w-5" />
                AI-Powered Log Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <HardDrive className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Advanced Analytics Available</h3>
                <p className="text-muted-foreground mb-4">
                  AI-powered insights are included in log exports when enabled
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="text-left p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Pattern Recognition</h4>
                    <p className="text-sm text-muted-foreground">
                      Identify recurring issues and system patterns automatically
                    </p>
                  </div>
                  <div className="text-left p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Anomaly Detection</h4>
                    <p className="text-sm text-muted-foreground">
                      Detect unusual system behavior and performance outliers
                    </p>
                  </div>
                  <div className="text-left p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Smart Recommendations</h4>
                    <p className="text-sm text-muted-foreground">
                      Get actionable suggestions for system optimization
                    </p>
                  </div>
                  <div className="text-left p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Trend Analysis</h4>
                    <p className="text-sm text-muted-foreground">
                      Understand system health trends over time
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
