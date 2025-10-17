'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Radio, 
  Wifi,
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  CheckCircle,
  XCircle,
  Info,
  Loader2
} from 'lucide-react'

interface GlobalCachePort {
  id: string
  portNumber: number
  portType: string
  enabled: boolean
}

interface GlobalCacheDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  model?: string
  status: 'online' | 'offline'
  lastSeen?: string
  ports: GlobalCachePort[]
}

interface AddDeviceForm {
  name: string
  ipAddress: string
  port: string
  model: string
}

export default function GlobalCacheControl() {
  const [devices, setDevices] = useState<GlobalCacheDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [formData, setFormData] = useState<AddDeviceForm>({
    name: '',
    ipAddress: '',
    port: '4998',
    model: ''
  })

  useEffect(() => {
    fetchDevices()
  }, [])

  const fetchDevices = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/globalcache/devices')
      const data = await response.json()
      
      if (data.success) {
        setDevices(data.devices)
      }
    } catch (error) {
      console.error('Error fetching devices:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.ipAddress) {
      alert('Please fill in all required fields')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/globalcache/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          ipAddress: formData.ipAddress,
          port: parseInt(formData.port) || 4998,
          model: formData.model || null
        })
      })

      const data = await response.json()

      if (data.success) {
        await fetchDevices()
        setShowAddForm(false)
        setFormData({ name: '', ipAddress: '', port: '4998', model: '' })
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error adding device:', error)
      alert('Failed to add device')
    } finally {
      setLoading(false)
    }
  }

  const handleTestDevice = async (deviceId: string) => {
    try {
      setTesting(deviceId)
      const response = await fetch(`/api/globalcache/devices/${deviceId}/test`, {
        method: 'POST'
      })

      const data = await response.json()

      if (data.success) {
        alert(`Connection test ${data.online ? 'successful' : 'failed'}${data.deviceInfo ? `: ${data.deviceInfo}` : ''}`)
        await fetchDevices()
      } else {
        alert(`Test failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Error testing device:', error)
      alert('Failed to test device connection')
    } finally {
      setTesting(null)
    }
  }

  const handleDeleteDevice = async (deviceId: string, deviceName: string) => {
    if (!confirm(`Are you sure you want to delete ${deviceName}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/globalcache/devices/${deviceId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        await fetchDevices()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error deleting device:', error)
      alert('Failed to delete device')
    }
  }

  if (loading && devices.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-purple-400" />
                Global Cache IR Control
              </CardTitle>
              <CardDescription>
                Manage Global Cache iTach devices for infrared control of cable boxes and other IR devices
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Device
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Add Device Form */}
      {showAddForm && (
        <Card className="border-blue-500/30">
          <CardHeader>
            <CardTitle>Add New Global Cache Device</CardTitle>
            <CardDescription>
              Add a Global Cache iTach device (IP2IR, WF2IR, etc.) to control IR devices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddDevice} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Device Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., cable 1"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model (Optional)</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="e.g., iptoir"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ipAddress">IP Address *</Label>
                  <Input
                    id="ipAddress"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    placeholder="e.g., 192.168.5.110"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                    placeholder="4998"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Device
                    </>
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowAddForm(false)
                    setFormData({ name: '', ipAddress: '', port: '4998', model: '' })
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Devices List */}
      {devices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Radio className="w-12 h-12 mx-auto mb-4 text-slate-500" />
            <h3 className="text-lg font-semibold text-slate-300 mb-2">
              No Global Cache Devices
            </h3>
            <p className="text-slate-400 mb-4">
              Add your first Global Cache iTach device to get started
            </p>
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Device
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => (
            <Card key={device.id} className={device.status === 'online' ? 'border-green-500/30' : 'border-red-500/30'}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Radio className="w-4 h-4" />
                      {device.name}
                    </CardTitle>
                    {device.model && (
                      <p className="text-sm text-slate-400 mt-1">{device.model}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {device.status === 'online' ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Wifi className="w-4 h-4 text-blue-400" />
                    <span className="font-mono">{device.ipAddress}:{device.port}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Info className="w-4 h-4" />
                    <span>
                      {device.ports?.length || 0} IR port{device.ports?.length !== 1 ? 's' : ''}
                      {device.ports && ` (${device.ports.filter(p => p.enabled).length} enabled)`}
                    </span>
                  </div>
                  {device.lastSeen && (
                    <div className="text-xs text-slate-500">
                      Last seen: {new Date(device.lastSeen).toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestDevice(device.id)}
                    disabled={testing === device.id}
                    className="flex-1"
                  >
                    {testing === device.id ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Test
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteDevice(device.id, device.name)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-300">
              <p className="font-semibold text-blue-400 mb-2">Setup Instructions:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Add your Global Cache iTach devices using their IP addresses</li>
                <li>Test connectivity to ensure devices are reachable</li>
                <li>Go to the "IR Devices" tab to add cable boxes and other IR-controlled devices</li>
                <li>Assign IR devices to specific Global Cache ports</li>
                <li>Download IR commands from the Global Cache database for each device</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
