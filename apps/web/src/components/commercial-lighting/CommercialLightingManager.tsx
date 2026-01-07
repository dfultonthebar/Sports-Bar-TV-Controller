'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { RefreshCw, Plus, Trash2, TestTube, Wifi, WifiOff, Settings, Lightbulb, Home, Layers } from 'lucide-react'

interface LightingSystem {
  id: string
  name: string
  systemType: string
  ipAddress: string
  port: number | null
  username: string | null
  password: string | null
  applicationKey: string | null
  status: string
  lastSeen: string | null
  zones?: LightingZone[]
  scenes?: LightingScene[]
}

interface LightingZone {
  id: string
  systemId: string
  name: string
  externalId: string | null
  zoneType: string | null
  currentLevel: number
  isOn: boolean
  bartenderVisible: boolean
}

interface LightingScene {
  id: string
  systemId: string | null
  name: string
  description: string | null
  category: string
  bartenderVisible: boolean
  isFavorite: boolean
  iconName: string | null
  iconColor: string | null
  usageCount: number
}

const SYSTEM_TYPES = [
  { value: 'lutron-radiora2', label: 'Lutron RadioRA 2', protocol: 'Telnet', defaultPort: 23 },
  { value: 'lutron-radiora3', label: 'Lutron RadioRA 3', protocol: 'LEAP', defaultPort: 8081 },
  { value: 'lutron-homeworks', label: 'Lutron HomeWorks QS', protocol: 'Telnet', defaultPort: 23 },
  { value: 'lutron-caseta', label: 'Lutron Caseta', protocol: 'LEAP', defaultPort: 8083 },
  { value: 'philips-hue', label: 'Philips Hue', protocol: 'REST', defaultPort: 443 },
]

export default function CommercialLightingManager() {
  const [systems, setSystems] = useState<LightingSystem[]>([])
  const [selectedSystem, setSelectedSystem] = useState<LightingSystem | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    systemType: 'lutron-radiora2',
    ipAddress: '',
    port: '',
    username: 'lutron',
    password: 'integration',
  })

  const fetchSystems = useCallback(async () => {
    try {
      const response = await fetch('/api/commercial-lighting/systems')
      const data = await response.json()
      if (data.success) {
        setSystems(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch systems:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSystems()
  }, [fetchSystems])

  const fetchSystemDetails = async (systemId: string) => {
    try {
      const response = await fetch(`/api/commercial-lighting/systems/${systemId}`)
      const data = await response.json()
      if (data.success) {
        setSelectedSystem(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch system details:', error)
    }
  }

  const handleAddSystem = async () => {
    const systemType = SYSTEM_TYPES.find(t => t.value === formData.systemType)

    try {
      const response = await fetch('/api/commercial-lighting/systems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          systemType: formData.systemType,
          ipAddress: formData.ipAddress,
          port: formData.port ? parseInt(formData.port) : systemType?.defaultPort,
          username: formData.systemType.startsWith('lutron-') ? formData.username : undefined,
          password: formData.systemType.startsWith('lutron-') ? formData.password : undefined,
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchSystems()
        setShowAddForm(false)
        setFormData({
          name: '',
          systemType: 'lutron-radiora2',
          ipAddress: '',
          port: '',
          username: 'lutron',
          password: 'integration',
        })
      }
    } catch (error) {
      console.error('Failed to add system:', error)
    }
  }

  const handleTestConnection = async (systemId: string) => {
    setTesting(systemId)
    try {
      const response = await fetch(`/api/commercial-lighting/systems/${systemId}/test`, {
        method: 'POST',
      })
      const data = await response.json()

      // Refresh systems to update status
      await fetchSystems()

      if (data.data?.needsPairing) {
        alert('Hue bridge requires pairing. Press the button on the bridge and try again.')
      } else if (data.data?.connected) {
        alert(`Connection successful! Response time: ${data.data.responseTime}ms`)
      } else {
        alert(`Connection failed: ${data.data?.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to test connection:', error)
      alert('Failed to test connection')
    } finally {
      setTesting(null)
    }
  }

  const handleDeleteSystem = async (systemId: string) => {
    if (!confirm('Are you sure you want to delete this system? All associated zones and scenes will also be deleted.')) {
      return
    }

    try {
      const response = await fetch(`/api/commercial-lighting/systems/${systemId}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (data.success) {
        await fetchSystems()
        if (selectedSystem?.id === systemId) {
          setSelectedSystem(null)
        }
      }
    } catch (error) {
      console.error('Failed to delete system:', error)
    }
  }

  const handleHuePair = async (systemId: string) => {
    setTesting(systemId)
    alert('Press the button on your Hue bridge now, then click OK to continue pairing.')

    try {
      const response = await fetch('/api/commercial-lighting/hue/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemId }),
      })
      const data = await response.json()

      if (data.success) {
        alert('Hue bridge paired successfully!')
        await fetchSystems()
      } else {
        alert(`Pairing failed: ${data.error || data.message}`)
      }
    } catch (error) {
      console.error('Failed to pair Hue bridge:', error)
      alert('Failed to pair with Hue bridge')
    } finally {
      setTesting(null)
    }
  }

  const getSystemTypeInfo = (systemType: string) => {
    return SYSTEM_TYPES.find(t => t.value === systemType)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Loading commercial lighting systems...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Add System Form */}
      {showAddForm ? (
        <Card>
          <CardHeader>
            <CardTitle>Add Commercial Lighting System</CardTitle>
            <CardDescription>
              Configure a new Lutron or Philips Hue lighting system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Main Lighting"
                />
              </div>

              <div className="space-y-2">
                <Label>System Type</Label>
                <Select
                  value={formData.systemType}
                  onValueChange={(value) => {
                    const typeInfo = SYSTEM_TYPES.find(t => t.value === value)
                    setFormData({
                      ...formData,
                      systemType: value,
                      port: typeInfo?.defaultPort?.toString() || '',
                      username: value.startsWith('lutron-') ? 'lutron' : '',
                      password: value.startsWith('lutron-') ? 'integration' : '',
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SYSTEM_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label} ({type.protocol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>IP Address</Label>
                <Input
                  value={formData.ipAddress}
                  onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                  placeholder="192.168.1.100"
                />
              </div>

              <div className="space-y-2">
                <Label>Port (optional)</Label>
                <Input
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                  placeholder={getSystemTypeInfo(formData.systemType)?.defaultPort?.toString()}
                />
              </div>

              {formData.systemType.startsWith('lutron-') && (
                <>
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="lutron"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="integration"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddSystem} disabled={!formData.name || !formData.ipAddress}>
                Add System
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setShowAddForm(true)} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Commercial Lighting System
        </Button>
      )}

      {/* Systems List */}
      <div className="grid gap-4">
        {systems.length === 0 && !showAddForm ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No commercial lighting systems configured.</p>
              <p className="text-sm mt-2">Click &quot;Add Commercial Lighting System&quot; to get started.</p>
            </CardContent>
          </Card>
        ) : (
          systems.map((system) => {
            const typeInfo = getSystemTypeInfo(system.systemType)

            return (
              <Card key={system.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${system.status === 'online' ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {system.status === 'online' ? (
                          <Wifi className="w-5 h-5 text-green-600" />
                        ) : (
                          <WifiOff className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{system.name}</CardTitle>
                        <CardDescription>
                          {typeInfo?.label} • {system.ipAddress}:{system.port || typeInfo?.defaultPort}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={system.status === 'online' ? 'default' : 'secondary'}>
                        {system.status}
                      </Badge>
                      <Badge variant="outline">{typeInfo?.protocol}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection(system.id)}
                      disabled={testing === system.id}
                    >
                      {testing === system.id ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <TestTube className="w-4 h-4 mr-2" />
                      )}
                      Test Connection
                    </Button>

                    {system.systemType === 'philips-hue' && !system.applicationKey && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleHuePair(system.id)}
                        disabled={testing === system.id}
                      >
                        <Wifi className="w-4 h-4 mr-2" />
                        Pair Bridge
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchSystemDetails(system.id)}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Configure
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSystem(system.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {system.lastSeen && (
                    <p className="text-xs text-gray-500 mt-2">
                      Last seen: {new Date(system.lastSeen).toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* System Details */}
      {selectedSystem && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedSystem.name} - Configuration</CardTitle>
                <CardDescription>
                  Manage zones and scenes for this system
                </CardDescription>
              </div>
              <Button variant="ghost" onClick={() => setSelectedSystem(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="zones">
              <TabsList>
                <TabsTrigger value="zones" className="flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  Zones ({selectedSystem.zones?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="scenes" className="flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Scenes ({selectedSystem.scenes?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="zones" className="mt-4">
                {selectedSystem.zones && selectedSystem.zones.length > 0 ? (
                  <div className="space-y-2">
                    {selectedSystem.zones.map((zone) => (
                      <div key={zone.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{zone.name}</p>
                          <p className="text-sm text-gray-500">
                            ID: {zone.externalId || 'Not set'} • Level: {zone.currentLevel}%
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={zone.isOn ? 'default' : 'secondary'}>
                            {zone.isOn ? 'On' : 'Off'}
                          </Badge>
                          <Switch checked={zone.bartenderVisible} disabled />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">
                    No zones configured. Use the system&apos;s native software to create zones.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="scenes" className="mt-4">
                {selectedSystem.scenes && selectedSystem.scenes.length > 0 ? (
                  <div className="space-y-2">
                    {selectedSystem.scenes.map((scene) => (
                      <div key={scene.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{scene.name}</p>
                          <p className="text-sm text-gray-500">
                            {scene.category} • Used {scene.usageCount} times
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {scene.isFavorite && <Badge>Favorite</Badge>}
                          <Switch checked={scene.bartenderVisible} disabled />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">
                    No scenes configured. Add scenes via the API or system&apos;s native software.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
