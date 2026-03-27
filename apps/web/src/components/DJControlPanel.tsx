'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Music, Volume2, Radio, Zap } from 'lucide-react'
import { logger } from '@sports-bar/logger'

const PROCESSOR_ID = '3641dcba-98b8-4f7c-b0ae-d4c7dbecaed9'
const ATLAS_IP = '10.11.3.246'

interface AtlasSource {
  index: number
  name: string
}

interface AudioZone {
  id: string
  zoneNumber: number
  name: string
  volume: number
  muted: boolean
  enabled: boolean
}

// Wolf Pack audio outputs that feed into Atlas source indices
const WOLFPACK_AUDIO_OPTIONS: AtlasSource[] = [
  { index: 4, name: 'Matrix Audio 1' },
  { index: 5, name: 'Matrix Audio 2' },
  { index: 6, name: 'Matrix Audio 3' },
  { index: 7, name: 'Matrix Audio 4' },
]

export default function DJControlPanel() {
  const [djSources, setDjSources] = useState<AtlasSource[]>([])
  const [selectedDJSource, setSelectedDJSource] = useState<number | null>(null)
  const [selectedGameSource, setSelectedGameSource] = useState<number>(WOLFPACK_AUDIO_OPTIONS[0].index)
  const [zones, setZones] = useState<AudioZone[]>([])
  const [selectedZones, setSelectedZones] = useState<Set<number>>(new Set())
  const [isDJMode, setIsDJMode] = useState(true)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [zoneVolumes, setZoneVolumes] = useState<Map<number, number>>(new Map())
  const [volumeTimers, setVolumeTimers] = useState<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  // Fetch Atlas sources
  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch(`/api/atlas/sources?processorIp=${ATLAS_IP}`)
      const data = await res.json()
      if (data.success && data.sources) {
        setDjSources(data.sources)
        // Auto-select DJ Audio if available
        const djSource = data.sources.find((s: AtlasSource) => s.name.toLowerCase().includes('dj'))
        if (djSource && selectedDJSource === null) {
          setSelectedDJSource(djSource.index)
        }
      }
    } catch (err) {
      logger.error('[DJ_PANEL] Failed to fetch sources:', err)
    }
  }, [selectedDJSource])

  // Fetch Atlas zones
  const fetchZones = useCallback(async () => {
    try {
      const res = await fetch(`/api/audio-processor/zones?processorId=${PROCESSOR_ID}`)
      const data = await res.json()
      if (data.zones) {
        const enabledZones = data.zones.filter((z: AudioZone) => z.enabled)
        setZones(enabledZones)
        // Initialize volume map
        const volMap = new Map<number, number>()
        enabledZones.forEach((z: AudioZone) => volMap.set(z.zoneNumber, z.volume))
        setZoneVolumes(volMap)
      }
    } catch (err) {
      logger.error('[DJ_PANEL] Failed to fetch zones:', err)
    }
  }, [])

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Save DJ mode state (debounced)
  const saveDJState = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch('/api/settings/dj-mode', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isActive: true,
            activeMode: isDJMode ? 'dj' : 'game',
            djSourceIndex: selectedDJSource,
            djSourceName: djSources.find(s => s.index === selectedDJSource)?.name,
            gameAudioSourceIndex: selectedGameSource,
            gameAudioSourceName: WOLFPACK_AUDIO_OPTIONS.find(s => s.index === selectedGameSource)?.name,
            selectedZones: Array.from(selectedZones),
          }),
        })
      } catch {}
    }, 500)
  }, [isDJMode, selectedDJSource, selectedGameSource, selectedZones, djSources])

  // Load saved state on mount
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchSources(), fetchZones()])

      // Restore saved state
      try {
        const res = await fetch('/api/settings/dj-mode')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.state?.isActive) {
            if (data.state.activeMode === 'dj') setIsDJMode(true)
            else setIsDJMode(false)
            if (data.state.djSourceIndex != null) setSelectedDJSource(data.state.djSourceIndex)
            if (data.state.gameAudioSourceIndex != null) setSelectedGameSource(data.state.gameAudioSourceIndex)
            if (data.state.selectedZones?.length > 0) setSelectedZones(new Set(data.state.selectedZones))
          }
        }
      } catch {}

      setLoading(false)
    }
    init()
  }, [fetchSources, fetchZones])

  // Auto-save when state changes
  useEffect(() => {
    if (!loading) saveDJState()
  }, [isDJMode, selectedDJSource, selectedGameSource, selectedZones, loading, saveDJState])

  // Switch audio source for all selected zones
  const switchSource = useCallback(async (sourceIndex: number) => {
    if (selectedZones.size === 0) {
      setStatusMessage('Select at least one zone')
      setTimeout(() => setStatusMessage(null), 3000)
      return
    }

    setSwitching(true)
    setStatusMessage(null)

    try {
      const commands = Array.from(selectedZones).map((zoneNumber) =>
        fetch('/api/audio-processor/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            processorId: PROCESSOR_ID,
            command: {
              action: 'source',
              zone: zoneNumber + 1,
              value: sourceIndex,
            },
          }),
        })
      )

      const results = await Promise.all(commands)
      const allOk = results.every((r) => r.ok)

      if (allOk) {
        setStatusMessage(`Switched ${selectedZones.size} zone${selectedZones.size > 1 ? 's' : ''} successfully`)
      } else {
        setStatusMessage('Some zones failed to switch')
      }
    } catch (err) {
      logger.error('[DJ_PANEL] Switch source error:', err)
      setStatusMessage('Error switching zones')
    } finally {
      setSwitching(false)
      setTimeout(() => setStatusMessage(null), 3000)
    }
  }, [selectedZones])

  // Handle the big toggle button
  const handleModeToggle = useCallback(() => {
    const newMode = !isDJMode
    setIsDJMode(newMode)

    const sourceIndex = newMode ? selectedDJSource : selectedGameSource
    if (sourceIndex !== null && sourceIndex !== undefined) {
      switchSource(sourceIndex)
    }
  }, [isDJMode, selectedDJSource, selectedGameSource, switchSource])

  // Handle volume change with debounce
  const handleVolumeChange = useCallback((zoneNumber: number, value: number) => {
    setZoneVolumes((prev) => {
      const next = new Map(prev)
      next.set(zoneNumber, value)
      return next
    })

    // Clear existing timer for this zone
    const existing = volumeTimers.get(zoneNumber)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(async () => {
      try {
        await fetch('/api/audio-processor/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            processorId: PROCESSOR_ID,
            command: {
              action: 'volume',
              zone: zoneNumber + 1,
              value: value,
            },
          }),
        })
      } catch (err) {
        logger.error('[DJ_PANEL] Volume change error:', err)
      }
    }, 200)

    setVolumeTimers((prev) => {
      const next = new Map(prev)
      next.set(zoneNumber, timer)
      return next
    })
  }, [volumeTimers])

  // Zone selection helpers
  const toggleZone = (zoneNumber: number) => {
    setSelectedZones((prev) => {
      const next = new Set(prev)
      if (next.has(zoneNumber)) {
        next.delete(zoneNumber)
      } else {
        next.add(zoneNumber)
      }
      return next
    })
  }

  const selectAllZones = () => {
    setSelectedZones(new Set(zones.map((z) => z.zoneNumber)))
  }

  const clearAllZones = () => {
    setSelectedZones(new Set())
  }

  // Quick presets
  const applyPreset = useCallback(async (preset: 'dj-main-bar' | 'dj-everywhere' | 'game-all') => {
    if (selectedDJSource === null && preset !== 'game-all') {
      setStatusMessage('Select a DJ source first')
      setTimeout(() => setStatusMessage(null), 3000)
      return
    }

    let targetZones: Set<number>
    let sourceIndex: number

    switch (preset) {
      case 'dj-main-bar': {
        // Find a zone with "main" or "bar" in the name
        const mainBarZone = zones.find(
          (z) => z.name.toLowerCase().includes('main') || z.name.toLowerCase().includes('bar')
        )
        targetZones = mainBarZone ? new Set([mainBarZone.zoneNumber]) : new Set([zones[0]?.zoneNumber].filter(Boolean))
        sourceIndex = selectedDJSource!
        setIsDJMode(true)
        break
      }
      case 'dj-everywhere':
        targetZones = new Set(zones.map((z) => z.zoneNumber))
        sourceIndex = selectedDJSource!
        setIsDJMode(true)
        break
      case 'game-all':
        targetZones = new Set(zones.map((z) => z.zoneNumber))
        sourceIndex = selectedGameSource
        setIsDJMode(false)
        break
    }

    setSelectedZones(targetZones)

    // Fire commands
    setSwitching(true)
    try {
      const commands = Array.from(targetZones).map((zoneNumber) =>
        fetch('/api/audio-processor/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            processorId: PROCESSOR_ID,
            command: {
              action: 'source',
              zone: zoneNumber + 1,
              value: sourceIndex,
            },
          }),
        })
      )
      await Promise.all(commands)
      setStatusMessage(`Preset applied to ${targetZones.size} zone${targetZones.size > 1 ? 's' : ''}`)
    } catch (err) {
      logger.error('[DJ_PANEL] Preset error:', err)
      setStatusMessage('Error applying preset')
    } finally {
      setSwitching(false)
      setTimeout(() => setStatusMessage(null), 3000)
    }
  }, [zones, selectedDJSource, selectedGameSource])

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <div className="flex items-center justify-center gap-3 text-slate-400">
          <div className="animate-spin h-5 w-5 border-2 border-slate-500 border-t-teal-400 rounded-full" />
          <span>Loading DJ controls...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Music className="h-5 w-5 text-orange-400" />
          DJ Audio Control
        </h2>
        <p className="text-sm text-slate-400 mt-1">Switch between DJ and game audio across Atlas zones</p>
      </div>

      {/* Source Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Source A: DJ */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <label className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-2">
            <Radio className="h-4 w-4 text-green-400" />
            Source A (DJ)
          </label>
          <select
            value={selectedDJSource ?? ''}
            onChange={(e) => setSelectedDJSource(e.target.value ? Number(e.target.value) : null)}
            className="w-full h-12 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm px-3 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select DJ source...</option>
            {djSources.map((src) => (
              <option key={src.index} value={src.index}>
                {src.name}
              </option>
            ))}
          </select>
        </div>

        {/* Source B: Game Audio */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <label className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-2">
            <Volume2 className="h-4 w-4 text-blue-400" />
            Source B (Game Audio)
          </label>
          <select
            value={selectedGameSource}
            onChange={(e) => setSelectedGameSource(Number(e.target.value))}
            className="w-full h-12 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {WOLFPACK_AUDIO_OPTIONS.map((src) => (
              <option key={src.index} value={src.index}>
                {src.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Big Toggle Button */}
      <button
        onClick={handleModeToggle}
        disabled={switching}
        className={`w-full min-h-16 rounded-lg text-xl font-bold transition-all active:scale-[0.98] ${
          switching
            ? 'bg-slate-700 text-slate-400 cursor-wait'
            : isDJMode
              ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/30'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30'
        }`}
      >
        {switching ? (
          <span className="flex items-center justify-center gap-2">
            <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full" />
            Switching...
          </span>
        ) : isDJMode ? (
          <span className="flex items-center justify-center gap-3">
            <Music className="h-6 w-6" />
            DJ MODE
          </span>
        ) : (
          <span className="flex items-center justify-center gap-3">
            <Volume2 className="h-6 w-6" />
            GAME AUDIO
          </span>
        )}
      </button>

      {/* Status Message */}
      {statusMessage && (
        <div className="rounded-lg bg-slate-800/50 border border-slate-700 px-4 py-2 text-center text-sm text-slate-300">
          {statusMessage}
        </div>
      )}

      {/* Quick Presets */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-yellow-400" />
          Quick Presets
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => applyPreset('dj-main-bar')}
            disabled={switching}
            className="h-14 rounded-lg bg-green-800/40 border border-green-700/50 text-green-300 text-sm font-medium hover:bg-green-700/40 transition-colors active:scale-[0.98] disabled:opacity-50"
          >
            DJ Main Bar
          </button>
          <button
            onClick={() => applyPreset('dj-everywhere')}
            disabled={switching}
            className="h-14 rounded-lg bg-green-800/40 border border-green-700/50 text-green-300 text-sm font-medium hover:bg-green-700/40 transition-colors active:scale-[0.98] disabled:opacity-50"
          >
            DJ Everywhere
          </button>
          <button
            onClick={() => applyPreset('game-all')}
            disabled={switching}
            className="h-14 rounded-lg bg-blue-800/40 border border-blue-700/50 text-blue-300 text-sm font-medium hover:bg-blue-700/40 transition-colors active:scale-[0.98] disabled:opacity-50"
          >
            Game Audio All
          </button>
        </div>
      </div>

      {/* Zone Selector */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-300">Zones</h3>
          <div className="flex gap-2">
            <button
              onClick={selectAllZones}
              className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-xs font-medium text-slate-300 transition-colors"
            >
              All Zones
            </button>
            <button
              onClick={clearAllZones}
              className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-xs font-medium text-slate-300 transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {zones.map((zone) => {
            const checked = selectedZones.has(zone.zoneNumber)
            return (
              <button
                key={zone.id}
                onClick={() => toggleZone(zone.zoneNumber)}
                className={`group flex items-center gap-2 py-2 px-3 rounded-lg border transition-colors ${
                  checked
                    ? 'border-teal-500/50 bg-teal-900/20'
                    : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors flex-shrink-0 ${
                    checked
                      ? 'border-teal-500 bg-teal-500'
                      : 'border-slate-600 bg-slate-900 group-hover:border-slate-500'
                  }`}
                >
                  {checked && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className={`text-sm truncate ${checked ? 'text-white' : 'text-slate-400'}`}>
                  {zone.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Volume Sliders for Selected Zones */}
      {selectedZones.size > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-3">
            <Volume2 className="h-4 w-4 text-teal-400" />
            Zone Volume
          </h3>
          <div className="space-y-3">
            {zones
              .filter((z) => selectedZones.has(z.zoneNumber))
              .map((zone) => (
                <div key={zone.id} className="flex items-center gap-3">
                  <span className="text-sm text-slate-400 w-28 truncate flex-shrink-0">{zone.name}</span>
                  <div className="flex-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={zoneVolumes.get(zone.zoneNumber) ?? zone.volume}
                      onChange={(e) => handleVolumeChange(zone.zoneNumber, parseInt(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-700 accent-teal-500"
                    />
                  </div>
                  <span className="text-sm font-mono text-slate-300 w-10 text-right">
                    {zoneVolumes.get(zone.zoneNumber) ?? zone.volume}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
