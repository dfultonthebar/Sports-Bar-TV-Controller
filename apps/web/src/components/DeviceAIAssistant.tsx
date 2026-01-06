
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { logger } from '@sports-bar/logger'
import { 
  Brain, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  Settings, 
  Tv, 
  Satellite,
  Radio,
  RefreshCw,
  Lightbulb,
  Target,
  Activity,
  Clock,
  Network,
  Volume2
} from 'lucide-react'

interface DeviceAIInsight {
  id: string
  deviceId: string
  deviceType: 'directv' | 'firetv' | 'ir'
  deviceName: string
  type: 'optimization' | 'troubleshooting' | 'maintenance' | 'performance' | 'usage_pattern' | 'prediction'
  priority: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  recommendation: string
  confidence: number
  timestamp: Date
  data?: any
}

interface DevicePerformanceMetrics {
  responsiveness: number
  connectionStability: number
  errorRate: number
  usageFrequency: number
  lastSeen: Date
  avgResponseTime: number
}

interface SmartRecommendation {
  type: 'channel_optimization' | 'maintenance_alert' | 'usage_insight' | 'sports_enhancement'
  message: string
  action: string
  priority: 'high' | 'medium' | 'low'
  deviceTypes: string[]
}

export default function DeviceAIAssistant() {
  const [insights, setInsights] = useState<DeviceAIInsight[]>([])
  const [recommendations, setRecommendations] = useState<SmartRecommendation[]>([])
  const [metrics, setMetrics] = useState<Record<string, DevicePerformanceMetrics>>({})
  const [loading, setLoading] = useState(true)
  const [selectedDevice, setSelectedDevice] = useState<string>('all')
  const [timeframe, setTimeframe] = useState('24h')
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    fetchDeviceAIAnalysis()
    
    if (autoRefresh) {
      const interval = setInterval(fetchDeviceAIAnalysis, 30000) // 30 seconds
      return () => clearInterval(interval)
    }
  }, [selectedDevice, timeframe, autoRefresh])

  const fetchDeviceAIAnalysis = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/devices/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceFilter: selectedDevice,
          timeframe,
          analysisTypes: ['performance', 'usage', 'optimization', 'troubleshooting']
        })
      })

      if (response.ok) {
        const data = await response.json()
        setInsights(data.insights || [])
        setRecommendations(data.recommendations || [])
        setMetrics(data.metrics || {})
      }
    } catch (error) {
      logger.error('Failed to fetch device AI analysis:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'directv': return <Satellite className="w-4 h-4" />
      case 'firetv': return <Tv className="w-4 h-4" />
      case 'ir': return <Radio className="w-4 h-4" />
      default: return <Settings className="w-4 h-4" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-slate-800 or bg-slate-900 text-slate-100 border-slate-700'
    }
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'optimization': return <Zap className="w-4 h-4" />
      case 'troubleshooting': return <AlertTriangle className="w-4 h-4" />
      case 'maintenance': return <Settings className="w-4 h-4" />
      case 'performance': return <TrendingUp className="w-4 h-4" />
      case 'usage_pattern': return <Activity className="w-4 h-4" />
      case 'prediction': return <Brain className="w-4 h-4" />
      default: return <Lightbulb className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Analyzing device performance with AI...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-blue-600" />
            Device AI Assistant
          </h2>
          <p className="text-gray-600">Intelligent insights for DirecTV, Fire TV, and IR devices</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-md text-slate-100"
          >
            <option value="all" className="bg-slate-800 text-slate-100">All Devices</option>
            <option value="directv" className="bg-slate-800 text-slate-100">DirecTV Only</option>
            <option value="firetv" className="bg-slate-800 text-slate-100">Fire TV Only</option>
            <option value="ir" className="bg-slate-800 text-slate-100">IR Devices Only</option>
          </select>
          
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-md text-slate-100"
          >
            <option value="1h" className="bg-slate-800 text-slate-100">Last Hour</option>
            <option value="24h" className="bg-slate-800 text-slate-100">Last 24 Hours</option>
            <option value="7d" className="bg-slate-800 text-slate-100">Last 7 Days</option>
          </select>
          
          <Button onClick={fetchDeviceAIAnalysis} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* AI Insights Tabs */}
      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="insights">Smart Insights</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights.map((insight) => (
              <Card key={insight.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getDeviceIcon(insight.deviceType)}
                      <CardTitle className="text-sm">{insight.deviceName}</CardTitle>
                    </div>
                    <Badge className={getPriorityColor(insight.priority)}>
                      {insight.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {getInsightIcon(insight.type)}
                    <CardDescription className="font-medium">{insight.title}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-300 mb-3">{insight.description}</p>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 mb-1">AI Recommendation:</p>
                    <p className="text-sm text-blue-700">{insight.recommendation}</p>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                    <span>Confidence: {Math.round(insight.confidence * 100)}%</span>
                    <span>{new Date(insight.timestamp).toLocaleTimeString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {insights.length === 0 && (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-slate-400">
                  <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No AI insights available for the selected criteria</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(metrics).map(([deviceId, metric]) => (
              <Card key={deviceId}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{deviceId}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Responsiveness</span>
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${
                        metric.responsiveness > 80 ? 'bg-green-500' : 
                        metric.responsiveness > 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <span className="text-xs font-medium">{metric.responsiveness}%</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Connection</span>
                    <div className="flex items-center gap-1">
                      <Network className="w-3 h-3 text-slate-500" />
                      <span className="text-xs font-medium">{metric.connectionStability}%</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Error Rate</span>
                    <span className="text-xs font-medium">{metric.errorRate.toFixed(2)}%</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Usage</span>
                    <span className="text-xs font-medium">{metric.usageFrequency}/day</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <div className="space-y-4">
            {recommendations.map((rec, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-blue-600" />
                      <CardTitle className="text-lg capitalize">
                        {rec.type.replace('_', ' ')}
                      </CardTitle>
                    </div>
                    <Badge className={getPriorityColor(rec.priority)}>
                      {rec.priority}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-200 mb-3">{rec.message}</p>
                  <div className="bg-slate-800 or bg-slate-900 p-3 rounded-lg">
                    <p className="text-sm font-medium text-slate-100 mb-1">Recommended Action:</p>
                    <p className="text-sm text-slate-300">{rec.action}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs text-slate-400">Applies to:</span>
                    {rec.deviceTypes.map((type, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-600" />
                Predictive Analytics
              </CardTitle>
              <CardDescription>
                AI-powered predictions based on usage patterns and system behavior
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {insights.filter(i => i.type === 'prediction').map((prediction) => (
                  <div key={prediction.id} className="border-l-4 border-purple-500 pl-4 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium">{prediction.title}</h4>
                      <span className="text-xs text-slate-400">
                        {Math.round(prediction.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 mb-2">{prediction.description}</p>
                    <p className="text-sm text-purple-700 bg-purple-50 p-2 rounded">
                      {prediction.recommendation}
                    </p>
                  </div>
                ))}
                
                {insights.filter(i => i.type === 'prediction').length === 0 && (
                  <div className="text-center text-slate-400 py-6">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Building predictive models...</p>
                    <p className="text-xs">More data needed for accurate predictions</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
