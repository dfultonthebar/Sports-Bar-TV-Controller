
'use client'

import { useState, useEffect } from 'react'
import { Volume2, VolumeX, Music, Radio, Tv, Wifi } from 'lucide-react'

interface AudioInput {
  id: string
  name: string
  isActive: boolean
  type?: 'matrix' | 'atlas' | 'streaming'
  matrixNumber?: number
}

interface Zone {
  id: string
  name: string
  currentSource: string
  volume: number
  isMuted: boolean
  isActive: boolean
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

export default function AudioZoneControl() {
  const [audioInputs, setAudioInputs] = useState<AudioInput[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeProcessorId, setActiveProcessorId] = useState<string | null>(null)

  useEffect(() => {
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

      // Fetch inputs and outputs for the active processor
      const [inputsResponse, outputsResponse] = await Promise.all([
        fetch(`/api/audio-processor/inputs?processorId=${activeProcessor.id}`),
        fetch(`/api/audio-processor/outputs?processorId=${activeProcessor.id}&includeGroups=true`)
      ])

      const inputsData = await inputsResponse.json()
      const outputsData = await outputsResponse.json()

      if (!inputsResponse.ok) {
        throw new Error(inputsData.error || 'Failed to fetch inputs')
      }

      if (!outputsResponse.ok) {
        throw new Error(outputsData.error || 'Failed to fetch outputs')
      }

      // Build inputs list: Matrix 1-4 first (special inputs for video routing), then Atlas inputs
      // Check if Matrix outputs have custom labels from video input selection
      const matrixLabels = await fetchMatrixLabels()
      
      const matrixInputs: AudioInput[] = [
        { id: 'matrix1', name: matrixLabels[1] || 'Matrix 1', isActive: true, type: 'matrix', matrixNumber: 1 },
        { id: 'matrix2', name: matrixLabels[2] || 'Matrix 2', isActive: true, type: 'matrix', matrixNumber: 2 },
        { id: 'matrix3', name: matrixLabels[3] || 'Matrix 3', isActive: true, type: 'matrix', matrixNumber: 3 },
        { id: 'matrix4', name: matrixLabels[4] || 'Matrix 4', isActive: true, type: 'matrix', matrixNumber: 4 },
      ]

      // Add Atlas inputs from API (safely handle undefined or null)
      const inputsList = inputsData?.inputs || []
      const atlasInputs: AudioInput[] = (Array.isArray(inputsList) ? inputsList : [])
        .filter((input: AtlasInputConfig) => input.type !== 'matrix_audio') // Exclude internal matrix audio buses from UI
        .map((input: AtlasInputConfig) => ({
          id: input.id,
          name: input.name,
          isActive: true,
          type: 'atlas' as const
        }))

      setAudioInputs([...matrixInputs, ...atlasInputs])

      // Build zones from Atlas outputs and groups
      const allZones: Zone[] = []

      // Add zone groups first (safely handle undefined or null)
      const groups = outputsData?.groups || []
      if (Array.isArray(groups) && groups.length > 0) {
        groups.forEach((group: AtlasZoneGroup) => {
          allZones.push({
            id: group.id,
            name: group.name,
            currentSource: 'Not Set',
            volume: 50,
            isMuted: false,
            isActive: true
          })
        })
      }

      // Add individual outputs/zones (safely handle undefined or null)
      const outputs = outputsData?.outputs || []
      if (Array.isArray(outputs) && outputs.length > 0) {
        outputs.forEach((output: AtlasOutputConfig) => {
          allZones.push({
            id: output.id,
            name: output.name,
            currentSource: 'Not Set',
            volume: 50,
            isMuted: false,
            isActive: true
          })
        })
      }

      // Always set zones, even if empty
      setZones(allZones)

      console.log('Dynamic Atlas configuration loaded:', {
        processor: activeProcessor.name,
        model: activeProcessor.model,
        matrixInputs: matrixInputs.length,
        atlasInputs: atlasInputs.length,
        zones: allZones.length,
        groups: outputsData.groups?.length || 0
      })

      setLoading(false)
    } catch (err) {
      console.error('Error fetching dynamic Atlas configuration:', err)
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
      console.error('Error fetching matrix labels:', error)
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
          console.error('Failed to route Matrix to zone:', error)
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
      console.error('Error routing audio:', error)
    }
  }

  const handleVolumeChange = (zoneId: string, newVolume: number) => {
    setZones(zones.map(zone => 
      zone.id === zoneId 
        ? { ...zone, volume: newVolume }
        : zone
    ))
  }

  const toggleMute = (zoneId: string) => {
    setZones(zones.map(zone => 
      zone.id === zoneId 
        ? { ...zone, isMuted: !zone.isMuted }
        : zone
    ))
  }

  if (loading) {
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

            {/* Volume Control */}
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
