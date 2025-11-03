
'use client'

import { useState, useEffect } from 'react'
import { Volume2, VolumeX, Music, Radio, Tv, Wifi, Speaker } from 'lucide-react'

import { logger } from '@/lib/logger'
interface AudioInput {
  id: string
  name: string
  isActive: boolean
  type?: 'matrix' | 'atlas' | 'streaming'
  matrixNumber?: number
  atlasIndex?: number // 0-based index for Atlas protocol API calls
}

interface ZoneOutput {
  id: string
  outputNumber: number
  atlasIndex: number
  name: string
  type: string
  volume: number
  parameterName: string
}

interface Zone {
  id: string
  name: string
  currentSource: string
  volume: number
  isMuted: boolean
  isActive: boolean
  atlasIndex?: number // 0-based index for Atlas protocol API calls
  outputs?: ZoneOutput[] // Array of amplifier outputs for this zone
}

interface AtlasInputConfig {
  id: string
  number: number
  name: string
  type: string
  connector: string
  description?: string
}

interface AtlasOutputConfig {
  id: string
  number: number
  name: string
  type: string
  connector: string
  powerRating?: string
  description?: string
  groupId?: string | null
}

interface AtlasZoneGroup {
  id: string
  name: string
  outputIds: string[]
  outputs: AtlasOutputConfig[]
}

interface AudioZoneControlProps {
  bartenderMode?: boolean // When true, show simplified single-slider interface
}

export default function AudioZoneControl({ bartenderMode = false }: AudioZoneControlProps) {
  const [audioInputs, setAudioInputs] = useState<AudioInput[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeProcessorId, setActiveProcessorId] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set()) // Track which zones have expanded output controls

  useEffect(() => {
    setIsMounted(true)
    // Fetch dynamic Atlas configuration on component mount
    fetchDynamicAtlasConfiguration()
  }, [])

  const fetchDynamicAtlasConfiguration = async () => {
    try {
      setLoading(true)
      setError(null)

      // First, get the active audio processor
      const processorsResponse = await fetch('/api/audio-processor')
      const processorsData = await processorsResponse.json()

      if (!processorsResponse.ok) {
        throw new Error(processorsData.error || 'Failed to fetch audio processors')
      }

      const activeProcessor = processorsData.processors?.find((p: any) => p.status === 'online')
      
      if (!activeProcessor) {
        throw new Error('No active audio processor found')
      }

      setActiveProcessorId(activeProcessor.id)

      // Fetch real-time zones status from Atlas processor
      // This queries the actual hardware for current source assignments, volume, and mute state
      const zonesStatusResponse = await fetch(`/api/audio-processor/${activeProcessor.id}/zones-status`)
      const zonesStatusData = await zonesStatusResponse.json()

      if (!zonesStatusResponse.ok) {
        throw new Error(zonesStatusData.error || 'Failed to fetch zones status from Atlas processor')
      }

      // Build audio inputs list from Atlas sources
      const atlasInputs: AudioInput[] = (zonesStatusData.sources || []).map((source: any) => ({
        id: source.id,
        name: source.name,
        isActive: true,
        type: 'atlas' as const,
        atlasIndex: source.atlasIndex
      }))

      // Add Matrix inputs (for video routing) first
      const matrixLabels = await fetchMatrixLabels()
      const matrixInputs: AudioInput[] = [
        { id: 'matrix1', name: matrixLabels[1] || 'Matrix 1 (Video)', isActive: true, type: 'matrix', matrixNumber: 1 },
        { id: 'matrix2', name: matrixLabels[2] || 'Matrix 2 (Video)', isActive: true, type: 'matrix', matrixNumber: 2 },
        { id: 'matrix3', name: matrixLabels[3] || 'Matrix 3 (Video)', isActive: true, type: 'matrix', matrixNumber: 3 },
        { id: 'matrix4', name: matrixLabels[4] || 'Matrix 4 (Video)', isActive: true, type: 'matrix', matrixNumber: 4 },
      ]

      setAudioInputs([...matrixInputs, ...atlasInputs])

      // Build zones from real Atlas hardware data
      const realZones: Zone[] = (zonesStatusData.zones || []).map((zone: any) => ({
        id: zone.id,
        name: zone.name,
        currentSource: zone.currentSourceName, // Real source name from Atlas
        volume: zone.volume,
        isMuted: zone.isMuted,
        isActive: zone.isActive,
        atlasIndex: zone.atlasIndex // Store for API calls
      }))

      setZones(realZones)

      logger.info('Real Atlas configuration loaded from hardware:', {
        processor: activeProcessor.name,
        model: activeProcessor.model,
        sources: atlasInputs.length,
        matrixInputs: matrixInputs.length,
        zones: realZones.length,
        queriedAt: zonesStatusData.queriedAt
      })

      setLoading(false)
    } catch (err) {
      logger.error('Error fetching dynamic Atlas configuration:', err)
      setError(err instanceof Error ? err.message : 'Failed to load configuration')
      
      // Fallback to Matrix inputs only if Atlas config fails
      const matrixLabels = await fetchMatrixLabels()
      setAudioInputs([
        { id: 'matrix1', name: matrixLabels[1] || 'Matrix 1', isActive: true, type: 'matrix', matrixNumber: 1 },
        { id: 'matrix2', name: matrixLabels[2] || 'Matrix 2', isActive: true, type: 'matrix', matrixNumber: 2 },
        { id: 'matrix3', name: matrixLabels[3] || 'Matrix 3', isActive: true, type: 'matrix', matrixNumber: 3 },
        { id: 'matrix4', name: matrixLabels[4] || 'Matrix 4', isActive: true, type: 'matrix', matrixNumber: 4 },
      ])
      
      // Set empty zones array - no mock data
      // This ensures the UI shows a proper error state rather than misleading mock data
      setZones([])
      
      setLoading(false)
    }
  }

  /**
   * Fetch Matrix output labels from video input selections
   * This allows Matrix 1-4 labels to reflect the selected video input
   */
  const fetchMatrixLabels = async (): Promise<Record<number, string>> => {
    try {
      const response = await fetch('/api/matrix/video-input-selection')
      if (!response.ok) {
        return {}
      }
      
      const data = await response.json()
      if (!data.success || !data.selections) {
        return {}
      }

      // Build a map of matrix output number to label
      const labels: Record<number, string> = {}
      data.selections.forEach((selection: any) => {
        if (selection.videoInputLabel) {
          labels[selection.matrixOutputNumber] = selection.videoInputLabel
        }
      })

      return labels
    } catch (error) {
      logger.error('Error fetching matrix labels:', error)
      return {}
    }
  }

  /**
   * Refresh configuration after video input selection
   * This is called from parent components when video input changes
   */
  const refreshConfiguration = () => {
    fetchDynamicAtlasConfiguration()
  }

  // Expose refresh function to parent via window object for cross-component communication
  useEffect(() => {
    (window as any).refreshAudioZoneControl = refreshConfiguration
    return () => {
      delete (window as any).refreshAudioZoneControl
    }
  }, [])

  const handleSourceChange = async (zoneId: string, sourceId: string) => {
    const source = audioInputs.find(input => input.id === sourceId)
    if (!source) return

    try {
      // For Matrix inputs, route video to Atlas
      if (source.type === 'matrix' && source.matrixNumber) {
        const response = await fetch('/api/atlas/route-matrix-to-zone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matrixInput: source.matrixNumber,
            zoneId: zoneId
          })
        })

        if (!response.ok) {
          const error = await response.json()
          logger.error('Failed to route Matrix to zone:', error)
          return
        }
      }

      // Direct routing for Atlas inputs (audio only)
      // This would use Atlas API to route the input to the zone
      
      // Update local state
      setZones(zones.map(zone => 
        zone.id === zoneId 
          ? { ...zone, currentSource: source.name }
          : zone
      ))
    } catch (error) {
      logger.error('Error routing audio:', error)
    }
  }

  const handleVolumeChange = async (zoneId: string, newVolume: number) => {
    // Find the zone to get its zone number
    const zone = zones.find(z => z.id === zoneId)
    if (!zone || !activeProcessorId) return

    // Optimistically update UI
    setZones(zones.map(z => 
      z.id === zoneId 
        ? { ...z, volume: newVolume }
        : z
    ))

    try {
      // Send command to Atlas processor
      const response = await fetch('/api/audio-processor/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: activeProcessorId,
          command: {
            action: 'volume',
            zone: zone.atlasIndex !== undefined ? zone.atlasIndex + 1 : parseInt(zone.id.split('_')[1]) + 1,
            value: newVolume
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()
        logger.error('Failed to set zone volume:', error)
        // Revert optimistic update
        await fetchDynamicAtlasConfiguration()
      }
    } catch (error) {
      logger.error('Error setting zone volume:', error)
      // Revert optimistic update
      await fetchDynamicAtlasConfiguration()
    }
  }
  const handleOutputVolumeChange = async (zoneId: string, outputId: string, newVolume: number) => {
    // Update the output volume in state
    setZones(zones.map(zone => {
      if (zone.id === zoneId && zone.outputs) {
        return {
          ...zone,
          outputs: zone.outputs.map(output =>
            output.id === outputId
              ? { ...output, volume: newVolume }
              : output
          )
        }
      }
      return zone
    }))

    // Send output volume command to backend
    const zone = zones.find(z => z.id === zoneId)
    const output = zone?.outputs?.find(o => o.id === outputId)
    if (!zone || !output || !activeProcessorId) return

    try {
      const response = await fetch('/api/audio-processor/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: activeProcessorId,
          command: {
            action: 'output-volume',
            zone: zone.atlasIndex !== undefined ? zone.atlasIndex + 1 : parseInt(zone.id.split('_')[1]) + 1,
            outputIndex: output.atlasIndex,
            value: newVolume,
            parameterName: output.parameterName
          }
        })
      })

      if (!response.ok) {
        logger.error('Failed to set output volume:', await response.json())
      }
    } catch (error) {
      logger.error('Error setting output volume:', error)
    }
  }

  /**
   * Handle master volume change - updates all outputs proportionally
   * Used in bartender mode for simplified control
   */
  const handleMasterVolumeChange = async (zoneId: string, newMasterVolume: number) => {
    const zone = zones.find(z => z.id === zoneId)
    if (!zone || !zone.outputs || zone.outputs.length === 0 || !activeProcessorId) return

    // Calculate the current average volume across all outputs
    const currentAvgVolume = zone.outputs.reduce((sum, output) => sum + output.volume, 0) / zone.outputs.length
    
    // Calculate the volume change delta
    const volumeDelta = newMasterVolume - currentAvgVolume

    // Update all outputs proportionally
    const updatedOutputs = zone.outputs.map(output => ({
      ...output,
      volume: Math.max(0, Math.min(100, output.volume + volumeDelta))
    }))

    // Optimistically update UI
    setZones(zones.map(z => 
      z.id === zoneId 
        ? { ...z, volume: newMasterVolume, outputs: updatedOutputs }
        : z
    ))

    // Send commands to update all outputs
    try {
      const updatePromises = updatedOutputs.map(output => 
        fetch('/api/audio-processor/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            processorId: activeProcessorId,
            command: {
              action: 'output-volume',
              zone: zone.atlasIndex !== undefined ? zone.atlasIndex + 1 : parseInt(zone.id.split('_')[1]) + 1,
              outputIndex: output.atlasIndex,
              value: output.volume,
              parameterName: output.parameterName
            }
          })
        })
      )

      const responses = await Promise.all(updatePromises)
      const failedResponses = responses.filter(r => !r.ok)
      
      if (failedResponses.length > 0) {
        logger.error('Some output volume updates failed')
        // Revert to actual state
        await fetchDynamicAtlasConfiguration()
      }
    } catch (error) {
      logger.error('Error setting master volume:', error)
      // Revert to actual state
      await fetchDynamicAtlasConfiguration()
    }
  }

  const toggleMute = async (zoneId: string) => {
    // Find the zone to get its zone number and current mute state
    const zone = zones.find(z => z.id === zoneId)
    if (!zone || !activeProcessorId) return

    const newMutedState = !zone.isMuted

    // Optimistically update UI
    setZones(zones.map(z => 
      z.id === zoneId 
        ? { ...z, isMuted: newMutedState }
        : z
    ))

    try {
      // Send command to Atlas processor
      const response = await fetch('/api/audio-processor/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: activeProcessorId,
          command: {
            action: 'mute',
            zone: zone.atlasIndex !== undefined ? zone.atlasIndex + 1 : parseInt(zone.id.split('_')[1]) + 1,
            value: newMutedState
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()
        logger.error('Failed to toggle mute:', error)
        // Revert optimistic update
        await fetchDynamicAtlasConfiguration()
      }
    } catch (error) {
      logger.error('Error toggling mute:', error)
      // Revert optimistic update
      await fetchDynamicAtlasConfiguration()
    }
  }
  const toggleZoneExpanded = (zoneId: string) => {
    setExpandedZones(prev => {
      const newSet = new Set(prev)
      if (newSet.has(zoneId)) {
        newSet.delete(zoneId)
      } else {
        newSet.add(zoneId)
      }
      return newSet
    })
  }

  // Prevent hydration errors by only rendering after mount
  if (!isMounted || loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400"></div>
          <span className="ml-3 text-slate-300">Loading audio configuration...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400 font-medium">Configuration Error</p>
          <p className="text-red-300 text-sm mt-1">{error}</p>
          <button
            onClick={fetchDynamicAtlasConfiguration}
            className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-gradient-to-r from-teal-900/30 to-blue-900/30 border border-teal-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Music className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-slate-200 font-medium">Audio Zone Control</p>
            <p className="text-slate-400 text-sm mt-1">
              Matrix inputs route video sources for audio • Atlas inputs route audio directly
            </p>
          </div>
        </div>
      </div>

      {/* Zone Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {zones.length === 0 ? (
          <div className="col-span-full bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
            <Speaker className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-300 mb-2">No Zones Available</h3>
            <p className="text-slate-400 text-sm">
              Please configure your Atlas audio processor to set up zones.
            </p>
          </div>
        ) : zones.map(zone => (
          <div 
            key={zone.id}
            className="bg-slate-800 rounded-lg p-5 border border-slate-700 hover:border-teal-500/50 transition-all"
          >
            {/* Zone Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${zone.isActive ? 'bg-teal-400' : 'bg-slate-600'}`} />
                <h3 className="text-lg font-semibold text-slate-100">{zone.name}</h3>
              </div>
              <button
                onClick={() => toggleMute(zone.id)}
                className={`p-2 rounded-lg transition-colors ${
                  zone.isMuted 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                {zone.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Current Source */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 uppercase tracking-wide mb-2 block">
                Current Source
              </label>
              <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                <p className="text-teal-400 font-medium">{zone.currentSource}</p>
              </div>
            </div>

            {/* Source Selection */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 uppercase tracking-wide mb-2 block">
                Select Audio Source
              </label>
              <select
                value={audioInputs.find(input => input.name === zone.currentSource)?.id || ''}
                onChange={(e) => handleSourceChange(zone.id, e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500 transition-colors"
              >
                <option value="">Select source...</option>
                {audioInputs.map(input => (
                  <option key={input.id} value={input.id}>
                    {input.name} {input.type === 'matrix' ? '(Video)' : '(Audio)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Volume Control - Multiple Outputs Support */}
            {zone.outputs && zone.outputs.length > 1 ? (
              /* Multi-Output Zone (e.g., Mono+Sub, Stereo) */
              bartenderMode ? (
                /* BARTENDER MODE: Simplified Single Master Slider */
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-slate-400 uppercase tracking-wide">
                      Master Volume
                    </label>
                    <span className="text-sm font-medium text-teal-400">
                      {Math.round(zone.outputs.reduce((sum, output) => sum + output.volume, 0) / zone.outputs.length)}%
                    </span>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(zone.outputs.reduce((sum, output) => sum + output.volume, 0) / zone.outputs.length)}
                      onChange={(e) => handleMasterVolumeChange(zone.id, parseInt(e.target.value))}
                      disabled={zone.isMuted}
                      className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-2">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                  {/* Show output levels in bartender mode for reference only */}
                  <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
                    <span>Output Levels:</span>
                    {zone.outputs.map((output, idx) => (
                      <span key={output.id}>
                        {output.name.replace(/Amp Out \d+ - /, '')}: {output.volume}%
                        {idx < zone.outputs.length - 1 && ' •'}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                /* ADMIN MODE: Detailed Individual Output Controls */
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-slate-400 uppercase tracking-wide">
                      Output Controls ({zone.outputs.length} outputs)
                    </label>
                    <button
                      onClick={() => toggleZoneExpanded(zone.id)}
                      className="text-xs text-teal-400 hover:text-teal-300 underline"
                    >
                      {expandedZones.has(zone.id) ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                  
                  {expandedZones.has(zone.id) ? (
                    /* Expanded View - Show All Outputs */
                    <div className="space-y-3">
                      {zone.outputs.map(output => (
                        <div key={output.id} className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-300">{output.name}</span>
                            <span className="text-sm font-medium text-teal-400">{output.volume}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={output.volume}
                            onChange={(e) => handleOutputVolumeChange(zone.id, output.id, parseInt(e.target.value))}
                            disabled={zone.isMuted}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Collapsed View - Show Summary */
                    <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                      <div className="space-y-1">
                        {zone.outputs.map(output => (
                          <div key={output.id} className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">{output.name}:</span>
                            <span className="text-teal-400 font-medium">{output.volume}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              /* Single Output Zone (backward compatibility) */
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-400 uppercase tracking-wide">
                    Volume
                  </label>
                  <span className="text-sm font-medium text-teal-400">{zone.volume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={zone.volume}
                  onChange={(e) => handleVolumeChange(zone.id, parseInt(e.target.value))}
                  disabled={zone.isMuted}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Available Inputs Summary */}
      <div className="bg-slate-800 rounded-lg p-5 border border-slate-700">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Available Audio Sources</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {audioInputs.map(input => (
            <div
              key={input.id}
              className="bg-slate-900 rounded-lg p-3 border border-slate-700"
            >
              <div className="flex items-center gap-2 mb-1">
                {input.type === 'matrix' && <Tv className="w-4 h-4 text-teal-400" />}
                {input.type === 'atlas' && <Radio className="w-4 h-4 text-blue-400" />}
                {input.type === 'streaming' && <Wifi className="w-4 h-4 text-purple-400" />}
                <span className="text-sm font-medium text-slate-200">{input.name}</span>
              </div>
              <span className="text-xs text-slate-500">
                {input.type === 'matrix' ? 'Video Source' : 'Audio Source'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
