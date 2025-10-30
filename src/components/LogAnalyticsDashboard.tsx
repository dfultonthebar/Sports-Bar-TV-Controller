
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/cards'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from './ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Download, RefreshCw, AlertTriangle, TrendingUp, Activity, HardDrive, Clock, Users } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'

interface LogAnalytics {
  totalLogs: number
  errorRate: number
  performanceMetrics: {
    averageResponseTime: number
    slowestOperations: Array<{ operation: string; duration: number }>
  }
  topErrors: Array<{ message: string; count: number; lastOccurred: string }>
  userActivity: Array<{ action: string; count: number }>
  deviceUsage: Array<{ device: string; operations: number; errorRate: number }>
  timePatterns: Array<{ hour: number; activity: number }>
  recommendations: string[]
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C']

export default function LogAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<LogAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('24')
  const [category, setCategory] = useState('all')
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => {
    fetchAnalytics()
    
    if (autoRefresh) {
      const interval = setInterval(fetchAnalytics, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [timeRange, category, autoRefresh])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/logs/analytics?hours=${timeRange}&category=${category !== 'all' ? category : ''}`)
      const data = await response.json()
      setAnalytics(data)
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadLogs = async () => {
    try {
      const response = await fetch(`/api/logs/export?hours=${timeRange}&category=${category !== 'all' ? category : ''}`)
      const data = await response.json()
      
      const blob = new Blob([data.content], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = data.filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to download logs:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load analytics data</p>
        <Button onClick={fetchAnalytics} className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  const getErrorRateColor = (rate: number) => {
    if (rate < 5) return 'text-green-600'
    if (rate < 15) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Logs & Analytics</h2>
          <p className="text-muted-foreground">Monitor system performance and diagnose issues</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 Hour</SelectItem>
              <SelectItem value="6">6 Hours</SelectItem>
              <SelectItem value="24">24 Hours</SelectItem>
              <SelectItem value="168">7 Days</SelectItem>
              <SelectItem value="720">30 Days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="cec">CEC Control (TVs & Cable Boxes)</SelectItem>
              <SelectItem value="user_interaction">User Interactions</SelectItem>
              <SelectItem value="system">System Events</SelectItem>
              <SelectItem value="api">API Calls</SelectItem>
              <SelectItem value="hardware">Hardware</SelectItem>
              <SelectItem value="configuration">Configuration</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
              <SelectItem value="security">Security</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-green-50 text-green-700' : ''}
          >
            <Activity className="mr-2 h-4 w-4" />
            {autoRefresh ? 'Auto Refresh On' : 'Auto Refresh Off'}
          </Button>

          <Button onClick={fetchAnalytics} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Button onClick={downloadLogs} className="bg-blue-600 hover:bg-blue-700">
            <Download className="mr-2 h-4 w-4" />
            Download Logs
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Events</p>
                <p className="text-2xl font-bold">{analytics.totalLogs.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className={`h-8 w-8 ${getErrorRateColor(analytics.errorRate)}`} />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                <p className={`text-2xl font-bold ${getErrorRateColor(analytics.errorRate)}`}>
                  {analytics.errorRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Avg Response</p>
                <p className="text-2xl font-bold">
                  {formatDuration(analytics.performanceMetrics.averageResponseTime)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <HardDrive className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Devices</p>
                <p className="text-2xl font-bold">{analytics.deviceUsage.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {analytics.recommendations.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="text-orange-800 flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5" />
              AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
                  <p className="text-orange-800">{recommendation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts and Tables */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  Activity Timeline (24 Hours)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.timePatterns}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="hour" 
                      tickFormatter={(hour) => `${hour}:00`}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(hour) => `${hour}:00 - ${hour + 1}:00`}
                      formatter={(value) => [value, 'Events']}
                    />
                    <Line type="monotone" dataKey="activity" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  User Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.userActivity.slice(0, 6)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) => entry.action as string}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {analytics.userActivity.slice(0, 6).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Slowest Operations</CardTitle>
              <p className="text-sm text-muted-foreground">Operations taking the most time</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.performanceMetrics.slowestOperations.slice(0, 10).map((op, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="font-medium">{op.operation}</span>
                    <Badge variant={op.duration > 5000 ? 'destructive' : op.duration > 2000 ? 'default' : 'secondary'}>
                      {formatDuration(op.duration)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Top Errors</CardTitle>
              <p className="text-sm text-muted-foreground">Most frequently occurring errors</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.topErrors.slice(0, 10).map((error, index) => (
                  <div key={index} className="p-4 rounded-lg border border-red-200 bg-red-50/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-red-800 mb-1">{error.message}</p>
                        <p className="text-sm text-red-600">
                          Last occurred: {new Date(error.lastOccurred).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="destructive">{error.count} times</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Device Usage & Health</CardTitle>
              <p className="text-sm text-muted-foreground">Performance statistics by device</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Device</th>
                      <th className="text-left p-3 font-medium">Operations</th>
                      <th className="text-left p-3 font-medium">Error Rate</th>
                      <th className="text-left p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.deviceUsage.map((device, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="p-3 font-medium">{device.device}</td>
                        <td className="p-3">{device.operations}</td>
                        <td className="p-3">
                          <span className={getErrorRateColor(device.errorRate)}>
                            {device.errorRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-3">
                          <Badge 
                            variant={device.errorRate < 5 ? 'default' : device.errorRate < 15 ? 'default' : 'destructive'}
                            className={device.errorRate < 5 ? 'bg-green-100 text-green-800' : ''}
                          >
                            {device.errorRate < 5 ? 'Healthy' : device.errorRate < 15 ? 'Warning' : 'Critical'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Activity Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={analytics.userActivity.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="action" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
