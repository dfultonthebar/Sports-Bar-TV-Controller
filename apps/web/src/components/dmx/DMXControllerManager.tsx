'use client'

import { useState, useEffect } from 'react'
import {
  Lightbulb,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  Usb,
  Network,
  Sliders,
  Play,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  Zap,
  Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@sports-bar/ui-utils'

interface DMXController {
  id: string
  name: string
  controllerType: 'usb' | 'artnet' | 'maestro'
  serialPort?: string
  baudRate?: number
  adapterModel?: string
  ipAddress?: string
  artnetPort?: number
  universeStart: number
  universeCount: number
  maestroPresetCount?: number
  maestroFunctionCount?: number
  status: 'online' | 'offline' | 'error'
  lastSeen?: string
  createdAt: string
  updatedAt: string
}

interface DMXFixture {
  id: string
  controllerId: string
  zoneId?: string
  name: string
  fixtureType: string
  startAddress: number
  channelCount: number
}

interface DMXZone {
  id: string
  name: string
  description?: string
  fixtureCount?: number
}

interface DMXScene {
  id: string
  name: string
  description?: string
  category: string
  bartenderVisible: boolean
  fadeTimeMs: number
  maestroPresetNumber?: number
  usageCount: number
}

const CONTROLLER_TYPE_INFO = {
  usb: {
    label: 'USB DMX',
    icon: Usb,
    description: 'Enttec Pro, Open DMX, PKnight CR011R',
    color: 'text-blue-400',
  },
  artnet: {
    label: 'Art-Net',
    icon: Network,
    description: 'Enttec ODE, DMXking, Generic Art-Net',
    color: 'text-green-400',
  },
  maestro: {
    label: 'Maestro DMX',
    icon: Zap,
    description: 'Art-Net + Built-in Presets/Functions',
    color: 'text-purple-400',
  },
}

const USB_ADAPTER_MODELS = [
  { value: 'enttec-pro', label: 'Enttec DMX USB Pro' },
  { value: 'enttec-open', label: 'Enttec Open DMX USB' },
  { value: 'pknight-cr011r', label: 'PKnight CR011R' },
]

const ARTNET_ADAPTER_MODELS = [
  { value: 'enttec-ode', label: 'Enttec ODE' },
  { value: 'dmxking', label: 'DMXking' },
  { value: 'generic-artnet', label: 'Generic Art-Net' },
]

export default function DMXControllerManager() {
  const [controllers, setControllers] = useState<DMXController[]>([])
  const [zones, setZones] = useState<DMXZone[]>([])
  const [scenes, setScenes] = useState<DMXScene[]>([])
  const [fixtures, setFixtures] = useState<DMXFixture[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'controllers' | 'zones' | 'scenes' | 'fixtures'>('controllers')
  const [editingController, setEditingController] = useState<DMXController | null>(null)
  const [isAddingController, setIsAddingController] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' })

  // Form state for controller
  const [formData, setFormData] = useState({
    name: '',
    controllerType: 'usb' as 'usb' | 'artnet' | 'maestro',
    serialPort: '/dev/ttyUSB0',
    baudRate: 250000,
    adapterModel: 'enttec-pro',
    ipAddress: '',
    artnetPort: 6454,
    universeStart: 0,
    universeCount: 1,
    maestroPresetCount: 8,
    maestroFunctionCount: 8,
  })

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    setLoading(true)
    try {
      const [controllersRes, zonesRes, scenesRes, fixturesRes] = await Promise.allSettled([
        fetch('/api/dmx/controllers'),
        fetch('/api/dmx/zones'),
        fetch('/api/dmx/scenes'),
        fetch('/api/dmx/fixtures'),
      ])

      if (controllersRes.status === 'fulfilled' && controllersRes.value.ok) {
        const data = await controllersRes.value.json()
        setControllers(data.controllers || [])
      }

      if (zonesRes.status === 'fulfilled' && zonesRes.value.ok) {
        const data = await zonesRes.value.json()
        setZones(data.zones || [])
      }

      if (scenesRes.status === 'fulfilled' && scenesRes.value.ok) {
        const data = await scenesRes.value.json()
        setScenes(data.scenes || [])
      }

      if (fixturesRes.status === 'fulfilled' && fixturesRes.value.ok) {
        const data = await fixturesRes.value.json()
        setFixtures(data.fixtures || [])
      }
    } catch (error) {
      console.error('Failed to load DMX data:', error)
      setStatus({ type: 'error', message: 'Failed to load DMX configuration' })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      controllerType: 'usb',
      serialPort: '/dev/ttyUSB0',
      baudRate: 250000,
      adapterModel: 'enttec-pro',
      ipAddress: '',
      artnetPort: 6454,
      universeStart: 0,
      universeCount: 1,
      maestroPresetCount: 8,
      maestroFunctionCount: 8,
    })
  }

  const handleAddController = () => {
    setIsAddingController(true)
    setEditingController(null)
    resetForm()
  }

  const handleEditController = (controller: DMXController) => {
    setEditingController(controller)
    setIsAddingController(false)
    setFormData({
      name: controller.name,
      controllerType: controller.controllerType,
      serialPort: controller.serialPort || '/dev/ttyUSB0',
      baudRate: controller.baudRate || 250000,
      adapterModel: controller.adapterModel || 'enttec-pro',
      ipAddress: controller.ipAddress || '',
      artnetPort: controller.artnetPort || 6454,
      universeStart: controller.universeStart,
      universeCount: controller.universeCount,
      maestroPresetCount: controller.maestroPresetCount || 8,
      maestroFunctionCount: controller.maestroFunctionCount || 8,
    })
  }

  const handleSaveController = async () => {
    try {
      const payload: any = {
        name: formData.name,
        controllerType: formData.controllerType,
        universeStart: formData.universeStart,
        universeCount: formData.universeCount,
      }

      if (formData.controllerType === 'usb') {
        payload.serialPort = formData.serialPort
        payload.baudRate = formData.baudRate
        payload.adapterModel = formData.adapterModel
      } else {
        payload.ipAddress = formData.ipAddress
        payload.artnetPort = formData.artnetPort
        if (formData.controllerType === 'maestro') {
          payload.maestroPresetCount = formData.maestroPresetCount
          payload.maestroFunctionCount = formData.maestroFunctionCount
        }
      }

      const url = editingController
        ? `/api/dmx/controllers/${editingController.id}`
        : '/api/dmx/controllers'
      const method = editingController ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        setStatus({ type: 'success', message: `Controller ${editingController ? 'updated' : 'created'} successfully` })
        setIsAddingController(false)
        setEditingController(null)
        resetForm()
        loadAllData()
      } else {
        const error = await response.json()
        setStatus({ type: 'error', message: error.error || 'Failed to save controller' })
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to save controller' })
    }
    setTimeout(() => setStatus({ type: null, message: '' }), 3000)
  }

  const handleDeleteController = async (id: string) => {
    if (!confirm('Are you sure you want to delete this controller?')) return

    try {
      const response = await fetch(`/api/dmx/controllers/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setStatus({ type: 'success', message: 'Controller deleted' })
        loadAllData()
      } else {
        setStatus({ type: 'error', message: 'Failed to delete controller' })
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to delete controller' })
    }
    setTimeout(() => setStatus({ type: null, message: '' }), 3000)
  }

  const handleTestConnection = async (controller: DMXController) => {
    try {
      const response = await fetch(`/api/dmx/controllers/${controller.id}/test`, {
        method: 'POST',
      })

      const result = await response.json()
      if (result.success) {
        setStatus({ type: 'success', message: `${controller.name}: Connection successful` })
        loadAllData()
      } else {
        setStatus({ type: 'error', message: `${controller.name}: ${result.error || 'Connection failed'}` })
      }
    } catch (error) {
      setStatus({ type: 'error', message: `${controller.name}: Connection test failed` })
    }
    setTimeout(() => setStatus({ type: null, message: '' }), 3000)
  }

  const renderControllerForm = () => {
    const typeInfo = CONTROLLER_TYPE_INFO[formData.controllerType]
    const TypeIcon = typeInfo.icon

    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-white">
            {editingController ? 'Edit Controller' : 'Add New Controller'}
          </h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsAddingController(false)
              setEditingController(null)
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Controller Type Selection */}
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(CONTROLLER_TYPE_INFO).map(([type, info]) => {
            const Icon = info.icon
            return (
              <button
                key={type}
                onClick={() => setFormData({ ...formData, controllerType: type as any })}
                className={cn(
                  'p-3 rounded-lg border transition-all text-left',
                  formData.controllerType === type
                    ? 'bg-blue-500/20 border-blue-500/50'
                    : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                )}
              >
                <Icon className={cn('w-5 h-5 mb-1', info.color)} />
                <div className="text-sm font-medium text-white">{info.label}</div>
                <div className="text-xs text-slate-400">{info.description}</div>
              </button>
            )
          })}
        </div>

        {/* Name Field */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Controller Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Main Lighting Controller"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* USB-specific fields */}
        {formData.controllerType === 'usb' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Serial Port</label>
                <input
                  type="text"
                  value={formData.serialPort}
                  onChange={(e) => setFormData({ ...formData, serialPort: e.target.value })}
                  placeholder="/dev/ttyUSB0"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Adapter Model</label>
                <select
                  value={formData.adapterModel}
                  onChange={(e) => setFormData({ ...formData, adapterModel: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                >
                  {USB_ADAPTER_MODELS.map((model) => (
                    <option key={model.value} value={model.value}>{model.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {/* Art-Net/Maestro fields */}
        {(formData.controllerType === 'artnet' || formData.controllerType === 'maestro') && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">IP Address</label>
                <input
                  type="text"
                  value={formData.ipAddress}
                  onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                  placeholder="192.168.1.100"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Art-Net Port</label>
                <input
                  type="number"
                  value={formData.artnetPort}
                  onChange={(e) => setFormData({ ...formData, artnetPort: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </>
        )}

        {/* Maestro-specific fields */}
        {formData.controllerType === 'maestro' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Preset Count</label>
              <input
                type="number"
                value={formData.maestroPresetCount}
                onChange={(e) => setFormData({ ...formData, maestroPresetCount: parseInt(e.target.value) })}
                min={1}
                max={99}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Function Button Count</label>
              <input
                type="number"
                value={formData.maestroFunctionCount}
                onChange={(e) => setFormData({ ...formData, maestroFunctionCount: parseInt(e.target.value) })}
                min={1}
                max={99}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Universe Configuration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Universe Start</label>
            <input
              type="number"
              value={formData.universeStart}
              onChange={(e) => setFormData({ ...formData, universeStart: parseInt(e.target.value) })}
              min={0}
              max={3}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Universe Count</label>
            <input
              type="number"
              value={formData.universeCount}
              onChange={(e) => setFormData({ ...formData, universeCount: parseInt(e.target.value) })}
              min={1}
              max={4}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => {
              setIsAddingController(false)
              setEditingController(null)
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleSaveController} disabled={!formData.name}>
            <Save className="w-4 h-4 mr-2" />
            {editingController ? 'Update' : 'Create'} Controller
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Message */}
      {status.type && (
        <div className={cn(
          'px-4 py-3 rounded-lg flex items-center gap-2',
          status.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
        )}>
          {status.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {status.message}
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {[
          { key: 'controllers', label: 'Controllers', count: controllers.length },
          { key: 'zones', label: 'Zones', count: zones.length },
          { key: 'scenes', label: 'Scenes', count: scenes.length },
          { key: 'fixtures', label: 'Fixtures', count: fixtures.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key as any)}
            className={cn(
              'px-4 py-2 rounded-t-lg font-medium transition-colors',
              activeSection === tab.key
                ? 'bg-slate-800 text-white border-b-2 border-purple-500'
                : 'text-slate-400 hover:text-white'
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Controllers Section */}
      {activeSection === 'controllers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-purple-400" />
              DMX Controllers
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadAllData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button size="sm" onClick={handleAddController}>
                <Plus className="w-4 h-4 mr-2" />
                Add Controller
              </Button>
            </div>
          </div>

          {/* Add/Edit Form */}
          {(isAddingController || editingController) && renderControllerForm()}

          {/* Controller List */}
          {controllers.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Lightbulb className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No DMX controllers configured</p>
              <Button className="mt-4" onClick={handleAddController}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Controller
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {controllers.map((controller) => {
                const typeInfo = CONTROLLER_TYPE_INFO[controller.controllerType]
                const TypeIcon = typeInfo.icon

                return (
                  <div
                    key={controller.id}
                    className="bg-slate-800/50 border border-slate-700 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={cn('p-2 rounded-lg bg-slate-900/50', typeInfo.color)}>
                          <TypeIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-medium text-white">{controller.name}</h4>
                          <div className="text-sm text-slate-400">
                            {typeInfo.label} • Universe {controller.universeStart}-{controller.universeStart + controller.universeCount - 1}
                          </div>
                          {controller.controllerType === 'usb' && (
                            <div className="text-xs text-slate-500 mt-1">
                              {controller.serialPort} • {controller.adapterModel}
                            </div>
                          )}
                          {(controller.controllerType === 'artnet' || controller.controllerType === 'maestro') && (
                            <div className="text-xs text-slate-500 mt-1">
                              {controller.ipAddress}:{controller.artnetPort}
                              {controller.controllerType === 'maestro' && (
                                <span> • {controller.maestroPresetCount} presets</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
                          controller.status === 'online'
                            ? 'bg-green-500/20 text-green-400'
                            : controller.status === 'error'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-slate-500/20 text-slate-400'
                        )}>
                          {controller.status === 'online' ? (
                            <Wifi className="w-3 h-3" />
                          ) : (
                            <WifiOff className="w-3 h-3" />
                          )}
                          {controller.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConnection(controller)}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Test
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditController(controller)}
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:border-red-500/50"
                        onClick={() => handleDeleteController(controller.id)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Zones Section */}
      {activeSection === 'zones' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Lighting Zones</h3>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Zone
            </Button>
          </div>
          {zones.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>No zones configured. Zones help organize fixtures by area.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {zones.map((zone) => (
                <div key={zone.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">{zone.name}</div>
                    {zone.description && <div className="text-sm text-slate-400">{zone.description}</div>}
                  </div>
                  <span className="text-sm text-slate-400">{zone.fixtureCount || 0} fixtures</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scenes Section */}
      {activeSection === 'scenes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Lighting Scenes</h3>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Create Scene
            </Button>
          </div>
          {scenes.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>No scenes configured. Create scenes to save lighting presets.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {scenes.map((scene) => (
                <div key={scene.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white flex items-center gap-2">
                      {scene.name}
                      {scene.bartenderVisible && (
                        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">Bartender</span>
                      )}
                    </div>
                    <div className="text-sm text-slate-400">{scene.category} • {scene.fadeTimeMs}ms fade</div>
                  </div>
                  <span className="text-sm text-slate-400">{scene.usageCount} uses</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fixtures Section */}
      {activeSection === 'fixtures' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">DMX Fixtures</h3>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Fixture
            </Button>
          </div>
          {fixtures.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>No fixtures configured. Add fixtures to control lights.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {fixtures.map((fixture) => (
                <div key={fixture.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">{fixture.name}</div>
                    <div className="text-sm text-slate-400">
                      {fixture.fixtureType} • Address {fixture.startAddress}-{fixture.startAddress + fixture.channelCount - 1}
                    </div>
                  </div>
                  <span className="text-sm text-slate-400">{fixture.channelCount} ch</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
