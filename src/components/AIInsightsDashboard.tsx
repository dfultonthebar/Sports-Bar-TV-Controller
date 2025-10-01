
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { AlertTriangle, TrendingUp, Clock, Zap, BarChart3, RefreshCw } from 'lucide-react'

interface AIInsightsData {
  summary: any
  insights: any
  recommendations: any[]
}

export default function AIInsightsDashboard() {
  const [insightsData, setInsightsData] = useState<AIInsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('24')

  const fetchInsights = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/ai/log-analysis?hours=${timeframe}`)
      const data = await response.json()
      setInsightsData(data)
    } catch (error) {
      console.error('Failed to fetch AI insights:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInsights()
  }, [timeframe])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Analyzing logs with AI...</span>
      </div>
    )
  }

  if (!insightsData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">No Data Available</CardTitle>
          <CardDescription>Unable to load AI insights</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { summary, insights, recommendations } = insightsData

  // Prepare simple visualization data
  const hourlyData = Object.entries(insights.timePatterns?.hourlyDistribution || {})
    .map(([hour, count]) => ({ hour: `${hour}:00`, operations: count as number }))
    .sort((a, b) => parseInt(a.hour) - parseInt(b.hour))

  const deviceData = Object.entries(insights.devicePatterns?.deviceDistribution || {})
    .map(([device, count]) => ({ device: device.substring(0, 15), count: count as number }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const maxHourly = Math.max(...hourlyData.map(d => d.operations), 1)
  const maxDevice = Math.max(...deviceData.map(d => d.count), 1)

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'default'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">AI Log Analysis</h2>
          <p className="text-muted-foreground">Intelligent insights from bartender operations</p>
        </div>
        <div className="flex gap-2">
          <select 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="1">Last Hour</option>
            <option value="24">Last 24 Hours</option>
            <option value="168">Last Week</option>
          </select>
          <Button onClick={fetchInsights} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Operations</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalOperations}</div>
            <p className="text-xs text-muted-foreground">
              {summary.successRate.toFixed(1)}% success rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Count</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.errorCount}</div>
            <p className="text-xs text-muted-foreground">System errors detected</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sports Activity</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.sportsInsights?.sportsPercentage?.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground">Sports-related operations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Hour</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insights.timePatterns?.peakHour?.[0] || 'N/A'}:00
            </div>
            <p className="text-xs text-muted-foreground">
              {insights.timePatterns?.peakHour?.[1] || 0} operations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>AI Recommendations</CardTitle>
          <CardDescription>Intelligent suggestions based on operation patterns</CardDescription>
        </CardHeader>
        <CardContent>
          {recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((rec, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg">
                  <Badge variant={getPriorityColor(rec.priority)}>
                    {rec.priority}
                  </Badge>
                  <div>
                    <p className="font-medium capitalize">{rec.type.replace('_', ' ')}</p>
                    <p className="text-sm text-muted-foreground">{rec.message}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No recommendations at this time</p>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <Tabs defaultValue="hourly" className="space-y-4">
        <TabsList>
          <TabsTrigger value="hourly">Hourly Usage</TabsTrigger>
          <TabsTrigger value="devices">Device Usage</TabsTrigger>
          <TabsTrigger value="patterns">Pattern Analysis</TabsTrigger>
        </TabsList>
        
        <TabsContent value="hourly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Operations by Hour</CardTitle>
              <CardDescription>Bartender activity throughout the day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {hourlyData.map((item) => (
                  <div key={item.hour} className="flex items-center space-x-3">
                    <div className="w-12 text-sm font-medium">{item.hour}</div>
                    <div className="flex-1 bg-slate-800 or bg-slate-900 rounded-full h-6 relative overflow-hidden">
                      <div 
                        className="bg-blue-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${(item.operations / maxHourly) * 100}%` }}
                      />
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-xs font-medium text-slate-200">
                          {item.operations} ops
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {hourlyData.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    No hourly data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Most Used Devices</CardTitle>
              <CardDescription>Device interaction frequency</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {deviceData.map((item, index) => (
                  <div key={item.device} className="flex items-center space-x-3">
                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{index + 1}</span>
                    </div>
                    <div className="w-20 text-sm font-medium truncate">{item.device}</div>
                    <div className="flex-1 bg-slate-800 or bg-slate-900 rounded-full h-6 relative overflow-hidden">
                      <div 
                        className="bg-green-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${(item.count / maxDevice) * 100}%` }}
                      />
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-xs font-medium text-slate-200">
                          {item.count} uses
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {deviceData.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    No device usage data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Time Patterns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Peak Hour:</span>
                    <span className="font-medium">
                      {insights.timePatterns?.peakHour?.[0] || 'N/A'}:00
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Peak Day:</span>
                    <span className="font-medium">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][insights.timePatterns?.peakDay?.[0]] || 'N/A'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Sports Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Sports Operations:</span>
                    <span className="font-medium">
                      {insights.sportsInsights?.sportsOperationCount || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sports Percentage:</span>
                    <span className="font-medium">
                      {insights.sportsInsights?.sportsPercentage?.toFixed(1) || 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
