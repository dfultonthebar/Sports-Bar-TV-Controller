'use client'

import { useState, useEffect } from 'react'
import { 
  Brain, 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw, 
  ArrowLeft,
  Cpu,
  Database,
  Network,
  Zap,
  TrendingUp,
  Clock
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Badge } from '@/components/ui/badge'

import { logger } from '@sports-bar/logger'
interface DiagnosticResult {
  category: string
  status: 'healthy' | 'warning' | 'error'
  message: string
  details?: any
  timestamp: string
}

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'error'
  score: number
  diagnostics: DiagnosticResult[]
}

export default function AIDiagnosticsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  useEffect(() => {
    runDiagnostics()
  }, [])

  const runDiagnostics = async () => {
    setIsLoading(true)
    try {
      // Run multiple diagnostic checks
      const [
        bartenderRemote,
        deviceMapping,
        aiProviders,
        deviceAnalysis
      ] = await Promise.allSettled([
        fetch('/api/diagnostics/bartender-remote').then(r => r.json()),
        fetch('/api/diagnostics/device-mapping').then(r => r.json()),
        fetch('/api/ai-providers/status').then(r => r.json()),
        fetch('/api/devices/ai-analysis').then(r => r.json())
      ])

      const diagnostics: DiagnosticResult[] = []

      // Process bartender remote diagnostics
      if (bartenderRemote.status === 'fulfilled' && bartenderRemote.value.success) {
        diagnostics.push({
          category: 'Bartender Remote',
          status: 'healthy',
          message: 'Bartender remote control is functioning properly',
          details: bartenderRemote.value,
          timestamp: new Date().toISOString()
        })
      } else {
        diagnostics.push({
          category: 'Bartender Remote',
          status: 'error',
          message: 'Bartender remote control check failed',
          details: bartenderRemote.status === 'fulfilled' ? bartenderRemote.value : { error: 'Request failed' },
          timestamp: new Date().toISOString()
        })
      }

      // Process device mapping diagnostics
      if (deviceMapping.status === 'fulfilled' && deviceMapping.value.success) {
        diagnostics.push({
          category: 'Device Mapping',
          status: 'healthy',
          message: 'Device mapping is configured correctly',
          details: deviceMapping.value,
          timestamp: new Date().toISOString()
        })
      } else {
        diagnostics.push({
          category: 'Device Mapping',
          status: 'warning',
          message: 'Device mapping may need attention',
          details: deviceMapping.status === 'fulfilled' ? deviceMapping.value : { error: 'Request failed' },
          timestamp: new Date().toISOString()
        })
      }

      // Process AI providers status
      if (aiProviders.status === 'fulfilled' && aiProviders.value.success) {
        const activeCount = aiProviders.value.active || 0
        const totalCount = aiProviders.value.total || 0
        
        if (activeCount > 0) {
          diagnostics.push({
            category: 'AI Providers',
            status: 'healthy',
            message: `${activeCount} of ${totalCount} AI providers are active`,
            details: aiProviders.value,
            timestamp: new Date().toISOString()
          })
        } else {
          diagnostics.push({
            category: 'AI Providers',
            status: 'warning',
            message: 'No AI providers are currently active',
            details: aiProviders.value,
            timestamp: new Date().toISOString()
          })
        }
      } else {
        diagnostics.push({
          category: 'AI Providers',
          status: 'error',
          message: 'Unable to check AI provider status',
          details: aiProviders.status === 'fulfilled' ? aiProviders.value : { error: 'Request failed' },
          timestamp: new Date().toISOString()
        })
      }

      // Process device AI analysis
      if (deviceAnalysis.status === 'fulfilled' && deviceAnalysis.value.success) {
        diagnostics.push({
          category: 'Device AI Analysis',
          status: 'healthy',
          message: 'AI device analysis is operational',
          details: deviceAnalysis.value,
          timestamp: new Date().toISOString()
        })
      } else {
        diagnostics.push({
          category: 'Device AI Analysis',
          status: 'warning',
          message: 'Device AI analysis may be limited',
          details: deviceAnalysis.status === 'fulfilled' ? deviceAnalysis.value : { error: 'Request failed' },
          timestamp: new Date().toISOString()
        })
      }

      // Calculate overall health
      const errorCount = diagnostics.filter(d => d.status === 'error').length
      const warningCount = diagnostics.filter(d => d.status === 'warning').length
      const healthyCount = diagnostics.filter(d => d.status === 'healthy').length
      
      const score = Math.round((healthyCount / diagnostics.length) * 100)
      
      let overall: 'healthy' | 'warning' | 'error' = 'healthy'
      if (errorCount > 0) {
        overall = 'error'
      } else if (warningCount > 0) {
        overall = 'warning'
      }

      setSystemHealth({
        overall,
        score,
        diagnostics
      })
      setLastRefresh(new Date())
    } catch (error) {
      logger.error('Error running diagnostics:', error)
      setSystemHealth({
        overall: 'error',
        score: 0,
        diagnostics: [{
          category: 'System',
          status: 'error',
          message: 'Failed to run diagnostics',
          details: { error: String(error) },
          timestamp: new Date().toISOString()
        }]
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-400 bg-green-900/30 border-green-500/50'
      case 'warning':
        return 'text-yellow-400 bg-yellow-900/30 border-yellow-500/50'
      case 'error':
        return 'text-red-400 bg-red-900/30 border-red-500/50'
      default:
        return 'text-slate-400 bg-slate-900/30 border-slate-500/50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />
      default:
        return <Activity className="w-5 h-5 text-slate-400" />
    }
  }

  return (
    <div className="min-h-screen bg-sports-gradient">
      <header className="sports-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link 
                href="/ai-hub"
                className="p-2 rounded-lg bg-sportsBar-700/50 hover:bg-sportsBar-600/50 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-slate-200" />
              </Link>
              <div className="bg-primary-gradient rounded-xl p-2.5 shadow-lg">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100">AI System Diagnostics</h1>
                <p className="text-sm text-slate-300">Real-time AI system health monitoring</p>
              </div>
            </div>
            <button
              onClick={runDiagnostics}
              disabled={isLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Running...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overall Health Score */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">System Health Score</CardTitle>
                <CardDescription>
                  Last updated: {lastRefresh.toLocaleString()}
                </CardDescription>
              </div>
              {systemHealth && (
                <div className="text-right">
                  <div className="text-4xl font-bold text-slate-100">
                    {systemHealth.score}%
                  </div>
                  <Badge className={getStatusColor(systemHealth.overall)}>
                    {systemHealth.overall.toUpperCase()}
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
                <span className="ml-3 text-slate-300">Running diagnostics...</span>
              </div>
            ) : systemHealth ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-sportsBar-700/60 rounded-lg border border-green-400/30">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="font-medium text-green-300">Healthy</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-100">
                    {systemHealth.diagnostics.filter(d => d.status === 'healthy').length}
                  </div>
                </div>
                <div className="p-4 bg-sportsBar-700/60 rounded-lg border border-yellow-400/30">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-yellow-400" />
                    <span className="font-medium text-yellow-300">Warnings</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-100">
                    {systemHealth.diagnostics.filter(d => d.status === 'warning').length}
                  </div>
                </div>
                <div className="p-4 bg-sportsBar-700/60 rounded-lg border border-red-400/30">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="font-medium text-red-300">Errors</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-100">
                    {systemHealth.diagnostics.filter(d => d.status === 'error').length}
                  </div>
                </div>
                <div className="p-4 bg-sportsBar-700/60 rounded-lg border border-blue-400/30">
                  <div className="flex items-center space-x-2 mb-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    <span className="font-medium text-blue-300">Total Checks</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-100">
                    {systemHealth.diagnostics.length}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Diagnostic Results */}
        {systemHealth && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-100 mb-4">Diagnostic Results</h2>
            {systemHealth.diagnostics.map((diagnostic, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(diagnostic.status)}
                      <div>
                        <CardTitle className="text-lg">{diagnostic.category}</CardTitle>
                        <CardDescription>{diagnostic.message}</CardDescription>
                      </div>
                    </div>
                    <Badge className={getStatusColor(diagnostic.status)}>
                      {diagnostic.status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                {diagnostic.details && (
                  <CardContent>
                    <div className="bg-sportsBar-800/50 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <Database className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-300">Details</span>
                      </div>
                      <pre className="text-xs text-slate-400 overflow-x-auto">
                        {JSON.stringify(diagnostic.details, null, 2)}
                      </pre>
                    </div>
                    <div className="flex items-center space-x-2 mt-3 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(diagnostic.timestamp).toLocaleString()}</span>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common diagnostic and troubleshooting actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link
                href="/ai-hub"
                className="p-4 bg-gradient-to-br from-purple-600/40 to-blue-600/40 rounded-lg border-2 border-purple-400/50 hover:border-purple-400/70 transition-all"
              >
                <Brain className="w-6 h-6 text-purple-300 mb-2" />
                <h3 className="font-semibold text-purple-200 mb-1">AI Hub</h3>
                <p className="text-sm text-purple-100/80">Manage AI providers and configuration</p>
              </Link>
              
              <Link
                href="/system-admin"
                className="p-4 bg-gradient-to-br from-blue-600/40 to-indigo-600/40 rounded-lg border-2 border-blue-400/50 hover:border-blue-400/70 transition-all"
              >
                <Activity className="w-6 h-6 text-blue-300 mb-2" />
                <h3 className="font-semibold text-blue-200 mb-1">System Admin</h3>
                <p className="text-sm text-blue-100/80">View logs and system tests</p>
              </Link>
              
              <Link
                href="/device-config"
                className="p-4 bg-gradient-to-br from-green-600/40 to-teal-600/40 rounded-lg border-2 border-green-400/50 hover:border-green-400/70 transition-all"
              >
                <Cpu className="w-6 h-6 text-green-300 mb-2" />
                <h3 className="font-semibold text-green-200 mb-1">Device Config</h3>
                <p className="text-sm text-green-100/80">Configure devices and connections</p>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
