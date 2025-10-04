
'use client'

import { useState, useEffect } from 'react'
import { Activity, AlertTriangle, CheckCircle, TrendingUp, Zap, Clock, Database, Cpu, HardDrive, RefreshCw, Play, Wrench, ArrowLeft, MessageSquare, BarChart3, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Badge } from '@/components/ui/badge'
import DiagnosticsChatbot from '@/components/DiagnosticsChatbot'
import HealthMetricsChart from '@/components/HealthCharts/HealthMetricsChart'
import IssueFrequencyChart from '@/components/HealthCharts/IssueFrequencyChart'
import FixSuccessChart from '@/components/HealthCharts/FixSuccessChart'
import UptimeGauge from '@/components/HealthCharts/UptimeGauge'
import { useDiagnostics } from '@/lib/useDiagnostics'

export default function DiagnosticsPage() {
  const { 
    status, 
    isLoading, 
    error, 
    refresh,
    runLightCheck,
    runDeepDiagnostics,
    runSelfHeal,
    isRunningCheck,
    isRunningDeep,
    isRunningHeal
  } = useDiagnostics()

  const [activeTab, setActiveTab] = useState('overview')

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-500'
      case 'warning': return 'text-yellow-500'
      case 'critical': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const getHealthBg = (health: string) => {
    switch (health) {
      case 'healthy': return 'bg-green-500/20 border-green-500/50'
      case 'warning': return 'bg-yellow-500/20 border-yellow-500/50'
      case 'critical': return 'bg-red-500/20 border-red-500/50'
      default: return 'bg-gray-500/20 border-gray-500/50'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-sports-gradient">
      <header className="sports-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link 
                href="/"
                className="p-2 rounded-lg bg-sportsBar-700/50 hover:bg-sportsBar-600/50 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-slate-200" />
              </Link>
              <div className="bg-primary-gradient rounded-xl p-2.5 shadow-lg">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100">System Diagnostics</h1>
                <p className="text-sm text-slate-300">AI-Powered Health Monitoring & Self-Healing</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={refresh}
                disabled={isLoading}
                className="p-2 rounded-lg bg-sportsBar-700/50 hover:bg-sportsBar-600/50 transition-colors"
              >
                <RefreshCw className={`h-5 w-5 text-slate-200 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-200">{error}</span>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-sportsBar-800/50 p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="chatbot" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <MessageSquare className="w-4 h-4 mr-2" />
              AI Assistant
            </TabsTrigger>
            <TabsTrigger value="details" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Activity className="w-4 h-4 mr-2" />
              Details
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* System Health Status */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className={`border-2 ${getHealthBg(status?.overallHealth || 'unknown')}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-300">Overall Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className={`text-3xl font-bold ${getHealthColor(status?.overallHealth || 'unknown')}`}>
                      {status?.overallHealth?.toUpperCase() || 'UNKNOWN'}
                    </div>
                    {status?.overallHealth === 'healthy' ? (
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    ) : status?.overallHealth === 'warning' ? (
                      <AlertTriangle className="w-8 h-8 text-yellow-500" />
                    ) : (
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-300">Active Issues</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-3xl font-bold text-slate-100">
                      {status?.activeIssues || 0}
                    </div>
                    <AlertTriangle className="w-8 h-8 text-orange-400" />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    {status?.criticalIssues || 0} critical
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-300">Recent Fixes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-3xl font-bold text-slate-100">
                      {status?.recentFixes || 0}
                    </div>
                    <Wrench className="w-8 h-8 text-blue-400" />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Last 24 hours
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-300">Uptime</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-3xl font-bold text-green-400">
                      {status?.uptime ? `${status.uptime.toFixed(2)}%` : 'N/A'}
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-400" />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Last 7 days
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Manual Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  <span>Manual Diagnostics</span>
                </CardTitle>
                <CardDescription>Run diagnostics and self-healing operations manually</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={runLightCheck}
                    disabled={isRunningCheck}
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    {isRunningCheck ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Running...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Light Check</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={runDeepDiagnostics}
                    disabled={isRunningDeep}
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    {isRunningDeep ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Running...</span>
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4" />
                        <span>Deep Diagnostics</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={runSelfHeal}
                    disabled={isRunningHeal}
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    {isRunningHeal ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Healing...</span>
                      </>
                    ) : (
                      <>
                        <Wrench className="w-4 h-4" />
                        <span>Self-Heal</span>
                      </>
                    )}
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <HealthMetricsChart />
              <IssueFrequencyChart />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FixSuccessChart />
              <UptimeGauge uptime={status?.uptime || 0} />
            </div>

            {/* Component Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Cpu className="w-5 h-5 text-blue-400" />
                  <span>Component Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {status?.components?.map((component: any, idx: number) => (
                    <div key={idx} className={`p-4 rounded-lg border-2 ${getHealthBg(component.status)}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-slate-100">{component.name}</h3>
                        <Badge className={getSeverityColor(component.status)}>
                          {component.status}
                        </Badge>
                      </div>
                      {component.metrics && (
                        <div className="space-y-1 text-xs text-slate-300">
                          {Object.entries(component.metrics).map(([key, value]: [string, any]) => (
                            <div key={key} className="flex justify-between">
                              <span>{key}:</span>
                              <span className="font-mono">{value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Chatbot Tab */}
          <TabsContent value="chatbot" className="space-y-6">
            <DiagnosticsChatbot />
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-6">
            {/* Recent Health Checks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <span>Recent Health Checks</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {status?.recentChecks?.slice(0, 10).map((check: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {check.status === 'healthy' ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : check.status === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                        <div>
                          <div className="font-medium text-slate-100">{check.component}</div>
                          <div className="text-xs text-slate-400">
                            {new Date(check.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getSeverityColor(check.status)}>
                          {check.checkType}
                        </Badge>
                        {check.responseTime && (
                          <span className="text-xs text-slate-400">{check.responseTime}ms</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Active Issues */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-orange-400" />
                  <span>Active Issues</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {status?.issues?.filter((i: any) => i.status === 'open').map((issue: any, idx: number) => (
                    <div key={idx} className="p-4 bg-slate-800/50 rounded-lg border-l-4 border-orange-500">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-slate-100">{issue.title}</h3>
                          <p className="text-sm text-slate-300 mt-1">{issue.description}</p>
                        </div>
                        <Badge className={getSeverityColor(issue.severity)}>
                          {issue.severity}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-slate-400 mt-2">
                        <span>{issue.component}</span>
                        <span>•</span>
                        <span>{new Date(issue.timestamp).toLocaleString()}</span>
                        {issue.autoFixed && (
                          <>
                            <span>•</span>
                            <span className="text-green-400">Auto-fix attempted</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!status?.issues || status.issues.filter((i: any) => i.status === 'open').length === 0) && (
                    <div className="text-center py-8 text-slate-400">
                      <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                      <p>No active issues detected</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Fixes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Wrench className="w-5 h-5 text-blue-400" />
                  <span>Recent Fixes Applied</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {status?.fixes?.slice(0, 10).map((fix: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {fix.success ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                        <div>
                          <div className="font-medium text-slate-100">{fix.action}</div>
                          <div className="text-xs text-slate-400">
                            {new Date(fix.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={fix.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {fix.success ? 'Success' : 'Failed'}
                        </Badge>
                        {fix.duration && (
                          <span className="text-xs text-slate-400">{fix.duration}ms</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Learning Patterns */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                  <span>Learning Patterns</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {status?.patterns?.map((pattern: any, idx: number) => (
                    <div key={idx} className="p-4 bg-slate-800/50 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-slate-100">{pattern.patternType}</h3>
                          <p className="text-sm text-slate-300 mt-1">{pattern.description}</p>
                        </div>
                        <Badge className="bg-purple-100 text-purple-800">
                          {pattern.frequency}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-400 mt-2">
                        Occurrences: {pattern.occurrences}
                      </div>
                      {pattern.recommendation && (
                        <div className="mt-2 p-2 bg-blue-900/30 rounded text-xs text-blue-200">
                          💡 {pattern.recommendation}
                        </div>
                      )}
                    </div>
                  ))}
                  {(!status?.patterns || status.patterns.length === 0) && (
                    <div className="text-center py-8 text-slate-400">
                      <Database className="w-12 h-12 mx-auto mb-2" />
                      <p>No patterns identified yet</p>
                      <p className="text-xs mt-1">System is learning from diagnostics</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
