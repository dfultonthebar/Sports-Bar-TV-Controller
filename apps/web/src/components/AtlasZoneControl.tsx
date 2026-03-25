'use client'

import { useState, useEffect, useCallback } from 'react'
import { Volume2, VolumeX, Minus, Plus } from 'lucide-react'
import { logger } from '@sports-bar/logger'

interface AtlasZone {
  id: string
  zoneNumber: number
  name: string
  volume: number
  muted: boolean
  currentSource: string | null
  enabled: boolean
}

interface AtlasSource {
  index: number
  name: string
}

interface AtlasZoneControlProps {
  processorId: string
  processorIp: string
  compact?: boolean
}

export default function AtlasZoneControl({
  processorId,
  processorIp,
  compact = false,
}: AtlasZoneControlProps) {
  const [zones, setZones] = useState<AtlasZone[]>([])
  const [sources, setSources] = useState<AtlasSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingVolumes, setPendingVolumes] = useState<Map<number, number>>(new Map())

  const fetchZones = useCallback(async () => {
    try {
      const response = await fetch(`/api/audio-processor?id=${processorId}`)
      if (!response.ok) throw new Error('Failed to fetch processor')
      const data = await response.json()

      // Zones come from the database
      const res2 = await fetch(`/api/atlas/output-meters?processorIp=${processorIp}`)
      const meterData = res2.ok ? await res2.json() : { meters: [] }

      // Get zones from DB via a simple query
      const res3 = await fetch(`/api/audio-processor/zones?processorId=${processorId}`)
      if (res3.ok) {
        const zoneData = await res3.json()
        setZones(zoneData.zones || [])
      }
      setError(null)
    } catch (err) {
      logger.error('Error fetching zones:', err)
      setError(err instanceof Error ? err.message : 'Failed to load zones')
    } finally {
      setLoading(false)
    }
  }, [processorId, processorIp])

  const fetchSources = useCallback(async () => {
    try {
      const response = await fetch(`/api/atlas/sources?processorIp=${processorIp}`)
      if (!response.ok) throw new Error('Failed to fetch sources')
      const data = await response.json()
      setSources(data.sources || [])
    } catch (err) {
      logger.error('Error fetching sources:', err)
    }
  }, [processorIp])

  useEffect(() => {
    if (processorId && processorIp) {
      fetchZones()
      fetchSources()
    }
  }, [processorId, processorIp, fetchZones, fetchSources])

  const handleVolumeChange = async (zoneNumber: number, newVolume: number) => {
    const clamped = Math.max(0, Math.min(100, newVolume))
    // Optimistic update
    setZones(prev => prev.map(z =>
      z.zoneNumber === zoneNumber ? { ...z, volume: clamped } : z
    ))

    try {
      const response = await fetch('/api/audio-processor/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId,
          command: { action: 'volume', zone: zoneNumber + 1, value: clamped }
        })
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to set volume')
      }
    } catch (err) {
      logger.error('Error setting volume:', err)
      fetchZones() // Revert to actual state
    }
  }

  const handleMuteToggle = async (zoneNumber: number, currentMuted: boolean) => {
    const newMuted = !currentMuted
    // Optimistic update
    setZones(prev => prev.map(z =>
      z.zoneNumber === zoneNumber ? { ...z, muted: newMuted } : z
    ))

    try {
      const response = await fetch('/api/audio-processor/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId,
          command: { action: 'mute', zone: zoneNumber + 1, value: newMuted }
        })
      })
      if (!response.ok) {
        throw new Error('Failed to toggle mute')
      }
    } catch (err) {
      logger.error('Error toggling mute:', err)
      fetchZones()
    }
  }

  const handleSourceChange = async (zoneNumber: number, sourceIndex: number) => {
    setZones(prev => prev.map(z =>
      z.zoneNumber === zoneNumber ? { ...z, currentSource: String(sourceIndex) } : z
    ))

    try {
      const response = await fetch('/api/audio-processor/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId,
          command: { action: 'source', zone: zoneNumber + 1, value: sourceIndex }
        })
      })
      if (!response.ok) {
        throw new Error('Failed to change source')
      }
    } catch (err) {
      logger.error('Error changing source:', err)
      fetchZones()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-6">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={fetchZones} className="mt-2 text-xs text-teal-400 hover:underline">Retry</button>
      </div>
    )
  }

  if (zones.length === 0) {
    return <div className="text-center py-6 text-slate-400 text-sm">No zones configured</div>
  }

  return (
    <div className="space-y-3">
      {zones.filter(z => z.enabled).map(zone => (
        <div
          key={zone.id}
          className={`rounded-xl border p-4 transition-colors ${
            zone.muted
              ? 'border-red-500/30 bg-red-950/20'
              : 'border-slate-700 bg-slate-800/50'
          }`}
        >
          {/* Zone header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Volume2 className={`w-4 h-4 ${zone.muted ? 'text-red-400' : 'text-teal-400'}`} />
              <span className="font-medium text-white text-sm">{zone.name}</span>
            </div>
            <button
              onClick={() => handleMuteToggle(zone.zoneNumber, zone.muted)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                zone.muted
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {zone.muted ? 'MUTED' : 'Mute'}
            </button>
          </div>

          {/* Volume control */}
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => handleVolumeChange(zone.zoneNumber, zone.volume - 5)}
              className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
            >
              <Minus className="w-4 h-4 text-slate-300" />
            </button>
            <div className="flex-1 relative">
              <input
                type="range"
                min={0}
                max={100}
                value={zone.volume}
                onChange={(e) => handleVolumeChange(zone.zoneNumber, parseInt(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-700 accent-teal-500"
              />
            </div>
            <button
              onClick={() => handleVolumeChange(zone.zoneNumber, zone.volume + 5)}
              className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
            >
              <Plus className="w-4 h-4 text-slate-300" />
            </button>
            <span className="text-sm font-mono text-slate-300 w-10 text-right">{zone.volume}%</span>
          </div>

          {/* Source selector */}
          {!compact && sources.length > 0 && (
            <select
              value={zone.currentSource || ''}
              onChange={(e) => handleSourceChange(zone.zoneNumber, parseInt(e.target.value))}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-300"
            >
              <option value="">No Source</option>
              {sources.map(src => (
                <option key={src.index} value={src.index}>{src.name}</option>
              ))}
            </select>
          )}
        </div>
      ))}
    </div>
  )
}
