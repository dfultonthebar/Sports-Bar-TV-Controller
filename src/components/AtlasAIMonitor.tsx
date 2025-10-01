
/**
 * Atlas AI Monitor Component
 * Real-time AI-powered monitoring dashboard for Atlas audio processors
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { 
  Activity,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Brain,
  Zap,
  Network,
  Volume2,
  Settings,
  RefreshCw,
  BarChart3,
  AlertCircle
} from 'lucide-react'

interface AtlasAIMonitorProps {
  processorId: string
  processorModel: string
  autoRefresh?: boolean
  refreshInterval?: number
}

export default function AtlasAIMonitor({ 
  processorId, 
  processorModel, 
  autoRefresh = true, 
  refreshInterval = 30000 
}: AtlasAIMonitorProps) {
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    fetchAtlasAnalysis()
    
    if (autoRefresh) {
      const interval = setInterval(fetchAtlasAnalysis, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [processorId, autoRefresh, refreshInterval])

  const fetchAtlasAnalysis = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch real Atlas hardware data - this will query the actual Atlas processor
      // The API will return error if Atlas is not configured or unreachable
      const response = await fetch('/api/atlas/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId,
          processorModel
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch Atlas AI analysis')
      }
      
      const result = await response.json()
      setAnalysis(result.analysis)
      setLastUpdate(new Date())
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'optimal': return 'text-green-600 bg-green-100'
      case 'minor': return 'text-yellow-600 bg-yellow-100'
      case 'moderate': return 'text-orange-600 bg-orange-100'
      case 'critical': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'optimal': return <CheckCircle className="w-4 h-4" />
      case 'minor': return <AlertTriangle className="w-4 h-4" />
      case 'moderate': return <AlertTriangle className="w-4 h-4" />
      case 'critical': return <AlertCircle className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  if (loading && !analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-blue-600" />
            <span>Atlas AI Monitor</span>
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-slate-400">Analyzing Atlas processor...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-red-600" />
            <span>Atlas AI Monitor</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 text-center py-4">
            Error: {error}
            <Button 
              onClick={fetchAtlasAnalysis}
              className="ml-4"
              size="sm"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Main Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Brain className="w-5 h-5 text-blue-600" />
              <span>Atlas AI Monitor</span>
              <Badge className={`${getSeverityColor(analysis?.severity || 'unknown')} border-0`}>
                {getSeverityIcon(analysis?.severity || 'unknown')}
                <span className="ml-1">{analysis?.severity?.toUpperCase() || 'UNKNOWN'}</span>
              </Badge>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                onClick={fetchAtlasAnalysis}
                size="sm"
                variant="outline"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
          <CardDescription>
            {processorModel} ({processorId}) • Last updated: {lastUpdate.toLocaleTimeString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-medium mb-4">
            {analysis?.summary || 'Analysis unavailable'}
          </div>
          
          {/* Performance Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center space-x-2 mb-2">
                <Volume2 className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Signal Quality</span>
              </div>
              <div className="text-2xl font-bold text-green-800">
                {analysis?.performanceMetrics?.signalQuality || 0}%
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2 mb-2">
                <Network className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">Network</span>
              </div>
              <div className="text-2xl font-bold text-blue-800">
                {analysis?.performanceMetrics?.latencyMs || 0}ms
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-blue-900/20 to-blue-900/20 p-4 rounded-lg border border-blue-800/40">
              <div className="flex items-center space-x-2 mb-2">
                <Zap className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-300">DSP Load</span>
              </div>
              <div className="text-2xl font-bold text-blue-200">
                {analysis?.performanceMetrics?.processingLoad || 0}%
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-teal-50 to-emerald-50 p-4 rounded-lg border border-teal-200">
              <div className="flex items-center space-x-2 mb-2">
                <Activity className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-medium text-teal-700">Stability</span>
              </div>
              <div className="text-2xl font-bold text-teal-800">
                {analysis?.performanceMetrics?.networkStability || 0}%
              </div>
            </div>
          </div>

          {/* AI Insights */}
          {analysis?.audioInsights && analysis.audioInsights.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-slate-200 mb-2">AI Insights</h4>
              <div className="space-y-1">
                {analysis.audioInsights.map((insight: string, index: number) => (
                  <div key={index} className="text-sm text-slate-300 flex items-start space-x-2">
                    <Brain className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysis?.hardwareRecommendations && analysis.hardwareRecommendations.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-slate-200 mb-2">Hardware Recommendations</h4>
              <div className="space-y-1">
                {analysis.hardwareRecommendations.map((rec: string, index: number) => (
                  <div key={index} className="text-sm text-orange-600 flex items-start space-x-2">
                    <Settings className="w-3 h-3 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Configuration Issues */}
          {analysis?.configurationIssues && analysis.configurationIssues.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-200 mb-2">Configuration Issues</h4>
              <div className="space-y-1">
                {analysis.configurationIssues.map((issue: string, index: number) => (
                  <div key={index} className="text-sm text-red-600 flex items-start space-x-2">
                    <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>{issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confidence Indicator */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>Analysis Confidence</span>
              <span>{analysis?.confidence || 0}%</span>
            </div>
            <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${analysis?.confidence || 0}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audio Pattern Analysis */}
      {analysis?.audioPatterns && analysis.audioPatterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <span>Audio Pattern Analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysis.audioPatterns.map((pattern: string, index: number) => (
                <div key={index} className="bg-blue-900/20 border border-blue-800/40 rounded p-3">
                  <div className="text-sm text-blue-200">{pattern}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
