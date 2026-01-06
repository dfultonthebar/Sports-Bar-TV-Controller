
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Settings,
  Trash2,
  Edit3,
  Radio,
  Download,
  Search,
  Copy
} from 'lucide-react'
import { IRDatabaseSearch } from './IRDatabaseSearch'
import { IRLearningPanel } from './IRLearningPanel'

import { logger } from '@sports-bar/logger'
interface GlobalCacheDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  model?: string
  status: string
  ports: GlobalCachePort[]
}

interface GlobalCachePort {
  id: string
  portNumber: number
  portType: string
  assignedTo?: string
  enabled: boolean
}

interface IRDevice {
  id: string
  name: string
  deviceType: string
  brand: string
  model?: string
  matrixInput?: number
  matrixInputLabel?: string
  irCodeSetId?: string
  globalCacheDeviceId?: string
  globalCachePortNumber?: number
  description?: string
  status: string
  ports: any[]
  commands: any[]
}

export function IRDeviceSetup() {
  const [devices, setDevices] = useState<IRDevice[]>([])
  const [globalCacheDevices, setGlobalCacheDevices] = useState<GlobalCacheDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [showIRDatabase, setShowIRDatabase] = useState(false)
  const [showIRLearning, setShowIRLearning] = useState(false)
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<IRDevice | null>(null)
  const [editingDevice, setEditingDevice] = useState<IRDevice | null>(null)
  const [cloneSourceDevice, setCloneSourceDevice] = useState<IRDevice | null>(null)
  const [selectedTargetDevices, setSelectedTargetDevices] = useState<Set<string>>(new Set())
  const [cloning, setCloning] = useState(false)
  const [newDevice, setNewDevice] = useState({
    name: '',
    deviceType: '',
    brand: '',
    model: '',
    matrixInput: '',
    matrixInputLabel: '',
    globalCacheDeviceId: '',
    globalCachePortNumber: '',
    description: ''
  })

  const deviceTypes = [
    'Cable Box',
    'Satellite Receiver',
    'AV Receiver',
    'Blu-ray Player',
    'DVD Player',
    'Media Player',
    'Soundbar',
    'Other'
  ]

  useEffect(() => {
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('🔌 [IR DEVICE SETUP] Component mounted')
    logger.info('   Timestamp:', { data: new Date().toISOString() })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    loadDevices()
    loadGlobalCacheDevices()
  }, [])

  const loadDevices = async () => {
    logger.info('📋 [IR DEVICE SETUP] Loading IR devices...')
    try {
      const response = await fetch('/api/ir/devices')
      const data = await response.json()
      
      logger.info('✅ [IR DEVICE SETUP] IR devices loaded:', data.devices?.length || 0)
      
      if (data.success) {
        setDevices(data.devices)
      } else {
        logger.error('❌ [IR DEVICE SETUP] Failed to load devices:', data.error)
      }
    } catch (error) {
      logger.error('❌ [IR DEVICE SETUP] Error loading IR devices:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadGlobalCacheDevices = async () => {
    logger.info('📡 [IR DEVICE SETUP] Loading Global Cache devices...')
    try {
      const response = await fetch('/api/globalcache/devices')
      const data = await response.json()
      
      logger.info('✅ [IR DEVICE SETUP] Global Cache devices loaded:', data.devices?.length || 0)
      
      if (data.success) {
        setGlobalCacheDevices(data.devices)
      } else {
        logger.error('❌ [IR DEVICE SETUP] Failed to load Global Cache devices:', data.error)
      }
    } catch (error) {
      logger.error('❌ [IR DEVICE SETUP] Error loading Global Cache devices:', error)
    }
  }

  const addDevice = async () => {
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('➕ [IR DEVICE SETUP] Adding new device')
    logger.info('   Name:', { data: newDevice.name })
    logger.info('   Type:', { data: newDevice.deviceType })
    logger.info('   Brand:', { data: newDevice.brand })
    logger.info('   Global Cache Device:', { data: newDevice.globalCacheDeviceId || 'Not selected' })
    logger.info('   Global Cache Port:', { data: newDevice.globalCachePortNumber || 'Not selected' })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch('/api/ir/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newDevice,
          matrixInput: newDevice.matrixInput ? parseInt(newDevice.matrixInput) : null,
          globalCacheDeviceId: newDevice.globalCacheDeviceId || null,
          globalCachePortNumber: newDevice.globalCachePortNumber ? parseInt(newDevice.globalCachePortNumber) : null
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        logger.info('✅ [IR DEVICE SETUP] Device added successfully')
        await loadDevices()
        setShowAddDevice(false)
        setNewDevice({
          name: '',
          deviceType: '',
          brand: '',
          model: '',
          matrixInput: '',
          matrixInputLabel: '',
          globalCacheDeviceId: '',
          globalCachePortNumber: '',
          description: ''
        })
      } else {
        logger.error('❌ [IR DEVICE SETUP] Error adding device:', data.error)
        alert('Error adding device: ' + data.error)
      }
    } catch (error) {
      logger.error('❌ [IR DEVICE SETUP] Error adding device:', error)
      alert('Error adding device')
    }
  }

  const startEdit = (device: IRDevice) => {
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('✏️  [IR DEVICE SETUP] Starting edit mode')
    logger.info('   Device:', { data: device.name })
    logger.info('   ID:', { data: device.id })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    setEditingDevice(device)
    setNewDevice({
      name: device.name,
      deviceType: device.deviceType,
      brand: device.brand,
      model: device.model || '',
      matrixInput: device.matrixInput?.toString() || '',
      matrixInputLabel: device.matrixInputLabel || '',
      globalCacheDeviceId: device.globalCacheDeviceId || '',
      globalCachePortNumber: device.globalCachePortNumber?.toString() || '',
      description: device.description || ''
    })
    setShowAddDevice(true)
  }

  const updateDevice = async () => {
    if (!editingDevice) return

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('💾 [IR DEVICE SETUP] Updating device')
    logger.info('   Device ID:', { data: editingDevice.id })
    logger.info('   Name:', { data: newDevice.name })
    logger.info('   Global Cache Device:', { data: newDevice.globalCacheDeviceId || 'Not selected' })
    logger.info('   Global Cache Port:', { data: newDevice.globalCachePortNumber || 'Not selected' })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch(`/api/ir/devices/${editingDevice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newDevice,
          matrixInput: newDevice.matrixInput ? parseInt(newDevice.matrixInput) : null,
          globalCacheDeviceId: newDevice.globalCacheDeviceId || null,
          globalCachePortNumber: newDevice.globalCachePortNumber ? parseInt(newDevice.globalCachePortNumber) : null
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        logger.info('✅ [IR DEVICE SETUP] Device updated successfully')
        await loadDevices()
        setShowAddDevice(false)
        setEditingDevice(null)
        setNewDevice({
          name: '',
          deviceType: '',
          brand: '',
          model: '',
          matrixInput: '',
          matrixInputLabel: '',
          globalCacheDeviceId: '',
          globalCachePortNumber: '',
          description: ''
        })
      } else {
        logger.error('❌ [IR DEVICE SETUP] Error updating device:', data.error)
        alert('Error updating device: ' + data.error)
      }
    } catch (error) {
      logger.error('❌ [IR DEVICE SETUP] Error updating device:', error)
      alert('Error updating device')
    }
  }

  const cancelEdit = () => {
    logger.info('↩️  [IR DEVICE SETUP] Cancelled edit/add')
    setEditingDevice(null)
    setShowAddDevice(false)
    setNewDevice({
      name: '',
      deviceType: '',
      brand: '',
      model: '',
      matrixInput: '',
      matrixInputLabel: '',
      globalCacheDeviceId: '',
      globalCachePortNumber: '',
      description: ''
    })
  }

  const deleteDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to delete this device? All associated commands will be deleted.')) {
      return
    }
    
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('🗑️  [IR DEVICE SETUP] Deleting device')
    logger.info('   Device ID:', { data: deviceId })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch(`/api/ir/devices/${deviceId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        logger.info('✅ [IR DEVICE SETUP] Device deleted successfully')
        await loadDevices()
      } else {
        logger.error('❌ [IR DEVICE SETUP] Error deleting device:', data.error)
        alert('Error deleting device: ' + data.error)
      }
    } catch (error) {
      logger.error('❌ [IR DEVICE SETUP] Error deleting device:', error)
      alert('Error deleting device')
    }
  }

  const openIRDatabase = (device: IRDevice) => {
    setSelectedDevice(device)
    setShowIRDatabase(true)
  }

  const closeIRDatabase = async () => {
    setShowIRDatabase(false)
    setSelectedDevice(null)
    await loadDevices()
  }

  const openIRLearning = (device: IRDevice) => {
    setSelectedDevice(device)
    setShowIRLearning(true)
  }

  const closeIRLearning = async () => {
    setShowIRLearning(false)
    setSelectedDevice(null)
    await loadDevices()
  }

  const openCloneModal = (device: IRDevice) => {
    if (device.commands.length === 0) {
      alert('This device has no commands to clone. Please learn IR commands first.')
      return
    }
    setCloneSourceDevice(device)
    setSelectedTargetDevices(new Set())
    setShowCloneModal(true)
  }

  const closeCloneModal = () => {
    setShowCloneModal(false)
    setCloneSourceDevice(null)
    setSelectedTargetDevices(new Set())
  }

  const toggleTargetDevice = (deviceId: string) => {
    const newSet = new Set(selectedTargetDevices)
    if (newSet.has(deviceId)) {
      newSet.delete(deviceId)
    } else {
      newSet.add(deviceId)
    }
    setSelectedTargetDevices(newSet)
  }

  const executeClone = async () => {
    if (!cloneSourceDevice || selectedTargetDevices.size === 0) {
      alert('Please select at least one target device')
      return
    }

    setCloning(true)
    try {
      const response = await fetch('/api/ir/commands/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceDeviceId: cloneSourceDevice.id,
          targetDeviceIds: Array.from(selectedTargetDevices)
        })
      })

      const data = await response.json()

      if (data.success) {
        const summary = data.results.map((r: any) =>
          `${r.deviceName}: ${r.added} added, ${r.skipped} skipped`
        ).join('\n')

        alert(`Clone completed successfully!\n\n${summary}`)
        closeCloneModal()
        await loadDevices()
      } else {
        alert(`Clone failed: ${data.error}`)
      }
    } catch (error) {
      logger.error('Error cloning commands:', error)
      alert('Error cloning commands')
    } finally {
      setCloning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-slate-400">Loading IR devices...</div>
      </div>
    )
  }

  if (showIRDatabase && selectedDevice) {
    return (
      <IRDatabaseSearch 
        device={selectedDevice}
        onClose={closeIRDatabase}
      />
    )
  }

  if (showIRLearning && selectedDevice) {
    return (
      <IRLearningPanel 
        device={selectedDevice}
        onClose={closeIRLearning}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">IR Device Setup</h2>
          <p className="text-slate-400 mt-1">
            Manage devices controlled via IR (Cable boxes, receivers, etc.)
          </p>
        </div>
        <Button
          onClick={() => setShowAddDevice(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add IR Device
        </Button>
      </div>

      {/* Add/Edit Device Form */}
      {showAddDevice && (
        <Card className="border-blue-500/20 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-slate-100">
              {editingDevice ? 'Edit IR Device' : 'Add IR Device'}
            </CardTitle>
            <CardDescription>
              {editingDevice ? 'Update device configuration' : 'Configure a new device to be controlled via IR'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name" className="text-slate-300">Device Name *</Label>
                <Input
                  id="name"
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                  placeholder="e.g., Cable Box 1"
                  className="bg-slate-700 border-slate-600 text-slate-100"
                />
              </div>
              <div>
                <Label htmlFor="deviceType" className="text-slate-300">Device Type *</Label>
                <select
                  id="deviceType"
                  value={newDevice.deviceType}
                  onChange={(e) => setNewDevice({ ...newDevice, deviceType: e.target.value })}
                  className="w-full h-10 px-3 rounded-md bg-slate-700 border border-slate-600 text-slate-100"
                >
                  <option value="">Select type...</option>
                  {deviceTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="brand" className="text-slate-300">Brand *</Label>
                <Input
                  id="brand"
                  value={newDevice.brand}
                  onChange={(e) => setNewDevice({ ...newDevice, brand: e.target.value })}
                  placeholder="e.g., DirectTV, Dish"
                  className="bg-slate-700 border-slate-600 text-slate-100"
                />
              </div>
              <div>
                <Label htmlFor="model" className="text-slate-300">Model</Label>
                <Input
                  id="model"
                  value={newDevice.model}
                  onChange={(e) => setNewDevice({ ...newDevice, model: e.target.value })}
                  placeholder="e.g., HR54"
                  className="bg-slate-700 border-slate-600 text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="globalCacheDevice" className="text-slate-300">Global Cache Device</Label>
                <select
                  id="globalCacheDevice"
                  value={newDevice.globalCacheDeviceId}
                  onChange={(e) => {
                    logger.info('🔄 [IR DEVICE SETUP] Global Cache device changed:', { data: e.target.value })
                    setNewDevice({ ...newDevice, globalCacheDeviceId: e.target.value, globalCachePortNumber: '' })
                  }}
                  className="w-full h-10 px-3 rounded-md bg-slate-700 border border-slate-600 text-slate-100"
                >
                  <option value="">Select device...</option>
                  {globalCacheDevices.map(device => (
                    <option key={device.id} value={device.id}>
                      {device.name} ({device.ipAddress}) - {device.status}
                    </option>
                  ))}
                </select>
                {globalCacheDevices.length === 0 && (
                  <p className="text-xs text-amber-400 mt-1">
                    No Global Cache devices configured. Add one in the Global Cache tab.
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="globalCachePort" className="text-slate-300">Port Number</Label>
                <select
                  id="globalCachePort"
                  value={newDevice.globalCachePortNumber}
                  onChange={(e) => {
                    logger.info('🔄 [IR DEVICE SETUP] Global Cache port changed:', { data: e.target.value })
                    setNewDevice({ ...newDevice, globalCachePortNumber: e.target.value })
                  }}
                  disabled={!newDevice.globalCacheDeviceId}
                  className="w-full h-10 px-3 rounded-md bg-slate-700 border border-slate-600 text-slate-100 disabled:opacity-50"
                >
                  <option value="">Select port...</option>
                  {newDevice.globalCacheDeviceId && 
                    globalCacheDevices
                      .find(d => d.id === newDevice.globalCacheDeviceId)
                      ?.ports.filter(p => p.enabled)
                      .map(port => (
                        <option key={port.id} value={port.portNumber}>
                          Port {port.portNumber} ({port.portType})
                          {port.assignedTo ? ` - ${port.assignedTo}` : ''}
                        </option>
                      ))
                  }
                </select>
                {!newDevice.globalCacheDeviceId && (
                  <p className="text-xs text-slate-400 mt-1">
                    Select a Global Cache device first
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="matrixInput" className="text-slate-300">Matrix Input Channel</Label>
                <Input
                  id="matrixInput"
                  type="number"
                  value={newDevice.matrixInput}
                  onChange={(e) => setNewDevice({ ...newDevice, matrixInput: e.target.value })}
                  placeholder="e.g., 1"
                  className="bg-slate-700 border-slate-600 text-slate-100"
                />
              </div>
              <div>
                <Label htmlFor="matrixInputLabel" className="text-slate-300">Matrix Input Label</Label>
                <Input
                  id="matrixInputLabel"
                  value={newDevice.matrixInputLabel}
                  onChange={(e) => setNewDevice({ ...newDevice, matrixInputLabel: e.target.value })}
                  placeholder="e.g., Cable 1"
                  className="bg-slate-700 border-slate-600 text-slate-100"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description" className="text-slate-300">Description</Label>
              <Input
                id="description"
                value={newDevice.description}
                onChange={(e) => setNewDevice({ ...newDevice, description: e.target.value })}
                placeholder="Optional notes"
                className="bg-slate-700 border-slate-600 text-slate-100"
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={editingDevice ? updateDevice : addDevice} 
                className="flex-1"
              >
                {editingDevice ? 'Update Device' : 'Add Device'}
              </Button>
              <Button
                variant="outline"
                onClick={cancelEdit}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Devices List */}
      {devices.length === 0 ? (
        <Card className="border-slate-700 bg-slate-800/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Radio className="w-16 h-16 text-slate-600 mb-4" />
            <p className="text-slate-400 text-center">
              No IR devices configured yet.
              <br />
              Click "Add IR Device" to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {devices.map((device) => (
            <Card key={device.id} className="border-slate-700 bg-slate-800/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                      <Radio className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-slate-100">{device.name}</CardTitle>
                      <CardDescription>
                        {device.brand} {device.model && `• ${device.model}`} • {device.deviceType}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="default"
                      className="bg-purple-500/20 text-purple-400 border-purple-500/30"
                    >
                      {device.commands.length} commands
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openIRLearning(device)}
                      className="flex items-center gap-1"
                    >
                      <Radio className="w-4 h-4" />
                      Learn IR
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openIRDatabase(device)}
                      className="flex items-center gap-1"
                    >
                      <Search className="w-4 h-4" />
                      IR Database
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openCloneModal(device)}
                      className="flex items-center gap-1"
                      disabled={device.commands.length === 0}
                    >
                      <Copy className="w-4 h-4" />
                      Clone
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(device)}
                      className="flex items-center gap-1"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteDevice(device.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {device.globalCacheDeviceId && (
                    <div>
                      <span className="text-slate-400">Global Cache Device:</span>
                      <span className="text-slate-200 ml-2">
                        {globalCacheDevices.find(d => d.id === device.globalCacheDeviceId)?.name || device.globalCacheDeviceId}
                      </span>
                    </div>
                  )}
                  {device.globalCachePortNumber && (
                    <div>
                      <span className="text-slate-400">Global Cache Port:</span>
                      <span className="text-slate-200 ml-2">Port {device.globalCachePortNumber}</span>
                    </div>
                  )}
                  {device.matrixInput && (
                    <div>
                      <span className="text-slate-400">Matrix Input:</span>
                      <span className="text-slate-200 ml-2">
                        Channel {device.matrixInput} {device.matrixInputLabel && `(${device.matrixInputLabel})`}
                      </span>
                    </div>
                  )}
                  {device.irCodeSetId && (
                    <div>
                      <span className="text-slate-400">Codeset ID:</span>
                      <span className="text-slate-200 ml-2">{device.irCodeSetId}</span>
                    </div>
                  )}
                  {device.description && (
                    <div className="col-span-2">
                      <span className="text-slate-400">Description:</span>
                      <span className="text-slate-200 ml-2">{device.description}</span>
                    </div>
                  )}
                </div>

                {device.commands.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">Available Commands</h4>
                    <div className="flex flex-wrap gap-2">
                      {device.commands.slice(0, 10).map((cmd: any) => (
                        <Badge key={cmd.id} variant="outline" className="bg-slate-700/50 text-slate-300">
                          {cmd.functionName}
                        </Badge>
                      ))}
                      {device.commands.length > 10 && (
                        <Badge variant="outline" className="bg-slate-700/50 text-slate-400">
                          +{device.commands.length - 10} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Clone Commands Modal */}
      {showCloneModal && cloneSourceDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl border-slate-700 bg-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">Clone IR Commands</CardTitle>
              <CardDescription>
                Copy all {cloneSourceDevice.commands.length} commands from "{cloneSourceDevice.name}" to other devices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-slate-300 mb-3 block">
                  Select target devices to clone commands to:
                </Label>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {devices
                    .filter(d => d.id !== cloneSourceDevice.id)
                    .map((device) => (
                      <label
                        key={device.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-slate-600 hover:border-slate-500 hover:bg-slate-700/30 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTargetDevices.has(device.id)}
                          onChange={() => toggleTargetDevice(device.id)}
                          className="w-4 h-4"
                        />
                        <div className="flex-1">
                          <div className="text-slate-200 font-medium">{device.name}</div>
                          <div className="text-xs text-slate-400">
                            {device.brand} • {device.deviceType}
                            {device.commands.length > 0 && (
                              <span className="ml-2 text-amber-400">
                                ({device.commands.length} existing commands)
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            device.commands.length > 0
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : 'bg-slate-600/20 text-slate-400'
                          }
                        >
                          {device.commands.length} commands
                        </Badge>
                      </label>
                    ))}
                  {devices.filter(d => d.id !== cloneSourceDevice.id).length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      No other devices available. Create more IR devices first.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <Button
                  variant="outline"
                  onClick={closeCloneModal}
                  disabled={cloning}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={executeClone}
                  disabled={cloning || selectedTargetDevices.size === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {cloning ? (
                    <>
                      <Radio className="w-4 h-4 mr-2 animate-spin" />
                      Cloning...
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Clone to {selectedTargetDevices.size} Device{selectedTargetDevices.size !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
