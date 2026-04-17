'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import {
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Save,
  X,
  Zap,
  Play,
  Trophy,
  Target,
  Timer,
  AlertCircle,
} from 'lucide-react'

interface DMXGameEventTrigger {
  id: string
  name: string
  description: string | null
  eventType: string
  sportFilter: string | null
  teamFilter: string | null
  homeTeamOnly: boolean
  effectType: string
  sceneId: string | null
  maestroPresetNumber: number | null
  effectConfig: string | null
  durationMs: number
  cooldownMs: number
  isEnabled: boolean
  priority: number
  lastTriggered: string | null
}

interface DMXScene {
  id: string
  name: string
  category: string
}

const EVENT_TYPES = [
  { value: 'goal', label: 'Goal / Score', sports: ['nhl', 'soccer', 'mls'] },
  { value: 'touchdown', label: 'Touchdown', sports: ['nfl', 'ncaaf'] },
  { value: 'home_run', label: 'Home Run', sports: ['mlb'] },
  { value: 'three_pointer', label: '3-Point Shot', sports: ['nba', 'ncaab'] },
  { value: 'score_change', label: 'Any Score Change', sports: ['all'] },
  { value: 'game_start', label: 'Game Start', sports: ['all'] },
  { value: 'game_end', label: 'Game End', sports: ['all'] },
  { value: 'halftime', label: 'Halftime', sports: ['all'] },
  { value: 'overtime', label: 'Overtime', sports: ['all'] },
  { value: 'penalty', label: 'Penalty/Foul', sports: ['nhl', 'nfl', 'soccer'] },
]

const SPORTS = [
  { value: 'nfl', label: 'NFL' },
  { value: 'nba', label: 'NBA' },
  { value: 'mlb', label: 'MLB' },
  { value: 'nhl', label: 'NHL' },
  { value: 'ncaaf', label: 'College Football' },
  { value: 'ncaab', label: 'College Basketball' },
  { value: 'mls', label: 'MLS' },
  { value: 'soccer', label: 'Soccer' },
]

const EFFECT_TYPES = [
  { value: 'scene', label: 'Scene Recall', description: 'Recall a saved DMX scene' },
  { value: 'strobe', label: 'Strobe', description: 'Quick flashing lights' },
  { value: 'color-burst', label: 'Color Burst', description: 'Flash a single color then fade' },
  { value: 'chase', label: 'Chase', description: 'Sequential light pattern' },
  { value: 'rainbow', label: 'Rainbow', description: 'Cycle through colors' },
  { value: 'pulse', label: 'Pulse', description: 'Pulsing intensity' },
  { value: 'maestro-preset', label: 'Maestro Preset', description: 'Trigger Maestro controller preset' },
]

export default function DMXGameEventManager() {
  const [triggers, setTriggers] = useState<DMXGameEventTrigger[]>([])
  const [scenes, setScenes] = useState<DMXScene[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTrigger, setEditingTrigger] = useState<DMXGameEventTrigger | null>(null)
  const [simulating, setSimulating] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    eventType: 'goal',
    sportFilter: '',
    homeTeamOnly: true,
    effectType: 'strobe',
    sceneId: '',
    maestroPresetNumber: 1,
    durationMs: 5000,
    cooldownMs: 30000,
    isEnabled: true,
    priority: 0,
    effectConfig: {
      color: '#ff0000',
      rate: 10,
      speed: 60,
      intensity: 255,
    },
  })

  const fetchData = useCallback(async () => {
    try {
      const [triggersRes, scenesRes] = await Promise.all([
        fetch('/api/dmx/game-events/triggers'),
        fetch('/api/dmx/scenes'),
      ])

      const [triggersData, scenesData] = await Promise.all([
        triggersRes.json(),
        scenesRes.json(),
      ])

      if (triggersData.success) setTriggers(triggersData.triggers || [])
      if (scenesData.success) setScenes(scenesData.data || [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAddTrigger = async () => {
    try {
      const response = await fetch('/api/dmx/game-events/triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          eventType: formData.eventType,
          sportFilter: formData.sportFilter || null,
          homeTeamOnly: formData.homeTeamOnly,
          effectType: formData.effectType,
          sceneId: formData.effectType === 'scene' ? formData.sceneId : null,
          maestroPresetNumber: formData.effectType === 'maestro-preset' ? formData.maestroPresetNumber : null,
          effectConfig: formData.effectConfig,
          durationMs: formData.durationMs,
          cooldownMs: formData.cooldownMs,
          isEnabled: formData.isEnabled,
          priority: formData.priority,
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchData()
        setShowAddForm(false)
        resetForm()
      }
    } catch (error) {
      console.error('Failed to add trigger:', error)
    }
  }

  const handleUpdateTrigger = async () => {
    if (!editingTrigger) return

    try {
      const response = await fetch(`/api/dmx/game-events/triggers/${editingTrigger.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          eventType: formData.eventType,
          sportFilter: formData.sportFilter || null,
          homeTeamOnly: formData.homeTeamOnly,
          effectType: formData.effectType,
          sceneId: formData.effectType === 'scene' ? formData.sceneId : null,
          maestroPresetNumber: formData.effectType === 'maestro-preset' ? formData.maestroPresetNumber : null,
          effectConfig: formData.effectConfig,
          durationMs: formData.durationMs,
          cooldownMs: formData.cooldownMs,
          isEnabled: formData.isEnabled,
          priority: formData.priority,
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchData()
        setEditingTrigger(null)
        resetForm()
      }
    } catch (error) {
      console.error('Failed to update trigger:', error)
    }
  }

  const handleDeleteTrigger = async (triggerId: string) => {
    if (!confirm('Delete this game event trigger?')) return

    try {
      const response = await fetch(`/api/dmx/game-events/triggers/${triggerId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        await fetchData()
      }
    } catch (error) {
      console.error('Failed to delete trigger:', error)
    }
  }

  const handleToggleEnabled = async (trigger: DMXGameEventTrigger) => {
    try {
      await fetch(`/api/dmx/game-events/triggers/${trigger.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !trigger.isEnabled }),
      })
      await fetchData()
    } catch (error) {
      console.error('Failed to toggle trigger:', error)
    }
  }

  const handleSimulateTrigger = async (triggerId: string) => {
    setSimulating(triggerId)
    try {
      await fetch('/api/dmx/game-events/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerId }),
      })
      await fetchData()
    } catch (error) {
      console.error('Failed to simulate trigger:', error)
    } finally {
      setTimeout(() => setSimulating(null), 2000)
    }
  }

  const startEdit = (trigger: DMXGameEventTrigger) => {
    let effectConfig = { color: '#ff0000', rate: 10, speed: 60, intensity: 255 }
    try {
      if (trigger.effectConfig) {
        effectConfig = { ...effectConfig, ...JSON.parse(trigger.effectConfig) }
      }
    } catch { /* ignore */ }

    setEditingTrigger(trigger)
    setFormData({
      name: trigger.name,
      description: trigger.description || '',
      eventType: trigger.eventType,
      sportFilter: trigger.sportFilter || '',
      homeTeamOnly: trigger.homeTeamOnly,
      effectType: trigger.effectType,
      sceneId: trigger.sceneId || '',
      maestroPresetNumber: trigger.maestroPresetNumber || 1,
      durationMs: trigger.durationMs,
      cooldownMs: trigger.cooldownMs,
      isEnabled: trigger.isEnabled,
      priority: trigger.priority,
      effectConfig,
    })
    setShowAddForm(false)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      eventType: 'goal',
      sportFilter: '',
      homeTeamOnly: true,
      effectType: 'strobe',
      sceneId: '',
      maestroPresetNumber: 1,
      durationMs: 5000,
      cooldownMs: 30000,
      isEnabled: true,
      priority: 0,
      effectConfig: {
        color: '#ff0000',
        rate: 10,
        speed: 60,
        intensity: 255,
      },
    })
  }

  const cancelEdit = () => {
    setEditingTrigger(null)
    setShowAddForm(false)
    resetForm()
  }

  const getEventTypeLabel = (eventType: string) => {
    return EVENT_TYPES.find(e => e.value === eventType)?.label || eventType
  }

  const getSportLabel = (sportFilter: string | null) => {
    if (!sportFilter) return 'All Sports'
    return SPORTS.find(s => s.value === sportFilter)?.label || sportFilter
  }

  const getEffectTypeLabel = (effectType: string) => {
    return EFFECT_TYPES.find(e => e.value === effectType)?.label || effectType
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Loading game event triggers...</p>
        </CardContent>
      </Card>
    )
  }

  const isEditing = editingTrigger !== null || showAddForm

  return (
    <div className="space-y-4">
      {/* Add/Edit Form */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              {editingTrigger ? 'Edit Game Event Trigger' : 'Create Game Event Trigger'}
            </CardTitle>
            <CardDescription>
              Automatically trigger lighting effects when game events occur
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Trigger Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Home Team Goal Celebration"
                />
              </div>

              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select
                  value={formData.eventType}
                  onValueChange={(v) => setFormData({ ...formData, eventType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((event) => (
                      <SelectItem key={event.value} value={event.value}>
                        {event.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sport Filter</Label>
                <Select
                  value={formData.sportFilter}
                  onValueChange={(v) => setFormData({ ...formData, sportFilter: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Sports" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Sports</SelectItem>
                    {SPORTS.map((sport) => (
                      <SelectItem key={sport.value} value={sport.value}>
                        {sport.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Effect Type</Label>
                <Select
                  value={formData.effectType}
                  onValueChange={(v) => setFormData({ ...formData, effectType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EFFECT_TYPES.map((effect) => (
                      <SelectItem key={effect.value} value={effect.value}>
                        {effect.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.effectType === 'scene' && (
                <div className="space-y-2">
                  <Label>Scene</Label>
                  <Select
                    value={formData.sceneId}
                    onValueChange={(v) => setFormData({ ...formData, sceneId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select scene" />
                    </SelectTrigger>
                    <SelectContent>
                      {scenes.map((scene) => (
                        <SelectItem key={scene.id} value={scene.id}>
                          {scene.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.effectType === 'maestro-preset' && (
                <div className="space-y-2">
                  <Label>Maestro Preset Number</Label>
                  <Input
                    type="number"
                    min="1"
                    max="99"
                    value={formData.maestroPresetNumber}
                    onChange={(e) => setFormData({ ...formData, maestroPresetNumber: parseInt(e.target.value) || 1 })}
                  />
                </div>
              )}

              {['strobe', 'color-burst', 'pulse'].includes(formData.effectType) && (
                <div className="space-y-2">
                  <Label>Effect Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={formData.effectConfig.color}
                      onChange={(e) => setFormData({
                        ...formData,
                        effectConfig: { ...formData.effectConfig, color: e.target.value },
                      })}
                      className="w-14 h-10 p-1"
                    />
                    <Input
                      value={formData.effectConfig.color}
                      onChange={(e) => setFormData({
                        ...formData,
                        effectConfig: { ...formData.effectConfig, color: e.target.value },
                      })}
                      placeholder="#ff0000"
                      className="flex-1"
                    />
                  </div>
                </div>
              )}

              {formData.effectType === 'strobe' && (
                <div className="space-y-2">
                  <Label>Strobe Rate (Hz): {formData.effectConfig.rate}</Label>
                  <Slider
                    value={[formData.effectConfig.rate]}
                    onValueChange={([v]) => setFormData({
                      ...formData,
                      effectConfig: { ...formData.effectConfig, rate: v },
                    })}
                    min={1}
                    max={25}
                    step={1}
                  />
                </div>
              )}

              {formData.effectType === 'chase' && (
                <div className="space-y-2">
                  <Label>Chase Speed (BPM): {formData.effectConfig.speed}</Label>
                  <Slider
                    value={[formData.effectConfig.speed]}
                    onValueChange={([v]) => setFormData({
                      ...formData,
                      effectConfig: { ...formData.effectConfig, speed: v },
                    })}
                    min={30}
                    max={240}
                    step={10}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Duration (seconds)</Label>
                <Input
                  type="number"
                  min="0.5"
                  max="60"
                  step="0.5"
                  value={formData.durationMs / 1000}
                  onChange={(e) => setFormData({ ...formData, durationMs: (parseFloat(e.target.value) || 1) * 1000 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Cooldown (seconds)</Label>
                <Input
                  type="number"
                  min="0"
                  max="300"
                  step="5"
                  value={formData.cooldownMs / 1000}
                  onChange={(e) => setFormData({ ...formData, cooldownMs: (parseFloat(e.target.value) || 0) * 1000 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Priority (higher = more important)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.homeTeamOnly}
                  onCheckedChange={(v) => setFormData({ ...formData, homeTeamOnly: v })}
                />
                <Label>Home Team Only</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isEnabled}
                  onCheckedChange={(v) => setFormData({ ...formData, isEnabled: v })}
                />
                <Label>Enabled</Label>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={cancelEdit}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={editingTrigger ? handleUpdateTrigger : handleAddTrigger}
                disabled={!formData.name}
              >
                <Save className="w-4 h-4 mr-2" />
                {editingTrigger ? 'Update' : 'Create'} Trigger
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isEditing && (
        <Button onClick={() => setShowAddForm(true)} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Create Game Event Trigger
        </Button>
      )}

      {/* Triggers List */}
      <div className="grid gap-3">
        {triggers.length === 0 && !isEditing ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No game event triggers configured.</p>
              <p className="text-sm mt-2">Create triggers to automatically celebrate goals and scores!</p>
            </CardContent>
          </Card>
        ) : (
          triggers.map((trigger) => (
            <Card
              key={trigger.id}
              className={`hover:shadow-md transition-shadow ${!trigger.isEnabled ? 'opacity-60' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${trigger.isEnabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                      {trigger.eventType === 'goal' || trigger.eventType === 'touchdown' ? (
                        <Trophy className={`w-5 h-5 ${trigger.isEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                      ) : trigger.eventType === 'score_change' ? (
                        <Target className={`w-5 h-5 ${trigger.isEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                      ) : (
                        <Zap className={`w-5 h-5 ${trigger.isEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{trigger.name}</p>
                        {!trigger.isEnabled && (
                          <Badge variant="secondary" className="text-xs">Disabled</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {getEventTypeLabel(trigger.eventType)} &bull; {getSportLabel(trigger.sportFilter)}
                        {trigger.homeTeamOnly && ' (Home only)'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{getEffectTypeLabel(trigger.effectType)}</Badge>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Timer className="w-3 h-3" />
                      {trigger.durationMs / 1000}s
                    </Badge>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleSimulateTrigger(trigger.id)}
                      disabled={simulating === trigger.id || !trigger.isEnabled}
                    >
                      {simulating === trigger.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                    <Switch
                      checked={trigger.isEnabled}
                      onCheckedChange={() => handleToggleEnabled(trigger)}
                    />
                    <Button variant="ghost" size="sm" onClick={() => startEdit(trigger)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTrigger(trigger.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
