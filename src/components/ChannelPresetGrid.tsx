
'use client'

import { useState, useEffect } from 'react'
import { Star, TrendingUp } from 'lucide-react'

interface ChannelPreset {
  id: string
  name: string
  channelNumber: string
  deviceType: 'cable' | 'directv'
  order: number
  usageCount: number
  lastUsed: Date | null
}

interface ChannelPresetGridProps {
  deviceType: 'cable' | 'directv'
  onPresetClick: (preset: ChannelPreset) => void
  maxVisible?: number
}

export default function ChannelPresetGrid({ 
  deviceType, 
  onPresetClick,
  maxVisible = 6 
}: ChannelPresetGridProps) {
  const [presets, setPresets] = useState<ChannelPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    loadPresets()
  }, [deviceType])

  const loadPresets = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/channel-presets/by-device?deviceType=${deviceType}`)
      const data = await response.json()

      if (data.success) {
        setPresets(data.presets || [])
      } else {
        setError(data.error || 'Failed to load presets')
      }
    } catch (err) {
      console.error('Error loading presets:', err)
      setError('Failed to load channel presets')
    } finally {
      setLoading(false)
    }
  }

  const handlePresetClick = async (preset: ChannelPreset) => {
    // Call the parent's click handler
    onPresetClick(preset)

    // Update usage tracking in the background
    try {
      await fetch('/api/channel-presets/update-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetId: preset.id })
      })
      
      // Reload presets to reflect updated usage
      await loadPresets()
    } catch (err) {
      console.error('Error updating preset usage:', err)
      // Don't show error to user - usage tracking is non-critical
    }
  }

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 mt-4">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
          <span className="ml-2 text-slate-400">Loading presets...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 mt-4">
        <div className="text-center py-4 text-red-400">
          {error}
        </div>
      </div>
    )
  }

  if (presets.length === 0) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 mt-4">
        <div className="text-center py-4 text-slate-400">
          <Star className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No channel presets configured</p>
          <p className="text-xs mt-1">Add presets in Sports Guide settings</p>
        </div>
      </div>
    )
  }

  const visiblePresets = showAll ? presets : presets.slice(0, maxVisible)
  const hasMore = presets.length > maxVisible

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center">
          <Star className="w-4 h-4 mr-2 text-yellow-400" />
          Quick Channel Access
        </h3>
        {presets.some(p => p.usageCount > 0) && (
          <div className="flex items-center text-xs text-green-400">
            <TrendingUp className="w-3 h-3 mr-1" />
            <span>AI Sorted</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {visiblePresets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handlePresetClick(preset)}
            className="group relative bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg p-3 transition-all transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
          >
            <div className="flex flex-col items-start text-left">
              <div className="text-xs font-medium opacity-90 mb-1">
                {preset.name}
              </div>
              <div className="text-lg font-bold">
                {preset.channelNumber}
              </div>
              {preset.usageCount > 0 && (
                <div className="absolute top-1 right-1 bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5 rounded-full font-bold">
                  {preset.usageCount}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full mt-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
        >
          {showAll ? 'Show Less' : `Show All (${presets.length} total)`}
        </button>
      )}
    </div>
  )
}
