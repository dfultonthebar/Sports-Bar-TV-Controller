'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Tv,
  Satellite,
  Cable,
  Save,
  Pencil,
} from 'lucide-react'

interface ChannelPreset {
  id: string
  name: string
  channelNumber: string
  deviceType: string
  order: number
  isActive: boolean
  usageCount: number
  lastUsed: string | null
}

interface SyncResultPreset {
  name: string
  deviceType: string
  channelNumber: string
  action: 'created' | 'updated' | 'unchanged'
}

interface SyncResult {
  success: boolean
  created: number
  updated: number
  unchanged: number
  presets: SyncResultPreset[]
  error?: string
}

// Station categories for grouping
const CHANNEL_GROUPS: Record<string, string[]> = {
  'National Sports': [
    'ESPN', 'ESPN2', 'ESPN U', 'ESPN News', 'Fox Sports 1', 'Fox Sports 2',
    'TNT', 'TBS', 'TruTV', 'USA Network', 'CBS Sports Network',
    'Peacock/NBC Sports', 'Fox Sports Prime',
  ],
  'Regional Sports': [
    'Fan Duel', 'Fan Duel North', 'Big 10', 'SEC Network',
  ],
  'Sports Specialty': [
    'Golf', 'Tennis', 'MLB Network', 'NFL Network', 'NBA TV', 'NHL Network',
    'Willow Cricket',
  ],
  'Local Broadcast': [
    'FOX', 'CBS', 'NBC', 'ABC', 'CW', 'WGBA',
  ],
}

function getGroupForChannel(name: string): string {
  for (const [group, channels] of Object.entries(CHANNEL_GROUPS)) {
    if (channels.includes(name)) return group
  }
  return 'Other'
}

export default function SportsChannelSetup() {
  const [presets, setPresets] = useState<ChannelPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchPresets = useCallback(async () => {
    try {
      const [cableRes, dtvRes] = await Promise.all([
        fetch('/api/channel-presets?deviceType=cable'),
        fetch('/api/channel-presets?deviceType=directv'),
      ])
      const cableData = await cableRes.json()
      const dtvData = await dtvRes.json()

      const all = [
        ...(cableData.presets || []),
        ...(dtvData.presets || []),
      ]
      setPresets(all)
    } catch (error) {
      console.error('Failed to fetch presets:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPresets()
  }, [fetchPresets])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/channel-presets/sync-from-guide', { method: 'POST' })
      const data = await res.json()
      setSyncResult(data)
      if (data.success) {
        await fetchPresets()
      }
    } catch (error) {
      setSyncResult({
        success: false,
        created: 0,
        updated: 0,
        unchanged: 0,
        presets: [],
        error: 'Network error during sync',
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleSaveEdit = async (presetId: string) => {
    setSaving(true)
    try {
      await fetch(`/api/channel-presets/${presetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelNumber: editValue }),
      })
      setEditingId(null)
      await fetchPresets()
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setSaving(false)
    }
  }

  // Build a merged view: unique channel names with cable + directv numbers
  const channelRows = buildChannelRows(presets)

  // Group channels
  const grouped = new Map<string, typeof channelRows>()
  for (const row of channelRows) {
    const group = getGroupForChannel(row.name)
    if (!grouped.has(group)) grouped.set(group, [])
    grouped.get(group)!.push(row)
  }

  // Order groups
  const groupOrder = ['National Sports', 'Regional Sports', 'Sports Specialty', 'Local Broadcast', 'Other']
  const orderedGroups = groupOrder
    .filter(g => grouped.has(g))
    .map(g => ({ name: g, rows: grouped.get(g)! }))

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-700 p-8">
        <div className="text-center text-slate-400">Loading sports channels...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Tv className="h-5 w-5 text-blue-400" />
            Sports Channel Setup
          </h3>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-slate-600 hover:bg-slate-700"
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync from Sports Guide'}
            </Button>
          </div>
        </div>

        <p className="text-sm text-slate-400">
          Channel numbers are synced from the Rail Media Sports Guide API.
          Click &quot;Sync from Sports Guide&quot; to update from the latest guide data.
          You can also manually edit any channel number.
        </p>

        {/* Sync result banner */}
        {syncResult && (
          <div className={`mt-4 rounded-lg p-4 ${
            syncResult.success
              ? 'bg-green-900/30 border border-green-500/30'
              : 'bg-red-900/30 border border-red-500/30'
          }`}>
            {syncResult.success ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <span className="text-green-200">
                  Sync complete: {syncResult.created} created, {syncResult.updated} updated, {syncResult.unchanged} unchanged
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <span className="text-red-200">{syncResult.error || 'Sync failed'}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg bg-slate-800/50 p-4 flex items-center gap-3">
          <Tv className="h-8 w-8 text-blue-400" />
          <div>
            <p className="text-xs text-slate-400">Total Channels</p>
            <p className="text-2xl font-bold text-white">{channelRows.length}</p>
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/50 p-4 flex items-center gap-3">
          <Cable className="h-8 w-8 text-green-400" />
          <div>
            <p className="text-xs text-slate-400">Cable Presets</p>
            <p className="text-2xl font-bold text-white">{channelRows.filter(r => r.cableNumber).length}</p>
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/50 p-4 flex items-center gap-3">
          <Satellite className="h-8 w-8 text-purple-400" />
          <div>
            <p className="text-xs text-slate-400">DirecTV Presets</p>
            <p className="text-2xl font-bold text-white">{channelRows.filter(r => r.dtvNumber).length}</p>
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/50 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          <div>
            <p className="text-xs text-slate-400">Both Synced</p>
            <p className="text-2xl font-bold text-white">{channelRows.filter(r => r.cableNumber && r.dtvNumber).length}</p>
          </div>
        </div>
      </div>

      {/* Channel table by group */}
      {orderedGroups.map(({ name: groupName, rows }) => (
        <div key={groupName} className="rounded-lg border border-slate-700">
          <div className="px-6 py-3 bg-slate-800/80 border-b border-slate-700">
            <h4 className="text-sm font-semibold text-slate-300">{groupName}</h4>
          </div>
          <table className="w-full">
            <thead className="bg-slate-800">
              <tr>
                <th className="text-left p-3 text-slate-300 font-medium">Station</th>
                <th className="text-left p-3 text-slate-300 font-medium">Cable Ch#</th>
                <th className="text-left p-3 text-slate-300 font-medium">DirecTV Ch#</th>
                <th className="text-left p-3 text-slate-300 font-medium">Status</th>
                <th className="text-right p-3 text-slate-300 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.name}
                  className={index % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-800/50'}
                >
                  <td className="p-3 text-white font-medium">{row.name}</td>
                  <td className="p-3">
                    {editingId === row.cableId ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="bg-slate-800 border-slate-600 w-24 h-8"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(row.cableId!)
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSaveEdit(row.cableId!)}
                          disabled={saving}
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-slate-200">{row.cableNumber || '—'}</span>
                    )}
                  </td>
                  <td className="p-3">
                    {editingId === row.dtvId ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="bg-slate-800 border-slate-600 w-24 h-8"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(row.dtvId!)
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSaveEdit(row.dtvId!)}
                          disabled={saving}
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-slate-200">{row.dtvNumber || '—'}</span>
                    )}
                  </td>
                  <td className="p-3">
                    {row.cableNumber && row.dtvNumber ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Synced
                      </Badge>
                    ) : row.cableNumber || row.dtvNumber ? (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                        Partial
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
                        Manual
                      </Badge>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {row.cableId && editingId !== row.cableId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-slate-400 hover:text-white h-7 px-2"
                          onClick={() => {
                            setEditingId(row.cableId!)
                            setEditValue(row.cableNumber || '')
                          }}
                          title="Edit cable channel"
                        >
                          <Cable className="h-3 w-3 mr-1" />
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {row.dtvId && editingId !== row.dtvId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-slate-400 hover:text-white h-7 px-2"
                          onClick={() => {
                            setEditingId(row.dtvId!)
                            setEditValue(row.dtvNumber || '')
                          }}
                          title="Edit DirecTV channel"
                        >
                          <Satellite className="h-3 w-3 mr-1" />
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

interface ChannelRow {
  name: string
  cableId: string | null
  cableNumber: string | null
  dtvId: string | null
  dtvNumber: string | null
}

function buildChannelRows(presets: ChannelPreset[]): ChannelRow[] {
  const byName = new Map<string, ChannelRow>()

  for (const preset of presets) {
    let row = byName.get(preset.name)
    if (!row) {
      row = { name: preset.name, cableId: null, cableNumber: null, dtvId: null, dtvNumber: null }
      byName.set(preset.name, row)
    }
    if (preset.deviceType === 'cable') {
      row.cableId = preset.id
      row.cableNumber = preset.channelNumber
    } else if (preset.deviceType === 'directv') {
      row.dtvId = preset.id
      row.dtvNumber = preset.channelNumber
    }
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
}
