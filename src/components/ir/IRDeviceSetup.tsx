
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
  Search
} from 'lucide-react'
import { IRDatabaseSearch } from './IRDatabaseSearch'

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
  const [selectedDevice, setSelectedDevice] = useState<IRDevice | null>(null)
  const [editingDevice, setEditingDevice] = useState<IRDevice | null>(null)
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
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔌 [IR DEVICE SETUP] Component mounted')
    console.log('   Timestamp:', new Date().toISOString())
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    loadDevices()
    loadGlobalCacheDevices()
  }, [])

  const loadDevices = async () => {
    console.log('📋 [IR DEVICE SETUP] Loading IR devices...')
    try {
      const response = await fetch('/api/ir/devices')
      const data = await response.json()
      
      console.log('✅ [IR DEVICE SETUP] IR devices loaded:', data.devices?.length || 0)
      
      if (data.success) {
        setDevices(data.devices)
      } else {
        console.error('❌ [IR DEVICE SETUP] Failed to load devices:', data.error)
      }
    } catch (error) {
      console.error('❌ [IR DEVICE SETUP] Error loading IR devices:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadGlobalCacheDevices = async () => {
    console.log('📡 [IR DEVICE SETUP] Loading Global Cache devices...')
    try {
      const response = await fetch('/api/globalcache/devices')
      const data = await response.json()
      
      console.log('✅ [IR DEVICE SETUP] Global Cache devices loaded:', data.devices?.length || 0)
      
      if (data.success) {
        setGlobalCacheDevices(data.devices)
      } else {
        console.error('❌ [IR DEVICE SETUP] Failed to load Global Cache devices:', data.error)
      }
    } catch (error) {
      console.error('❌ [IR DEVICE SETUP] Error loading Global Cache devices:', error)
    }
  }

  const addDevice = async () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('➕ [IR DEVICE SETUP] Adding new device')
    console.log('   Name:', newDevice.name)
    console.log('   Type:', newDevice.deviceType)
    console.log('   Brand:', newDevice.brand)
    console.log('   Global Cache Device:', newDevice.globalCacheDeviceId || 'Not selected')
    console.log('   Global Cache Port:', newDevice.globalCachePortNumber || 'Not selected')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

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
        console.log('✅ [IR DEVICE SETUP] Device added successfully')
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
        console.error('❌ [IR DEVICE SETUP] Error adding device:', data.error)
        alert('Error adding device: ' + data.error)
      }
    } catch (error) {
      console.error('❌ [IR DEVICE SETUP] Error adding device:', error)
      alert('Error adding device')
    }
  }

  const startEdit = (device: IRDevice) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✏️  [IR DEVICE SETUP] Starting edit mode')
    console.log('   Device:', device.name)
    console.log('   ID:', device.id)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

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

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('💾 [IR DEVICE SETUP] Updating device')
    console.log('   Device ID:', editingDevice.id)
    console.log('   Name:', newDevice.name)
    console.log('   Global Cache Device:', newDevice.globalCacheDeviceId || 'Not selected')
    console.log('   Global Cache Port:', newDevice.globalCachePortNumber || 'Not selected')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

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
        console.log('✅ [IR DEVICE SETUP] Device updated successfully')
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
        console.error('❌ [IR DEVICE SETUP] Error updating device:', data.error)
        alert('Error updating device: ' + data.error)
      }
    } catch (error) {
      console.error('❌ [IR DEVICE SETUP] Error updating device:', error)
      alert('Error updating device')
    }
  }

  const cancelEdit = () => {
    console.log('↩️  [IR DEVICE SETUP] Cancelled edit/add')
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
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🗑️  [IR DEVICE SETUP] Deleting device')
    console.log('   Device ID:', deviceId)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      const response = await fetch(`/api/ir/devices/${deviceId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        console.log('✅ [IR DEVICE SETUP] Device deleted successfully')
        await loadDevices()
      } else {
        console.error('❌ [IR DEVICE SETUP] Error deleting device:', data.error)
        alert('Error deleting device: ' + data.error)
      }
    } catch (error) {
      console.error('❌ [IR DEVICE SETUP] Error deleting device:', error)
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
                    console.log('🔄 [IR DEVICE SETUP] Global Cache device changed:', e.target.value)
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
                    console.log('🔄 [IR DEVICE SETUP] Global Cache port changed:', e.target.value)
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
                      onClick={() => openIRDatabase(device)}
                      className="flex items-center gap-1"
                    >
                      <Search className="w-4 h-4" />
                      IR Database
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
    </div>
  )
}
