
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { 
  AlertTriangle, 
  Brain, 
  CheckCircle, 
  Settings, 
  Zap,
  RefreshCw,
  Bug,
  Wrench,
  TrendingUp,
  Clock,
  Target
} from 'lucide-react'

interface DiagnosticResult {
  deviceId: string
  deviceName: string
  deviceType: 'directv' | 'firetv' | 'ir'
  issues: Issue[]
  overallHealth: number
  lastChecked: Date
  recommendedActions: RecommendedAction[]
}

interface Issue {
  id: string
  type: 'connection' | 'performance' | 'configuration' | 'hardware'
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  possibleCauses: string[]
  aiConfidence: number
}

interface RecommendedAction {
  id: string
  title: string
  description: string
  complexity: 'simple' | 'moderate' | 'complex'
  estimatedTime: string
  successProbability: number
  automated: boolean
  steps: string[]
}

interface TroubleshootingSession {
  id: string
  deviceId: string
  startTime: Date
  status: 'running' | 'completed' | 'failed'
  progress: number
  currentStep: string
  results?: DiagnosticResult
}

export default function IntelligentTroubleshooter() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [activeSession, setActiveSession] = useState<TroubleshootingSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<string>('all')

  const runDiagnostics = async (deviceId?: string) => {
    setLoading(true)
    
    const sessionId = `session_${Date.now()}`
    const session: TroubleshootingSession = {
      id: sessionId,
      deviceId: deviceId || 'all',
      startTime: new Date(),
      status: 'running',
      progress: 0,
      currentStep: 'Initializing AI diagnostics...'
    }
    
    setActiveSession(session)

    try {
      // Simulate progressive diagnostic steps
      const steps = [
        'Scanning device connectivity...',
        'Analyzing performance metrics...',
        'Checking configuration settings...',
        'Testing command response times...',
        'Evaluating network stability...',
        'Running AI pattern analysis...',
        'Generating recommendations...'
      ]

      for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        setActiveSession(prev => prev ? {
          ...prev,
          progress: Math.round(((i + 1) / steps.length) * 100),
          currentStep: steps[i]
        } : null)
      }

      const response = await fetch('/api/devices/intelligent-diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: deviceId || selectedDevice })
      })

      if (response.ok) {
        const data = await response.json()
        setDiagnostics(data.diagnostics || [])
        
        setActiveSession(prev => prev ? {
          ...prev,
          status: 'completed',
          progress: 100,
          currentStep: 'Diagnostics complete',
          results: data.diagnostics[0]
        } : null)
      }
    } catch (error) {
      console.error('Diagnostics failed:', error)
      setActiveSession(prev => prev ? {
        ...prev,
        status: 'failed',
        currentStep: 'Diagnostics failed'
      } : null)
    } finally {
      setLoading(false)
    }
  }

  const executeAction = async (action: RecommendedAction, deviceId: string) => {
    try {
      const response = await fetch('/api/devices/execute-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId: action.id, deviceId })
      })

      if (response.ok) {
        // Refresh diagnostics after executing action
        runDiagnostics(deviceId)
      }
    } catch (error) {
      console.error('Action execution failed:', error)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-slate-800 or bg-slate-900 text-slate-100 border-slate-700'
    }
  }

  const getHealthColor = (health: number) => {
    if (health >= 90) return 'text-green-600'
    if (health >= 70) return 'text-yellow-600'
    if (health >= 50) return 'text-orange-600'
    return 'text-red-600'
  }

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple': return 'text-green-600'
      case 'moderate': return 'text-yellow-600'
      case 'complex': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-600" />
            Intelligent Troubleshooter
          </h2>
          <p className="text-gray-600">AI-powered device diagnostics and repair</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">All Devices</option>
            <option value="directv">DirecTV Only</option>
            <option value="firetv">Fire TV Only</option>
            <option value="ir">IR Devices Only</option>
          </select>
          
          <Button
            onClick={() => runDiagnostics()}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Bug className="w-4 h-4" />
            )}
            Run Diagnostics
          </Button>
        </div>
      </div>

      {/* Active Session */}
      {activeSession && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 animate-spin" />
              Diagnostic Session Active
            </CardTitle>
            <CardDescription>
              Session ID: {activeSession.id}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">{activeSession.currentStep}</span>
                <span className="text-sm font-medium">{activeSession.progress}%</span>
              </div>
              <div className="w-full bg-slate-800 or bg-slate-900 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${activeSession.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Started: {activeSession.startTime.toLocaleTimeString()}</span>
                <Badge className={
                  activeSession.status === 'completed' ? 'bg-green-100 text-green-800' :
                  activeSession.status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-blue-100 text-blue-800'
                }>
                  {activeSession.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diagnostics Results */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="issues">Issues Found</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {diagnostics.map((diagnostic) => (
              <Card key={diagnostic.deviceId} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{diagnostic.deviceName}</CardTitle>
                    <Badge variant="outline" className="capitalize">
                      {diagnostic.deviceType}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Overall Health</span>
                    <span className={`font-bold text-lg ${getHealthColor(diagnostic.overallHealth)}`}>
                      {diagnostic.overallHealth}%
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>Issues Found:</span>
                      <span className="font-medium">{diagnostic.issues.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Critical:</span>
                      <span className="font-medium text-red-600">
                        {diagnostic.issues.filter(i => i.severity === 'critical').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Last Checked:</span>
                      <span className="text-xs">{diagnostic.lastChecked.toLocaleTimeString()}</span>
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => runDiagnostics(diagnostic.deviceId)}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Re-scan
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          {diagnostics.map((diagnostic) => (
            diagnostic.issues.length > 0 && (
              <Card key={`issues-${diagnostic.deviceId}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    {diagnostic.deviceName} - Issues Detected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {diagnostic.issues.map((issue) => (
                      <div key={issue.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{issue.title}</h4>
                          <div className="flex items-center gap-2">
                            <Badge className={getSeverityColor(issue.severity)}>
                              {issue.severity}
                            </Badge>
                            <span className="text-xs text-slate-400">
                              {Math.round(issue.aiConfidence * 100)}% confidence
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-300 mb-3">{issue.description}</p>
                        <div className="bg-slate-800 or bg-slate-900 p-3 rounded">
                          <p className="text-xs font-medium text-slate-100 mb-1">Possible Causes:</p>
                          <ul className="text-xs text-slate-400 list-disc list-inside">
                            {issue.possibleCauses.map((cause, index) => (
                              <li key={index}>{cause}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          ))}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          {diagnostics.map((diagnostic) => (
            diagnostic.recommendedActions.length > 0 && (
              <Card key={`actions-${diagnostic.deviceId}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-600" />
                    {diagnostic.deviceName} - Recommended Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {diagnostic.recommendedActions.map((action) => (
                      <div key={action.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{action.title}</h4>
                          <div className="flex items-center gap-2">
                            <Badge className={`${getComplexityColor(action.complexity)} bg-transparent border`}>
                              {action.complexity}
                            </Badge>
                            {action.automated && (
                              <Badge className="bg-blue-100 text-blue-800">
                                <Zap className="w-3 h-3 mr-1" />
                                Auto
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-slate-300 mb-3">{action.description}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                          <div className="bg-slate-800 or bg-slate-900 p-2 rounded text-sm">
                            <span className="font-medium">Time:</span> {action.estimatedTime}
                          </div>
                          <div className="bg-green-50 p-2 rounded text-sm">
                            <span className="font-medium">Success Rate:</span> {action.successProbability}%
                          </div>
                        </div>

                        <div className="bg-blue-50 p-3 rounded mb-3">
                          <p className="text-xs font-medium text-blue-800 mb-1">Steps:</p>
                          <ol className="text-xs text-blue-700 list-decimal list-inside space-y-1">
                            {action.steps.map((step, index) => (
                              <li key={index}>{step}</li>
                            ))}
                          </ol>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => executeAction(action, diagnostic.deviceId)}
                          className="w-full"
                        >
                          <Wrench className="w-3 h-3 mr-1" />
                          {action.automated ? 'Execute Automatically' : 'Start Manual Process'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          ))}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-600" />
                Diagnostic History
              </CardTitle>
              <CardDescription>
                Recent troubleshooting sessions and their outcomes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-slate-400">
                <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Diagnostic history will appear here</p>
                <p className="text-sm">Run diagnostics to start building history</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
