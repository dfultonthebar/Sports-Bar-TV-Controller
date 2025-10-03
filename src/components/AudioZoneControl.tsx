
'use client'

import { useState, useEffect } from 'react'
import { 
  Volume2, 
  VolumeX,
  ChevronUp, 
  ChevronDown,
  Radio,
  AlertCircle,
  Users
} from 'lucide-react'
import WolfpackInputSelector from './WolfpackInputSelector'
import ChannelPresetPopup from './ChannelPresetPopup'
import { detectDeviceType, shouldShowChannelPresets } from '@/lib/inputDeviceMap'

interface AudioZone {
  id: string
  name: string
  currentSource: string
  volume: number
  isMuted: boolean
  isActive: boolean
  isGroup?: boolean
  outputIds?: string[]
}

interface AudioInput {
  id: string
  name: string
  isActive: boolean
  type: 'matrix' | 'atlas'
  matrixNumber?: number
  inputType?: string
  connector?: string
  description?: string
}

interface AtlasInputConfig {
  id: string
  number: number
  name: string
  type: string
  connector: string
  description: string
  priority?: string
  isCustom: boolean
}

interface AtlasOutputConfig {
  id: string
  number: number
  name: string
  type: string
  levelDb: number
  muted: boolean
  groupId?: string | null
  isCustom: boolean
}

interface AtlasZoneGroup {
  id: string
  name: string
  outputIds: string[]
  outputs: AtlasOutputConfig[]
  levelDb: number
  muted: boolean
}

export default function AudioZoneControl() {
  const [selectedInput, setSelectedInput] = useState<string | null>('matrix1')
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [showMatrixSelector, setShowMatrixSelector] = useState(false)
  const [currentMatrixNumber, setCurrentMatrixNumber] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [zones, setZones] = useState<AudioZone[]>([])
  const [audioInputs, setAudioInputs] = useState<AudioInput[]>([])
  
  // Channel preset popup state
  const [showChannelPresets, setShowChannelPresets] = useState(false)
  const [channelPresetDeviceType, setChannelPresetDeviceType] = useState<'cable' | 'directv'>('cable')
  const [channelPresetInputLabel, setChannelPresetInputLabel] = useState('')
  const [channelPresetDeviceIp, setChannelPresetDeviceIp] = useState<string | undefined>(undefined)

  // Fetch dynamic Atlas configuration on component mount
  useEffect(() => {
    fetchDynamicAtlasConfiguration()
  }, [])

  const fetchDynamicAtlasConfiguration = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const processorId = 'atlas-001' // Default processor ID
      
      // Fetch inputs from new API endpoint
      const inputsResponse = await fetch(`/api/audio-processor/inputs?processorId=${processorId}`)
      const inputsData = await inputsResponse.json()

      if (!inputsResponse.ok) {
        throw new Error(inputsData.error || 'Failed to fetch inputs')
      }

      // Fetch outputs/zones from new API endpoint (with group detection)
      const outputsResponse = await fetch(`/api/audio-processor/outputs?processorId=${processorId}&includeGroups=true`)
      const outputsData = await outputsResponse.json()

      if (!outputsResponse.ok) {
        throw new Error(outputsData.error || 'Failed to fetch outputs')
      }

      // Build inputs list: Matrix 1-4 first (special inputs for video routing), then Atlas inputs
      const matrixInputs: AudioInput[] = [
        { id: 'matrix1', name: 'Matrix 1', isActive: true, type: 'matrix', matrixNumber: 1 },
        { id: 'matrix2', name: 'Matrix 2', isActive: true, type: 'matrix', matrixNumber: 2 },
        { id: 'matrix3', name: 'Matrix 3', isActive: true, type: 'matrix', matrixNumber: 3 },
        { id: 'matrix4', name: 'Matrix 4', isActive: true, type: 'matrix', matrixNumber: 4 },
      ]

      // Add Atlas inputs from API
      const atlasInputs: AudioInput[] = (inputsData.inputs || [])
        .filter((input: AtlasInputConfig) => input.type !== 'matrix_audio') // Exclude internal matrix audio buses from UI
        .map((input: AtlasInputConfig) => ({
          id: input.id,
          name: input.name,
          isActive: true,
          type: 'atlas' as const,
          inputType: input.type,
          connector: input.connector,
          description: input.description
        }))

      setAudioInputs([...matrixInputs, ...atlasInputs])

      // Build zones from Atlas outputs and groups
      const atlasZones: AudioZone[] = []

      // Add zone groups first (if any)
      if (outputsData.groups && outputsData.groups.length > 0) {
        outputsData.groups.forEach((group: AtlasZoneGroup) => {
          atlasZones.push({
            id: group.id,
            name: group.name,
            currentSource: 'Spotify', // Default source
            volume: Math.round((group.levelDb + 60) * (100 / 60)), // Convert dB to 0-100 scale
            isMuted: group.muted,
            isActive: true,
            isGroup: true,
            outputIds: group.outputIds
          })
        })
      }

      // Add individual outputs/zones
      if (outputsData.outputs && outputsData.outputs.length > 0) {
        outputsData.outputs.forEach((output: AtlasOutputConfig) => {
          atlasZones.push({
            id: output.id,
            name: output.name,
            currentSource: 'Spotify', // Default source
            volume: Math.round((output.levelDb + 60) * (100 / 60)), // Convert dB to 0-100 scale
            isMuted: output.muted,
            isActive: true,
            isGroup: false
          })
        })
      }

      // If no outputs configured, use default zones as fallback
      if (atlasZones.length === 0) {
        setZones([
          { id: 'mainbar', name: 'Main Bar', currentSource: 'Spotify', volume: 59, isMuted: false, isActive: true },
          { id: 'pavilion', name: 'Pavilion', currentSource: 'Spotify', volume: 45, isMuted: false, isActive: true },
          { id: 'partyroom', name: 'Party Room', currentSource: 'Spotify', volume: 45, isMuted: false, isActive: true },
          { id: 'upstairs', name: 'Upstairs', currentSource: 'Spotify', volume: 42, isMuted: false, isActive: true },
          { id: 'patio', name: 'Patio', currentSource: 'Spotify', volume: 45, isMuted: false, isActive: true },
        ])
      } else {
        setZones(atlasZones)
      }

      console.log('Dynamic Atlas configuration loaded:', {
        inputs: inputsData.inputs?.length || 0,
        outputs: outputsData.outputs?.length || 0,
        groups: outputsData.groups?.length || 0,
        model: inputsData.model
      })

    } catch (err) {
      console.error('Error fetching dynamic Atlas configuration:', err)
      setError(err instanceof Error ? err.message : 'Failed to load configuration')
      
      // Fallback to Matrix inputs only if Atlas config fails
      setAudioInputs([
        { id: 'matrix1', name: 'Matrix 1', isActive: true, type: 'matrix', matrixNumber: 1 },
        { id: 'matrix2', name: 'Matrix 2', isActive: true, type: 'matrix', matrixNumber: 2 },
        { id: 'matrix3', name: 'Matrix 3', isActive: true, type: 'matrix', matrixNumber: 3 },
        { id: 'matrix4', name: 'Matrix 4', isActive: true, type: 'matrix', matrixNumber: 4 },
      ])
      
      // Fallback to default zones
      setZones([
        { id: 'mainbar', name: 'Main Bar', currentSource: 'Spotify', volume: 59, isMuted: false, isActive: true },
        { id: 'pavilion', name: 'Pavilion', currentSource: 'Spotify', volume: 45, isMuted: false, isActive: true },
        { id: 'partyroom', name: 'Party Room', currentSource: 'Spotify', volume: 45, isMuted: false, isActive: true },
        { id: 'upstairs', name: 'Upstairs', currentSource: 'Spotify', volume: 42, isMuted: false, isActive: true },
        { id: 'patio', name: 'Patio', currentSource: 'Spotify', volume: 45, isMuted: false, isActive: true },
      ])
    } finally {
      setLoading(false)
    }
  }

  const updateZoneVolume = (zoneId: string, volumeChange: number) => {
    setZones(zones.map(zone => {
      if (zone.id === zoneId) {
        const newVolume = Math.max(0, Math.min(100, zone.volume + volumeChange))
        return { ...zone, volume: newVolume }
      }
      return zone
    }))
  }

  const toggleZoneMute = (zoneId: string) => {
    setZones(zones.map(zone => {
      if (zone.id === zoneId) {
        return { ...zone, isMuted: !zone.isMuted }
      }
      return zone
    }))
  }

  const setZoneSource = (zoneId: string, source: string) => {
    setZones(zones.map(zone => {
      if (zone.id === zoneId) {
        return { ...zone, currentSource: source }
      }
      return zone
    }))
  }

  const handleInputSelection = (inputId: string) => {
    const input = audioInputs.find(i => i.id === inputId)
    
    if (!input) return

    // If it's a Matrix input, show the Wolfpack selector for video routing
    if (input.type === 'matrix' && input.matrixNumber) {
      setCurrentMatrixNumber(input.matrixNumber)
      setShowMatrixSelector(true)
    } else {
      // Direct routing for Atlas inputs (audio only)
      setSelectedInput(inputId)
      // In a real implementation, this would call the API to route audio
      console.log(`Direct audio routing: ${input.name}`)
    }
  }

  const handleMatrixInputSelected = (inputNumber: number, inputLabel: string) => {
    // Update the zone source to show the selected Wolfpack input
    console.log(`Matrix ${currentMatrixNumber} now routing from: ${inputLabel}`)
    setSelectedInput(`matrix${currentMatrixNumber}`)
    // The actual routing is handled by the WolfpackInputSelector component
    
    // Check if this input should trigger channel presets popup
    if (shouldShowChannelPresets(inputLabel)) {
      const deviceType = detectDeviceType(inputLabel)
      if (deviceType === 'cable' || deviceType === 'directv') {
        setChannelPresetDeviceType(deviceType)
        setChannelPresetInputLabel(inputLabel)
        // For DirecTV, you might want to set the device IP here if available
        // setChannelPresetDeviceIp('192.168.1.100') // Example
        setShowChannelPresets(true)
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
          <p className="text-gray-400">Loading Audio Control Center...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
      {/* Wolfpack Input Selector Modal */}
      <WolfpackInputSelector
        isOpen={showMatrixSelector}
        onClose={() => setShowMatrixSelector(false)}
        matrixNumber={currentMatrixNumber}
        onSelectInput={handleMatrixInputSelected}
      />

      {/* Channel Preset Popup */}
      <ChannelPresetPopup
        isOpen={showChannelPresets}
        onClose={() => setShowChannelPresets(false)}
        deviceType={channelPresetDeviceType}
        deviceIp={channelPresetDeviceIp}
        inputLabel={channelPresetInputLabel}
      />

      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-orange-400 mb-2">Audio Channels</h1>
        <p className="text-gray-400 text-sm">
          Matrix inputs route video sources for audio • Atlas inputs route audio directly
        </p>
        {error && (
          <div className="mt-4 bg-yellow-500/20 border border-yellow-500 text-yellow-200 px-4 py-2 rounded-lg inline-flex items-center space-x-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Using fallback configuration: {error}</span>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left Panel - Audio Inputs */}
        <div className="lg:col-span-1">
          <div className="bg-gray-800/80 backdrop-blur-sm rounded-lg p-4">
            <div className="space-y-2">
              {audioInputs.map((input) => (
                <button
                  key={input.id}
                  onClick={() => handleInputSelection(input.id)}
                  className={`w-full p-3 rounded-lg text-left transition-all flex items-center justify-between ${
                    selectedInput === input.id
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                  }`}
                  title={input.description || input.name}
                >
                  <div className="flex items-center space-x-2">
                    {input.type === 'matrix' && (
                      <Radio className="w-4 h-4 text-orange-400" />
                    )}
                    <span className="font-medium">{input.name}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 rotate-90" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Audio Control Area */}
        <div className="lg:col-span-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {zones.map((zone) => (
              <div key={zone.id} className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-4">
                {/* Zone Header */}
                <div className="text-center mb-4">
                  <div className={`${zone.isGroup ? 'bg-purple-600' : 'bg-orange-500'} text-slate-100 px-3 py-1 rounded text-sm font-bold mb-2 flex items-center justify-center space-x-1`}>
                    {zone.isGroup && <Users className="w-3 h-3" />}
                    <span>{zone.name}</span>
                  </div>
                  <div className="text-white font-medium">
                    {zone.currentSource}
                  </div>
                </div>

                {/* Volume Slider Area */}
                <div className="flex flex-col items-center space-y-4 mb-4">
                  {/* Volume Display */}
                  <div className="bg-gray-700 text-white px-3 py-2 rounded font-mono text-lg min-w-[50px] text-center">
                    {zone.volume}
                  </div>

                  {/* Volume Controls */}
                  <div className="flex flex-col space-y-2">
                    <button
                      onClick={() => updateZoneVolume(zone.id, 5)}
                      className="bg-green-600 hover:bg-green-500 text-white p-2 rounded transition-all"
                    >
                      <ChevronUp className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => updateZoneVolume(zone.id, -5)}
                      className="bg-red-600 hover:bg-red-500 text-white p-2 rounded transition-all"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Mute and Volume Icons */}
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => toggleZoneMute(zone.id)}
                    className={`p-2 rounded transition-all ${
                      zone.isMuted 
                        ? 'bg-red-600 hover:bg-red-500' 
                        : 'bg-gray-600 hover:bg-gray-500'
                    } text-white`}
                  >
                    <VolumeX className="w-5 h-5" />
                  </button>
                  <button
                    className="bg-gray-600 hover:bg-gray-500 text-white p-2 rounded transition-all"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
