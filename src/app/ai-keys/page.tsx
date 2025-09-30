
'use client'

import { ArrowLeft, Brain, Key } from 'lucide-react'
import Link from 'next/link'
import ApiKeysManager from '@/components/ApiKeysManager'

export default function AIKeysPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Link 
              href="/"
              className="flex items-center space-x-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Main</span>
            </Link>
            
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg p-3">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">AI API Keys Management</h1>
                <p className="text-blue-200">Configure AI providers for enhanced chat functionality</p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Info */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-6 border border-white/20">
          <div className="flex items-center space-x-3">
            <Key className="w-5 h-5 text-blue-300" />
            <div>
              <h3 className="font-medium text-white">AI Chat Integration</h3>
              <p className="text-sm text-blue-200">
                Configure API keys for AI providers to enable intelligent chat assistance with your AV systems and sports bar operations.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
          <ApiKeysManager />
        </div>

        {/* Features Overview */}
        <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
          <h3 className="font-semibold text-white mb-4 flex items-center space-x-2">
            <Brain className="w-5 h-5" />
            <span>AI Assistant Features</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="font-medium text-blue-300 mb-2">🔧 Equipment Troubleshooting</h4>
              <p className="text-sm text-gray-300">
                Get intelligent help with Wolf Pack matrix switchers, Atlas audio processors, and IR device configuration.
              </p>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="font-medium text-green-300 mb-2">📊 System Analysis</h4>
              <p className="text-sm text-gray-300">
                AI-powered analysis of your system logs, performance metrics, and operational patterns.
              </p>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="font-medium text-purple-300 mb-2">⚙️ Configuration Assistance</h4>
              <p className="text-sm text-gray-300">
                Smart guidance for device setup, channel mapping, and AV system optimization.
              </p>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="font-medium text-yellow-300 mb-2">🏈 Sports Guide Intelligence</h4>
              <p className="text-sm text-gray-300">
                Intelligent sports scheduling, team prioritization, and event management recommendations.
              </p>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="font-medium text-red-300 mb-2">📈 Operational Insights</h4>
              <p className="text-sm text-gray-300">
                Data-driven insights on system usage patterns, maintenance schedules, and optimization opportunities.
              </p>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="font-medium text-indigo-300 mb-2">🎯 Proactive Monitoring</h4>
              <p className="text-sm text-gray-300">
                AI-powered monitoring and alerts for potential issues before they affect your operations.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 flex space-x-4">
          <Link
            href="/ai-config"
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <span>Test AI Providers</span>
          </Link>
          <Link
            href="/logs"
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span>View System Logs</span>
          </Link>
          <Link
            href="/remote"
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <span>Test AI Chat</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
