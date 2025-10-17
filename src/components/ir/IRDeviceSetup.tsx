
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

interface IRDevice {
  id: string
  name: string
  deviceType: string
  brand: string
  model?: string
  matrixInput?: number
  matrixInputLabel?: string
  irCodeSetId?: string
  description?: string
  status: string
  ports: any[]
  commands: any[]
}

export function IRDeviceSetup() {
  const [devices, setDevices] = useState<IRDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [showIRDatabase, setShowIRDatabase] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<IRDevice | null>(null)
  const [newDevice, setNewDevice] = useState({
    name: '',
    deviceType: '',
    brand: '',
    model: '',
    matrixInput: '',
    matrixInputLabel: '',
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
    loadDevices()
  }, [])

  const loadDevices = async () => {
    try {
      const response = await fetch('/api/ir/devices')
      const data = await response.json()
      
      if (data.success) {
        setDevices(data.devices)
      }
    } catch (error) {
      console.error('Error loading IR devices:', error)
    } finally {
      setLoading(false)
    }
  }

  const addDevice = async () => {
    try {
      const response = await fetch('/api/ir/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newDevice,
          matrixInput: newDevice.matrixInput ? parseInt(newDevice.matrixInput) : null
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        await loadDevices()
        setShowAddDevice(false)
        setNewDevice({
          name: '',
          deviceType: '',
          brand: '',
          model: '',
          matrixInput: '',
          matrixInputLabel: '',
          description: ''
        })
      } else {
        alert('Error adding device: ' + data.error)
      }
    } catch (error) {
      console.error('Error adding device:', error)
      alert('Error adding device')
    }
  }

  const deleteDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to delete this device? All associated commands will be deleted.')) {
      return
    }
    
    try {
      const response = await fetch(`/api/ir/devices/${deviceId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        await loadDevices()
      }
    } catch (error) {
      console.error('Error deleting device:', error)
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

      {/* Add Device Form */}
      {showAddDevice && (
        <Card className="border-blue-500/20 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-slate-100">Add IR Device</CardTitle>
            <CardDescription>
              Configure a new device to be controlled via IR
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
              <Button onClick={addDevice} className="flex-1">
                Add Device
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAddDevice(false)}
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
                      onClick={() => deleteDevice(device.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
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
