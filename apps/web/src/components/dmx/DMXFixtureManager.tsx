'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Lightbulb,
  Save,
  X,
  Sliders,
  Zap,
} from 'lucide-react'

interface DMXFixture {
  id: string
  controllerId: string | null
  zoneId: string | null
  name: string
  fixtureType: string
  manufacturer: string | null
  model: string | null
  universe: number
  startAddress: number
  channelCount: number
  channelMap: string
  capabilities: string | null
  isActive: boolean
  displayOrder: number
}

interface DMXController {
  id: string
  name: string
  controllerType: string
  universeStart: number
  universeCount: number
}

interface DMXZone {
  id: string
  name: string
}

const FIXTURE_TYPES = [
  { value: 'led-par', label: 'LED Par Can', channels: 4, map: { dimmer: 1, red: 2, green: 3, blue: 4 } },
  { value: 'led-par-rgbw', label: 'LED Par RGBW', channels: 5, map: { dimmer: 1, red: 2, green: 3, blue: 4, white: 5 } },
  { value: 'led-bar', label: 'LED Bar', channels: 3, map: { red: 1, green: 2, blue: 3 } },
  { value: 'moving-head', label: 'Moving Head', channels: 16, map: { pan: 1, panFine: 2, tilt: 3, tiltFine: 4, speed: 5, dimmer: 6, strobe: 7, red: 8, green: 9, blue: 10, white: 11, gobo: 12, goboRotation: 13, prism: 14, focus: 15, macro: 16 } },
  { value: 'strobe', label: 'Strobe', channels: 2, map: { dimmer: 1, speed: 2 } },
  { value: 'fog', label: 'Fog Machine', channels: 2, map: { output: 1, fan: 2 } },
  { value: 'dimmer', label: 'Dimmer Pack', channels: 4, map: { ch1: 1, ch2: 2, ch3: 3, ch4: 4 } },
  { value: 'custom', label: 'Custom', channels: 1, map: { ch1: 1 } },
]

export default function DMXFixtureManager() {
  const [fixtures, setFixtures] = useState<DMXFixture[]>([])
  const [controllers, setControllers] = useState<DMXController[]>([])
  const [zones, setZones] = useState<DMXZone[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingFixture, setEditingFixture] = useState<DMXFixture | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    fixtureType: 'led-par',
    controllerId: '',
    zoneId: '',
    manufacturer: '',
    model: '',
    universe: 0,
    startAddress: 1,
    channelCount: 4,
    channelMap: '{}',
  })

  const fetchData = useCallback(async () => {
    try {
      const [fixturesRes, controllersRes, zonesRes] = await Promise.all([
        fetch('/api/dmx/fixtures'),
        fetch('/api/dmx/controllers'),
        fetch('/api/dmx/zones'),
      ])

      const [fixturesData, controllersData, zonesData] = await Promise.all([
        fixturesRes.json(),
        controllersRes.json(),
        zonesRes.json(),
      ])

      if (fixturesData.success) setFixtures(fixturesData.data || [])
      if (controllersData.success) setControllers(controllersData.data || [])
      if (zonesData.success) setZones(zonesData.data || [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleFixtureTypeChange = (fixtureType: string) => {
    const typeInfo = FIXTURE_TYPES.find(t => t.value === fixtureType)
    setFormData({
      ...formData,
      fixtureType,
      channelCount: typeInfo?.channels || 1,
      channelMap: JSON.stringify(typeInfo?.map || {}),
    })
  }

  const handleAddFixture = async () => {
    try {
      const response = await fetch('/api/dmx/fixtures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          fixtureType: formData.fixtureType,
          controllerId: formData.controllerId || null,
          zoneId: formData.zoneId || null,
          manufacturer: formData.manufacturer || null,
          model: formData.model || null,
          universe: formData.universe,
          startAddress: formData.startAddress,
          channelCount: formData.channelCount,
          channelMap: formData.channelMap,
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchData()
        setShowAddForm(false)
        resetForm()
      }
    } catch (error) {
      console.error('Failed to add fixture:', error)
    }
  }

  const handleUpdateFixture = async () => {
    if (!editingFixture) return

    try {
      const response = await fetch(`/api/dmx/fixtures/${editingFixture.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          fixtureType: formData.fixtureType,
          controllerId: formData.controllerId || null,
          zoneId: formData.zoneId || null,
          manufacturer: formData.manufacturer || null,
          model: formData.model || null,
          universe: formData.universe,
          startAddress: formData.startAddress,
          channelCount: formData.channelCount,
          channelMap: formData.channelMap,
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchData()
        setEditingFixture(null)
        resetForm()
      }
    } catch (error) {
      console.error('Failed to update fixture:', error)
    }
  }

  const handleDeleteFixture = async (fixtureId: string) => {
    if (!confirm('Delete this fixture?')) return

    try {
      const response = await fetch(`/api/dmx/fixtures/${fixtureId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        await fetchData()
      }
    } catch (error) {
      console.error('Failed to delete fixture:', error)
    }
  }

  const startEdit = (fixture: DMXFixture) => {
    setEditingFixture(fixture)
    setFormData({
      name: fixture.name,
      fixtureType: fixture.fixtureType,
      controllerId: fixture.controllerId || '',
      zoneId: fixture.zoneId || '',
      manufacturer: fixture.manufacturer || '',
      model: fixture.model || '',
      universe: fixture.universe,
      startAddress: fixture.startAddress,
      channelCount: fixture.channelCount,
      channelMap: fixture.channelMap,
    })
    setShowAddForm(false)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      fixtureType: 'led-par',
      controllerId: '',
      zoneId: '',
      manufacturer: '',
      model: '',
      universe: 0,
      startAddress: 1,
      channelCount: 4,
      channelMap: '{}',
    })
  }

  const cancelEdit = () => {
    setEditingFixture(null)
    setShowAddForm(false)
    resetForm()
  }

  const getFixtureTypeLabel = (type: string) => {
    return FIXTURE_TYPES.find(t => t.value === type)?.label || type
  }

  const getControllerName = (controllerId: string | null) => {
    if (!controllerId) return 'Unassigned'
    return controllers.find(c => c.id === controllerId)?.name || 'Unknown'
  }

  const getZoneName = (zoneId: string | null) => {
    if (!zoneId) return 'No Zone'
    return zones.find(z => z.id === zoneId)?.name || 'Unknown'
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Loading fixtures...</p>
        </CardContent>
      </Card>
    )
  }

  const isEditing = editingFixture !== null || showAddForm

  return (
    <div className="space-y-4">
      {/* Add/Edit Form */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>{editingFixture ? 'Edit Fixture' : 'Add DMX Fixture'}</CardTitle>
            <CardDescription>
              Configure a DMX lighting fixture with channel mapping
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fixture Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Stage Left Par 1"
                />
              </div>

              <div className="space-y-2">
                <Label>Fixture Type</Label>
                <Select value={formData.fixtureType} onValueChange={handleFixtureTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIXTURE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label} ({type.channels} ch)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Controller</Label>
                <Select
                  value={formData.controllerId}
                  onValueChange={(v) => setFormData({ ...formData, controllerId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select controller" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {controllers.map((controller) => (
                      <SelectItem key={controller.id} value={controller.id}>
                        {controller.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Zone</Label>
                <Select
                  value={formData.zoneId}
                  onValueChange={(v) => setFormData({ ...formData, zoneId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Zone</SelectItem>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zone.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Universe</Label>
                <Input
                  type="number"
                  min="0"
                  max="15"
                  value={formData.universe}
                  onChange={(e) => setFormData({ ...formData, universe: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Start Address (1-512)</Label>
                <Input
                  type="number"
                  min="1"
                  max="512"
                  value={formData.startAddress}
                  onChange={(e) => setFormData({ ...formData, startAddress: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Manufacturer</Label>
                <Input
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  placeholder="Chauvet, ADJ, etc."
                />
              </div>

              <div className="space-y-2">
                <Label>Model</Label>
                <Input
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="SlimPAR 64"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-800 rounded-lg">
              <p className="text-sm text-slate-400 mb-2">Channel Mapping (JSON)</p>
              <pre className="text-xs text-slate-300 overflow-x-auto">
                {formData.channelMap}
              </pre>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={cancelEdit}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={editingFixture ? handleUpdateFixture : handleAddFixture}
                disabled={!formData.name}
              >
                <Save className="w-4 h-4 mr-2" />
                {editingFixture ? 'Update' : 'Add'} Fixture
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isEditing && (
        <Button onClick={() => setShowAddForm(true)} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add DMX Fixture
        </Button>
      )}

      {/* Fixtures List */}
      <div className="grid gap-3">
        {fixtures.length === 0 && !isEditing ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No DMX fixtures configured.</p>
              <p className="text-sm mt-2">Add fixtures to start controlling your lights.</p>
            </CardContent>
          </Card>
        ) : (
          fixtures.map((fixture) => (
            <Card key={fixture.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${fixture.isActive ? 'bg-purple-100' : 'bg-gray-100'}`}>
                      <Lightbulb className={`w-5 h-5 ${fixture.isActive ? 'text-purple-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <p className="font-medium">{fixture.name}</p>
                      <p className="text-sm text-gray-500">
                        {getFixtureTypeLabel(fixture.fixtureType)} &bull;
                        Universe {fixture.universe}, Address {fixture.startAddress}-{fixture.startAddress + fixture.channelCount - 1}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{getControllerName(fixture.controllerId)}</Badge>
                    <Badge variant="secondary">{getZoneName(fixture.zoneId)}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => startEdit(fixture)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteFixture(fixture.id)}
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
