'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { logger } from '@sports-bar/logger'
import { ChevronDown, ChevronRight, Monitor, Check, Volume2, AlertTriangle, Speaker } from 'lucide-react'

interface Zone {
  id: string
  outputNumber: number
  label?: string
  room?: string // room ID
}

interface Room {
  id: string
  name: string
  color: string
}

interface AtlasSource {
  index: number
  name: string
}

interface AtlasAudioGroup {
  index: number
  name: string
  isActive: boolean
}

interface ScheduledGameTVPickerProps {
  allocationId: string
  currentOutputIds: number[]
  onUpdate: (outputIds: number[]) => void
  currentAudioConfig?: { sourceIndex?: number; zoneIds?: number[] }
}

// Wolf Pack audio outputs feed the Atlas audio processor
const AUDIO_OUTPUTS = [
  { outputNumber: 37, label: 'Matrix Audio 1' },
  { outputNumber: 38, label: 'Matrix Audio 2' },
  { outputNumber: 39, label: 'Matrix Audio 3' },
  { outputNumber: 40, label: 'Matrix Audio 4' },
]

export default function ScheduledGameTVPicker({
  allocationId,
  currentOutputIds,
  onUpdate,
  currentAudioConfig,
}: ScheduledGameTVPickerProps) {
  const [expanded, setExpanded] = useState(false)
  const [zones, setZones] = useState<Zone[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedOutputIds, setSelectedOutputIds] = useState<number[]>(currentOutputIds)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflictMap, setConflictMap] = useState<Map<number, string>>(new Map())
  const hasFetched = useRef(false)

  // Atlas audio state
  const [atlasSources, setAtlasSources] = useState<AtlasSource[]>([])
  const [atlasGroups, setAtlasGroups] = useState<AtlasAudioGroup[]>([])
  const [selectedAudioSource, setSelectedAudioSource] = useState<number | null>(
    currentAudioConfig?.sourceIndex ?? null
  )
  const [selectedAudioSourceName, setSelectedAudioSourceName] = useState<string>('')
  const [selectedAudioZoneIds, setSelectedAudioZoneIds] = useState<number[]>(
    currentAudioConfig?.zoneIds ?? []
  )
  const [atlasProcessorIp, setAtlasProcessorIp] = useState<string | null>(null)
  const [atlasLoading, setAtlasLoading] = useState(false)
  const [audioSaving, setAudioSaving] = useState(false)

  // Sync with external changes to currentOutputIds
  useEffect(() => {
    setSelectedOutputIds(currentOutputIds)
  }, [currentOutputIds])

  // Fetch layout data when expanded for the first time
  useEffect(() => {
    if (!expanded || hasFetched.current) return
    hasFetched.current = true

    const fetchLayout = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/bartender/layout')
        if (!response.ok) {
          throw new Error(`Failed to load layout: ${response.status}`)
        }
        const data = await response.json()
        const layout = data.layout || {}
        setZones(layout.zones || [])
        setRooms(layout.rooms || [])
        logger.debug('[TV-PICKER] Loaded layout', {
          zones: (layout.zones || []).length,
          rooms: (layout.rooms || []).length,
        })
      } catch (err: any) {
        logger.error('[TV-PICKER] Failed to load layout:', err)
        setError(err.message || 'Failed to load TV layout')
      } finally {
        setLoading(false)
      }
    }

    const fetchConflicts = async () => {
      try {
        const res = await fetch('/api/schedules/bartender-schedule')
        if (res.ok) {
          const data = await res.json()

          // Find this allocation's start time
          const thisAlloc = (data.schedules || []).find((s: any) => s.id === allocationId)
          const thisStart = thisAlloc?.tuneAt ? new Date(thisAlloc.tuneAt).getTime() : 0

          // Estimate game duration by league (in ms)
          const durationByLeague: Record<string, number> = {
            'mlb': 3 * 3600000, 'baseball': 3 * 3600000,
            'nfl': 3.5 * 3600000, 'football': 3.5 * 3600000,
            'nba': 2.5 * 3600000, 'basketball': 2 * 3600000,
            'nhl': 2.5 * 3600000, 'hockey': 2.5 * 3600000,
            'soccer': 2 * 3600000, 'mls': 2 * 3600000,
          }
          const getEstDuration = (league: string) => {
            const l = (league || '').toLowerCase()
            for (const [key, dur] of Object.entries(durationByLeague)) {
              if (l.includes(key)) return dur
            }
            return 3 * 3600000 // default 3 hours
          }

          const thisEnd = thisStart + getEstDuration(thisAlloc?.league || '')

          const map = new Map<number, string>()
          for (const sched of data.schedules || []) {
            if (sched.id === allocationId) continue
            if (!sched.tvOutputIds || !Array.isArray(sched.tvOutputIds)) continue

            // Check time overlap — only flag if games actually overlap
            const otherStart = sched.tuneAt ? new Date(sched.tuneAt).getTime() : 0
            const otherEnd = otherStart + getEstDuration(sched.league || '')

            // No overlap if one ends before the other starts
            if (thisEnd <= otherStart || otherEnd <= thisStart) continue

            const label = `${sched.league}: ${sched.awayTeam} @ ${sched.homeTeam}`
            for (const outputId of sched.tvOutputIds) {
              map.set(outputId, label)
            }
          }
          setConflictMap(map)

          // Load saved audio config for this allocation
          if (thisAlloc) {
            if (thisAlloc.audioSourceIndex != null) {
              setSelectedAudioSource(thisAlloc.audioSourceIndex)
            }
            if (thisAlloc.audioSourceName) {
              setSelectedAudioSourceName(thisAlloc.audioSourceName)
            }
            if (Array.isArray(thisAlloc.audioZoneIds) && thisAlloc.audioZoneIds.length > 0) {
              setSelectedAudioZoneIds(thisAlloc.audioZoneIds)
            }
          }
        }
      } catch {}
    }

    const fetchAtlasProcessorIp = async () => {
      try {
        const res = await fetch('/api/audio-processor')
        const data = await res.json()
        if (data.processors?.length > 0) {
          const processor = data.processors[0]
          setAtlasProcessorIp(processor.ipAddress)
          logger.debug('[TV-PICKER] Loaded Atlas processor IP', {
            ip: processor.ipAddress,
          })
        }
      } catch (err: any) {
        logger.error('[TV-PICKER] Failed to load Atlas processor:', err)
      }
    }

    fetchLayout()
    fetchConflicts()
    fetchAtlasProcessorIp()
  }, [expanded, allocationId])

  // Fetch Atlas sources and groups once processor IP is known
  useEffect(() => {
    if (!atlasProcessorIp) return

    const fetchAtlasData = async () => {
      setAtlasLoading(true)
      try {
        const [sourcesRes, groupsRes] = await Promise.all([
          fetch(`/api/atlas/sources?processorIp=${atlasProcessorIp}`),
          fetch(`/api/atlas/groups?processorIp=${atlasProcessorIp}`),
        ])

        if (sourcesRes.ok) {
          const sourcesData = await sourcesRes.json()
          setAtlasSources(sourcesData.sources || [])
          logger.debug('[TV-PICKER] Loaded Atlas sources', {
            count: (sourcesData.sources || []).length,
          })
        }

        if (groupsRes.ok) {
          const groupsData = await groupsRes.json()
          const activeGroups = (groupsData.groups || []).filter(
            (g: AtlasAudioGroup) => g.isActive
          )
          setAtlasGroups(activeGroups)
          logger.debug('[TV-PICKER] Loaded Atlas groups', {
            total: (groupsData.groups || []).length,
            active: activeGroups.length,
          })
        }
      } catch (err: any) {
        logger.error('[TV-PICKER] Failed to load Atlas data:', err)
      } finally {
        setAtlasLoading(false)
      }
    }

    fetchAtlasData()
  }, [atlasProcessorIp])

  // Persist selection to backend and notify parent
  const persistSelection = useCallback(
    async (outputIds: number[]) => {
      setSelectedOutputIds(outputIds)
      onUpdate(outputIds)
      setSaving(true)
      try {
        const response = await fetch('/api/schedules/bartender-schedule', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: allocationId,
            tvOutputIds: outputIds,
          }),
        })
        if (!response.ok) {
          logger.error('[TV-PICKER] Failed to save TV selection', {
            status: response.status,
          })
        } else {
          logger.debug('[TV-PICKER] Saved TV selection', {
            allocationId,
            outputIds,
          })
        }
      } catch (err: any) {
        logger.error('[TV-PICKER] Error saving TV selection:', err)
      } finally {
        setSaving(false)
      }
    },
    [allocationId, onUpdate]
  )

  // Persist Atlas audio config to backend
  const persistAudioConfig = useCallback(
    async (sourceIndex: number | null, sourceName: string, zoneIds: number[]) => {
      setAudioSaving(true)
      try {
        const response = await fetch('/api/schedules/bartender-schedule', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: allocationId,
            tvOutputIds: selectedOutputIds,
            audioSourceIndex: sourceIndex ?? undefined,
            audioSourceName: sourceName || undefined,
            audioZoneIds: zoneIds,
          }),
        })
        if (!response.ok) {
          logger.error('[TV-PICKER] Failed to save audio config', {
            status: response.status,
          })
        } else {
          logger.debug('[TV-PICKER] Saved audio config', {
            allocationId,
            sourceIndex,
            sourceName,
            zoneIds,
          })
        }
      } catch (err: any) {
        logger.error('[TV-PICKER] Error saving audio config:', err)
      } finally {
        setAudioSaving(false)
      }
    },
    [allocationId, selectedOutputIds]
  )

  // Handle Atlas audio source change
  const handleAudioSourceChange = useCallback(
    (sourceIndex: number, sourceName: string) => {
      setSelectedAudioSource(sourceIndex)
      setSelectedAudioSourceName(sourceName)
      persistAudioConfig(sourceIndex, sourceName, selectedAudioZoneIds)
    },
    [selectedAudioZoneIds, persistAudioConfig]
  )

  // Toggle a single Atlas audio zone
  const toggleAudioZone = useCallback(
    (zoneNumber: number) => {
      const next = selectedAudioZoneIds.includes(zoneNumber)
        ? selectedAudioZoneIds.filter((id) => id !== zoneNumber)
        : [...selectedAudioZoneIds, zoneNumber].sort((a, b) => a - b)
      setSelectedAudioZoneIds(next)
      persistAudioConfig(selectedAudioSource, selectedAudioSourceName, next)
    },
    [selectedAudioZoneIds, selectedAudioSource, selectedAudioSourceName, persistAudioConfig]
  )

  // Select all / clear all Atlas audio zones
  const setAllAudioZones = useCallback(
    (selectAll: boolean) => {
      const next = selectAll ? atlasGroups.map((g) => g.index) : []
      setSelectedAudioZoneIds(next)
      persistAudioConfig(selectedAudioSource, selectedAudioSourceName, next)
    },
    [atlasGroups, selectedAudioSource, selectedAudioSourceName, persistAudioConfig]
  )

  // Toggle a single TV output
  const toggleOutput = useCallback(
    (outputNumber: number) => {
      const next = selectedOutputIds.includes(outputNumber)
        ? selectedOutputIds.filter((id) => id !== outputNumber)
        : [...selectedOutputIds, outputNumber].sort((a, b) => a - b)
      persistSelection(next)
    },
    [selectedOutputIds, persistSelection]
  )

  // Toggle all TVs in a room
  const toggleRoom = useCallback(
    (roomId: string) => {
      const roomZones = zones.filter((z) => z.room === roomId)
      const roomOutputs = roomZones.map((z) => z.outputNumber)
      const allSelected = roomOutputs.every((o) => selectedOutputIds.includes(o))

      let next: number[]
      if (allSelected) {
        // Deselect all in this room
        next = selectedOutputIds.filter((id) => !roomOutputs.includes(id))
      } else {
        // Select all in this room
        const toAdd = roomOutputs.filter((o) => !selectedOutputIds.includes(o))
        next = [...selectedOutputIds, ...toAdd].sort((a, b) => a - b)
      }
      persistSelection(next)
    },
    [zones, selectedOutputIds, persistSelection]
  )

  // Toggle all audio outputs at once
  const toggleAllAudio = useCallback(() => {
    const audioOutputNumbers = AUDIO_OUTPUTS.map((a) => a.outputNumber)
    const allSelected = audioOutputNumbers.every((o) =>
      selectedOutputIds.includes(o)
    )

    let next: number[]
    if (allSelected) {
      next = selectedOutputIds.filter(
        (id) => !audioOutputNumbers.includes(id)
      )
    } else {
      const toAdd = audioOutputNumbers.filter(
        (o) => !selectedOutputIds.includes(o)
      )
      next = [...selectedOutputIds, ...toAdd].sort((a, b) => a - b)
    }
    persistSelection(next)
  }, [selectedOutputIds, persistSelection])

  // Group zones by room
  const zonesByRoom = zones.reduce<Record<string, Zone[]>>((acc, zone) => {
    const roomId = zone.room || '_unassigned'
    if (!acc[roomId]) acc[roomId] = []
    acc[roomId].push(zone)
    return acc
  }, {})

  // Sort zones within each room by output number
  Object.values(zonesByRoom).forEach((group) =>
    group.sort((a, b) => a.outputNumber - b.outputNumber)
  )

  const roomMap = rooms.reduce<Record<string, Room>>((acc, r) => {
    acc[r.id] = r
    return acc
  }, {})

  const audioOutputNumbers = AUDIO_OUTPUTS.map((a) => a.outputNumber)
  const tvCount = selectedOutputIds.filter(
    (id) => !audioOutputNumbers.includes(id)
  ).length
  const audioCount = selectedOutputIds.filter((id) =>
    audioOutputNumbers.includes(id)
  ).length
  const gameAudioZoneCount = selectedAudioZoneIds.length

  // Build summary parts for collapsed button
  const summaryParts: string[] = []
  if (tvCount > 0) summaryParts.push(`${tvCount} TV${tvCount !== 1 ? 's' : ''}`)
  if (audioCount > 0) summaryParts.push(`${audioCount} matrix audio`)
  if (gameAudioZoneCount > 0) summaryParts.push(`${gameAudioZoneCount} game audio zone${gameAudioZoneCount !== 1 ? 's' : ''}`)

  return (
    <div className="mt-1.5">
      {/* Collapsed summary / toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors py-2 px-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-slate-500"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <Monitor className="h-4 w-4" />
        <span>
          {summaryParts.length === 0
            ? 'Assign TVs & Audio'
            : summaryParts.join(' + ')}
        </span>
        {(saving || audioSaving) && (
          <span className="text-blue-400 text-[10px] ml-1">saving...</span>
        )}
      </button>

      {/* Expanded picker */}
      {expanded && (
        <div className="mt-2 rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm w-full max-w-2xl">
          {loading && (
            <p className="text-slate-500 py-1">Loading TVs...</p>
          )}

          {error && (
            <p className="text-red-400 py-1">{error}</p>
          )}

          {!loading && !error && zones.length === 0 && (
            <p className="text-slate-500 py-1">No TVs configured in layout.</p>
          )}

          {!loading &&
            !error &&
            zones.length > 0 &&
            Object.entries(zonesByRoom).map(([roomId, roomZones]) => {
              const room = roomMap[roomId]
              const roomOutputs = roomZones.map((z) => z.outputNumber)
              const allSelected = roomOutputs.every((o) =>
                selectedOutputIds.includes(o)
              )
              const someSelected =
                !allSelected &&
                roomOutputs.some((o) => selectedOutputIds.includes(o))

              return (
                <div key={roomId} className="mb-4 last:mb-0">
                  {/* Room header with Select All */}
                  <label className="flex items-center gap-3 cursor-pointer py-1.5 group">
                    <span
                      className="relative flex h-6 w-6 items-center justify-center rounded-sm border-2 transition-colors"
                      style={{
                        borderColor: room?.color || '#64748b',
                        backgroundColor:
                          allSelected || someSelected
                            ? room?.color || '#3b82f6'
                            : 'transparent',
                      }}
                      onClick={(e) => {
                        e.preventDefault()
                        toggleRoom(roomId)
                      }}
                    >
                      {allSelected && (
                        <Check className="h-4 w-4 text-white" />
                      )}
                      {someSelected && (
                        <span className="block h-2.5 w-2.5 rounded-xs bg-white" />
                      )}
                    </span>
                    <span
                      className="font-semibold text-base text-slate-200 group-hover:text-white transition-colors"
                      onClick={() => toggleRoom(roomId)}
                    >
                      {room?.name || 'Unassigned'}
                    </span>
                    <span className="text-slate-500 text-xs">
                      ({roomZones.length})
                    </span>
                  </label>

                  {/* TV checkboxes */}
                  <div className="ml-9 mt-1 flex flex-wrap gap-2">
                    {roomZones.map((zone) => {
                      const checked = selectedOutputIds.includes(zone.outputNumber)
                      const conflict = conflictMap.get(zone.outputNumber)
                      const hasConflict = !!conflict
                      return (
                        <label
                          key={zone.id}
                          className={`flex items-center gap-2 cursor-pointer py-2 px-3 rounded-lg border transition-all ${
                            checked
                              ? hasConflict ? 'border-amber-500 bg-amber-500/20' : 'border-blue-500 bg-blue-500/20'
                              : hasConflict ? 'border-amber-500/40 bg-slate-900 hover:border-amber-500' : 'border-slate-600 bg-slate-900 hover:border-slate-500'
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                              checked
                                ? hasConflict ? 'border-amber-500 bg-amber-500' : 'border-blue-500 bg-blue-500'
                                : 'border-slate-600 bg-slate-900'
                            }`}
                            onClick={(e) => {
                              e.preventDefault()
                              toggleOutput(zone.outputNumber)
                            }}
                          >
                            {checked && (
                              <Check className="h-3.5 w-3.5 text-white" />
                            )}
                          </span>
                          <span
                            className={`text-sm font-medium transition-colors ${
                              checked ? 'text-white' : 'text-slate-400'
                            }`}
                            onClick={() => toggleOutput(zone.outputNumber)}
                          >
                            {zone.label || `Output ${zone.outputNumber}`}
                          </span>
                          {hasConflict && (
                            <span className="flex items-center gap-1 text-xs text-amber-400" title={conflict}>
                              <AlertTriangle className="h-3 w-3" />
                              <span className="max-w-[100px] truncate">{conflict}</span>
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}

          {/* Audio Zones Section */}
          {!loading && !error && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              {/* Audio Routing header with Select All */}
              <label className="flex items-center gap-3 cursor-pointer py-1.5 group">
                {(() => {
                  const allAudioSelected = AUDIO_OUTPUTS.every((a) =>
                    selectedOutputIds.includes(a.outputNumber)
                  )
                  const someAudioSelected =
                    !allAudioSelected &&
                    AUDIO_OUTPUTS.some((a) =>
                      selectedOutputIds.includes(a.outputNumber)
                    )
                  return (
                    <span
                      className={`relative flex h-6 w-6 items-center justify-center rounded border-2 transition-colors ${
                        allAudioSelected || someAudioSelected
                          ? 'border-amber-500 bg-amber-500'
                          : 'border-amber-500/50'
                      }`}
                      onClick={(e) => {
                        e.preventDefault()
                        toggleAllAudio()
                      }}
                    >
                      {allAudioSelected && (
                        <Check className="h-4 w-4 text-white" />
                      )}
                      {someAudioSelected && (
                        <span className="block h-2.5 w-2.5 rounded-xs bg-white" />
                      )}
                    </span>
                  )
                })()}
                <Volume2 className="h-5 w-5 text-amber-400" />
                <span
                  className="font-semibold text-base text-slate-200 group-hover:text-white transition-colors"
                  onClick={() => toggleAllAudio()}
                >
                  Audio Zones
                </span>
                <span className="text-slate-500 text-xs">
                  ({AUDIO_OUTPUTS.length})
                </span>
              </label>

              {/* Audio output checkboxes */}
              <div className="ml-9 mt-1 flex flex-wrap gap-2">
                {AUDIO_OUTPUTS.map((audio) => {
                  const checked = selectedOutputIds.includes(audio.outputNumber)
                  const conflict = conflictMap.get(audio.outputNumber)
                  const hasConflict = !!conflict
                  return (
                    <label
                      key={audio.outputNumber}
                      className={`flex items-center gap-2 cursor-pointer py-2 px-3 rounded-lg border transition-all ${
                        checked
                          ? 'border-amber-500 bg-amber-500/20'
                          : hasConflict ? 'border-amber-500/40 bg-slate-900 hover:border-amber-500' : 'border-slate-600 bg-slate-900 hover:border-slate-500'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                          checked
                            ? 'border-amber-500 bg-amber-500'
                            : 'border-slate-600 bg-slate-900'
                        }`}
                        onClick={(e) => {
                          e.preventDefault()
                          toggleOutput(audio.outputNumber)
                        }}
                      >
                        {checked && (
                          <Check className="h-3.5 w-3.5 text-white" />
                        )}
                      </span>
                      <span
                        className={`text-sm font-medium transition-colors ${
                          checked ? 'text-white' : 'text-slate-400'
                        }`}
                        onClick={() => toggleOutput(audio.outputNumber)}
                      >
                        {audio.label}
                      </span>
                      {hasConflict && (
                        <span className="flex items-center gap-1 text-xs text-amber-400" title={conflict}>
                          <AlertTriangle className="h-3 w-3" />
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Game Audio Zones Section — Atlas audio source & zone routing */}
          {!loading && !error && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              {/* Section header */}
              <div className="flex items-center gap-3 py-1.5">
                <Speaker className="h-5 w-5 text-orange-400" />
                <span className="font-semibold text-base text-slate-200">
                  Game Audio Zones
                </span>
                {(audioSaving) && (
                  <span className="text-orange-400 text-[10px] ml-1">saving...</span>
                )}
              </div>

              {atlasLoading && (
                <p className="text-slate-500 py-1 ml-8">Loading audio sources...</p>
              )}

              {!atlasLoading && (
                <>
                  {/* Audio Source Selector */}
                  <div className="ml-8 mt-2">
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Audio Source
                    </label>
                    <select
                      className="min-h-[48px] text-base w-full max-w-sm rounded-lg border border-slate-600 bg-slate-900 text-slate-200 px-3 py-2 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-hidden"
                      value={selectedAudioSource ?? ''}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation()
                        const idx = e.target.value === '' ? null : Number(e.target.value)
                        if (idx === null) {
                          setSelectedAudioSource(null)
                          setSelectedAudioSourceName('')
                          persistAudioConfig(null, '', selectedAudioZoneIds)
                        } else {
                          const source = atlasSources.find((s) => s.index === idx)
                          handleAudioSourceChange(idx, source?.name || `Source ${idx}`)
                        }
                      }}
                    >
                      <option value="">-- Select audio source --</option>
                      {atlasSources.map((source) => (
                        <option key={source.index} value={source.index}>
                          {source.name} (Source {source.index})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Group Checkboxes */}
                  {atlasGroups.length > 0 && (
                    <div className="ml-8 mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-medium text-slate-400">
                          Audio Groups
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="text-xs font-medium text-orange-400 hover:text-orange-300 px-2 py-1 rounded-sm transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              setAllAudioZones(true)
                            }}
                          >
                            All Groups
                          </button>
                          <button
                            type="button"
                            className="text-xs font-medium text-slate-400 hover:text-slate-300 px-2 py-1 rounded-sm transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              setAllAudioZones(false)
                            }}
                          >
                            Clear All
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {atlasGroups.map((group) => {
                          const checked = selectedAudioZoneIds.includes(group.index)
                          return (
                            <label
                              key={group.index}
                              className={`flex items-center gap-2 cursor-pointer py-2 px-3 rounded-lg border transition-all ${
                                checked
                                  ? 'border-orange-500 bg-orange-500/20'
                                  : 'border-slate-600 bg-slate-900 hover:border-slate-500'
                              }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                                  checked
                                    ? 'border-orange-500 bg-orange-500'
                                    : 'border-slate-600 bg-slate-900'
                                }`}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  toggleAudioZone(group.index)
                                }}
                              >
                                {checked && (
                                  <Check className="h-3.5 w-3.5 text-white" />
                                )}
                              </span>
                              <span
                                className={`text-sm font-medium transition-colors ${
                                  checked ? 'text-white' : 'text-slate-400'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleAudioZone(group.index)
                                }}
                              >
                                {group.name}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {!atlasLoading && atlasGroups.length === 0 && atlasSources.length === 0 && (
                    <p className="text-slate-500 py-1 ml-8 text-sm">
                      No Atlas audio processor data available.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
