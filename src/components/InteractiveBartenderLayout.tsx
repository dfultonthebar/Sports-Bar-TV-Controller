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
import { Monitor, X, Tv } from 'lucide-react'

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
}

export default function InteractiveBartenderLayout({
  layout,
  onInputSelect,
  currentSources,
  inputs
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
    return input ? input.label : `Input ${inputNum}`
  }

  // Use professional image if available, otherwise fallback to original
  const imageUrl = layout.professionalImageUrl || layout.imageUrl

  if (!imageUrl) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-12 border border-slate-700/50 text-center shadow-2xl">
        <Monitor className="w-20 h-20 mx-auto mb-6 text-slate-600" />
        <p className="text-xl text-slate-300 font-medium">No Layout Uploaded</p>
        <p className="text-sm text-slate-500 mt-3">Upload a floor plan in the Layout Editor to get started</p>
      </div>
    )
  }

  return (
    <>
      {/* Modern Layout Display */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700/50 shadow-2xl">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">{layout.name}</h2>
          <p className="text-slate-400">
            <span className="inline-flex items-center space-x-2">
              <Tv className="w-4 h-4" />
              <span>{layout.zones.length} TVs</span>
            </span>
            <span className="mx-3 text-slate-600">•</span>
            <span className="text-sm">Click any TV to change source</span>
          </p>
        </div>

        {/* Layout Container */}
        <div className="relative w-full bg-slate-950/50 rounded-xl overflow-hidden border border-slate-700/30" style={{ paddingBottom: '75%' }}>
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
              <div
                key={zone.id}
                onClick={() => handleZoneClick(zone)}
                className="absolute transition-all duration-200 cursor-pointer group flex items-center justify-center"
                style={{
                  left: `${zone.x}%`,
                  top: `${zone.y}%`,
                  width: `${zone.width}%`,
                  height: `${zone.height}%`,
                }}
              >
                {/* Consistent TV Icon Box - Same size for all TVs */}
                <div className={`relative w-12 h-12 rounded-lg shadow-xl transition-all duration-200 group-hover:scale-125 border-3 ${
                  currentInput
                    ? 'bg-gradient-to-br from-green-600 to-green-500 border-green-400'
                    : 'bg-gradient-to-br from-slate-700 to-slate-600 border-slate-500 group-hover:from-blue-600 group-hover:to-blue-500 group-hover:border-blue-400'
                }`}>
                  {/* TV Screen Icon */}
                  <div className="absolute inset-2 bg-slate-900/50 rounded flex items-center justify-center">
                    <Tv className={`w-6 h-6 ${currentInput ? 'text-green-200' : 'text-slate-400 group-hover:text-blue-200'}`} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gradient-to-r from-slate-700 to-slate-600 rounded border border-slate-500"></div>
            <span className="text-slate-400">Available</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gradient-to-r from-green-600 to-green-500 rounded border border-green-400"></div>
            <span className="text-slate-400">Active</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gradient-to-r from-blue-600 to-blue-500 rounded border border-blue-400"></div>
            <span className="text-slate-400">Hover</span>
          </div>
        </div>
      </div>

      {/* Input Selection Modal */}
      {selectedZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700 max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">
                  Select Source for {selectedZone.label || `TV ${selectedZone.outputNumber}`}
                </h3>
                <p className="text-blue-100 text-sm mt-1">Choose an input to display on this TV</p>
              </div>
              <button
                onClick={() => setSelectedZone(null)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-white" />
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
                      className={`p-5 rounded-xl text-left transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-green-600 to-green-500 text-white border-2 border-green-400 shadow-lg scale-105'
                          : 'bg-slate-800/50 hover:bg-slate-700/50 text-slate-200 border-2 border-slate-700 hover:border-blue-500 hover:scale-105'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-medium opacity-75 mb-1">
                            Input {input.channelNumber}
                          </div>
                          <div className="text-lg font-bold">
                            {input.label}
                          </div>
                        </div>
                        {isActive && (
                          <div className="text-xs bg-white/20 px-2 py-1 rounded">
                            ACTIVE
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {inputs.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No inputs configured</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
