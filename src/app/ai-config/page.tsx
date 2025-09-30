
'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Bot, Settings, CheckCircle2, XCircle, Clock } from 'lucide-react'
import Link from 'next/link'

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

export default function AIConfigPage() {
  const [providersStatus, setProvidersStatus] = useState<AIProvidersStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

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
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    testProviders()
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    testProviders()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'inactive':
        return <XCircle className="w-4 h-4 text-gray-400" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">Testing AI providers...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Link 
              href="/ai-keys"
              className="flex items-center space-x-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to AI Keys</span>
            </Link>
            
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg p-3">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">AI Providers Configuration</h1>
                <p className="text-blue-200">Test and configure available AI services</p>
              </div>
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
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-6 border border-white/20">
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
                  <div className="text-2xl font-bold text-gray-400">{providersStatus.total - providersStatus.active}</div>
                  <div className="text-sm text-blue-200">Inactive</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Local Services */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center space-x-2">
            <Bot className="w-5 h-5" />
            <span>Local AI Services</span>
          </h3>
          
          {providersStatus?.localServices && providersStatus.localServices.length > 0 ? (
            <div className="space-y-3">
              {providersStatus.localServices.map((service, index) => (
                <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10">
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
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {service.status}
                      </div>
                      {service.responseTime && (
                        <p className="text-xs text-gray-400 mt-1">{service.responseTime}ms</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No local AI services detected</p>
          )}
        </div>

        {/* Cloud Services */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center space-x-2">
            <Bot className="w-5 h-5" />
            <span>Cloud AI Services</span>
          </h3>
          
          {providersStatus?.cloudServices && (
            <div className="space-y-3">
              {providersStatus.cloudServices.map((service, index) => (
                <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {service.hasKey ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-400" />
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
                        : 'bg-gray-100 text-gray-800'
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
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
          <h3 className="font-semibold text-white mb-4">Local AI Setup Guide</h3>
          
          <div className="space-y-4 text-sm text-gray-300">
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="font-medium text-blue-300 mb-2">🦙 Ollama</h4>
              <code className="block bg-black/20 p-2 rounded mb-2 text-xs">
                curl -fsSL https://ollama.ai/install.sh | sh<br/>
                ollama pull llama3.2:3b
              </code>
              <p>Runs on port 11434 with simple API</p>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="font-medium text-green-300 mb-2">🤖 LocalAI</h4>
              <code className="block bg-black/20 p-2 rounded mb-2 text-xs">
                docker run -p 8080:8080 --name local-ai -ti localai/localai:latest
              </code>
              <p>OpenAI-compatible API on port 8080</p>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="font-medium text-purple-300 mb-2">⚡ LM Studio</h4>
              <p>Download from <a href="https://lmstudio.ai" className="text-blue-400 hover:underline">lmstudio.ai</a> and enable local server</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex space-x-4">
          <Link
            href="/ai-keys"
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span>Manage API Keys</span>
          </Link>
          <Link
            href="/sports-config"
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <span>Test Team Search</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
