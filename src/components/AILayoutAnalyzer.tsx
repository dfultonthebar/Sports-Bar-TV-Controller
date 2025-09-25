
'use client'

import { useState } from 'react'
import { Upload, Brain, MapPin, Tv, Check, X } from 'lucide-react'

interface TVLocation {
  number: number
  description: string
  position: {
    x: number
    y: number
    wall: string
  }
}

interface OutputSuggestion {
  outputNumber: number
  tvNumber: number
  label: string
  description: string
  priority: 'high' | 'medium' | 'low'
}

interface LayoutAnalysis {
  totalTVs: number
  locations: TVLocation[]
  suggestions: OutputSuggestion[]
}

interface AILayoutAnalyzerProps {
  onAnalysisComplete: (analysis: LayoutAnalysis) => void
  layoutDescription?: string
}

export default function AILayoutAnalyzer({ onAnalysisComplete, layoutDescription }: AILayoutAnalyzerProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<LayoutAnalysis | null>(null)
  const [error, setError] = useState<string>('')

  const analyzeLayout = async () => {
    if (!layoutDescription) {
      setError('No layout data available to analyze')
      return
    }

    setAnalyzing(true)
    setError('')

    try {
      const response = await fetch('/api/ai/analyze-layout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          layoutDescription: layoutDescription,
          matrixOutputs: 36
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to analyze layout')
      }

      const data = await response.json()
      setAnalysis(data.analysis)
      onAnalysisComplete(data.analysis)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50'
      case 'medium': return 'text-orange-600 bg-orange-50'
      case 'low': return 'text-green-600 bg-green-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴'
      case 'medium': return '🟡'
      case 'low': return '🟢'
      default: return '⚪'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Brain className="w-6 h-6 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">AI Layout Analyzer</h3>
      </div>

      {!analysis && (
        <div className="text-center py-8">
          <div className="bg-blue-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-blue-600" />
          </div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">
            Intelligent TV Mapping
          </h4>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Let AI analyze your uploaded bar layout and automatically map TV locations to matrix outputs based on optimal viewing positions.
          </p>
          
          <button
            onClick={analyzeLayout}
            disabled={analyzing || !layoutDescription}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
          >
            {analyzing ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Analyzing Layout...</span>
              </>
            ) : (
              <>
                <Brain className="w-4 h-4" />
                <span>Analyze Layout with AI</span>
              </>
            )}
          </button>

          {!layoutDescription && (
            <p className="text-sm text-red-600 mt-3">
              Please upload a layout first to enable AI analysis
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <X className="w-5 h-5 text-red-600" />
            <span className="text-red-800 font-medium">Analysis Error</span>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      )}

      {analysis && (
        <div className="space-y-6">
          {/* Analysis Summary */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Check className="w-5 h-5 text-green-600" />
              <span className="text-green-800 font-medium">Analysis Complete</span>
            </div>
            <p className="text-green-700">
              Found {analysis.totalTVs} TV locations in your layout. AI has generated optimized output mappings.
            </p>
          </div>

          {/* TV Locations Map */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <MapPin className="w-5 h-5" />
              <span>Detected TV Locations</span>
            </h4>
            <div className="grid gap-3">
              {analysis.locations.map((location) => (
                <div key={location.number} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 text-blue-800 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold">
                      {location.number}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">TV #{location.number}</p>
                      <p className="text-xs text-gray-600">{location.description}</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {location.position.wall} wall
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Output Mapping Suggestions */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <Tv className="w-5 h-5" />
              <span>Recommended Output Mappings</span>
            </h4>
            <div className="grid gap-2">
              {analysis.suggestions.map((suggestion) => (
                <div key={suggestion.tvNumber} className={`rounded-lg p-3 border ${getPriorityColor(suggestion.priority)}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{getPriorityIcon(suggestion.priority)}</span>
                      <div>
                        <p className="font-medium">
                          Output {suggestion.outputNumber} → {suggestion.label}
                        </p>
                        <p className="text-sm opacity-75">{suggestion.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-medium capitalize">{suggestion.priority} Priority</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reanalyze Button */}
          <div className="pt-4 border-t">
            <button
              onClick={analyzeLayout}
              disabled={analyzing}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center space-x-2"
            >
              <Brain className="w-4 h-4" />
              <span>Reanalyze Layout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
