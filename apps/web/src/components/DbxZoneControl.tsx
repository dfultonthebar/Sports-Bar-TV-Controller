'use client'

import { useState, useEffect, useCallback } from 'react'
import { Volume2, VolumeX, Mic, Music, Speaker } from 'lucide-react'
import { logger } from '@sports-bar/logger'

interface DbxZone {
  id: string
  zoneNumber: number
  name: string
  volume: number
  muted: boolean
  source: number
}

// dbx ZonePRO 1260m input labels - configurable per installation
const DEFAULT_INPUT_LABELS: Record<number, string> = {
  0: 'ML1 - Front XLR',
  1: 'ML2 - Back XLR',
  2: 'ML3 - DJ Left',
  3: 'ML4 - DJ Right',
  4: 'ML5 - Wireless Mic',
  5: 'ML6 - Unused',
  6: 'S1 - Jukebox',
  7: 'S2 - Matrix TV1',
  8: 'S3 - Matrix TV2',
  9: 'S4 - Spotify',
}

interface DbxZoneControlProps {
  processorId: string
  compact?: boolean
}

export default function DbxZoneControl({ processorId, compact = false }: DbxZoneControlProps) {
  const [zones, setZones] = useState<DbxZone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inputLabels] = useState<Record<number, string>>(DEFAULT_INPUT_LABELS)

  const fetchZones = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/audio-processor/zones?processorId=${processorId}`)
      const data = await response.json()

      if (response.ok && data.zones) {
        setZones(data.zones.map((z: any) => ({
          id: z.id,
          zoneNumber: z.zoneNumber,
          name: z.name || `Zone ${z.zoneNumber}`,
          volume: z.volume ?? 50,
          muted: z.muted ?? false,
          source: z.currentSource ? parseInt(z.currentSource) || 0 : 0,
        })))
        setError(null)
      } else {
        setError(data.error || 'Failed to load zones')
      }
    } catch (err) {
      logger.error('Error fetching dbx zones:', err)
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [processorId])

  useEffect(() => {
    fetchZones()
  }, [fetchZones])

  const handleVolumeChange = async (zone: DbxZone, newVolume: number) => {
    // Optimistic update
    setZones(prev => prev.map(z =>
      z.id === zone.id ? { ...z, volume: newVolume } : z
    ))

    try {
      const response = await fetch('/api/audio-processor/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId,
          command: {
            action: 'volume',
            zone: zone.zoneNumber,
            value: newVolume,
          },
        }),
      })

      if (!response.ok) {
        logger.error('Failed to set dbx volume:', await response.json())
      }
    } catch (err) {
      logger.error('Error setting dbx volume:', err)
    }
  }

  const handleMuteToggle = async (zone: DbxZone) => {
    const newMuted = !zone.muted
    // Optimistic update
    setZones(prev => prev.map(z =>
      z.id === zone.id ? { ...z, muted: newMuted } : z
    ))

    try {
      const response = await fetch('/api/audio-processor/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId,
          command: {
            action: 'mute',
            zone: zone.zoneNumber,
            value: newMuted,
          },
        }),
      })

      if (!response.ok) {
        logger.error('Failed to toggle dbx mute:', await response.json())
      }
    } catch (err) {
      logger.error('Error toggling dbx mute:', err)
    }
  }

  const handleSourceChange = async (zone: DbxZone, sourceIndex: number) => {
    // Optimistic update
    setZones(prev => prev.map(z =>
      z.id === zone.id ? { ...z, source: sourceIndex } : z
    ))

    try {
      const response = await fetch('/api/audio-processor/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId,
          command: {
            action: 'source',
            zone: zone.zoneNumber,
            value: sourceIndex,
          },
        }),
      })

      if (!response.ok) {
        logger.error('Failed to set dbx source:', await response.json())
      }
    } catch (err) {
      logger.error('Error setting dbx source:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400" />
        <span className="ml-3 text-slate-300">Loading dbx ZonePRO zones...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
        <p className="text-red-400 font-medium">dbx ZonePRO Error</p>
        <p className="text-red-300 text-sm mt-1">{error}</p>
        <button
          onClick={fetchZones}
          className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
        >
          Retry
        </button>
      </div>
    )
  }

  if (zones.length === 0) {
    return (
      <div className="text-center py-6 text-slate-500">
        <Speaker className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No zones configured for this processor</p>
      </div>
    )
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {/* Info banner */}
      <div className="bg-gradient-to-r from-orange-900/30 to-amber-900/30 border border-orange-500/30 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Music className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-slate-200 font-medium text-sm">dbx ZonePRO 1260m</p>
            <p className="text-slate-400 text-xs mt-0.5">6 output zones, 10 inputs</p>
          </div>
        </div>
      </div>

      {/* Zone controls */}
      <div className={compact ? 'space-y-2' : 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4'}>
        {zones.map(zone => (
          <div
            key={zone.id}
            className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-orange-500/50 transition-all"
          >
            {/* Zone header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <h4 className="text-sm font-semibold text-slate-100">{zone.name}</h4>
              </div>
              <button
                onClick={() => handleMuteToggle(zone)}
                className={`p-1.5 rounded-lg transition-colors ${
                  zone.muted
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                {zone.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Source selection */}
            <div className="mb-3">
              <label className="text-xs text-slate-400 mb-1 block">Source</label>
              <select
                value={zone.source}
                onChange={(e) => handleSourceChange(zone, parseInt(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
              >
                {Object.entries(inputLabels).map(([idx, label]) => (
                  <option key={idx} value={idx}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Volume slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">Volume</label>
                <span className="text-xs font-medium text-orange-400">{zone.volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={zone.volume}
                onChange={(e) => handleVolumeChange(zone, parseInt(e.target.value))}
                disabled={zone.muted}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
