

'use client'

import { useState, useEffect } from 'react'
import { 
  Monitor, 
  MonitorPlay,
  Power, 
  VolumeX,
  Volume2,
  ChevronUp, 
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Settings,
  Wifi,
  WifiOff,
  Calendar,
  Clock,
  Star,
  ExternalLink,
  Filter,
  Search,
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  CirclePlay,
  List,
  Trophy,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Home,
  ArrowLeft,
  Mic,
  Plus,
  Trash2,
  Edit3,
  Zap,
  Tv,
  Smartphone
} from 'lucide-react'
import { FireTVDevice, FIRETV_SPORTS_APPS, SPORTS_QUICK_ACCESS, StreamingApp, generateFireTVDeviceId } from '../lib/firetv-utils'

interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  deviceType: string
  status: string
  isActive: boolean
}

interface ConnectionTest {
  success: boolean
  message: string
  data?: any
  testing: boolean
}

interface CommandResponse {
  success: boolean
  message: string
  data?: any
}

export default function FireTVController() {
  const [devices, setDevices] = useState<FireTVDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<FireTVDevice | null>(null)
  const [connectionTests, setConnectionTests] = useState<Record<string, ConnectionTest>>({})
  const [commandStatus, setCommandStatus] = useState<CommandResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [showAppsGrid, setShowAppsGrid] = useState(false)
  const [activeCategory, setActiveCategory] = useState<'all' | 'sports' | 'entertainment' | 'news' | 'premium'>('sports')
  
  // Matrix inputs state
  const [matrixInputs, setMatrixInputs] = useState<MatrixInput[]>([])
  const [loadingInputs, setLoadingInputs] = useState(false)

  // New device form state
  const [newDevice, setNewDevice] = useState({
    name: '',
    ipAddress: '',
    port: 5555,
    deviceType: 'Fire TV Cube' as const,
    inputChannel: undefined as number | undefined
  })
  
  // Edit device state
  const [editingDevice, setEditingDevice] = useState<FireTVDevice | null>(null)
  const [showEditDevice, setShowEditDevice] = useState(false)
  const [editDevice, setEditDevice] = useState({
    name: '',
    ipAddress: '',
    port: 5555,
    deviceType: 'Fire TV Cube' as FireTVDevice['deviceType'],
    inputChannel: undefined as number | undefined
  })

  // Load devices on component mount
  useEffect(() => {
    loadDevices()
    loadMatrixInputs()
  }, [])

  const loadDevices = async () => {
    try {
      const response = await fetch('/api/firetv-devices')
      const data = await response.json()
      setDevices(data.devices || [])
      
      if (data.devices?.length > 0 && !selectedDevice) {
        setSelectedDevice(data.devices[0])
      }
    } catch (error) {
      console.error('Error loading Fire TV devices:', error)
      setCommandStatus({
        success: false,
        message: 'Failed to load devices'
      })
    }
  }

  const loadMatrixInputs = async () => {
    try {
      setLoadingInputs(true)
      const response = await fetch('/api/matrix/config')
      const data = await response.json()
      
      if (data.success && data.inputs) {
        const inputs = Object.entries(data.inputs).map(([key, input]: [string, any]) => ({
          id: key,
          channelNumber: parseInt(key),
          label: input.name || `Input ${key}`,
          inputType: input.type || 'unknown',
          deviceType: input.type || 'unknown',
          status: 'active',
          isActive: true
        }))
        setMatrixInputs(inputs)
      }
    } catch (error) {
      console.error('Error loading matrix inputs:', error)
    } finally {
      setLoadingInputs(false)
    }
  }

  const addDevice = async () => {
    if (!newDevice.name || !newDevice.ipAddress) {
      setCommandStatus({
        success: false,
        message: 'Please fill in device name and IP address'
      })
      return
    }

    if (!newDevice.inputChannel) {
      setCommandStatus({
        success: false,
        message: 'Please select which matrix input this Fire TV device is connected to'
      })
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/firetv-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newDevice,
          id: generateFireTVDeviceId(),
          isOnline: false
        })
      })

      const result = await response.json()
      
      if (response.ok) {
        setCommandStatus({
          success: true,
          message: 'Fire TV device added successfully'
        })
        
        setNewDevice({
          name: '',
          ipAddress: '',
          port: 5555,
          deviceType: 'Fire TV Cube',
          inputChannel: undefined
        })
        setShowAddDevice(false)
        await loadDevices()
      } else {
        setCommandStatus({
          success: false,
          message: result.error || 'Failed to add device'
        })
      }
    } catch (error) {
      setCommandStatus({
        success: false,
        message: 'Error adding device'
      })
    } finally {
      setLoading(false)
    }
  }

  const openEditDevice = (device: FireTVDevice) => {
    setEditingDevice(device)
    setEditDevice({
      name: device.name,
      ipAddress: device.ipAddress,
      port: device.port,
      deviceType: device.deviceType,
      inputChannel: device.inputChannel
    })
    setShowEditDevice(true)
    loadMatrixInputs()
  }

  const updateDevice = async () => {
    if (!editingDevice) return

    if (!editDevice.name || !editDevice.ipAddress) {
      setCommandStatus({
        success: false,
        message: 'Please fill in device name and IP address'
      })
      return
    }

    if (!editDevice.inputChannel) {
      setCommandStatus({
        success: false,
        message: 'Please select which matrix input this Fire TV device is connected to'
      })
      return
    }

    const updatedDevice = {
      ...editingDevice,
      name: editDevice.name,
      ipAddress: editDevice.ipAddress,
      port: editDevice.port,
      deviceType: editDevice.deviceType,
      inputChannel: editDevice.inputChannel,
      isOnline: false // Reset connection status
    }

    try {
      setLoading(true)
      const response = await fetch('/api/firetv-devices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDevice)
      })

      const result = await response.json()
      
      if (response.ok) {
        setCommandStatus({
          success: true,
          message: 'Fire TV device updated successfully'
        })
        
        setShowEditDevice(false)
        setEditingDevice(null)
        setEditDevice({
          name: '',
          ipAddress: '',
          port: 5555,
          deviceType: 'Fire TV Cube',
          inputChannel: undefined
        })
        
        // Update selected device if it's the one being edited
        if (selectedDevice?.id === editingDevice.id) {
          setSelectedDevice(updatedDevice)
        }
        await loadDevices()
      } else {
        setCommandStatus({
          success: false,
          message: result.error || 'Failed to update device'
        })
      }
    } catch (error) {
      setCommandStatus({
        success: false,
        message: 'Error updating device'
      })
    } finally {
      setLoading(false)
    }
  }

  const deleteDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to delete this Fire TV device?')) return

    try {
      const response = await fetch(`/api/firetv-devices?id=${deviceId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setCommandStatus({
          success: true,
          message: 'Device deleted successfully'
        })
        
        if (selectedDevice?.id === deviceId) {
          setSelectedDevice(null)
        }
        await loadDevices()
      } else {
        const result = await response.json()
        setCommandStatus({
          success: false,
          message: result.error || 'Failed to delete device'
        })
      }
    } catch (error) {
      setCommandStatus({
        success: false,
        message: 'Error deleting device'
      })
    }
  }

  const testConnection = async (device: FireTVDevice) => {
    const deviceId = device.id
    
    setConnectionTests(prev => ({
      ...prev,
      [deviceId]: { success: false, message: '', testing: true }
    }))

    try {
      const response = await fetch('/api/firetv-devices/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          ipAddress: device.ipAddress,
          port: device.port
        })
      })

      const result = await response.json()
      
      setConnectionTests(prev => ({
        ...prev,
        [deviceId]: {
          success: result.success,
          message: result.message,
          data: result.data,
          testing: false
        }
      }))

    } catch (error) {
      setConnectionTests(prev => ({
        ...prev,
        [deviceId]: {
          success: false,
          message: 'Connection test failed',
          testing: false
        }
      }))
    }
  }

  const sendCommand = async (command: string, appPackage?: string) => {
    if (!selectedDevice) {
      setCommandStatus({
        success: false,
        message: 'No device selected'
      })
      return
    }

    try {
      setLoading(true)
      setCommandStatus(null)

      const response = await fetch('/api/firetv-devices/send-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDevice.id,
          command,
          appPackage,
          ipAddress: selectedDevice.ipAddress,
          port: selectedDevice.port
        })
      })

      const result = await response.json()
      setCommandStatus(result)

    } catch (error) {
      setCommandStatus({
        success: false,
        message: 'Failed to send command'
      })
    } finally {
      setLoading(false)
    }
  }

  const launchApp = async (app: StreamingApp) => {
    await sendCommand('LAUNCH_APP', app.packageName)
  }

  const getFilteredApps = () => {
    switch (activeCategory) {
      case 'sports':
        return FIRETV_SPORTS_APPS.filter(app => app.sportsContent)
      case 'entertainment':
        return FIRETV_SPORTS_APPS.filter(app => app.category === 'Entertainment')
      case 'news':
        return FIRETV_SPORTS_APPS.filter(app => app.category === 'News')
      case 'premium':
        return FIRETV_SPORTS_APPS.filter(app => app.category === 'Premium')
      default:
        return FIRETV_SPORTS_APPS
    }
  }

  const clearStatus = () => {
    setTimeout(() => setCommandStatus(null), 5000)
  }

  useEffect(() => {
    if (commandStatus) {
      clearStatus()
    }
  }, [commandStatus])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <MonitorPlay className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Fire TV Controller</h2>
            <p className="text-gray-600">Control Amazon Fire TV devices via ADB over IP</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddDevice(!showAddDevice)}
          className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <Plus className="w-4 h-4" />
          <span>Add Device</span>
        </button>
      </div>

      {/* Command Status */}
      {commandStatus && (
        <div className={`p-4 rounded-lg border ${commandStatus.success 
          ? 'bg-green-50 border-green-200' 
          : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center space-x-2">
            {commandStatus.success ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span className={`font-medium ${commandStatus.success ? 'text-green-800' : 'text-red-800'}`}>
              {commandStatus.message}
            </span>
          </div>
        </div>
      )}

      {/* Add Device Form */}
      {showAddDevice && (
        <div className="bg-gray-50 p-6 rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Fire TV Device</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Device Name</label>
              <input
                type="text"
                value={newDevice.name}
                onChange={(e) => setNewDevice(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Living Room Fire TV Cube"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
              <input
                type="text"
                value={newDevice.ipAddress}
                onChange={(e) => setNewDevice(prev => ({ ...prev, ipAddress: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="192.168.1.100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
              <input
                type="number"
                value={newDevice.port}
                onChange={(e) => setNewDevice(prev => ({ ...prev, port: parseInt(e.target.value) || 5555 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="5555"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Device Type</label>
              <select
                value={newDevice.deviceType}
                onChange={(e) => setNewDevice(prev => ({ ...prev, deviceType: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="Fire TV Cube">Fire TV Cube</option>
                <option value="Fire TV Stick">Fire TV Stick</option>
                <option value="Fire TV">Fire TV</option>
                <option value="Fire TV Stick 4K Max">Fire TV Stick 4K Max</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Matrix Input Channel</label>
              {loadingInputs ? (
                <div className="flex items-center justify-center py-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />
                  <span className="text-gray-500 text-sm ml-2">Loading inputs...</span>
                </div>
              ) : (
                <select
                  value={newDevice.inputChannel || ''}
                  onChange={(e) => setNewDevice(prev => ({ ...prev, inputChannel: e.target.value ? parseInt(e.target.value) : undefined }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                >
                  <option value="">Select Input Channel...</option>
                  {matrixInputs
                    .filter(input => input.isActive && input.status === 'active')
                    .sort((a, b) => a.channelNumber - b.channelNumber)
                    .map((input) => (
                      <option key={input.id} value={input.channelNumber}>
                        Input {input.channelNumber}: {input.label} ({input.deviceType})
                      </option>
                    ))}
                </select>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Select which matrix input this Fire TV device is connected to. This helps the bartender remote show the correct controls when that input is selected.
              </p>
            </div>
          </div>
          <div className="mt-4 flex space-x-3">
            <button
              onClick={addDevice}
              disabled={loading || !newDevice.name || !newDevice.ipAddress}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Device'}
            </button>
            <button
              onClick={() => setShowAddDevice(false)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit Device Form */}
      {showEditDevice && editingDevice && (
        <div className="bg-gray-50 p-6 rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Fire TV Device</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Device Name</label>
              <input
                type="text"
                value={editDevice.name}
                onChange={(e) => setEditDevice(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Living Room Fire TV Cube"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
              <input
                type="text"
                value={editDevice.ipAddress}
                onChange={(e) => setEditDevice(prev => ({ ...prev, ipAddress: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="192.168.1.100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
              <input
                type="number"
                value={editDevice.port}
                onChange={(e) => setEditDevice(prev => ({ ...prev, port: parseInt(e.target.value) || 5555 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="5555"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Device Type</label>
              <select
                value={editDevice.deviceType}
                onChange={(e) => setEditDevice(prev => ({ ...prev, deviceType: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="Fire TV Cube">Fire TV Cube</option>
                <option value="Fire TV Stick">Fire TV Stick</option>
                <option value="Fire TV">Fire TV</option>
                <option value="Fire TV Stick 4K Max">Fire TV Stick 4K Max</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Matrix Input Channel</label>
              {loadingInputs ? (
                <div className="flex items-center justify-center py-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />
                  <span className="text-gray-500 text-sm ml-2">Loading inputs...</span>
                </div>
              ) : (
                <select
                  value={editDevice.inputChannel || ''}
                  onChange={(e) => setEditDevice(prev => ({ ...prev, inputChannel: e.target.value ? parseInt(e.target.value) : undefined }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                >
                  <option value="">Select Input Channel...</option>
                  {matrixInputs
                    .filter(input => input.isActive && input.status === 'active')
                    .sort((a, b) => a.channelNumber - b.channelNumber)
                    .map((input) => (
                      <option key={input.id} value={input.channelNumber}>
                        Input {input.channelNumber}: {input.label} ({input.deviceType})
                      </option>
                    ))}
                </select>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Select which matrix input this Fire TV device is connected to. This helps the bartender remote show the correct controls when that input is selected.
              </p>
            </div>
          </div>
          <div className="mt-4 flex space-x-3">
            <button
              onClick={updateDevice}
              disabled={loading || !editDevice.name || !editDevice.ipAddress || !editDevice.inputChannel}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Device'}
            </button>
            <button
              onClick={() => setShowEditDevice(false)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Device Management */}
      {devices.length > 0 && (
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Fire TV Devices</h3>
          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  selectedDevice?.id === device.id 
                    ? 'border-orange-200 bg-orange-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedDevice(device)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      selectedDevice?.id === device.id ? 'bg-orange-100' : 'bg-gray-100'
                    }`}>
                      <Monitor className={`w-5 h-5 ${
                        selectedDevice?.id === device.id ? 'text-orange-600' : 'text-gray-600'
                      }`} />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{device.name}</div>
                      <div className="text-sm text-gray-500">
                        {device.deviceType} • {device.ipAddress}:{device.port}
                      </div>
                      {device.inputChannel && (
                        <div className="text-xs text-orange-600 font-medium">
                          Input: {device.inputChannel}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        testConnection(device)
                      }}
                      disabled={connectionTests[device.id]?.testing}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {connectionTests[device.id]?.testing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        'Test'
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditDevice(device)
                      }}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteDevice(device.id)
                      }}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Connection Test Result */}
                {connectionTests[device.id] && !connectionTests[device.id].testing && (
                  <div className={`mt-3 p-3 rounded text-sm ${
                    connectionTests[device.id].success 
                      ? 'bg-green-50 text-green-700' 
                      : 'bg-red-50 text-red-700'
                  }`}>
                    <div className="flex items-center space-x-2">
                      {connectionTests[device.id].success ? (
                        <Wifi className="w-4 h-4" />
                      ) : (
                        <WifiOff className="w-4 h-4" />
                      )}
                      <span>{connectionTests[device.id].message}</span>
                    </div>
                    {connectionTests[device.id].data?.suggestions && (
                      <ul className="mt-2 ml-6 list-disc list-inside text-xs space-y-1">
                        {connectionTests[device.id].data.suggestions.map((suggestion: string, index: number) => (
                          <li key={index}>{suggestion}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control Interface */}
      {selectedDevice && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sports Quick Access */}
          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Sports Quick Access</h3>
              <Trophy className="w-5 h-5 text-orange-600" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {SPORTS_QUICK_ACCESS.map((sport, index) => (
                <button
                  key={index}
                  onClick={() => sendCommand(sport.command)}
                  disabled={loading}
                  className="p-3 text-left bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 disabled:opacity-50 transition-colors"
                >
                  <div className="font-medium text-orange-800">{sport.name}</div>
                  <div className="text-xs text-orange-600">{sport.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Navigation</h3>
            <div className="space-y-4">
              {/* D-Pad */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => sendCommand('UP')}
                  disabled={loading}
                  className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
                <div className="flex items-center space-x-2 mt-2">
                  <button
                    onClick={() => sendCommand('LEFT')}
                    disabled={loading}
                    className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => sendCommand('OK')}
                    disabled={loading}
                    className="p-3 bg-blue-100 hover:bg-blue-200 rounded-lg disabled:opacity-50 text-blue-700 font-medium"
                  >
                    OK
                  </button>
                  <button
                    onClick={() => sendCommand('RIGHT')}
                    disabled={loading}
                    className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={() => sendCommand('DOWN')}
                  disabled={loading}
                  className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 mt-2"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => sendCommand('HOME')}
                  disabled={loading}
                  className="flex items-center justify-center space-x-2 p-2 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                >
                  <Home className="w-4 h-4" />
                  <span className="text-sm">Home</span>
                </button>
                <button
                  onClick={() => sendCommand('BACK')}
                  disabled={loading}
                  className="flex items-center justify-center space-x-2 p-2 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">Back</span>
                </button>
                <button
                  onClick={() => sendCommand('MENU')}
                  disabled={loading}
                  className="flex items-center justify-center space-x-2 p-2 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-sm">Menu</span>
                </button>
              </div>
            </div>
          </div>

          {/* Media Controls */}
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Media Controls</h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => sendCommand('REWIND')}
                disabled={loading}
                className="flex flex-col items-center p-3 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
              >
                <SkipBack className="w-5 h-5" />
                <span className="text-xs mt-1">Rewind</span>
              </button>
              <button
                onClick={() => sendCommand('PLAY_PAUSE')}
                disabled={loading}
                className="flex flex-col items-center p-3 bg-blue-100 hover:bg-blue-200 rounded-lg disabled:opacity-50 text-blue-700"
              >
                <Play className="w-5 h-5" />
                <span className="text-xs mt-1">Play/Pause</span>
              </button>
              <button
                onClick={() => sendCommand('FAST_FORWARD')}
                disabled={loading}
                className="flex flex-col items-center p-3 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
              >
                <SkipForward className="w-5 h-5" />
                <span className="text-xs mt-1">Fast Forward</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <button
                onClick={() => sendCommand('VOL_DOWN')}
                disabled={loading}
                className="flex flex-col items-center p-3 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
              >
                <VolumeX className="w-5 h-5" />
                <span className="text-xs mt-1">Vol-</span>
              </button>
              <button
                onClick={() => sendCommand('MUTE')}
                disabled={loading}
                className="flex flex-col items-center p-3 bg-red-100 hover:bg-red-200 rounded-lg disabled:opacity-50 text-red-700"
              >
                <VolumeX className="w-5 h-5" />
                <span className="text-xs mt-1">Mute</span>
              </button>
              <button
                onClick={() => sendCommand('VOL_UP')}
                disabled={loading}
                className="flex flex-col items-center p-3 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
              >
                <Volume2 className="w-5 h-5" />
                <span className="text-xs mt-1">Vol+</span>
              </button>
            </div>
          </div>

          {/* App Launcher */}
          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">App Launcher</h3>
              <button
                onClick={() => setShowAppsGrid(!showAppsGrid)}
                className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
              >
                {showAppsGrid ? 'Hide' : 'Show All'}
              </button>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 mb-4">
              {(['sports', 'entertainment', 'news', 'premium', 'all'] as const).map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-3 py-1 text-sm rounded-full ${
                    activeCategory === category
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </button>
              ))}
            </div>

            <div className={`grid gap-2 ${showAppsGrid ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {getFilteredApps().slice(0, showAppsGrid ? 12 : 4).map((app, index) => (
                <button
                  key={index}
                  onClick={() => launchApp(app)}
                  disabled={loading}
                  className="flex items-center space-x-3 p-3 text-left bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
                >
                  <div className={`p-2 rounded ${
                    app.sportsContent ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <Tv className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{app.displayName}</div>
                    <div className="text-xs text-gray-500">{app.category}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* No Devices Message */}
      {devices.length === 0 && (
        <div className="text-center py-12">
          <Monitor className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Fire TV Devices</h3>
          <p className="text-gray-600 mb-6">
            Add your first Fire TV device to start controlling streaming content
          </p>
          <button
            onClick={() => setShowAddDevice(true)}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            Add Fire TV Device
          </button>
        </div>
      )}
    </div>
  )
}

