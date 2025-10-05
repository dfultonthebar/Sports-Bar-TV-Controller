'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { 
  Activity, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  Loader2,
  Play,
  RefreshCw,
  Database,
  Cpu,
  HardDrive,
  Network,
  Brain,
  FileText,
  BarChart3
} from 'lucide-react'

interface DiagnosticCheck {
  name: string
  category: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: any
  timestamp: string
}

interface DiagnosticResult {
  success: boolean
  overallHealth: 'healthy' | 'warning' | 'critical'
  healthScore: number
  summary: {
    total: number
    passed: number
    failed: number
    warnings: number
  }
  diagnostics: DiagnosticCheck[]
  executionTime: string
  timestamp: string
}

const categoryIcons: Record<string, any> = {
  infrastructure: Database,
  ai_system: Brain,
  hardware: Cpu,
  configuration: HardDrive,
  monitoring: BarChart3,
  network: Network
}

export default function AIDiagnosticRunner() {
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<DiagnosticResult | null>(null)
  const [selectedChecks, setSelectedChecks] = useState<string[]>(['all'])
  const [showDetails, setShowDetails] = useState(false)

  const availableChecks = [
    { id: 'all', label: 'All Checks', description: 'Run all diagnostic checks' },
    { id: 'database', label: 'Database', description: 'Check database connectivity' },
    { id: 'ai_providers', label: 'AI Providers', description: 'Check AI provider status' },
    { id: 'matrix_inputs', label: 'Matrix Inputs', description: 'Check Wolf Pack matrix inputs' },
    { id: 'ir_devices', label: 'IR Devices', description: 'Check IR device configuration' },
    { id: 'device_mapping', label: 'Device Mapping', description: 'Check input-to-device mapping' },
    { id: 'knowledge_base', label: 'Knowledge Base', description: 'Check AI knowledge base' },
    { id: 'system_logs', label: 'System Logs', description: 'Analyze recent system logs' },
    { id: 'api_health', label: 'API Health', description: 'Check critical API endpoints' }
  ]

  const runDiagnostics = async () => {
    setIsRunning(true)
    try {
      const response = await fetch('/api/ai/run-diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checks: selectedChecks,
          detailed: showDetails
        })
      })

      if (response.ok) {
        const data = await response.json()
        setResult(data)
      } else {
        console.error('Diagnostics failed:', response.statusText)
      }
    } catch (error) {
      console.error('Error running diagnostics:', error)
    } finally {
      setIsRunning(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-400" />
      default:
        return <Activity className="w-5 h-5 text-slate-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass':
      case 'healthy':
        return 'text-green-400 bg-green-900/30 border-green-500/50'
      case 'warning':
        return 'text-yellow-400 bg-yellow-900/30 border-yellow-500/50'
      case 'fail':
      case 'critical':
        return 'text-red-400 bg-red-900/30 border-red-500/50'
      default:
        return 'text-slate-400 bg-slate-900/30 border-slate-500/50'
    }
  }

  const getCategoryIcon = (category: string) => {
    const IconComponent = categoryIcons[category] || Activity
    return <IconComponent className="w-4 h-4" />
  }

  const toggleCheck = (checkId: string) => {
    if (checkId === 'all') {
      setSelectedChecks(['all'])
    } else {
      const newChecks = selectedChecks.filter(c => c !== 'all')
      if (selectedChecks.includes(checkId)) {
        const filtered = newChecks.filter(c => c !== checkId)
        setSelectedChecks(filtered.length > 0 ? filtered : ['all'])
      } else {
        setSelectedChecks([...newChecks, checkId])
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-blue-400" />
                <span>AI Diagnostic Runner</span>
              </CardTitle>
              <CardDescription>
                Run comprehensive system diagnostics to check health and identify issues
              </CardDescription>
            </div>
            <Button
              onClick={runDiagnostics}
              disabled={isRunning}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Diagnostics
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Check Selection */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Select Diagnostic Checks
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {availableChecks.map(check => (
                  <button
                    key={check.id}
                    onClick={() => toggleCheck(check.id)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      selectedChecks.includes(check.id) || selectedChecks.includes('all')
                        ? 'border-blue-500 bg-blue-900/30'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="font-medium text-sm text-slate-200">{check.label}</div>
                    <div className="text-xs text-slate-400 mt-1">{check.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDetails}
                  onChange={(e) => setShowDetails(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-300">Show detailed information</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Diagnostic Results</span>
                <Badge className={getStatusColor(result.overallHealth)}>
                  {result.overallHealth.toUpperCase()}
                </Badge>
              </CardTitle>
              <CardDescription>
                Completed in {result.executionTime} • {new Date(result.timestamp).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="text-3xl font-bold text-slate-100">{result.healthScore}%</div>
                  <div className="text-sm text-slate-400 mt-1">Health Score</div>
                </div>
                <div className="p-4 bg-green-900/30 rounded-lg border border-green-500/50">
                  <div className="flex items-center space-x-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-2xl font-bold text-green-300">{result.summary.passed}</span>
                  </div>
                  <div className="text-sm text-green-200">Passed</div>
                </div>
                <div className="p-4 bg-yellow-900/30 rounded-lg border border-yellow-500/50">
                  <div className="flex items-center space-x-2 mb-1">
                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                    <span className="text-2xl font-bold text-yellow-300">{result.summary.warnings}</span>
                  </div>
                  <div className="text-sm text-yellow-200">Warnings</div>
                </div>
                <div className="p-4 bg-red-900/30 rounded-lg border border-red-500/50">
                  <div className="flex items-center space-x-2 mb-1">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span className="text-2xl font-bold text-red-300">{result.summary.failed}</span>
                  </div>
                  <div className="text-sm text-red-200">Failed</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Results */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-100">Detailed Checks</h3>
            {result.diagnostics.map((check, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(check.status)}
                      <div>
                        <CardTitle className="text-base flex items-center space-x-2">
                          {getCategoryIcon(check.category)}
                          <span>{check.name}</span>
                        </CardTitle>
                        <CardDescription>{check.message}</CardDescription>
                      </div>
                    </div>
                    <Badge className={getStatusColor(check.status)}>
                      {check.status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                {check.details && (
                  <CardContent>
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                      <div className="flex items-center space-x-2 mb-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-300">Details</span>
                      </div>
                      <pre className="text-xs text-slate-400 overflow-x-auto">
                        {JSON.stringify(check.details, null, 2)}
                      </pre>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {!result && !isRunning && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">
                No diagnostics run yet
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                Select the checks you want to run and click "Run Diagnostics" to begin
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
