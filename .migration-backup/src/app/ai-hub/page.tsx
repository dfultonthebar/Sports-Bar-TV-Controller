
'use client'

import { useState, useEffect } from 'react'
import { Brain, MessageSquare, Cpu, Settings as SettingsIcon, Key, RefreshCw, Database, FileCode, CheckCircle, AlertCircle, Loader2, Bot, ArrowLeft, Activity, GraduationCap, Workflow } from 'lucide-react'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ApiKeysManager from '@/components/ApiKeysManager'
import DeviceAIAssistant from '@/components/DeviceAIAssistant'
import SmartDeviceOptimizer from '@/components/SmartDeviceOptimizer'
import IntelligentTroubleshooter from '@/components/IntelligentTroubleshooter'
import AITeachingInterface from '@/components/AITeachingInterface'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Badge } from '@/components/ui/badge'

interface IndexStats {
  totalFiles: number
  indexed: number
  updated: number
  skipped: number
  deactivated: number
}

interface CodebaseStats {
  totalFiles: number
  totalSize: number
  filesByType: Array<{ type: string; count: number }>
  lastIndexed?: string
}

interface ServiceStatus {
  name: string
  endpoint: string
  status: 'active' | 'inactive' | 'error'
  model?: string
  responseTime?: number
}

interface CloudService {
  name: string
  hasKey: boolean
}

interface AIProvidersStatus {
  localServices: ServiceStatus[]
  cloudServices: CloudService[]
  total: number
  active: number
}

export default function AIHubPage() {
  // AI Assistant state
  const [isIndexing, setIsIndexing] = useState(false)
  const [indexProgress, setIndexProgress] = useState<IndexStats | null>(null)
  const [codebaseStats, setCodebaseStats] = useState<CodebaseStats | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [chatMessage, setChatMessage] = useState('')
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [isChatting, setIsChatting] = useState(false)

  // AI Configuration state
  const [providersStatus, setProvidersStatus] = useState<AIProvidersStatus | null>(null)
  const [isLoadingProviders, setIsLoadingProviders] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // AI Enhanced Devices state
  const [activeDevices] = useState({
    directv: 3,
    firetv: 2,
    ir: 5
  })

  const [systemStats] = useState({
    totalOptimizations: 12,
    activeAlerts: 4,
    avgHealthScore: 87,
    aiUptime: 99.2
  })

  useEffect(() => {
    loadCodebaseStats()
    testProviders()
  }, [])

  const loadCodebaseStats = async () => {
    try {
      const response = await fetch('/api/ai-assistant/index-codebase')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setCodebaseStats(data.stats)
        }
      }
    } catch (error) {
      console.error('Error loading codebase stats:', error)
    }
  }

  const handleIndexCodebase = async () => {
    setIsIndexing(true)
    setMessage(null)
    setIndexProgress(null)

    try {
      const response = await fetch('/api/ai-assistant/index-codebase', {
        method: 'POST'
      })

      const data = await response.json()

      if (data.success) {
        setIndexProgress(data.stats)
        setMessage({
          type: 'success',
          text: `Successfully indexed ${data.stats.indexed} new files, updated ${data.stats.updated} files`
        })
        await loadCodebaseStats()
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to index codebase'
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error indexing codebase: ' + (error instanceof Error ? error.message : 'Unknown error')
      })
    } finally {
      setIsIndexing(false)
    }
  }

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || isChatting) return

    const userMessage = chatMessage.trim()
    setChatMessage('')
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }])
    setIsChatting(true)

    try {
      const response = await fetch('/api/ai/enhanced-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          useKnowledge: true,
          useCodebase: true,
          stream: false  // CRITICAL FIX: Explicitly request non-streaming response
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.response) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: data.response }])
      } else if (data.error) {
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: `Error: ${data.error}${data.message ? '\n\n' + data.message : ''}${data.suggestion ? '\n\nSuggestion: ' + data.suggestion : ''}` 
        }])
      } else {
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error processing your request.' 
        }])
      }
    } catch (error) {
      console.error('Chat error:', error)
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: 'Error: ' + (error instanceof Error ? error.message : 'Unknown error')
      }])
    } finally {
      setIsChatting(false)
    }
  }

  const testProviders = async () => {
    try {
      const response = await fetch('/api/ai-providers/test')
      if (response.ok) {
        const data = await response.json()
        setProvidersStatus(data)
      }
    } catch (error) {
      console.error('Error testing AI providers:', error)
    } finally {
      setIsLoadingProviders(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    testProviders()
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'inactive':
        return <AlertCircle className="w-4 h-4 text-slate-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
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
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100">AI Hub</h1>
                <p className="text-sm text-slate-300">Unified AI Management & Configuration</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions Section */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            href="/ai-diagnostics"
            className="p-4 bg-gradient-to-br from-blue-600/40 to-purple-600/40 rounded-xl border-2 border-blue-400/50 hover:border-blue-400/70 hover:from-blue-600/50 hover:to-purple-600/50 transition-all duration-200 shadow-lg"
          >
            <div className="flex items-center space-x-3 mb-2">
              <Activity className="w-6 h-6 text-blue-300" />
              <h3 className="font-bold text-blue-200">AI System Diagnostics</h3>
            </div>
            <p className="text-blue-100/90 text-sm">Run comprehensive AI system health checks and monitor performance</p>
          </Link>

          <div className="p-4 bg-gradient-to-br from-green-600/40 to-teal-600/40 rounded-xl border-2 border-green-400/50">
            <div className="flex items-center space-x-3 mb-2">
              <CheckCircle className="w-6 h-6 text-green-300" />
              <h3 className="font-bold text-green-200">System Status</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-green-100/70">Active Devices</div>
                <div className="text-xl font-bold text-green-200">{activeDevices.directv + activeDevices.firetv + activeDevices.ir}</div>
              </div>
              <div>
                <div className="text-green-100/70">Health Score</div>
                <div className="text-xl font-bold text-green-200">{systemStats.avgHealthScore}%</div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gradient-to-br from-purple-600/40 to-pink-600/40 rounded-xl border-2 border-purple-400/50">
            <div className="flex items-center space-x-3 mb-2">
              <Brain className="w-6 h-6 text-purple-300" />
              <h3 className="font-bold text-purple-200">AI Performance</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-purple-100/70">Optimizations</div>
                <div className="text-xl font-bold text-purple-200">{systemStats.totalOptimizations}</div>
              </div>
              <div>
                <div className="text-purple-100/70">Uptime</div>
                <div className="text-xl font-bold text-purple-200">{systemStats.aiUptime}%</div>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="assistant" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-sportsBar-800/50 p-1">
            <TabsTrigger value="assistant" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <MessageSquare className="w-4 h-4 mr-2" />
              AI Assistant
            </TabsTrigger>
            <TabsTrigger value="teach" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <GraduationCap className="w-4 h-4 mr-2" />
              Teach AI
            </TabsTrigger>
            <TabsTrigger value="devices" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Cpu className="w-4 h-4 mr-2" />
              Enhanced Devices
            </TabsTrigger>
            <TabsTrigger value="n8n" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Workflow className="w-4 h-4 mr-2" />
              n8n
            </TabsTrigger>
            <TabsTrigger value="configuration" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <SettingsIcon className="w-4 h-4 mr-2" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="keys" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Key className="w-4 h-4 mr-2" />
              API Keys
            </TabsTrigger>
          </TabsList>

          {/* AI Assistant Tab */}
          <TabsContent value="assistant" className="space-y-6">
            {/* Codebase Index Status */}
            <div className="card">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <Database className="w-6 h-6 text-blue-400" />
                    <h2 className="text-xl font-bold text-slate-100">Codebase Index</h2>
                  </div>
                  <button
                    onClick={handleIndexCodebase}
                    disabled={isIndexing}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    {isIndexing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Indexing...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>Sync Codebase</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Status Message */}
                {message && (
                  <div className={`mb-4 p-4 rounded-lg flex items-center space-x-2 ${
                    message.type === 'success' 
                      ? 'bg-green-900/30 border border-green-500/50' 
                      : 'bg-red-900/30 border border-red-500/50'
                  }`}>
                    {message.type === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    )}
                    <span className={message.type === 'success' ? 'text-green-200' : 'text-red-200'}>
                      {message.text}
                    </span>
                  </div>
                )}

                {/* Index Progress */}
                {indexProgress && (
                  <div className="mb-4 p-4 bg-slate-800/50 rounded-lg">
                    <h3 className="text-sm font-semibold text-slate-300 mb-2">Indexing Results:</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-2xl font-bold text-green-400">{indexProgress.indexed}</div>
                        <div className="text-xs text-slate-400">New Files</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-400">{indexProgress.updated}</div>
                        <div className="text-xs text-slate-400">Updated</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-yellow-400">{indexProgress.skipped}</div>
                        <div className="text-xs text-slate-400">Unchanged</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-400">{indexProgress.deactivated}</div>
                        <div className="text-xs text-slate-400">Removed</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Codebase Stats */}
                {codebaseStats && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <FileCode className="w-5 h-5 text-blue-400" />
                        <span className="text-sm text-slate-300">Total Files</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-100">{codebaseStats.totalFiles}</div>
                    </div>
                    
                    <div className="p-4 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <Database className="w-5 h-5 text-purple-400" />
                        <span className="text-sm text-slate-300">Total Size</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-100">{formatBytes(codebaseStats.totalSize)}</div>
                    </div>
                    
                    <div className="p-4 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <span className="text-sm text-slate-300">Last Indexed</span>
                      </div>
                      <div className="text-sm text-slate-100">
                        {codebaseStats.lastIndexed 
                          ? new Date(codebaseStats.lastIndexed).toLocaleString()
                          : 'Never'
                        }
                      </div>
                    </div>
                  </div>
                )}

                {/* File Types Breakdown */}
                {codebaseStats && codebaseStats.filesByType.length > 0 && (
                  <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Files by Type:</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {codebaseStats.filesByType.map(ft => (
                        <div key={ft.type} className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                          <span className="text-xs text-slate-300">{ft.type}</span>
                          <span className="text-sm font-bold text-slate-100">{ft.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AI Chat Interface */}
            <div className="card">
              <div className="p-6">
                <h2 className="text-xl font-bold text-slate-100 mb-4">Ask About Your Codebase</h2>
                
                {/* Chat History */}
                <div className="mb-4 h-96 overflow-y-auto bg-slate-800/50 rounded-lg p-4 space-y-4">
                  {chatHistory.length === 0 ? (
                    <div className="text-center text-slate-400 py-8">
                      <p>Ask me anything about your codebase!</p>
                      <p className="text-sm mt-2">I have access to all your source files and can help with troubleshooting.</p>
                    </div>
                  ) : (
                    chatHistory.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-3xl p-3 rounded-lg ${
                          msg.role === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-slate-700 text-slate-100'
                        }`}>
                          <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                        </div>
                      </div>
                    ))
                  )}
                  {isChatting && (
                    <div className="flex justify-start">
                      <div className="bg-slate-700 text-slate-100 p-3 rounded-lg">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask about your code, troubleshoot issues, or request help..."
                    className="flex-1 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    disabled={isChatting}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isChatting || !chatMessage.trim()}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Teach AI Tab */}
          <TabsContent value="teach" className="space-y-6">
            <AITeachingInterface />
          </TabsContent>

          {/* AI Enhanced Devices Tab */}
          <TabsContent value="devices" className="space-y-6">
            <DeviceAIAssistant />
          </TabsContent>

          {/* AI Configuration Tab */}
          <TabsContent value="configuration" className="space-y-6">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <SettingsIcon className="w-6 h-6 text-purple-400" />
                  <div>
                    <h2 className="text-xl font-bold text-slate-100">AI Providers Configuration</h2>
                    <p className="text-sm text-slate-300">Test and configure available AI services</p>
                  </div>
                </div>

                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Bot className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Testing...' : 'Refresh Status'}</span>
                </button>
              </div>

              {/* Status Overview */}
              {providersStatus && (
                <div className="bg-sportsBar-800/10 backdrop-blur-sm rounded-lg p-4 mb-6 border border-slate-700/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">{providersStatus.active}</div>
                        <div className="text-sm text-blue-200">Active Local</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">{providersStatus.cloudServices.filter(s => s.hasKey).length}</div>
                        <div className="text-sm text-blue-200">Cloud APIs</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-slate-500">{providersStatus.total - providersStatus.active}</div>
                        <div className="text-sm text-blue-200">Inactive</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Diagnostics Link */}
              <Link 
                href="/ai-diagnostics"
                className="block mb-6 p-4 bg-gradient-to-br from-blue-600/40 to-purple-600/40 rounded-xl border-2 border-blue-400/50 hover:border-blue-400/70 hover:from-blue-600/50 hover:to-purple-600/50 transition-all duration-200 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Activity className="w-6 h-6 text-blue-300" />
                    <div>
                      <h3 className="font-bold text-blue-200">AI System Diagnostics</h3>
                      <p className="text-blue-100/90 text-sm">Run comprehensive AI system health checks</p>
                    </div>
                  </div>
                  <div className="text-blue-300">→</div>
                </div>
              </Link>

              {/* Local Services */}
              <div className="mb-6">
                <h3 className="font-semibold text-white mb-4 flex items-center space-x-2">
                  <Bot className="w-5 h-5" />
                  <span>Local AI Services</span>
                </h3>
                
                {providersStatus?.localServices && providersStatus.localServices.length > 0 ? (
                  <div className="space-y-3">
                    {providersStatus.localServices.map((service, index) => (
                      <div key={index} className="bg-sportsBar-800/5 rounded-lg p-4 border border-slate-700/10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(service.status)}
                            <div>
                              <h4 className="font-medium text-white">{service.name}</h4>
                              <p className="text-sm text-gray-300">{service.endpoint}</p>
                              {service.model && (
                                <p className="text-xs text-blue-300">Model: {service.model}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              service.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : service.status === 'error'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-sportsBar-800 text-slate-100'
                            }`}>
                              {service.status}
                            </div>
                            {service.responseTime && (
                              <p className="text-xs text-slate-500 mt-1">{service.responseTime}ms</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">No local AI services detected</p>
                )}
              </div>

              {/* Cloud Services */}
              <div className="mb-6">
                <h3 className="font-semibold text-white mb-4 flex items-center space-x-2">
                  <Bot className="w-5 h-5" />
                  <span>Cloud AI Services</span>
                </h3>
                
                {providersStatus?.cloudServices && (
                  <div className="space-y-3">
                    {providersStatus.cloudServices.map((service, index) => (
                      <div key={index} className="bg-sportsBar-800/5 rounded-lg p-4 border border-slate-700/10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {service.hasKey ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-slate-500" />
                            )}
                            <div>
                              <h4 className="font-medium text-white">{service.name}</h4>
                              <p className="text-sm text-gray-300">
                                {service.hasKey ? 'API key configured' : 'No API key found'}
                              </p>
                            </div>
                          </div>
                          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            service.hasKey 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-sportsBar-800 text-slate-100'
                          }`}>
                            {service.hasKey ? 'Ready' : 'Not Configured'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Installation Guide */}
              <div className="bg-sportsBar-800/10 backdrop-blur-sm rounded-xl border border-slate-700/20 p-6">
                <h3 className="font-semibold text-white mb-4">Local AI Setup Guide</h3>
                
                <div className="space-y-4 text-sm text-gray-300">
                  <div className="bg-sportsBar-800/5 rounded-lg p-4">
                    <h4 className="font-medium text-blue-300 mb-2">🦙 Ollama</h4>
                    <code className="block bg-black/20 p-2 rounded mb-2 text-xs">
                      curl -fsSL https://ollama.ai/install.sh | sh<br/>
                      ollama pull llama3.2:3b
                    </code>
                    <p>Runs on port 11434 with simple API</p>
                  </div>
                  
                  <div className="bg-sportsBar-800/5 rounded-lg p-4">
                    <h4 className="font-medium text-green-300 mb-2">🤖 LocalAI</h4>
                    <code className="block bg-black/20 p-2 rounded mb-2 text-xs">
                      docker run -p 8080:8080 --name local-ai -ti localai/localai:latest
                    </code>
                    <p>OpenAI-compatible API on port 8080</p>
                  </div>
                  
                  <div className="bg-sportsBar-800/5 rounded-lg p-4">
                    <h4 className="font-medium text-purple-300 mb-2">⚡ LM Studio</h4>
                    <p>Download from <a href="https://lmstudio.ai" className="text-blue-400 hover:underline">lmstudio.ai</a> and enable local server</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* n8n Workflow Automation Tab */}
          <TabsContent value="n8n" className="space-y-6">
            <div className="card p-6">
              <div className="mb-6">
                <div className="flex items-center space-x-3 mb-2">
                  <Workflow className="w-6 h-6 text-purple-400" />
                  <h2 className="text-xl font-bold text-slate-100">n8n Workflow Automation</h2>
                </div>
                <p className="text-sm text-slate-300">Automate your sports bar operations with n8n workflows</p>
              </div>

              <div className="space-y-6">
                {/* n8n Embedded Interface */}
                <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-b border-purple-500/30 p-4">
                    <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-purple-400" />
                      n8n Workflow Editor
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                      Create and manage automation workflows for your sports bar
                    </p>
                  </div>
                  
                  <div className="relative" style={{ height: '600px' }}>
                    <iframe
                      src="http://24.123.87.42:5678"
                      className="w-full h-full border-0"
                      title="n8n Workflow Automation"
                      allow="clipboard-read; clipboard-write"
                    />
                  </div>
                </div>

                {/* n8n Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <h4 className="font-medium text-purple-300 mb-2 flex items-center gap-2">
                      <Workflow className="w-4 h-4" />
                      Workflow Capabilities
                    </h4>
                    <ul className="text-sm text-slate-300 space-y-2">
                      <li>• Automate audio/video routing based on schedules</li>
                      <li>• Integrate with external APIs and services</li>
                      <li>• Create custom triggers and actions</li>
                      <li>• Monitor system health and send alerts</li>
                    </ul>
                  </div>

                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <h4 className="font-medium text-blue-300 mb-2 flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      Integration Points
                    </h4>
                    <ul className="text-sm text-slate-300 space-y-2">
                      <li>• Atlas Audio System</li>
                      <li>• Matrix Video Switching</li>
                      <li>• Sports Data APIs</li>
                      <li>• Webhook endpoints at /api/n8n/webhook</li>
                    </ul>
                  </div>
                </div>

                {/* Quick Links */}
                <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-4">
                  <h4 className="font-medium text-slate-200 mb-3">Quick Access</h4>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href="http://24.123.87.42:5678"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                    >
                      <Workflow className="w-4 h-4" />
                      Open n8n in New Tab
                    </a>
                    <a
                      href="https://docs.n8n.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors flex items-center gap-2"
                    >
                      <FileCode className="w-4 h-4" />
                      n8n Documentation
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="keys" className="space-y-6">
            <div className="card p-6">
              <div className="mb-6">
                <div className="flex items-center space-x-3 mb-2">
                  <Key className="w-6 h-6 text-purple-400" />
                  <h2 className="text-xl font-bold text-slate-100">AI API Keys Management</h2>
                </div>
                <p className="text-sm text-slate-300">Configure API keys for AI providers to enable intelligent chat assistance</p>
              </div>

              <ApiKeysManager />

              {/* Features Overview */}
              <div className="mt-6 bg-sportsBar-800/10 backdrop-blur-sm rounded-lg p-6 border border-slate-700/20">
                <h3 className="font-semibold text-white mb-4 flex items-center space-x-2">
                  <Brain className="w-5 h-5" />
                  <span>AI Assistant Features</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-sportsBar-800/5 rounded-lg p-4">
                    <h4 className="font-medium text-blue-300 mb-2">🔧 Equipment Troubleshooting</h4>
                    <p className="text-sm text-gray-300">
                      Get intelligent help with Wolf Pack matrix switchers, Atlas audio processors, and IR device configuration.
                    </p>
                  </div>
                  
                  <div className="bg-sportsBar-800/5 rounded-lg p-4">
                    <h4 className="font-medium text-green-300 mb-2">📊 System Analysis</h4>
                    <p className="text-sm text-gray-300">
                      AI-powered analysis of your system logs, performance metrics, and operational patterns.
                    </p>
                  </div>
                  
                  <div className="bg-sportsBar-800/5 rounded-lg p-4">
                    <h4 className="font-medium text-purple-300 mb-2">⚙️ Configuration Assistance</h4>
                    <p className="text-sm text-gray-300">
                      Smart guidance for device setup, channel mapping, and AV system optimization.
                    </p>
                  </div>
                  
                  <div className="bg-sportsBar-800/5 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-300 mb-2">🏈 Sports Guide Intelligence</h4>
                    <p className="text-sm text-gray-300">
                      Intelligent sports scheduling, team prioritization, and event management recommendations.
                    </p>
                  </div>
                  
                  <div className="bg-sportsBar-800/5 rounded-lg p-4">
                    <h4 className="font-medium text-red-300 mb-2">📈 Operational Insights</h4>
                    <p className="text-sm text-gray-300">
                      Data-driven insights on system usage patterns, maintenance schedules, and optimization opportunities.
                    </p>
                  </div>
                  
                  <div className="bg-sportsBar-800/5 rounded-lg p-4">
                    <h4 className="font-medium text-indigo-300 mb-2">🎯 Proactive Monitoring</h4>
                    <p className="text-sm text-gray-300">
                      AI-powered monitoring and alerts for potential issues before they affect your operations.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
