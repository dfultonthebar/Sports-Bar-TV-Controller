
'use client'

import { useState, useEffect } from 'react'
import { 
  Volume2, 
  VolumeX,
  ChevronUp, 
  ChevronDown,
  Home,
  Calculator,
  Tv,
  Heart,
  Headphones,
  Power,
  Lightbulb,
  Radio
} from 'lucide-react'
import WolfpackInputSelector from './WolfpackInputSelector'

interface AudioZone {
  id: string
  name: string
  currentSource: string
  volume: number
  isMuted: boolean
  isActive: boolean
}

interface AudioInput {
  id: string
  name: string
  isActive: boolean
  type: 'matrix' | 'direct'
  matrixNumber?: number
}

export default function AudioZoneControl() {
  const [selectedInput, setSelectedInput] = useState<string | null>('cable4')
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [showMatrixSelector, setShowMatrixSelector] = useState(false)
  const [currentMatrixNumber, setCurrentMatrixNumber] = useState<number>(1)
  
  const [zones, setZones] = useState<AudioZone[]>([
    { id: 'mainbar', name: 'Main Bar', currentSource: 'Spotify', volume: 59, isMuted: false, isActive: true },
    { id: 'pavilion', name: 'Pavilion', currentSource: 'Spotify', volume: 45, isMuted: false, isActive: true },
    { id: 'partyroom', name: 'Party Room', currentSource: 'Spotify', volume: 45, isMuted: false, isActive: true },
    { id: 'upstairs', name: 'Upstairs', currentSource: 'Spotify', volume: 42, isMuted: false, isActive: true },
    { id: 'patio', name: 'Patio', currentSource: 'Spotify', volume: 45, isMuted: false, isActive: true },
  ])

  const [audioInputs] = useState<AudioInput[]>([
    { id: 'cable1', name: 'Cable 1', isActive: true, type: 'direct' },
    { id: 'cable2', name: 'Cable 2', isActive: true, type: 'direct' },
    { id: 'matrix1', name: 'Matrix 1', isActive: true, type: 'matrix', matrixNumber: 1 },
    { id: 'matrix2', name: 'Matrix 2', isActive: true, type: 'matrix', matrixNumber: 2 },
    { id: 'matrix3', name: 'Matrix 3', isActive: true, type: 'matrix', matrixNumber: 3 },
    { id: 'matrix4', name: 'Matrix 4', isActive: true, type: 'matrix', matrixNumber: 4 },
    { id: 'dtv1', name: 'DTV 1', isActive: true, type: 'direct' },
    { id: 'dtv2', name: 'DTV 2', isActive: true, type: 'direct' },
    { id: 'patioband', name: 'Patio Band', isActive: true, type: 'direct' },
    { id: 'vipband', name: 'VIP Band', isActive: true, type: 'direct' },
    { id: 'pavilionband', name: 'Pavilion Band', isActive: true, type: 'direct' },
    { id: 'mic1', name: 'MIC 1', isActive: true, type: 'direct' },
    { id: 'mic2', name: 'MIC 2', isActive: true, type: 'direct' },
    { id: 'jukebox', name: 'Juke Box', isActive: true, type: 'direct' },
  ])

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

    // If it's a Matrix input, show the Wolfpack selector
    if (input.type === 'matrix' && input.matrixNumber) {
      setCurrentMatrixNumber(input.matrixNumber)
      setShowMatrixSelector(true)
    } else {
      // Direct routing for non-Matrix inputs
      setSelectedInput(inputId)
      // In a real implementation, this would call the API to route audio
      console.log(`Direct routing: ${input.name}`)
    }
  }

  const handleMatrixInputSelected = (inputNumber: number, inputLabel: string) => {
    // Update the zone source to show the selected Wolfpack input
    console.log(`Matrix ${currentMatrixNumber} now routing from: ${inputLabel}`)
    setSelectedInput(`matrix${currentMatrixNumber}`)
    // The actual routing is handled by the WolfpackInputSelector component
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

      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-orange-400 mb-2">Audio Channels</h1>
        <p className="text-gray-400 text-sm">
          Matrix inputs route video sources for audio • Direct inputs route audio only
        </p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {zones.map((zone) => (
              <div key={zone.id} className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-4">
                {/* Zone Header */}
                <div className="text-center mb-4">
                  <div className="bg-orange-500 text-slate-100 or text-slate-200 px-3 py-1 rounded text-sm font-bold mb-2">
                    {zone.name}
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

          {/* Bottom Control Bar */}
          <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-4">
            <div className="flex justify-center items-center space-x-6">
              <button className="bg-gray-600 hover:bg-gray-500 text-white p-3 rounded-lg transition-all">
                <Home className="w-6 h-6" />
              </button>
              <button className="bg-gray-600 hover:bg-gray-500 text-white p-3 rounded-lg transition-all">
                <Calculator className="w-6 h-6" />
              </button>
              <button className="bg-gray-600 hover:bg-gray-500 text-white p-3 rounded-lg transition-all">
                <Tv className="w-6 h-6" />
              </button>
              <button className="bg-gray-600 hover:bg-gray-500 text-white p-3 rounded-lg transition-all">
                <Heart className="w-6 h-6" />
              </button>
              <button className="bg-gray-600 hover:bg-gray-500 text-white p-3 rounded-lg transition-all">
                <Volume2 className="w-6 h-6" />
              </button>
              <button className="bg-gray-600 hover:bg-gray-500 text-white p-3 rounded-lg transition-all">
                <Headphones className="w-6 h-6" />
              </button>

              {/* 50th Anniversary Logo Placeholder */}
              <div className="bg-gray-700 text-white p-3 rounded-full">
                <div className="text-xs font-bold">50</div>
              </div>

              <button className="bg-gray-600 hover:bg-gray-500 text-white p-3 rounded-lg transition-all">
                <Lightbulb className="w-6 h-6" />
              </button>
              <button className="bg-red-600 hover:bg-red-500 text-white p-3 rounded-lg transition-all">
                <Power className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
