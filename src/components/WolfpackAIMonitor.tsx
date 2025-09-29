
// Wolfpack Matrix AI Monitor Component - Real-time AI insights for matrix operations

'use client'

import { useState, useEffect } from 'react'
import { WolfpackAIInsight } from '@/lib/wolfpack-ai-analyzer'

interface WolfpackAIMonitorProps {
  matrixData?: any;
  isVisible?: boolean;
  className?: string;
}

export default function WolfpackAIMonitor({ 
  matrixData, 
  isVisible = true, 
  className = '' 
}: WolfpackAIMonitorProps) {
  const [insights, setInsights] = useState<WolfpackAIInsight[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null)
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')

  useEffect(() => {
    if (isVisible && matrixData) {
      analyzeMatrix()
    }
  }, [matrixData, isVisible])

  const analyzeMatrix = async () => {
    if (!matrixData) return

    setIsAnalyzing(true)
    
    try {
      const response = await fetch('/api/wolfpack/ai-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          matrixData: matrixData
        })
      })

      if (response.ok) {
        const data = await response.json()
        setInsights(data.insights || [])
        setLastAnalysis(new Date().toLocaleString())
      } else {
        console.error('Failed to get AI analysis:', response.statusText)
      }
    } catch (error) {
      console.error('Error during AI analysis:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getInsightIcon = (type: WolfpackAIInsight['type'], category: string) => {
    if (type === 'error') return '🚨'
    if (type === 'warning') return '⚠️'
    if (type === 'success') return '✅'
    if (type === 'optimization') return '⚡'
    
    // Category-specific icons
    switch (category) {
      case 'connection': return '🔗'
      case 'routing': return '🔄'
      case 'configuration': return '⚙️'
      case 'performance': return '📊'
      case 'layout': return '📍'
      case 'audio': return '🔊'
      default: return 'ℹ️'
    }
  }

  const getInsightColor = (type: WolfpackAIInsight['type']) => {
    switch (type) {
      case 'error': return 'border-red-300 bg-red-50'
      case 'warning': return 'border-yellow-300 bg-yellow-50'
      case 'success': return 'border-green-300 bg-green-50'
      case 'optimization': return 'border-blue-300 bg-blue-50'
      default: return 'border-gray-300 bg-gray-50'
    }
  }

  const getPriorityBadge = (priority: WolfpackAIInsight['priority']) => {
    switch (priority) {
      case 'critical':
        return <span className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded-full">CRITICAL</span>
      case 'high':
        return <span className="px-2 py-1 text-xs font-semibold bg-orange-100 text-orange-800 rounded-full">HIGH</span>
      case 'medium':
        return <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full">MEDIUM</span>
      case 'low':
        return <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">LOW</span>
    }
  }

  const filteredInsights = insights.filter(insight => {
    const categoryMatch = filterCategory === 'all' || insight.category === filterCategory
    const priorityMatch = filterPriority === 'all' || insight.priority === filterPriority
    return categoryMatch && priorityMatch
  })

  const insightCategories = [
    { value: 'all', label: 'All Categories' },
    { value: 'connection', label: '🔗 Connection' },
    { value: 'routing', label: '🔄 Routing' },
    { value: 'configuration', label: '⚙️ Configuration' },
    { value: 'performance', label: '📊 Performance' },
    { value: 'layout', label: '📍 Layout' },
    { value: 'audio', label: '🔊 Audio' }
  ]

  const priorityFilters = [
    { value: 'all', label: 'All Priorities' },
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ]

  if (!isVisible) return null

  return (
    <div className={`bg-white rounded-lg shadow-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🤖</span>
              <h3 className="text-lg font-semibold text-gray-900">Wolfpack Matrix AI Monitor</h3>
            </div>
            {isAnalyzing && (
              <div className="flex items-center space-x-2 text-blue-600">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                <span className="text-sm">Analyzing...</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {lastAnalysis && (
              <span className="text-sm text-gray-500">
                Last analysis: {lastAnalysis}
              </span>
            )}
            <button
              onClick={analyzeMatrix}
              disabled={isAnalyzing}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze Now'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Category:</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {insightCategories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Priority:</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {priorityFilters.map(priority => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Insights Summary */}
      {insights.length > 0 && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-red-600">
                {insights.filter(i => i.type === 'error').length}
              </div>
              <div className="text-sm text-gray-600">Errors</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">
                {insights.filter(i => i.type === 'warning').length}
              </div>
              <div className="text-sm text-gray-600">Warnings</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {insights.filter(i => i.type === 'optimization').length}
              </div>
              <div className="text-sm text-gray-600">Optimizations</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {insights.filter(i => i.type === 'success').length}
              </div>
              <div className="text-sm text-gray-600">Good Status</div>
            </div>
          </div>
        </div>
      )}

      {/* Insights List */}
      <div className="px-6 py-4">
        {isAnalyzing ? (
          <div className="text-center py-8">
            <svg className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            <p className="text-gray-600">AI is analyzing your Wolfpack matrix configuration...</p>
          </div>
        ) : filteredInsights.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-4xl mb-4 block">🎯</span>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Issues Found</h4>
            <p className="text-gray-600">
              {insights.length === 0 
                ? 'Run an analysis to get AI-powered insights about your matrix configuration.'
                : 'All insights filtered out. Adjust filters to see results.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInsights.map((insight, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${getInsightColor(insight.type)} transition-all duration-200`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <span className="text-xl" title={insight.category}>
                      {getInsightIcon(insight.type, insight.category)}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium text-gray-900">{insight.title}</h4>
                        {getPriorityBadge(insight.priority)}
                        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                          {Math.round(insight.confidence)}% confidence
                        </span>
                        {insight.affectedChannels && (
                          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                            Channels: {insight.affectedChannels.join(', ')}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 text-sm mb-2">{insight.message}</p>
                      
                      {insight.recommendation && (
                        <div className="mt-2">
                          <button
                            onClick={() => setExpandedInsight(
                              expandedInsight === `${index}-rec` ? null : `${index}-rec`
                            )}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center space-x-1"
                          >
                            <span>View Recommendation</span>
                            <svg 
                              className={`w-4 h-4 transform transition-transform ${
                                expandedInsight === `${index}-rec` ? 'rotate-180' : ''
                              }`} 
                              fill="none" 
                              viewBox="0 0 24 24" 
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {expandedInsight === `${index}-rec` && (
                            <div className="mt-2 p-3 bg-blue-50 rounded-md border border-blue-200">
                              <h5 className="font-medium text-blue-900 mb-1">💡 AI Recommendation:</h5>
                              <p className="text-blue-800 text-sm">{insight.recommendation}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {insights.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">
            🤖 AI-powered analysis of your Wolfpack matrix configuration and performance • 
            Showing {filteredInsights.length} of {insights.length} insights
          </p>
        </div>
      )}
    </div>
  )
}
