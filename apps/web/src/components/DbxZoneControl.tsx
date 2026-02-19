'use client'

import { useState, useEffect, useCallback } from 'react'
import { Volume2, VolumeX, ChevronUp, ChevronDown, Music, Speaker } from 'lucide-react'
import { logger } from '@sports-bar/logger'

interface DbxZone {
  id: string
  zoneNumber: number
  name: string
  volumeDb: number  // Track in dB (-80 to +20)
  muted: boolean
  source: number
}

// dbx volume scale: 0=-inf, 215=0dB, 415=+20dB
function dbToRawVolume(db: number): number {
  if (db <= -80) return 0
  if (db >= 20) return 415
  if (db <= 0) return Math.round(((db + 80) / 80) * 215)
  return Math.round(215 + (db / 20) * 200)
}

function rawVolumeToDb(raw: number): number {
  if (raw <= 0) return -80
  if (raw >= 415) return 20
  if (raw <= 215) return (raw / 215) * 80 - 80
  return ((raw - 215) / 200) * 20
}

// dbx ZonePRO 1260m Router source indices (confirmed via API testing)
// Index 0 = None, 1-6 = ML1-ML6, 7-10 = S1-S4
// ML3/ML4 are wired as DJ stereo pair - selecting index 3 routes both
const DEFAULT_INPUT_LABELS: Record<number, string> = {
  0: 'None',
  1: 'ML1 - Front XLR',
  2: 'ML2 - Back XLR',
  3: 'DJ (ML3/ML4)',
  5: 'ML5 - Wireless Mic',
  6: 'ML6 (unused)',
  7: 'S1 - Jukebox',
  8: 'S2 - Matrix TV1',
  9: 'S3 - Matrix TV2',
  10: 'S4 - Spotify',
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
  const [sending, setSending] = useState<string | null>(null)

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
          volumeDb: rawVolumeToDb(z.volume ?? 0),
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

  const handleVolumeStep = async (zone: DbxZone, stepDb: number) => {
    const newDb = Math.max(-80, Math.min(20, Math.round(zone.volumeDb + stepDb)))
    const rawVolume = dbToRawVolume(newDb)

    // Optimistic update
    setZones(prev => prev.map(z =>
      z.id === zone.id ? { ...z, volumeDb: newDb } : z
    ))
    setSending(zone.id)

    try {
      const response = await fetch('/api/audio-processor/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId,
          command: {
            action: 'volume',
            zone: zone.zoneNumber,
            value: rawVolume,
          },
        }),
      })

      if (!response.ok) {
        logger.error('Failed to set dbx volume:', await response.json())
      }
    } catch (err) {
      logger.error('Error setting dbx volume:', err)
    } finally {
      setSending(null)
    }
  }

  const handleMuteToggle = async (zone: DbxZone) => {
    const newMuted = !zone.muted
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

  // Format dB display
  const formatDb = (db: number): string => {
    if (db <= -80) return '-inf'
    if (db >= 0) return `+${db}`
    return `${db}`
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
            <p className="text-slate-400 text-xs mt-0.5">Router Mode - One-way control</p>
          </div>
        </div>
      </div>

      {/* Zone controls */}
      <div className={compact ? 'space-y-3' : 'grid grid-cols-1 lg:grid-cols-2 gap-4'}>
        {zones.map(zone => (
          <div
            key={zone.id}
            className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-orange-500/50 transition-all"
          >
            {/* Zone header with name and mute */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${zone.muted ? 'bg-red-500' : 'bg-orange-400'}`} />
                <h4 className="text-sm font-semibold text-slate-100">{zone.name}</h4>
              </div>
              <button
                onClick={() => handleMuteToggle(zone)}
                className={`px-3 py-1.5 rounded-lg transition-colors text-xs font-medium ${
                  zone.muted
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                {zone.muted ? (
                  <span className="flex items-center gap-1"><VolumeX className="w-3.5 h-3.5" /> MUTED</span>
                ) : (
                  <span className="flex items-center gap-1"><Volume2 className="w-3.5 h-3.5" /> Mute</span>
                )}
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

            {/* Volume up/down controls */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Volume</label>
              <div className="flex items-center gap-3">
                {/* Down button */}
                <button
                  onClick={() => handleVolumeStep(zone, -1)}
                  disabled={zone.muted || zone.volumeDb <= -80}
                  className="flex-shrink-0 w-12 h-12 rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  <ChevronDown className="w-6 h-6 text-slate-200" />
                </button>

                {/* dB display */}
                <div className={`flex-1 text-center py-2 rounded-lg border ${
                  zone.muted
                    ? 'bg-red-900/20 border-red-500/30'
                    : zone.volumeDb <= -80
                      ? 'bg-slate-900 border-slate-700'
                      : 'bg-orange-900/20 border-orange-500/30'
                }`}>
                  <span className={`text-2xl font-bold font-mono ${
                    zone.muted ? 'text-red-400' : 'text-orange-400'
                  }`}>
                    {formatDb(Math.round(zone.volumeDb))}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">dB</span>
                  {sending === zone.id && (
                    <span className="text-xs text-slate-500 block mt-0.5">sending...</span>
                  )}
                </div>

                {/* Up button */}
                <button
                  onClick={() => handleVolumeStep(zone, 1)}
                  disabled={zone.muted || zone.volumeDb >= 20}
                  className="flex-shrink-0 w-12 h-12 rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  <ChevronUp className="w-6 h-6 text-slate-200" />
                </button>
              </div>

              {/* Quick volume presets */}
              <div className="flex gap-1.5 mt-2">
                {[
                  { label: '-inf', db: -80 },
                  { label: '-60', db: -60 },
                  { label: '-40', db: -40 },
                  { label: '-20', db: -20 },
                  { label: '0', db: 0 },
                ].map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      const rawVolume = dbToRawVolume(preset.db)
                      setZones(prev => prev.map(z =>
                        z.id === zone.id ? { ...z, volumeDb: preset.db } : z
                      ))
                      fetch('/api/audio-processor/control', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          processorId,
                          command: { action: 'volume', zone: zone.zoneNumber, value: rawVolume },
                        }),
                      }).catch(err => logger.error('Volume preset error:', err))
                    }}
                    disabled={zone.muted}
                    className={`flex-1 py-1 text-xs rounded border transition-colors disabled:opacity-30 ${
                      Math.round(zone.volumeDb) === preset.db
                        ? 'bg-orange-600 border-orange-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-orange-500/50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
