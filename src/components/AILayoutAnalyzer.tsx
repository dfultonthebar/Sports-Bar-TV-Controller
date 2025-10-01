
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
  audioOutput?: string
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
    // Use fallback description if none provided
    const fallbackDescription = `The image displays a floor plan with 20 numbered markers. The floor plan outlines a large, irregularly shaped area.

Starting from the bottom left of the L-shaped section and moving clockwise:
- Marker 1 is on the vertical wall of the L-shaped section.
- Marker 2 is above Marker 1 on the same vertical wall.
- Marker 3 is above Marker 2 on the same vertical wall.
- Marker 4 is on the horizontal wall of the L-shaped section, to the left of the top corner.
- Marker 19 is on the top horizontal wall of the main room, to the left of the center.
- Marker 20 is on the top horizontal wall of the main room, to the right of the center.
- Marker 5 is in the top right corner of the main room, angled along the corner.
- Marker 6 is on the right vertical wall of the main room, below Marker 5.
- Marker 7 is below Marker 6 on the same vertical wall.
- Marker 8 is below Marker 7 on the same vertical wall.
- Marker 9 is below Marker 8 on the same vertical wall.
- Marker 10 is on a small internal wall in the bottom left section of the floor plan.
- Marker 11 is on the bottom horizontal wall of the bottom left section, to the right of Marker 10.
- Marker 12 is on the bottom horizontal wall of the bottom left section, to the left of Marker 11.
- Marker 13 is on the left vertical wall of the bottom left section, near the bottom.
- Marker 14 is above Marker 13 on the same vertical wall.
- Marker 15 is above Marker 14 on the same vertical wall, near the top left corner of the bottom left section.
- Marker 16 is on the top horizontal wall of the bottom left section, to the right of Marker 15.
- Marker 17 is on the bottom horizontal wall of the L-shaped section, to the left of the corner.
- Marker 18 is on the bottom horizontal wall of the L-shaped section, to the right of the corner.`
    
    const descriptionToAnalyze = layoutDescription || fallbackDescription

    setAnalyzing(true)
    setError('')

    try {
      // Fetch current matrix configuration to get available outputs
      let availableOutputs = []
      try {
        const configResponse = await fetch('/api/matrix/config')
        if (configResponse.ok) {
          const configData = await configResponse.json()
          if (configData.outputs) {
            availableOutputs = configData.outputs
            console.log('Loaded matrix outputs for AI analysis:', availableOutputs.length)
          }
        }
      } catch (configError) {
        console.warn('Could not fetch matrix configuration for AI analysis:', configError)
        // Continue without matrix config - AI will use fallback
      }

      const response = await fetch('/api/ai/analyze-layout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          layoutDescription: descriptionToAnalyze,
          matrixOutputs: 36,
          availableOutputs: availableOutputs
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
        <h3 className="text-lg font-semibold text-slate-100">AI Layout Analyzer</h3>
      </div>

      {!analysis && (
        <div className="text-center py-8">
          <div className="bg-blue-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-blue-600" />
          </div>
          <h4 className="text-lg font-medium text-slate-100 mb-2">
            Intelligent TV Mapping
          </h4>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Let AI analyze your uploaded bar layout and automatically map TV locations to matrix outputs based on optimal viewing positions.
          </p>
          
          <button
            onClick={analyzeLayout}
            disabled={analyzing}
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

          <p className="text-sm text-slate-400 mt-3">
            AI will analyze your layout and create TV zones automatically
          </p>
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
            <h4 className="text-md font-semibold text-slate-100 mb-3 flex items-center space-x-2">
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
                      <p className="text-sm font-medium text-slate-100">TV #{location.number}</p>
                      <p className="text-xs text-slate-400">{location.description}</p>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {location.position.wall} wall
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Output Mapping Suggestions */}
          <div>
            <h4 className="text-md font-semibold text-slate-100 mb-3 flex items-center space-x-2">
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
              className="bg-gray-100 text-slate-200 px-4 py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center space-x-2"
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
