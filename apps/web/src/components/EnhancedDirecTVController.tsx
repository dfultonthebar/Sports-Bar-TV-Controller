
'use client'

import { useState, useEffect } from 'react'
interface DirecTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  isOnline: boolean
  receiverType: 'Genie HD DVR' | 'Genie Mini' | 'HR Series DVR' | 'C61K Mini' | 'HS17 Server'
  inputChannel?: number
  lastResponse?: string
  softwareVersion?: string
  serialNumber?: string
}
import { 
  Satellite, 
  Brain, 
  Zap, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Trophy,
  Target,
  Settings
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

import { logger } from '@/lib/logger'
interface AIChannelSuggestion {
  channel: string
  name: string
  reason: string
  confidence: number
  category: 'sports' | 'news' | 'entertainment'
}

interface DeviceHealthMetrics {
  responseTime: number
  connectionStability: number
  commandSuccessRate: number
  lastHealthCheck: Date
  predictedIssues: string[]
}

interface SmartAlert {
  id: string
  type: 'maintenance' | 'optimization' | 'usage' | 'prediction'
  message: string
  severity: 'low' | 'medium' | 'high'
  deviceId: string
  timestamp: Date
  autoResolvable: boolean
}

interface EnhancedDirecTVControllerProps {
  device: DirecTVDevice
  onDeviceUpdate: (device: DirecTVDevice) => void
}

export default function EnhancedDirecTVController({ device, onDeviceUpdate }: EnhancedDirecTVControllerProps) {
  const [aiSuggestions, setAiSuggestions] = useState<AIChannelSuggestion[]>([])
  const [healthMetrics, setHealthMetrics] = useState<DeviceHealthMetrics | null>(null)
  const [smartAlerts, setSmartAlerts] = useState<SmartAlert[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showAIPanel, setShowAIPanel] = useState(false)

  useEffect(() => {
    if (device) {
      fetchAIInsights()
    }
  }, [device])

  const fetchAIInsights = async () => {
    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/directv-devices/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: device.id })
      })

      if (response.ok) {
        const data = await response.json()
        setAiSuggestions(data.channelSuggestions || [])
        setHealthMetrics(data.healthMetrics)
        setSmartAlerts(data.alerts || [])
      }
    } catch (error) {
      logger.error('Failed to fetch AI insights:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSmartChannelChange = async (suggestion: AIChannelSuggestion) => {
    try {
      const response = await fetch('/api/directv-devices/smart-channel-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id,
          channel: suggestion.channel,
          reason: suggestion.reason
        })
      })

      if (response.ok) {
        logger.info(`Smart channel change to ${suggestion.name} (${suggestion.channel})`)
      }
    } catch (error) {
      logger.error('Smart channel change failed:', error)
    }
  }

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/directv-devices/resolve-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, deviceId: device.id })
      })

      if (response.ok) {
        setSmartAlerts(prev => prev.filter(alert => alert.id !== alertId))
      }
    } catch (error) {
      logger.error('Failed to resolve alert:', error)
    }
  }

  const getHealthColor = (metric: number) => {
    if (metric >= 90) return 'text-green-600'
    if (metric >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-slate-800 or bg-slate-900 text-slate-100 border-slate-700'
    }
  }

  return (
    <div className="space-y-6">
      {/* AI Enhancement Panel */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg">AI-Enhanced DirecTV Control</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAIPanel(!showAIPanel)}
            >
              {showAIPanel ? 'Hide' : 'Show'} AI Panel
            </Button>
          </div>
          <CardDescription>
            {device.name} • Intelligent recommendations and monitoring
          </CardDescription>
        </CardHeader>

        {showAIPanel && (
          <CardContent className="space-y-4">
            {/* Device Health Metrics */}
            {healthMetrics && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800 or bg-slate-900 p-3 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Response Time</span>
                    <span className={`font-bold ${getHealthColor(100 - healthMetrics.responseTime / 10)}`}>
                      {healthMetrics.responseTime}ms
                    </span>
                  </div>
                </div>
                <div className="bg-slate-800 or bg-slate-900 p-3 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Connection</span>
                    <span className={`font-bold ${getHealthColor(healthMetrics.connectionStability)}`}>
                      {healthMetrics.connectionStability}%
                    </span>
                  </div>
                </div>
                <div className="bg-slate-800 or bg-slate-900 p-3 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Success Rate</span>
                    <span className={`font-bold ${getHealthColor(healthMetrics.commandSuccessRate)}`}>
                      {healthMetrics.commandSuccessRate}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Smart Alerts */}
            {smartAlerts.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Smart Alerts
                </h4>
                {smartAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-3 bg-slate-800 or bg-slate-900 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Badge className={getSeverityColor(alert.severity)}>
                        {alert.severity}
                      </Badge>
                      <span className="text-sm">{alert.message}</span>
                    </div>
                    {alert.autoResolvable && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveAlert(alert.id)}
                      >
                        Auto-Fix
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* AI Channel Suggestions */}
            {aiSuggestions.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Smart Channel Recommendations
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {aiSuggestions.map((suggestion, index) => (
                    <div key={index} 
                         className="bg-slate-800 or bg-slate-900 p-3 rounded-lg border hover:shadow-sm transition-shadow cursor-pointer"
                         onClick={() => handleSmartChannelChange(suggestion)}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-orange-500" />
                          <span className="font-medium">{suggestion.name}</span>
                        </div>
                        <Badge variant="outline">{suggestion.channel}</Badge>
                      </div>
                      <p className="text-xs text-slate-400 mb-1">{suggestion.reason}</p>
                      <div className="flex items-center justify-between">
                        <Badge className={`text-xs ${
                          suggestion.category === 'sports' ? 'bg-orange-100 text-orange-800' :
                          suggestion.category === 'news' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {suggestion.category}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {Math.round(suggestion.confidence * 100)}% match
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Status */}
            <div className="flex items-center justify-between bg-slate-800 or bg-slate-900 p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">AI Analysis Active</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchAIInsights}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? 'Analyzing...' : 'Refresh AI'}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
