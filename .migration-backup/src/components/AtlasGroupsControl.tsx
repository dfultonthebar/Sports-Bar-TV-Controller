'use client'

import { useState, useEffect } from 'react'
import { Users, Volume2, VolumeX, Play, Pause } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'

import { logger } from '@/lib/logger'
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
        throw new Error('Failed to control group')
      }

      // Update local state
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
      alert('Failed to control group: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const handleVolumeChange = (groupIndex: number, delta: number) => {
    const group = groups.find(g => g.index === groupIndex)
    if (!group) return

    const newGain = Math.max(-80, Math.min(0, group.gain + delta))
    handleGroupAction(groupIndex, 'setGain', newGain)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-purple-400" />
            <span>Atlas Groups</span>
          </CardTitle>
          <CardDescription>Loading groups...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-red-400" />
            <span>Atlas Groups</span>
          </CardTitle>
          <CardDescription className="text-red-400">{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <button onClick={fetchGroups} className="btn-primary w-full">
            Retry
          </button>
        </CardContent>
      </Card>
    )
  }

  const activeGroups = groups.filter(g => g.isActive)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-purple-400" />
          <span>Atlas Groups</span>
        </CardTitle>
        <CardDescription>
          Control combined zone groups ({activeGroups.length} active)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activeGroups.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No active groups configured
            </div>
          ) : (
            activeGroups.map((group) => (
              <div 
                key={group.index} 
                className="p-4 bg-slate-800/50 rounded-lg border-2 border-purple-500/30 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-5 h-5 text-purple-400" />
                    <span className="font-semibold text-slate-100">{group.name}</span>
                  </div>
                  <button
                    onClick={() => handleGroupAction(group.index, 'setMute', !group.muted)}
                    className={`p-2 rounded-lg transition-colors ${
                      group.muted 
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {group.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </div>

                {/* Source Selection */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Source</label>
                  <select
                    value={group.source}
                    onChange={(e) => handleGroupAction(group.index, 'setSource', parseInt(e.target.value))}
                    className="w-full bg-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value={-1}>No Source</option>
                    {sources.map((source) => (
                      <option key={source.index} value={source.index}>
                        {source.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Volume Control */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Volume</span>
                    <span className="text-slate-300 font-mono">{group.gain.toFixed(1)} dB</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleVolumeChange(group.index, -5)}
                      className="btn-secondary px-3 py-1 text-sm"
                    >
                      -5
                    </button>
                    <input
                      type="range"
                      min="-80"
                      max="0"
                      step="1"
                      value={group.gain}
                      onChange={(e) => handleGroupAction(group.index, 'setGain', parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <button
                      onClick={() => handleVolumeChange(group.index, 5)}
                      className="btn-secondary px-3 py-1 text-sm"
                    >
                      +5
                    </button>
                  </div>
                </div>

                {/* Combine/Split Button */}
                <button
                  onClick={() => handleGroupAction(group.index, 'setActive', false)}
                  className="w-full btn-secondary text-sm"
                >
                  Split Group
                </button>
              </div>
            ))
          )}

          {/* Show inactive groups */}
          {groups.filter(g => !g.isActive).length > 0 && (
            <div className="pt-4 border-t border-slate-700">
              <h4 className="text-sm font-semibold text-slate-400 mb-3">Inactive Groups</h4>
              <div className="grid grid-cols-2 gap-2">
                {groups.filter(g => !g.isActive).map((group) => (
                  <button
                    key={group.index}
                    onClick={() => handleGroupAction(group.index, 'setActive', true)}
                    className="p-3 bg-slate-800/30 rounded-lg border border-slate-700 hover:border-purple-500/50 transition-colors text-sm text-slate-300"
                  >
                    <Users className="w-4 h-4 inline mr-2" />
                    {group.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
