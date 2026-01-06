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
  Loader2,
  Zap,
  Play,
  StopCircle,
  Copy,
  Save
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { logger } from '@/lib/logger'
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
  
  // IR Learning state
  const [selectedDeviceForLearning, setSelectedDeviceForLearning] = useState<string>('')
  const [isLearning, setIsLearning] = useState(false)
  const [learnedCode, setLearnedCode] = useState<string>('')
  const [learningStatus, setLearningStatus] = useState<string>('')
  const [functionName, setFunctionName] = useState<string>('')

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
      logger.error('Error fetching devices:', error)
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
      logger.error('Error adding device:', error)
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
      logger.error('Error testing device:', error)
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
      logger.error('Error deleting device:', error)
      alert('Failed to delete device')
    }
  }

  const handleStartLearning = async () => {
    if (!selectedDeviceForLearning) {
      alert('Please select a Global Cache device first')
      return
    }

    try {
      setIsLearning(true)
      setLearningStatus('Starting IR learning mode...')
      setLearnedCode('')

      const response = await fetch('/api/globalcache/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDeviceForLearning
        })
      })

      const data = await response.json()

      if (data.success && data.learnedCode) {
        setLearnedCode(data.learnedCode)
        setLearningStatus('IR code learned successfully! You can now copy or save it.')
      } else {
        setLearningStatus(`Failed: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      logger.error('Error learning IR code:', error)
      setLearningStatus('Error: Failed to learn IR code')
    } finally {
      setIsLearning(false)
    }
  }

  const handleStopLearning = async () => {
    if (!selectedDeviceForLearning) {
      return
    }

    try {
      setLearningStatus('Stopping IR learning mode...')

      const response = await fetch('/api/globalcache/learn', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDeviceForLearning
        })
      })

      const data = await response.json()

      if (data.success) {
        setLearningStatus('IR learning stopped')
        setIsLearning(false)
      } else {
        setLearningStatus(`Failed to stop: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      logger.error('Error stopping learning:', error)
      setLearningStatus('Error: Failed to stop learning')
    }
  }

  const handleCopyCode = () => {
    if (learnedCode) {
      navigator.clipboard.writeText(learnedCode)
      alert('IR code copied to clipboard!')
    }
  }

  const handleSaveCode = () => {
    if (!learnedCode) {
      alert('No IR code to save')
      return
    }

    if (!functionName.trim()) {
      alert('Please enter a function name (e.g., "POWER", "CHANNEL UP")')
      return
    }

    // Here you would typically save to an IR device
    // For now, we'll just show the info and allow manual saving
    alert(`To save this IR code:\n\n1. Go to the IR Devices tab\n2. Create or select an IR device\n3. Add a new command with function name: "${functionName}"\n4. Paste this code into the IR Code field\n\nCode copied to clipboard!`)
    navigator.clipboard.writeText(learnedCode)
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
                Manage Global Cache iTach devices and learn IR codes from remote controls
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

      {/* Tabs for Device Management and IR Learning */}
      <Tabs defaultValue="devices" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="devices" className="flex items-center gap-2">
            <Radio className="w-4 h-4" />
            Device Management
          </TabsTrigger>
          <TabsTrigger value="learning" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            IR Learning
          </TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-6">

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
        </TabsContent>

        {/* IR Learning Tab */}
        <TabsContent value="learning" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Learn IR Codes from Remote Controls
              </CardTitle>
              <CardDescription>
                Use your Global Cache device's built-in IR receiver to learn commands directly from your remote controls
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Device Selection */}
              <div className="space-y-2">
                <Label htmlFor="learning-device">Select Global Cache Device</Label>
                <select
                  id="learning-device"
                  value={selectedDeviceForLearning}
                  onChange={(e) => setSelectedDeviceForLearning(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLearning}
                >
                  <option value="">-- Select a device --</option>
                  {devices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name} ({device.ipAddress})
                    </option>
                  ))}
                </select>
              </div>

              {/* Learning Controls */}
              <div className="flex gap-3">
                <Button
                  onClick={handleStartLearning}
                  disabled={!selectedDeviceForLearning || isLearning}
                  className="flex items-center gap-2"
                >
                  {isLearning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Learning...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Start Learning
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={handleStopLearning}
                  disabled={!isLearning}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <StopCircle className="w-4 h-4" />
                  Stop Learning
                </Button>
              </div>

              {/* Learning Status */}
              {learningStatus && (
                <div className={`p-4 rounded-lg ${
                  learningStatus.includes('success') 
                    ? 'bg-green-900/30 border border-green-700' 
                    : learningStatus.includes('Failed') || learningStatus.includes('Error')
                    ? 'bg-red-900/30 border border-red-700'
                    : 'bg-blue-900/30 border border-blue-700'
                }`}>
                  <p className="text-sm text-slate-200">{learningStatus}</p>
                </div>
              )}

              {/* Learned Code Display */}
              {learnedCode && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Learned IR Code</Label>
                    <div className="relative">
                      <textarea
                        value={learnedCode}
                        readOnly
                        rows={6}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-slate-200 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={handleCopyCode}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="function-name">Function Name (Optional)</Label>
                    <Input
                      id="function-name"
                      value={functionName}
                      onChange={(e) => setFunctionName(e.target.value)}
                      placeholder="e.g., POWER, CHANNEL UP, VOLUME DOWN"
                    />
                    <p className="text-xs text-slate-400">
                      Give this command a name to help identify it later
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveCode}
                      className="flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save to IR Device
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instructions Card */}
          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-slate-300">
                  <p className="font-semibold text-yellow-400 mb-2">How to Learn IR Codes:</p>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Select a Global Cache device from the dropdown above</li>
                    <li>Click "Start Learning" to enable IR learning mode</li>
                    <li>Point your remote control at the Global Cache device (small hole near power connector)</li>
                    <li>Press the button you want to learn on your remote control</li>
                    <li>The IR code will be displayed automatically when learned</li>
                    <li>Optionally give the command a function name (e.g., "POWER", "VOL UP")</li>
                    <li>Copy the code or follow the instructions to save it to an IR device</li>
                  </ol>
                  <p className="mt-3 text-yellow-400">
                    <strong>Note:</strong> Learning mode will timeout after 60 seconds if no button is pressed. 
                    You can stop learning at any time by clicking "Stop Learning".
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
