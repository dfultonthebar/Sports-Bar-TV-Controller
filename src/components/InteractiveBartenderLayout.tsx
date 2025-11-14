'use client'

/**
 * Interactive Bartender Layout Component
 *
 * Modern, professional TV layout with:
 * - Click TV to show input selector
 * - Real-time source display
 * - Clean, modern appearance
 */

import { useState } from 'react'
import { Monitor, X, Tv, Hash, Play } from 'lucide-react'

interface Zone {
  id: string
  outputNumber: number
  x: number
  y: number
  width: number
  height: number
  label?: string
  confidence?: number
}

interface TVLayout {
  id?: string
  name: string
  imageUrl?: string
  professionalImageUrl?: string
  zones: Zone[]
}

interface MatrixInput {
  id: string
  channelNumber: number
  label: string
}

interface Props {
  layout: TVLayout
  onInputSelect: (inputNumber: number, outputNumber: number) => void
  currentSources?: Map<number, number> // outputNumber -> inputNumber
  inputs: MatrixInput[]
  currentChannels?: Record<number, {
    channelNumber: string
    channelName: string | null
    deviceType: string
    inputLabel: string
  }>
}

export default function InteractiveBartenderLayout({
  layout,
  onInputSelect,
  currentSources,
  inputs,
  currentChannels = {}
}: Props) {
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)

  const handleZoneClick = (zone: Zone) => {
    setSelectedZone(zone)
  }

  const handleInputSelect = (inputNumber: number) => {
    if (selectedZone) {
      onInputSelect(inputNumber, selectedZone.outputNumber)
      setSelectedZone(null) // Close modal
    }
  }

  const getCurrentInputLabel = (outputNumber: number): string | null => {
    if (!currentSources) return null
    const inputNum = currentSources.get(outputNumber)
    if (!inputNum) return null

    const input = inputs.find(i => i.channelNumber === inputNum)
    if (!input) return `Input ${inputNum}`

    // Check if this input has current channel info
    const channelInfo = currentChannels[inputNum]
    if (channelInfo) {
      if (channelInfo.channelName) {
        // Show preset name if available (e.g., "Cable Box 1 - ESPN")
        return `${input.label} - ${channelInfo.channelName}`
      } else {
        // Show channel number if no preset name (e.g., "Cable Box 1 - Ch 40")
        return `${input.label} - Ch ${channelInfo.channelNumber}`
      }
    }

    return input.label
  }

  // Use professional image if available, otherwise fallback to original
  const imageUrl = layout.professionalImageUrl || layout.imageUrl

  if (!imageUrl) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-12 text-center">
        <Monitor className="w-20 h-20 mx-auto mb-6 text-slate-400" />
        <p className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">No Layout Uploaded</p>
        <p className="text-sm text-slate-400 mt-3">Upload a floor plan in the Layout Editor to get started</p>
      </div>
    )
  }

  return (
    <>
      {/* Modern Layout Display */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-8">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">{layout.name}</h2>
          <p className="text-slate-300">
            <span className="inline-flex items-center space-x-2">
              <Tv className="w-4 h-4" />
              <span>{layout.zones.length} TVs</span>
            </span>
            <span className="mx-3 text-slate-500">•</span>
            <span className="text-sm">25 Wolf Pack Inputs</span>
            <span className="mx-3 text-slate-500">•</span>
            <span className="text-sm">Click any TV to change source</span>
          </p>
        </div>

        {/* Layout Container */}
        <div className="relative w-full backdrop-blur-xl bg-white/5 rounded-xl overflow-hidden border border-white/10 shadow-xl" style={{ paddingBottom: '75%' }}>
          {/* Background Image */}
          <img
            src={imageUrl}
            alt={layout.name}
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Interactive TV Zones */}
          {layout.zones.map((zone) => {
            const currentInput = getCurrentInputLabel(zone.outputNumber)
            const zoneLabel = zone.label || `TV ${zone.outputNumber}`

            return (
              <button
                key={zone.id}
                onClick={() => handleZoneClick(zone)}
                className="group absolute transition-all duration-300 cursor-pointer hover:z-30"
                style={{
                  left: `${zone.x + zone.width / 2}%`,
                  top: `${zone.y + zone.height / 2}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                title={`${zoneLabel}${currentInput ? ` - ${currentInput}` : ''}`}
              >
                {/* Icon Container - ENLARGED WITHOUT BLUE EFFECTS */}
                <div className={`relative backdrop-blur-xl rounded-xl border-2 shadow-xl hover:scale-105 transition-all duration-300 min-w-[60px] ${
                  currentInput
                    ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-400/30'
                    : 'bg-gradient-to-br from-slate-500/10 to-gray-500/10 border-white/10 hover:from-green-500/20 hover:to-emerald-500/20 hover:border-green-400/50'
                }`}>
                  {/* TV Icon - LARGER ICON */}
                  <div className="relative z-10 p-3 flex flex-col items-center">
                    <Tv className={`w-12 h-12 ${currentInput ? 'text-green-400' : 'text-slate-300 group-hover:text-green-400'}`} />
                    {/* Current Input Label */}
                    {currentInput && (
                      <div className="mt-2 px-3 py-1 bg-black/60 rounded-lg text-xs font-semibold text-white whitespace-nowrap">
                        {currentInput}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Legend - LARGER ICONS FOR BETTER VISIBILITY */}
        <div className="mt-6 flex items-center justify-center space-x-8 text-sm">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 backdrop-blur-xl bg-gradient-to-br from-slate-500/10 to-gray-500/10 rounded-xl border-2 border-white/10 shadow-lg flex items-center justify-center">
              <Tv className="w-4 h-4 text-slate-300" />
            </div>
            <span className="text-slate-300 font-medium">Available</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative w-8 h-8 backdrop-blur-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border-2 border-green-400/30 shadow-lg flex items-center justify-center">
              <Tv className="w-4 h-4 text-green-400" />
              <div className="absolute -top-1 -left-1 w-3 h-3 bg-green-500 rounded-full border border-white text-[8px] flex items-center justify-center font-bold">
                #
              </div>
            </div>
            <span className="text-slate-300 font-medium">Active (Input# + Name)</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 backdrop-blur-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border-2 border-green-400/50 shadow-lg flex items-center justify-center">
              <Tv className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-slate-300 font-medium">Hover</span>
          </div>
        </div>
      </div>

      {/* Input Selection Modal */}
      {selectedZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="backdrop-blur-xl bg-gradient-to-r from-slate-500/10 to-gray-500/10 border-b border-white/10 px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                  Select Source for {selectedZone.label || `TV ${selectedZone.outputNumber}`}
                </h3>
                <p className="text-slate-300 text-sm mt-1">Choose an input to display on this TV</p>
              </div>
              <button
                onClick={() => setSelectedZone(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-slate-300" />
              </button>
            </div>

            {/* Input List */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {inputs.map((input) => {
                  const isActive = currentSources?.get(selectedZone.outputNumber) === input.channelNumber

                  return (
                    <button
                      key={input.id}
                      onClick={() => handleInputSelect(input.channelNumber)}
                      className={`group relative backdrop-blur-xl rounded-xl border-2 shadow-xl p-5 text-left transition-all duration-300 hover:scale-105 ${
                        isActive
                          ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-400/50'
                          : 'bg-gradient-to-br from-slate-500/10 to-gray-500/10 border-white/10 hover:from-green-500/20 hover:to-emerald-500/20 hover:border-green-400/50'
                      }`}
                    >
                      <div className="relative z-10 flex items-center justify-between">
                        <div>
                          <div className={`text-xs font-medium mb-1 ${isActive ? 'text-green-300' : 'text-slate-400'}`}>
                            Input {input.channelNumber}
                          </div>
                          <div className={`text-lg font-bold ${isActive ? 'text-white' : 'text-slate-200'}`}>
                            {input.label}
                          </div>
                        </div>
                        {isActive && (
                          <div className="relative">
                            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                            <span className="absolute inset-0 animate-ping">
                              <div className="w-3 h-3 bg-green-400 rounded-full opacity-75"></div>
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {inputs.length === 0 && (
                <div className="text-center py-12">
                  <Monitor className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-300">No inputs configured</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
