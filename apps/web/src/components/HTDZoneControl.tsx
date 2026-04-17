'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Volume2, VolumeX, Power, RefreshCw, ChevronUp, ChevronDown,
  Music, Minus, Plus, Speaker, AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { logger } from '@sports-bar/logger'

interface HTDZoneState {
  zone: number
  power: boolean
  volume: number
  mute: boolean
  source: number
  bass: number
  treble: number
  balance: number
}

interface HTDDevice {
  id: string
  name: string
  model: string
  zones: number
  sources: number
  status: 'online' | 'offline' | 'error'
}

interface HTDZoneControlProps {
  device: HTDDevice
  onRefresh?: () => void
  compact?: boolean
  showToneControls?: boolean
}

// Source names for HTD systems (user-configurable in future)
const DEFAULT_SOURCE_NAMES = [
  'Source 1',
  'Source 2',
  'Source 3',
  'Source 4',
  'Source 5',
  'Source 6'
]

// Zone name defaults (can be overridden)
const getDefaultZoneName = (zone: number) => `Zone ${zone}`

export default function HTDZoneControl({
  device,
  onRefresh,
  compact = false,
  showToneControls = false
}: HTDZoneControlProps) {
  const [zones, setZones] = useState<HTDZoneState[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [controllingZone, setControllingZone] = useState<number | null>(null)
  const [sourceNames] = useState<string[]>(DEFAULT_SOURCE_NAMES)

  const fetchZoneStates = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/htd/${device.id}/zones`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch zone states')
      }

      if (data.zones) {
        setZones(data.zones)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load zones'
      logger.error(`[HTD] Failed to fetch zones: ${errorMessage}`)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [device.id])

  useEffect(() => {
    fetchZoneStates()
  }, [fetchZoneStates])

  const sendCommand = async (
    command: string,
    zone?: number,
    value?: number
  ): Promise<boolean> => {
    try {
      if (zone !== undefined) {
        setControllingZone(zone)
      }

      const response = await fetch('/api/htd/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id,
          command,
          zone,
          value
        })
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Command failed')
      }

      // Update local zone state if returned
      if (data.zoneState && zone !== undefined) {
        setZones(prev => prev.map(z =>
          z.zone === zone ? { ...z, ...data.zoneState } : z
        ))
      }

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Command failed'
      logger.error(`[HTD] Command error: ${errorMessage}`)
      setError(errorMessage)
      return false
    } finally {
      setControllingZone(null)
    }
  }

  const handlePower = async (zone: number) => {
    await sendCommand('power', zone)
  }

  const handleMute = async (zone: number) => {
    await sendCommand('mute', zone)
  }

  const handleVolumeUp = async (zone: number) => {
    await sendCommand('volumeUp', zone)
  }

  const handleVolumeDown = async (zone: number) => {
    await sendCommand('volumeDown', zone)
  }

  const handleSetVolume = async (zone: number, value: number) => {
    await sendCommand('setVolume', zone, value)
  }

  const handleSetSource = async (zone: number, source: number) => {
    await sendCommand('setSource', zone, source)
  }

  const handleBassUp = async (zone: number) => {
    await sendCommand('bassUp', zone)
  }

  const handleBassDown = async (zone: number) => {
    await sendCommand('bassDown', zone)
  }

  const handleTrebleUp = async (zone: number) => {
    await sendCommand('trebleUp', zone)
  }

  const handleTrebleDown = async (zone: number) => {
    await sendCommand('trebleDown', zone)
  }

  const handleRefresh = () => {
    fetchZoneStates()
    onRefresh?.()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading zone states...
      </div>
    )
  }

  if (error && zones.length === 0) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <div className="flex items-center space-x-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          className="mt-3"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  // Compact mode for bartender remote
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Speaker className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium text-slate-200">{device.name}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={handleRefresh}>
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {zones.map(zone => (
            <div
              key={zone.zone}
              className={`p-3 rounded-lg border ${
                zone.power
                  ? 'bg-indigo-500/10 border-indigo-500/30'
                  : 'bg-slate-800/50 border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-300">
                  {getDefaultZoneName(zone.zone)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handlePower(zone.zone)}
                  disabled={controllingZone === zone.zone}
                  className={`h-6 w-6 p-0 ${zone.power ? 'text-green-400' : 'text-slate-500'}`}
                >
                  <Power className="w-3 h-3" />
                </Button>
              </div>

              {zone.power && (
                <div className="space-y-2">
                  {/* Volume */}
                  <div className="flex items-center space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleVolumeDown(zone.zone)}
                      disabled={controllingZone === zone.zone}
                      className="h-6 w-6 p-0"
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <div className="flex-1 text-center">
                      <span className="text-xs text-slate-300">{zone.volume}%</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleVolumeUp(zone.zone)}
                      disabled={controllingZone === zone.zone}
                      className="h-6 w-6 p-0"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMute(zone.zone)}
                      disabled={controllingZone === zone.zone}
                      className={`h-6 w-6 p-0 ${zone.mute ? 'text-red-400' : ''}`}
                    >
                      {zone.mute ? (
                        <VolumeX className="w-3 h-3" />
                      ) : (
                        <Volume2 className="w-3 h-3" />
                      )}
                    </Button>
                  </div>

                  {/* Source */}
                  <select
                    value={zone.source}
                    onChange={(e) => handleSetSource(zone.zone, parseInt(e.target.value))}
                    disabled={controllingZone === zone.zone}
                    className="w-full text-xs bg-slate-900 border border-slate-600 rounded-sm px-2 py-1 text-slate-200"
                  >
                    {sourceNames.slice(0, device.sources).map((name, idx) => (
                      <option key={idx + 1} value={idx + 1}>{name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Full zone control layout
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Speaker className="w-5 h-5 text-indigo-400" />
          <span className="text-lg font-medium text-slate-100">{device.name} Zones</span>
          <span className={`px-2 py-0.5 text-xs rounded-full ${
            device.status === 'online'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {device.status}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-400 text-sm">
          {error}
        </div>
      )}

      {/* Zone Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {zones.map(zone => (
          <div
            key={zone.zone}
            className={`rounded-lg border p-4 transition-all ${
              zone.power
                ? 'bg-slate-800/70 border-indigo-500/50'
                : 'bg-slate-800/30 border-slate-700'
            }`}
          >
            {/* Zone Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${zone.power ? 'bg-green-400' : 'bg-slate-500'}`} />
                <h4 className="font-semibold text-slate-100">
                  {getDefaultZoneName(zone.zone)}
                </h4>
              </div>
              <Button
                size="sm"
                variant={zone.power ? 'default' : 'outline-solid'}
                onClick={() => handlePower(zone.zone)}
                disabled={controllingZone === zone.zone}
                className={zone.power ? 'bg-green-600 hover:bg-green-500' : ''}
              >
                <Power className="w-4 h-4" />
              </Button>
            </div>

            {zone.power ? (
              <div className="space-y-4">
                {/* Volume Control */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Volume</span>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMute(zone.zone)}
                        disabled={controllingZone === zone.zone}
                        className={zone.mute ? 'text-red-400' : 'text-slate-400'}
                      >
                        {zone.mute ? (
                          <VolumeX className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </Button>
                      <span className="text-sm font-medium text-slate-200 w-10 text-right">
                        {zone.volume}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVolumeDown(zone.zone)}
                      disabled={controllingZone === zone.zone || zone.mute}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    <Slider
                      value={[zone.volume]}
                      min={0}
                      max={100}
                      step={1}
                      disabled={controllingZone === zone.zone || zone.mute}
                      onValueCommit={(value) => handleSetVolume(zone.zone, value[0])}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVolumeUp(zone.zone)}
                      disabled={controllingZone === zone.zone || zone.mute}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Source Selection */}
                <div className="space-y-2">
                  <span className="text-sm text-slate-400 flex items-center">
                    <Music className="w-4 h-4 mr-1" />
                    Source
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    {sourceNames.slice(0, device.sources).map((_, idx) => {
                      const sourceNum = idx + 1
                      return (
                        <Button
                          key={sourceNum}
                          size="sm"
                          variant={zone.source === sourceNum ? 'default' : 'outline-solid'}
                          onClick={() => handleSetSource(zone.zone, sourceNum)}
                          disabled={controllingZone === zone.zone}
                          className={`text-xs ${
                            zone.source === sourceNum
                              ? 'bg-indigo-600 hover:bg-indigo-500'
                              : ''
                          }`}
                        >
                          {sourceNum}
                        </Button>
                      )
                    })}
                  </div>
                </div>

                {/* Tone Controls (optional) */}
                {showToneControls && (
                  <div className="space-y-3 pt-3 border-t border-slate-700">
                    {/* Bass */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Bass</span>
                      <div className="flex items-center space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleBassDown(zone.zone)}
                          disabled={controllingZone === zone.zone}
                          className="h-6 w-6 p-0"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="text-xs text-slate-300 w-8 text-center">
                          {zone.bass}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleBassUp(zone.zone)}
                          disabled={controllingZone === zone.zone}
                          className="h-6 w-6 p-0"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Treble */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Treble</span>
                      <div className="flex items-center space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleTrebleDown(zone.zone)}
                          disabled={controllingZone === zone.zone}
                          className="h-6 w-6 p-0"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="text-xs text-slate-300 w-8 text-center">
                          {zone.treble}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleTrebleUp(zone.zone)}
                          disabled={controllingZone === zone.zone}
                          className="h-6 w-6 p-0"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-slate-500">
                <Power className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Zone is off</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* All Zones Control */}
      <div className="flex items-center justify-center space-x-4 pt-4 border-t border-slate-700">
        <Button
          variant="outline"
          onClick={() => sendCommand('powerAll', undefined, 1)}
          disabled={controllingZone !== null}
          className="border-green-500/50 text-green-400 hover:bg-green-500/10"
        >
          <Power className="w-4 h-4 mr-2" />
          All Zones On
        </Button>
        <Button
          variant="outline"
          onClick={() => sendCommand('powerAll', undefined, 0)}
          disabled={controllingZone !== null}
          className="border-red-500/50 text-red-400 hover:bg-red-500/10"
        >
          <Power className="w-4 h-4 mr-2" />
          All Zones Off
        </Button>
      </div>
    </div>
  )
}
