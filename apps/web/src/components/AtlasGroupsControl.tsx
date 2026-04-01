'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Users, Volume2, VolumeX } from 'lucide-react'

import { logger } from '@sports-bar/logger'
interface AtlasGroup {
  index: number
  name: string
  isActive: boolean
  source: number
  gain: number
  muted: boolean
}

interface AtlasSource {
  index: number
  name: string
}

interface AtlasGroupsControlProps {
  processorIp: string
  onGroupChange?: (groupIndex: number, action: string, value: any) => void
}

export default function AtlasGroupsControl({
  processorIp,
  onGroupChange
}: AtlasGroupsControlProps) {
  const [groups, setGroups] = useState<AtlasGroup[]>([])
  const [sources, setSources] = useState<AtlasSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchGroups()
    fetchSources()
  }, [processorIp])

  const fetchGroups = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/atlas/groups?processorIp=${processorIp}`)

      if (!response.ok) {
        throw new Error('Failed to fetch groups')
      }

      const data = await response.json()
      setGroups(data.groups || [])
      setError(null)
    } catch (err) {
      logger.error('Error fetching groups:', err)
      setError(err instanceof Error ? err.message : 'Failed to load groups')
    } finally {
      setLoading(false)
    }
  }

  const fetchSources = async () => {
    try {
      const response = await fetch(`/api/atlas/sources?processorIp=${processorIp}`)

      if (!response.ok) {
        throw new Error('Failed to fetch sources')
      }

      const data = await response.json()
      setSources(data.sources || [])
    } catch (err) {
      logger.error('Error fetching sources:', err)
      // Fallback to default source names if API fails
      const fallbackSources = Array.from({ length: 14 }, (_, i) => ({
        index: i,
        name: `Source ${i + 1}`
      }))
      setSources(fallbackSources)
    }
  }

  const handleGroupAction = async (groupIndex: number, action: string, value: any) => {
    try {
      const response = await fetch('/api/atlas/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorIp,
          groupIndex,
          action,
          value
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to control group')
      }

      // Parse response and check success field
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to control group')
      }

      // Update local state only after confirming success
      setGroups(prev => prev.map(g =>
        g.index === groupIndex
          ? {
              ...g,
              ...(action === 'setActive' ? { isActive: value } : {}),
              ...(action === 'setSource' ? { source: value } : {}),
              ...(action === 'setGain' ? { gain: value } : {}),
              ...(action === 'setMute' ? { muted: value } : {})
            }
          : g
      ))

      if (onGroupChange) {
        onGroupChange(groupIndex, action, value)
      }
    } catch (err) {
      logger.error('Error controlling group:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      alert(errorMessage)

      // Refresh groups to show actual state
      fetchGroups()
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Users className="w-5 h-5 text-purple-400" />
          <span className="text-sm">Loading groups...</span>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-red-400">
          <Users className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
        <button onClick={fetchGroups} className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-medium transition-colors">
          Retry
        </button>
      </div>
    )
  }

  const activeGroups = groups.filter(g => g.isActive)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">
          {activeGroups.length} active group{activeGroups.length !== 1 ? 's' : ''}
        </span>
      </div>

      {activeGroups.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          No active groups configured
        </div>
      ) : (
        <div className="space-y-3">
          {activeGroups.map((group) => (
            <GroupCard
              key={group.index}
              group={group}
              sources={sources}
              onAction={handleGroupAction}
            />
          ))}
        </div>
      )}

      {/* Inactive groups */}
      {groups.filter(g => !g.isActive).length > 0 && (
        <div className="pt-3 border-t border-slate-700/50">
          <h4 className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2">Inactive</h4>
          <div className="grid grid-cols-2 gap-2">
            {groups.filter(g => !g.isActive).map((group) => (
              <button
                key={group.index}
                onClick={() => handleGroupAction(group.index, 'setActive', true)}
                className="p-3 bg-slate-800/30 rounded-xl border border-slate-700 hover:border-purple-500/50 active:bg-slate-700/50 transition-colors text-sm text-slate-400"
              >
                <Users className="w-4 h-4 inline mr-2" />
                {group.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Individual group card with iPad-friendly volume slider
 */
function GroupCard({
  group,
  sources,
  onAction,
}: {
  group: AtlasGroup
  sources: AtlasSource[]
  onAction: (groupIndex: number, action: string, value: any) => void
}) {
  const sliderRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Convert dB gain (-80 to 0) to percentage (0 to 100) for display
  const gainToPercent = (gain: number) => ((gain + 80) / 80) * 100
  const percentToGain = (percent: number) => (percent / 100) * 80 - 80

  const percent = gainToPercent(group.gain)

  // Color based on volume level
  const getBarColor = () => {
    if (group.muted) return 'bg-slate-600'
    if (percent > 85) return 'bg-red-500'
    if (percent > 70) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  const getBarGlow = () => {
    if (group.muted) return ''
    if (percent > 85) return 'shadow-red-500/30 shadow-lg'
    if (percent > 70) return 'shadow-amber-500/20 shadow-md'
    return 'shadow-emerald-500/20 shadow-md'
  }

  // Debounced gain update — sends API call after user stops sliding
  const sendGainUpdate = useCallback((newGain: number) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      onAction(group.index, 'setGain', Math.round(newGain))
    }, 150)
  }, [group.index, onAction])

  // Calculate gain from touch/mouse position on the slider track
  const updateFromPosition = useCallback((clientX: number) => {
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const pct = (x / rect.width) * 100
    const newGain = percentToGain(pct)
    const clampedGain = Math.max(-80, Math.min(0, newGain))

    // Update local state immediately for responsive feel
    // (parent state update happens after debounce)
    sendGainUpdate(clampedGain)
  }, [sendGainUpdate])

  // Touch handlers for the custom slider
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    isDragging.current = true
    updateFromPosition(e.touches[0].clientX)
  }, [updateFromPosition])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return
    e.preventDefault()
    updateFromPosition(e.touches[0].clientX)
  }, [updateFromPosition])

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false
  }, [])

  // Mouse handlers (for desktop testing)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    updateFromPosition(e.clientX)

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      updateFromPosition(e.clientX)
    }
    const handleMouseUp = () => {
      isDragging.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [updateFromPosition])

  // Step volume with +/- buttons
  const stepVolume = (delta: number) => {
    const newGain = Math.max(-80, Math.min(0, group.gain + delta))
    onAction(group.index, 'setGain', newGain)
  }

  return (
    <div className={`rounded-xl border transition-colors ${
      group.muted
        ? 'bg-slate-900/60 border-slate-700/50'
        : 'bg-slate-800/60 border-purple-500/30'
    }`}>
      {/* Header row: name + mute */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-2 min-w-0">
          <Users className={`w-4 h-4 flex-shrink-0 ${group.muted ? 'text-slate-500' : 'text-purple-400'}`} />
          <span className={`font-semibold text-sm truncate ${group.muted ? 'text-slate-500' : 'text-slate-100'}`}>
            {group.name}
          </span>
        </div>

        {/* Mute button — 44px minimum touch target */}
        <button
          onClick={() => onAction(group.index, 'setMute', !group.muted)}
          className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all active:scale-95 ${
            group.muted
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-slate-700/60 text-slate-300 border border-slate-600/50 hover:bg-slate-600/60'
          }`}
        >
          {group.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Volume slider area */}
      <div className="px-4 pb-3">
        {/* dB readout */}
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-mono ${group.muted ? 'text-slate-600' : 'text-slate-400'}`}>
            {group.muted ? 'MUTED' : `${group.gain.toFixed(0)} dB`}
          </span>
          <span className={`text-xs ${group.muted ? 'text-slate-600' : 'text-slate-500'}`}>
            {Math.round(percent)}%
          </span>
        </div>

        {/* Custom touch-friendly slider */}
        <div className="flex items-center gap-2">
          {/* Minus button */}
          <button
            onClick={() => stepVolume(-3)}
            disabled={group.muted}
            className="flex items-center justify-center w-11 h-11 rounded-xl bg-slate-700/60 border border-slate-600/50 text-slate-300 text-lg font-bold active:scale-95 active:bg-slate-600 transition-all disabled:opacity-30 disabled:active:scale-100 flex-shrink-0"
          >
            −
          </button>

          {/* Slider track — tall touch target */}
          <div
            ref={sliderRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            className="relative flex-1 h-12 flex items-center cursor-pointer touch-none select-none"
          >
            {/* Track background */}
            <div className="absolute inset-x-0 h-3 bg-slate-700/80 rounded-full overflow-hidden">
              {/* Filled portion */}
              <div
                className={`h-full rounded-full transition-colors ${getBarColor()} ${getBarGlow()}`}
                style={{ width: `${percent}%` }}
              />
            </div>

            {/* Thumb — large touch target */}
            <div
              className={`absolute w-8 h-8 rounded-full border-2 shadow-lg transition-colors -translate-x-1/2 ${
                group.muted
                  ? 'bg-slate-700 border-slate-500'
                  : 'bg-white border-purple-400 shadow-purple-500/20'
              }`}
              style={{ left: `${percent}%` }}
            />
          </div>

          {/* Plus button */}
          <button
            onClick={() => stepVolume(3)}
            disabled={group.muted}
            className="flex items-center justify-center w-11 h-11 rounded-xl bg-slate-700/60 border border-slate-600/50 text-slate-300 text-lg font-bold active:scale-95 active:bg-slate-600 transition-all disabled:opacity-30 disabled:active:scale-100 flex-shrink-0"
          >
            +
          </button>
        </div>

        {/* Source selector */}
        <div className="mt-3">
          <select
            value={group.source}
            onChange={(e) => onAction(group.index, 'setSource', parseInt(e.target.value))}
            className="w-full bg-slate-700/60 text-slate-200 rounded-xl px-3 py-2.5 text-sm border border-slate-600/50 appearance-none"
          >
            <option value={-1}>No Source</option>
            {sources.map((source) => (
              <option key={source.index} value={source.index}>
                {source.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
