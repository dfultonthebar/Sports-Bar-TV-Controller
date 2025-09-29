

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/cards'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Alert, AlertDescription } from './ui/alert'
import LogAnalyticsDashboard from './LogAnalyticsDashboard'
import EnhancedLogDownloadCenter from './EnhancedLogDownloadCenter'
import { 
  Database, 
  Brain, 
  Settings, 
  Download, 
  Activity, 
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Cpu,
  HardDrive,
  BarChart3,
  Eye,
  Search
} from 'lucide-react'

interface AISystemStatus {
  available: boolean
  capabilities: string[]
  lastCheck: string
  error?: string
}

interface SystemStats {
  totalLogs: number
  errorRate: number
  systemHealth: 'good' | 'warning' | 'critical'
  recentActivity: number
}

export default function LoggingManagementDashboard() {
  const [aiStatus, setAiStatus] = useState<AISystemStatus | null>(null)
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchSystemStatus()
  }, [])

  const fetchSystemStatus = async () => {
    try {
      setLoading(true)
      
      // Fetch AI system status
      const aiResponse = await fetch('/api/ai-system/status')
      const aiData = await aiResponse.json()
      setAiStatus(aiData.aiSystem)

      // Fetch system stats
      const statsResponse = await fetch('/api/logs/stats')
      const statsData = await statsResponse.json()
      setSystemStats(statsData)
      
    } catch (error) {
      console.error('Failed to fetch system status:', error)
    } finally {
      setLoading(false)
    }
  }

  const testAISystem = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/ai-system/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_analysis' })
      })
      
      const data = await response.json()
      
      if (data.success) {
        alert(`AI Test Successful!\nLogs Analyzed: ${data.testResults.logsAnalyzed}\nSeverity: ${data.testResults.analysis.severity}\nConfidence: ${(data.testResults.analysis.confidence * 100).toFixed(1)}%`)
      } else {
        alert(`AI Test Failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to test AI system:', error)
      alert('Failed to test AI system')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (available: boolean, error?: string) => {
    if (error) return <XCircle className="h-5 w-5 text-red-600" />
    if (available) return <CheckCircle className="h-5 w-5 text-green-600" />
    return <AlertTriangle className="h-5 w-5 text-yellow-600" />
  }

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'good': return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'critical': return <XCircle className="h-5 w-5 text-red-600" />
      default: return <Activity className="h-5 w-5 text-gray-600" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logging Management Center</h1>
          <p className="text-muted-foreground">
            Comprehensive logging, AI analysis, and system monitoring
          </p>
        </div>
        
        <Button 
          onClick={fetchSystemStatus} 
          variant="outline" 
          disabled={loading}
          className="min-w-[120px]"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Brain className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">AI System</p>
                <div className="flex items-center gap-2">
                  {aiStatus && getStatusIcon(aiStatus.available, aiStatus.error)}
                  <p className="text-lg font-bold">
                    {aiStatus?.available ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Database className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Logs</p>
                <p className="text-2xl font-bold">
                  {systemStats?.totalLogs.toLocaleString() || '0'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                <p className={`text-2xl font-bold ${
                  (systemStats?.errorRate || 0) > 10 ? 'text-red-600' : 
                  (systemStats?.errorRate || 0) > 5 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {systemStats?.errorRate.toFixed(1) || '0.0'}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              {systemStats && getHealthIcon(systemStats.systemHealth)}
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">System Health</p>
                <Badge 
                  variant={
                    systemStats?.systemHealth === 'good' ? 'default' :
                    systemStats?.systemHealth === 'warning' ? 'secondary' : 'destructive'
                  }
                  className="text-lg font-bold"
                >
                  {systemStats?.systemHealth || 'unknown'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI System Status */}
      {aiStatus && (
        <Card className={
          aiStatus.available 
            ? "border-green-200 bg-green-50/50" 
            : aiStatus.error 
              ? "border-red-200 bg-red-50/50"
              : "border-yellow-200 bg-yellow-50/50"
        }>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Local AI Analysis System
              {aiStatus.available && <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {aiStatus.available ? (
                <div>
                  <p className="text-sm text-green-800 mb-3">
                    ✅ Local AI system is operational and ready for log analysis
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Available Capabilities:</h4>
                      <div className="space-y-1">
                        {aiStatus.capabilities.map((capability, index) => (
                          <Badge key={index} variant="secondary" className="mr-2 mb-1">
                            {capability}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button onClick={testAISystem} variant="outline" disabled={loading}>
                        <Cpu className="mr-2 h-4 w-4" />
                        Test AI Analysis
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {aiStatus.error 
                      ? `AI System Error: ${aiStatus.error}`
                      : 'Local AI system is not available. Install Python 3.11+ and run setup script to enable AI-powered log analysis.'
                    }
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="download" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Eye className="mr-2 h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => setActiveTab('analytics')}
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    View Analytics
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => setActiveTab('download')}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Logs
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => {
                      window.open('/api/logs/config-tracking', '_blank')
                    }}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Config Changes
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => {
                      window.open('/api/logs/channel-guide-tracking', '_blank')
                    }}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Guide Usage
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <HardDrive className="mr-2 h-5 w-5" />
                  System Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Updated:</span>
                    <span>{new Date().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recent Activity:</span>
                    <span>{systemStats?.recentActivity || 0} events/hour</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">AI Analysis:</span>
                    <span>{aiStatus?.available ? 'Enabled' : 'Disabled'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Log Categories:</span>
                    <span>7 active</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Alert>
            <Activity className="h-4 w-4" />
            <AlertDescription>
              🚀 Enhanced logging system is active! All user interactions, configuration changes, 
              and device operations are being tracked with AI-powered analysis capabilities.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <LogAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="download" className="mt-6">
          <EnhancedLogDownloadCenter />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Logging Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Enhanced Logging</p>
                      <p className="text-sm text-muted-foreground">Track all user interactions</p>
                    </div>
                    <Badge variant="default" className="bg-green-100 text-green-800">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">AI Analysis</p>
                      <p className="text-sm text-muted-foreground">Local AI-powered insights</p>
                    </div>
                    <Badge variant={aiStatus?.available ? "default" : "secondary"}>
                      {aiStatus?.available ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Configuration Tracking</p>
                      <p className="text-sm text-muted-foreground">Monitor system changes</p>
                    </div>
                    <Badge variant="default" className="bg-green-100 text-green-800">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Channel Guide Monitoring</p>
                      <p className="text-sm text-muted-foreground">Track content usage</p>
                    </div>
                    <Badge variant="default" className="bg-green-100 text-green-800">Enabled</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Maintenance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh System Status
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <HardDrive className="mr-2 h-4 w-4" />
                    Clean Old Logs
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Cpu className="mr-2 h-4 w-4" />
                    Test AI System
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Database className="mr-2 h-4 w-4" />
                    Export All Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
