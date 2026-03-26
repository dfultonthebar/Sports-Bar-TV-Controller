'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { logger } from '@sports-bar/logger'
import { ChevronDown, ChevronRight, Monitor, Check } from 'lucide-react'

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

interface ScheduledGameTVPickerProps {
  allocationId: string
  currentOutputIds: number[]
  onUpdate: (outputIds: number[]) => void
}

export default function ScheduledGameTVPicker({
  allocationId,
  currentOutputIds,
  onUpdate,
}: ScheduledGameTVPickerProps) {
  const [expanded, setExpanded] = useState(false)
  const [zones, setZones] = useState<Zone[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedOutputIds, setSelectedOutputIds] = useState<number[]>(currentOutputIds)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasFetched = useRef(false)

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

    fetchLayout()
  }, [expanded])

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

  const count = selectedOutputIds.length

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
          {count === 0
            ? 'Assign TVs'
            : `${count} TV${count !== 1 ? 's' : ''} assigned`}
        </span>
        {saving && (
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
                      className="relative flex h-6 w-6 items-center justify-center rounded border-2 transition-colors"
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
                        <span className="block h-2.5 w-2.5 rounded-sm bg-white" />
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
                      const checked = selectedOutputIds.includes(
                        zone.outputNumber
                      )
                      return (
                        <label
                          key={zone.id}
                          className={`flex items-center gap-2 cursor-pointer py-2 px-3 rounded-lg border transition-all ${
                            checked
                              ? 'border-blue-500 bg-blue-500/20'
                              : 'border-slate-600 bg-slate-900 hover:border-slate-500'
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                              checked
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-slate-600 bg-slate-900 group-hover:border-slate-500'
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
                              checked
                                ? 'text-white'
                                : 'text-slate-400'
                            }`}
                            onClick={() => toggleOutput(zone.outputNumber)}
                          >
                            {zone.label || `Output ${zone.outputNumber}`}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
