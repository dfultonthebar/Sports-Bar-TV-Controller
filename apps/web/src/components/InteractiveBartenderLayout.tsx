'use client'

/**
 * Interactive Bartender Layout Component
 *
 * Modern, professional TV layout with:
 * - Click TV to show input selector
 * - Real-time source display
 * - Room-based filtering
 * - Clean, modern appearance
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Monitor, X, Tv, Grid2X2, Maximize, Power } from 'lucide-react'
import { logger } from '@sports-bar/logger'

interface Room {
  id: string
  name: string
  color: string
  imageUrl?: string
}

interface Zone {
  id: string
  outputNumber: number
  x: number
  y: number
  width: number
  height: number
  label?: string
  room?: string
  confidence?: number
}

interface TVLayout {
  id?: string
  name: string
  imageUrl?: string
  professionalImageUrl?: string
  zones: Zone[]
  rooms?: Room[]
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
  onRefreshRoutes?: () => Promise<void>
}

export default function InteractiveBartenderLayout({
  layout,
  onInputSelect,
  currentSources,
  inputs,
  currentChannels = {},
  onRefreshRoutes
}: Props) {
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)
  const [multiViewCardId, setMultiViewCardId] = useState<string | null>(null)
  const [multiViewMode, setMultiViewMode] = useState<number>(0)
  const [multiViewLoading, setMultiViewLoading] = useState(false)
  const [imageAspectRatio, setImageAspectRatio] = useState<number>(4 / 3)
  const [powerLoading, setPowerLoading] = useState<number | null>(null) // outputNumber being toggled
  const [powerMessage, setPowerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const layoutImageRef = useRef<HTMLImageElement>(null)

  const rooms = layout.rooms || []

  // Load multi-view card
  useEffect(() => {
    fetch('/api/wolfpack/multiview')
      .then(r => r.json())
      .then(data => {
        if (data.cards?.length > 0) {
          setMultiViewCardId(data.cards[0].id)
          setMultiViewMode(data.cards[0].currentMode ?? 0)
        }
      })
      .catch(() => {})
  }, [])

  const toggleMultiView = useCallback(async () => {
    if (!multiViewCardId) return
    const newMode = multiViewMode === 0 ? 6 : 0
    setMultiViewLoading(true)
    try {
      const response = await fetch(`/api/wolfpack/multiview/${multiViewCardId}/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode })
      })
      const data = await response.json()
      if (data.success) setMultiViewMode(newMode)
    } catch (error) {
      logger.error('Multi-view toggle failed:', error)
    } finally {
      setMultiViewLoading(false)
    }
  }, [multiViewCardId, multiViewMode])

  // Default to Main Bar room if it exists, otherwise first room
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('')

  // Set default room when layout loads - prefer "Main Bar"
  useEffect(() => {
    if (rooms.length > 0 && !selectedRoomFilter) {
      const mainBar = rooms.find(r => r.name.toLowerCase().includes('main bar'))
      setSelectedRoomFilter(mainBar?.id || rooms[0].id)
    }
  }, [rooms, selectedRoomFilter])

  // Filter zones by room (no 'all' option when rooms are defined)
  const filteredZones = !selectedRoomFilter || selectedRoomFilter === 'all' || rooms.length === 0
    ? layout.zones
    : layout.zones.filter(z => z.room === selectedRoomFilter)

  // Get room info for a zone
  const getRoomInfo = (zone: Zone): Room | undefined => {
    return rooms.find(r => r.id === zone.room)
  }

  const handleZoneClick = (zone: Zone) => {
    setSelectedZone(zone)
    setPowerMessage(null)
    // Refresh routes so the highlighted input is up-to-date
    onRefreshRoutes?.()
  }

  const handleInputSelect = (inputNumber: number) => {
    if (selectedZone) {
      onInputSelect(inputNumber, selectedZone.outputNumber)
      setSelectedZone(null)
    }
  }

  const handlePowerToggle = useCallback(async (outputNumber: number) => {
    setPowerLoading(outputNumber)
    setPowerMessage(null)
    try {
      const response = await fetch(`/api/tv-control/by-output/${outputNumber}/power`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle' })
      })
      const data = await response.json()
      if (data.success) {
        setPowerMessage({ type: 'success', text: `${data.tvName || `TV ${outputNumber}`} power toggled` })
      } else {
        setPowerMessage({ type: 'error', text: data.error || 'Power control failed' })
      }
    } catch (error) {
      logger.error('[LAYOUT] Power toggle failed:', error)
      setPowerMessage({ type: 'error', text: 'Failed to send power command' })
    } finally {
      setPowerLoading(null)
    }
  }, [])

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

  // Get the current image to display based on room filter
  // When a room is selected, show its specific image if available
  const selectedRoom = selectedRoomFilter !== 'all'
    ? rooms.find(r => r.id === selectedRoomFilter)
    : null
  const imageUrl = selectedRoom?.imageUrl
    || layout.professionalImageUrl
    || layout.imageUrl

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
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-3 sm:p-4">
        {/* Header */}
        <div className="mb-2 sm:mb-4">
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

        {/* Room Filter Tabs + Quad View Toggle */}
        {rooms.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {multiViewCardId && (
              <button
                onClick={toggleMultiView}
                disabled={multiViewLoading}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 border ${
                  multiViewMode === 6
                    ? 'bg-purple-600/30 text-purple-300 border-purple-500'
                    : 'bg-slate-700/50 text-slate-400 border-white/10 hover:bg-slate-600/50'
                } ${multiViewLoading ? 'opacity-50' : ''}`}
              >
                {multiViewMode === 6 ? <Maximize className="w-4 h-4" /> : <Grid2X2 className="w-4 h-4" />}
                {multiViewLoading ? '...' : multiViewMode === 6 ? 'Single View' : 'Quad View'}
              </button>
            )}
            {rooms.map((room) => {
              const roomZoneCount = layout.zones.filter(z => z.room === room.id).length
              return (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoomFilter(room.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    selectedRoomFilter === room.id
                      ? 'text-white border'
                      : 'text-slate-400 border border-white/10 hover:bg-white/10'
                  }`}
                  style={{
                    backgroundColor: selectedRoomFilter === room.id ? `${room.color}30` : undefined,
                    borderColor: selectedRoomFilter === room.id ? room.color : undefined
                  }}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: room.color }}
                  />
                  {room.name} ({roomZoneCount})
                </button>
              )
            })}
          </div>
        )}

        {/* Layout Container - aspect ratio matches actual image so zones align */}
        <div className="relative w-full backdrop-blur-xl bg-slate-900/50 rounded-xl overflow-hidden border border-white/10 shadow-xl max-h-[calc(100vh-200px)]" style={{ aspectRatio: String(imageAspectRatio) }}>
          {/* Background Floor Plan Image */}
          {imageUrl && (
            <img
              ref={layoutImageRef}
              src={imageUrl}
              alt="Floor plan"
              className="absolute inset-0 w-full h-full object-fill opacity-40 pointer-events-none"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget
                if (img.naturalWidth && img.naturalHeight) {
                  setImageAspectRatio(img.naturalWidth / img.naturalHeight)
                }
              }}
            />
          )}

          {/* Interactive TV Zones */}
          {filteredZones.map((zone) => {
            const currentInput = getCurrentInputLabel(zone.outputNumber)
            const zoneLabel = zone.label || `TV ${zone.outputNumber}`
            const roomInfo = getRoomInfo(zone)
            const roomColor = roomInfo?.color

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
                title={`${zoneLabel}${roomInfo ? ` (${roomInfo.name})` : ''}${currentInput ? ` - ${currentInput}` : ''}`}
              >
                {/* Icon Container - Compact sizing to prevent overlapping */}
                <div
                  className={`relative backdrop-blur-xl border-2 shadow-xl hover:scale-105 transition-all duration-300
                    min-w-[32px] sm:min-w-[36px] md:min-w-[40px] lg:min-w-[44px] xl:min-w-[48px] ${
                    currentInput
                      ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20'
                      : 'bg-gradient-to-br from-slate-500/10 to-gray-500/10 hover:from-green-500/20 hover:to-emerald-500/20'
                  }`}
                  style={{
                    borderColor: roomColor ? `${roomColor}80` : (currentInput ? 'rgb(74 222 128 / 0.3)' : 'rgb(255 255 255 / 0.1)')
                  }}
                >
                  {/* Room Color Indicator */}
                  {roomInfo && (
                    <div
                      className="absolute -top-1 -right-1 w-3 h-3 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: roomColor }}
                      title={roomInfo.name}
                    />
                  )}
                  {/* TV Icon - Compact sizing to prevent overlap */}
                  <div className="relative z-10 p-1.5 sm:p-2 md:p-2 lg:p-2.5 xl:p-2.5 flex flex-col items-center">
                    <Tv className={`w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 xl:w-9 xl:h-9 ${currentInput ? 'text-green-400' : 'text-slate-300 group-hover:text-green-400'}`} />
                    {/* Current Input Label - Compact text */}
                    {currentInput && (
                      <div className="mt-0.5 sm:mt-1 md:mt-1 px-1.5 sm:px-2 md:px-2 py-0.5 bg-black/60 rounded text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs font-semibold text-white truncate max-w-[50px] sm:max-w-[60px] md:max-w-[70px] lg:max-w-[80px] xl:max-w-[90px]">
                        {currentInput}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Legend - LARGER SQUARE ICONS FOR BETTER VISIBILITY */}
        <div className="mt-6 flex items-center justify-center space-x-8 text-sm">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 backdrop-blur-xl bg-gradient-to-br from-slate-500/10 to-gray-500/10 border-2 border-white/10 shadow-lg flex items-center justify-center">
              <Tv className="w-4 h-4 text-slate-300" />
            </div>
            <span className="text-slate-300 font-medium">Available</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative w-8 h-8 backdrop-blur-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-400/30 shadow-lg flex items-center justify-center">
              <Tv className="w-4 h-4 text-green-400" />
              <div className="absolute -top-1 -left-1 w-3 h-3 bg-green-500 rounded-full border border-white text-[8px] flex items-center justify-center font-bold">
                #
              </div>
            </div>
            <span className="text-slate-300 font-medium">Active (Input# + Name)</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 backdrop-blur-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-400/50 shadow-lg flex items-center justify-center">
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
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                  {selectedZone.label || `TV ${selectedZone.outputNumber}`}
                </h3>
                <p className="text-slate-300 text-sm mt-1">Select source or toggle power</p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                {/* Power Toggle Button */}
                <button
                  onClick={() => handlePowerToggle(selectedZone.outputNumber)}
                  disabled={powerLoading === selectedZone.outputNumber}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all
                    ${powerLoading === selectedZone.outputNumber
                      ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400'
                      : 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 active:scale-95'
                    }`}
                >
                  <Power className={`w-5 h-5 ${powerLoading === selectedZone.outputNumber ? 'animate-spin' : ''}`} />
                  {powerLoading === selectedZone.outputNumber ? 'Sending...' : 'Power'}
                </button>
                {/* Close Button */}
                <button
                  onClick={() => setSelectedZone(null)}
                  className="p-3 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-slate-300" />
                </button>
              </div>
            </div>
            {/* Power feedback message */}
            {powerMessage && (
              <div className={`mx-6 mt-3 px-4 py-2 rounded-lg text-sm ${
                powerMessage.type === 'success'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {powerMessage.text}
              </div>
            )}

            {/* Input List */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {inputs.map((input) => {
                  const isActive = currentSources?.get(selectedZone.outputNumber) === input.channelNumber

                  return (
                    <button
                      key={input.id}
                      onClick={() => handleInputSelect(input.channelNumber)}
                      className={`group relative backdrop-blur-xl border-2 shadow-xl p-5 text-left transition-all duration-300 hover:scale-105 ${
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
