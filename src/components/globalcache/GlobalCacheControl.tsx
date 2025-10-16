'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Wifi, 
  WifiOff, 
  Settings, 
  Trash2, 
  Edit3,
  CheckCircle2,
  XCircle,
  Radio
} from 'lucide-react'

interface GlobalCacheDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  model?: string
  status: string
  lastSeen?: string
  ports: GlobalCachePort[]
}

interface GlobalCachePort {
  id: string
  deviceId: string
  portNumber: number
  portType: string
  assignedTo?: string
  assignedDeviceId?: string
  irCodeSet?: string
  enabled: boolean
}

export default function GlobalCacheControl() {
  const [devices, setDevices] = useState<GlobalCacheDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [newDevice, setNewDevice] = useState({
    name: '',
    ipAddress: '',
    port: 4998,
    model: ''
  })
  const [testingDevice, setTestingDevice] = useState<string | null>(null)

  useEffect(() => {
    loadDevices()
  }, [])

  const loadDevices = async () => {
    try {
      const response = await fetch('/api/globalcache/devices')
      const data = await response.json()
      
      if (data.success) {
        setDevices(data.devices)
      }
    } catch (error) {
      console.error('Error loading devices:', error)
    } finally {
      setLoading(false)
    }
  }

  const addDevice = async () => {
    try {
      const response = await fetch('/api/globalcache/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDevice)
      })
      
      const data = await response.json()
      
      if (data.success) {
        setDevices([...devices, data.device])
        setShowAddDevice(false)
        setNewDevice({ name: '', ipAddress: '', port: 4998, model: '' })
      } else {
        alert('Error adding device: ' + data.error)
      }
    } catch (error) {
      console.error('Error adding device:', error)
      alert('Error adding device')
    }
  }

  const testConnection = async (deviceId: string) => {
    setTestingDevice(deviceId)
    
    try {
      const response = await fetch(`/api/globalcache/devices/${deviceId}/test`, {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (data.success) {
        await loadDevices()
        
        if (data.online) {
          alert('Connection successful!\n\nDevice Info:\n' + (data.deviceInfo || 'No info available'))
        } else {
          alert('Connection failed - device is offline')
        }
      }
    } catch (error) {
      console.error('Error testing connection:', error)
      alert('Error testing connection')
    } finally {
      setTestingDevice(null)
    }
  }

  const deleteDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to delete this device?')) {
      return
    }
    
    try {
      const response = await fetch(`/api/globalcache/devices/${deviceId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setDevices(devices.filter(d => d.id !== deviceId))
      }
    } catch (error) {
      console.error('Error deleting device:', error)
      alert('Error deleting device')
    }
  }

  const updatePortAssignment = async (portId: string, assignedTo: string) => {
    try {
      const response = await fetch(`/api/globalcache/ports/${portId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo })
      })
      
      const data = await response.json()
      
      if (data.success) {
        await loadDevices()
      }
    } catch (error) {
      console.error('Error updating port:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-slate-400">Loading Global Cache devices...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Global Cache IR Control</h2>
          <p className="text-slate-400 mt-1">
            Manage Global Cache iTach devices and port assignments
          </p>
        </div>
        <Button
          onClick={() => setShowAddDevice(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Device
        </Button>
      </div>

      {showAddDevice && (
        <Card className="border-blue-500/20 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-slate-100">Add Global Cache Device</CardTitle>
            <CardDescription>
              Configure a new Global Cache iTach device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name" className="text-slate-300">Device Name</Label>
                <Input
                  id="name"
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                  placeholder="e.g., Global Cache 1"
                  className="bg-slate-700 border-slate-600 text-slate-100"
                />
              </div>
              <div>
                <Label htmlFor="model" className="text-slate-300">Model (Optional)</Label>
                <Input
                  id="model"
                  value={newDevice.model}
                  onChange={(e) => setNewDevice({ ...newDevice, model: e.target.value })}
                  placeholder="e.g., iTach IP2IR"
                  className="bg-slate-700 border-slate-600 text-slate-100"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ipAddress" className="text-slate-300">IP Address</Label>
                <Input
                  id="ipAddress"
                  value={newDevice.ipAddress}
                  onChange={(e) => setNewDevice({ ...newDevice, ipAddress: e.target.value })}
                  placeholder="192.168.5.110"
                  className="bg-slate-700 border-slate-600 text-slate-100"
                />
              </div>
              <div>
                <Label htmlFor="port" className="text-slate-300">Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={newDevice.port}
                  onChange={(e) => setNewDevice({ ...newDevice, port: parseInt(e.target.value) })}
                  className="bg-slate-700 border-slate-600 text-slate-100"
                />
              </div>
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

      {devices.length === 0 ? (
        <Card className="border-slate-700 bg-slate-800/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Radio className="w-16 h-16 text-slate-600 mb-4" />
            <p className="text-slate-400 text-center">
              No Global Cache devices configured yet.
              <br />
              Click "Add Device" to get started.
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
                    <div className={`p-2 rounded-lg ${
                      device.status === 'online' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {device.status === 'online' ? (
                        <Wifi className="w-5 h-5" />
                      ) : (
                        <WifiOff className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-slate-100">{device.name}</CardTitle>
                      <CardDescription>
                        {device.ipAddress}:{device.port}
                        {device.model && ` • ${device.model}`}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={device.status === 'online' ? 'default' : 'secondary'}
                      className={
                        device.status === 'online'
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }
                    >
                      {device.status === 'online' ? (
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                      ) : (
                        <XCircle className="w-3 h-3 mr-1" />
                      )}
                      {device.status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testConnection(device.id)}
                      disabled={testingDevice === device.id}
                    >
                      {testingDevice === device.id ? 'Testing...' : 'Test'}
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
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-300">Port Assignments</h4>
                  <div className="grid gap-3">
                    {device.ports.map((port) => (
                      <div
                        key={port.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 border border-slate-600"
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                            Port {port.portNumber}
                          </Badge>
                          <span className="text-slate-400 text-sm">{port.portType}</span>
                        </div>
                        <div className="flex-1">
                          <Input
                            value={port.assignedTo || ''}
                            onChange={(e) => updatePortAssignment(port.id, e.target.value)}
                            placeholder="Assign to device..."
                            className="bg-slate-600 border-slate-500 text-slate-100 text-sm"
                          />
                        </div>
                        <Badge
                          variant={port.enabled ? 'default' : 'secondary'}
                          className={
                            port.enabled
                              ? 'bg-green-500/20 text-green-400 border-green-500/30'
                              : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                          }
                        >
                          {port.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
