'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Save,
  X,
  Play,
  Layers,
  Palette,
  Clock,
  Star,
  Eye,
  EyeOff,
} from 'lucide-react'

interface DMXScene {
  id: string
  name: string
  description: string | null
  category: string
  sceneData: string
  fadeTimeMs: number
  maestroControllerId: string | null
  maestroPresetNumber: number | null
  bartenderVisible: boolean
  iconName: string | null
  iconColor: string | null
  usageCount: number
  lastUsed: string | null
}

interface DMXFixture {
  id: string
  name: string
  fixtureType: string
  channelCount: number
  channelMap: string
}

interface FixtureState {
  fixtureId: string
  channels: Record<string, number>
}

const SCENE_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'game-day', label: 'Game Day' },
  { value: 'celebration', label: 'Celebration' },
  { value: 'ambient', label: 'Ambient' },
  { value: 'special', label: 'Special Event' },
]

const ICON_COLORS = [
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
]

export default function DMXSceneEditor() {
  const [scenes, setScenes] = useState<DMXScene[]>([])
  const [fixtures, setFixtures] = useState<DMXFixture[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingScene, setEditingScene] = useState<DMXScene | null>(null)
  const [recalling, setRecalling] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general',
    fadeTimeMs: 500,
    bartenderVisible: true,
    iconColor: 'blue',
    fixtureStates: [] as FixtureState[],
  })

  const fetchData = useCallback(async () => {
    try {
      const [scenesRes, fixturesRes] = await Promise.all([
        fetch('/api/dmx/scenes'),
        fetch('/api/dmx/fixtures'),
      ])

      const [scenesData, fixturesData] = await Promise.all([
        scenesRes.json(),
        fixturesRes.json(),
      ])

      if (scenesData.success) setScenes(scenesData.data || [])
      if (fixturesData.success) setFixtures(fixturesData.data || [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAddScene = async () => {
    try {
      const sceneData = JSON.stringify(formData.fixtureStates)

      const response = await fetch('/api/dmx/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          category: formData.category,
          sceneData,
          fadeTimeMs: formData.fadeTimeMs,
          bartenderVisible: formData.bartenderVisible,
          iconColor: formData.iconColor,
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchData()
        setShowAddForm(false)
        resetForm()
      }
    } catch (error) {
      console.error('Failed to add scene:', error)
    }
  }

  const handleUpdateScene = async () => {
    if (!editingScene) return

    try {
      const sceneData = JSON.stringify(formData.fixtureStates)

      const response = await fetch(`/api/dmx/scenes/${editingScene.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          category: formData.category,
          sceneData,
          fadeTimeMs: formData.fadeTimeMs,
          bartenderVisible: formData.bartenderVisible,
          iconColor: formData.iconColor,
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchData()
        setEditingScene(null)
        resetForm()
      }
    } catch (error) {
      console.error('Failed to update scene:', error)
    }
  }

  const handleDeleteScene = async (sceneId: string) => {
    if (!confirm('Delete this scene?')) return

    try {
      const response = await fetch(`/api/dmx/scenes/${sceneId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        await fetchData()
      }
    } catch (error) {
      console.error('Failed to delete scene:', error)
    }
  }

  const handleRecallScene = async (sceneId: string) => {
    setRecalling(sceneId)
    try {
      await fetch('/api/dmx/scenes/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneId }),
      })
      await fetchData()
    } catch (error) {
      console.error('Failed to recall scene:', error)
    } finally {
      setRecalling(null)
    }
  }

  const startEdit = (scene: DMXScene) => {
    let fixtureStates: FixtureState[] = []
    try {
      fixtureStates = JSON.parse(scene.sceneData || '[]')
    } catch { /* ignore */ }

    setEditingScene(scene)
    setFormData({
      name: scene.name,
      description: scene.description || '',
      category: scene.category,
      fadeTimeMs: scene.fadeTimeMs,
      bartenderVisible: scene.bartenderVisible,
      iconColor: scene.iconColor || 'blue',
      fixtureStates,
    })
    setShowAddForm(false)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'general',
      fadeTimeMs: 500,
      bartenderVisible: true,
      iconColor: 'blue',
      fixtureStates: [],
    })
  }

  const cancelEdit = () => {
    setEditingScene(null)
    setShowAddForm(false)
    resetForm()
  }

  const initializeFixtureStates = () => {
    const states = fixtures.map(fixture => {
      let channelMap: Record<string, number> = {}
      try {
        channelMap = JSON.parse(fixture.channelMap || '{}')
      } catch { /* ignore */ }

      const channels: Record<string, number> = {}
      Object.keys(channelMap).forEach(key => {
        channels[key] = 0
      })

      return { fixtureId: fixture.id, channels }
    })
    setFormData({ ...formData, fixtureStates: states })
  }

  const updateFixtureChannel = (fixtureId: string, channel: string, value: number) => {
    const newStates = formData.fixtureStates.map(state => {
      if (state.fixtureId === fixtureId) {
        return {
          ...state,
          channels: { ...state.channels, [channel]: value },
        }
      }
      return state
    })
    setFormData({ ...formData, fixtureStates: newStates })
  }

  const getCategoryLabel = (category: string) => {
    return SCENE_CATEGORIES.find(c => c.value === category)?.label || category
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Loading scenes...</p>
        </CardContent>
      </Card>
    )
  }

  const isEditing = editingScene !== null || showAddForm

  return (
    <div className="space-y-4">
      {/* Add/Edit Form */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>{editingScene ? 'Edit Scene' : 'Create DMX Scene'}</CardTitle>
            <CardDescription>
              Design a lighting scene with fixture states
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Scene Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Game Day Red"
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCENE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fade Time (ms)</Label>
                <Input
                  type="number"
                  min="0"
                  max="10000"
                  step="100"
                  value={formData.fadeTimeMs}
                  onChange={(e) => setFormData({ ...formData, fadeTimeMs: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Icon Color</Label>
                <div className="flex gap-2">
                  {ICON_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setFormData({ ...formData, iconColor: color.value })}
                      className={`w-8 h-8 rounded-full ${color.class} ${
                        formData.iconColor === color.value ? 'ring-2 ring-white ring-offset-2' : ''
                      }`}
                      title={color.label}
                    />
                  ))}
                </div>
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

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.bartenderVisible}
                onCheckedChange={(v) => setFormData({ ...formData, bartenderVisible: v })}
              />
              <Label>Visible to Bartenders</Label>
            </div>

            {/* Fixture States */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-lg">Fixture Levels</Label>
                {formData.fixtureStates.length === 0 && (
                  <Button variant="outline" size="sm" onClick={initializeFixtureStates}>
                    <Palette className="w-4 h-4 mr-2" />
                    Initialize Fixtures
                  </Button>
                )}
              </div>

              {formData.fixtureStates.map((state) => {
                const fixture = fixtures.find(f => f.id === state.fixtureId)
                if (!fixture) return null

                return (
                  <Card key={state.fixtureId} className="p-3">
                    <p className="font-medium mb-2">{fixture.name}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {Object.entries(state.channels).map(([channel, value]) => (
                        <div key={channel} className="space-y-1">
                          <Label className="text-xs capitalize">{channel}</Label>
                          <div className="flex items-center gap-2">
                            <Slider
                              value={[value]}
                              onValueChange={([v]) => updateFixtureChannel(state.fixtureId, channel, v)}
                              max={255}
                              step={1}
                              className="flex-1"
                            />
                            <span className="text-xs w-8 text-right">{value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )
              })}
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={cancelEdit}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={editingScene ? handleUpdateScene : handleAddScene}
                disabled={!formData.name}
              >
                <Save className="w-4 h-4 mr-2" />
                {editingScene ? 'Update' : 'Create'} Scene
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isEditing && (
        <Button onClick={() => setShowAddForm(true)} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Create DMX Scene
        </Button>
      )}

      {/* Scenes List */}
      <div className="grid gap-3">
        {scenes.length === 0 && !isEditing ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No DMX scenes configured.</p>
              <p className="text-sm mt-2">Create scenes to save lighting presets.</p>
            </CardContent>
          </Card>
        ) : (
          scenes.map((scene) => (
            <Card key={scene.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${scene.iconColor || 'blue'}-500`}
                      style={{ backgroundColor: ICON_COLORS.find(c => c.value === scene.iconColor)?.class.replace('bg-', '') }}
                    >
                      <Layers className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{scene.name}</p>
                        {scene.bartenderVisible ? (
                          <Eye className="w-4 h-4 text-green-500" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {getCategoryLabel(scene.category)} &bull; {scene.fadeTimeMs}ms fade &bull;
                        Used {scene.usageCount} times
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{getCategoryLabel(scene.category)}</Badge>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleRecallScene(scene.id)}
                      disabled={recalling === scene.id}
                    >
                      {recalling === scene.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => startEdit(scene)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteScene(scene.id)}
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
