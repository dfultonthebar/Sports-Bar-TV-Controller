
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { logger } from '@sports-bar/logger'
import { 
  Zap, 
  TrendingUp, 
  Clock, 
  Target, 
  Settings,
  CheckCircle,
  AlertTriangle,
  Brain,
  Tv,
  Satellite,
  Radio,
  PlayCircle,
  RefreshCw
} from 'lucide-react'

interface OptimizationRule {
  id: string
  name: string
  description: string
  deviceTypes: string[]
  trigger: 'time' | 'usage' | 'event' | 'manual'
  action: string
  isActive: boolean
  priority: 'high' | 'medium' | 'low'
  lastExecuted?: Date
  successRate: number
}

interface AutomationSuggestion {
  type: 'schedule' | 'pattern' | 'optimization'
  title: string
  description: string
  estimatedBenefit: string
  complexity: 'low' | 'medium' | 'high'
  devices: string[]
  implementation: string
}

export default function SmartDeviceOptimizer() {
  const [optimizations, setOptimizations] = useState<OptimizationRule[]>([])
  const [suggestions, setSuggestions] = useState<AutomationSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('current')

  useEffect(() => {
    fetchOptimizations()
  }, [])

  const fetchOptimizations = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/devices/smart-optimizer')
      if (response.ok) {
        const data = await response.json()
        setOptimizations(data.optimizations || [])
        setSuggestions(data.suggestions || [])
      }
    } catch (error) {
      logger.error('Failed to fetch optimizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleOptimization = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch('/api/devices/smart-optimizer/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive })
      })
      
      if (response.ok) {
        setOptimizations(prev => 
          prev.map(opt => opt.id === id ? { ...opt, isActive } : opt)
        )
      }
    } catch (error) {
      logger.error('Failed to toggle optimization:', error)
    }
  }

  const implementSuggestion = async (suggestion: AutomationSuggestion) => {
    try {
      const response = await fetch('/api/devices/smart-optimizer/implement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suggestion)
      })
      
      if (response.ok) {
        // Refresh optimizations after implementing
        fetchOptimizations()
      }
    } catch (error) {
      logger.error('Failed to implement suggestion:', error)
    }
  }

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'DirectTV': return <Satellite className="w-4 h-4" />
      case 'Fire TV': return <Tv className="w-4 h-4" />
      case 'IR Device': return <Radio className="w-4 h-4" />
      default: return <Settings className="w-4 h-4" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-slate-800 or bg-slate-900 text-slate-100 border-slate-700'
    }
  }

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'high': return 'text-red-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading smart optimizations...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-600" />
            Smart Device Optimizer
          </h2>
          <p className="text-gray-600">AI-powered automation and optimization rules</p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'current' ? 'default' : 'outline'}
            onClick={() => setActiveTab('current')}
          >
            Current Rules
          </Button>
          <Button
            variant={activeTab === 'suggestions' ? 'default' : 'outline'}
            onClick={() => setActiveTab('suggestions')}
          >
            AI Suggestions
          </Button>
        </div>
      </div>

      {activeTab === 'current' && (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Rules</p>
                    <p className="text-2xl font-bold text-green-600">
                      {optimizations.filter(o => o.isActive).length}
                    </p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg Success Rate</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {Math.round(optimizations.reduce((acc, o) => acc + o.successRate, 0) / optimizations.length || 0)}%
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">High Priority</p>
                    <p className="text-2xl font-bold text-red-600">
                      {optimizations.filter(o => o.priority === 'high').length}
                    </p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Automated</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {optimizations.filter(o => o.trigger !== 'manual').length}
                    </p>
                  </div>
                  <Brain className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Optimization Rules */}
          <div className="space-y-4">
            {optimizations.map((rule) => (
              <Card key={rule.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {rule.deviceTypes.map(type => (
                          <div key={type} className="flex items-center gap-1">
                            {getDeviceIcon(type)}
                            <span className="text-xs">{type}</span>
                          </div>
                        ))}
                      </div>
                      <Badge className={getPriorityColor(rule.priority)}>
                        {rule.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400">
                        Success: {rule.successRate}%
                      </span>
                      <Button
                        size="sm"
                        variant={rule.isActive ? "default" : "outline"}
                        onClick={() => toggleOptimization(rule.id, !rule.isActive)}
                      >
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-lg">{rule.name}</CardTitle>
                  <CardDescription>{rule.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="bg-slate-800 or bg-slate-900 p-3 rounded-lg">
                      <p className="text-sm font-medium text-slate-100 mb-1">Action:</p>
                      <p className="text-sm text-slate-300">{rule.action}</p>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Target className="w-4 h-4" />
                          Trigger: {rule.trigger}
                        </span>
                        {rule.lastExecuted && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            Last: {rule.lastExecuted.toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'suggestions' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-blue-600" />
                AI-Generated Optimization Suggestions
              </CardTitle>
              <CardDescription>
                Smart recommendations based on usage patterns and system analysis
              </CardDescription>
            </CardHeader>
          </Card>
          
          <div className="space-y-4">
            {suggestions.map((suggestion, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {suggestion.type}
                      </Badge>
                      <Badge className={`${getComplexityColor(suggestion.complexity)} bg-transparent border`}>
                        {suggestion.complexity} complexity
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => implementSuggestion(suggestion)}
                      className="flex items-center gap-1"
                    >
                      <PlayCircle className="w-4 h-4" />
                      Implement
                    </Button>
                  </div>
                  <CardTitle className="text-lg">{suggestion.title}</CardTitle>
                  <CardDescription>{suggestion.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-green-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-green-800 mb-1">Estimated Benefit:</p>
                        <p className="text-sm text-green-700">{suggestion.estimatedBenefit}</p>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-blue-800 mb-1">Affected Devices:</p>
                        <div className="flex flex-wrap gap-1">
                          {suggestion.devices.map(device => (
                            <Badge key={device} variant="outline" className="text-xs">
                              {device}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-slate-800 or bg-slate-900 p-3 rounded-lg">
                      <p className="text-sm font-medium text-slate-100 mb-1">Implementation:</p>
                      <p className="text-sm text-slate-300">{suggestion.implementation}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
