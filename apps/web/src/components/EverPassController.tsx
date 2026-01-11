'use client'

import { useState, useEffect } from 'react'
import {
  Tv,
  Power,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Home,
  ArrowLeft,
  Menu,
  Info,
  List,
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Wifi,
  WifiOff,
  Settings,
} from 'lucide-react'
import { EverPassDevice, generateEverPassDeviceId, getCommandDisplayName } from '@/lib/everpass-utils'

interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  deviceType: string
  status: string
  isActive: boolean
}

interface CECAdapter {
  path: string
  port: string
  vendor: string
  firmwareVersion?: string
  available: boolean
}

interface CommandResponse {
  success: boolean
  message: string
}

export default function EverPassController() {
  const [devices, setDevices] = useState<EverPassDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<EverPassDevice | null>(null)
  const [commandStatus, setCommandStatus] = useState<CommandResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [testingConnection, setTestingConnection] = useState<string | null>(null)

  // CEC adapters
  const [cecAdapters, setCecAdapters] = useState<CECAdapter[]>([])
  const [loadingAdapters, setLoadingAdapters] = useState(false)

  // Matrix inputs
  const [matrixInputs, setMatrixInputs] = useState<MatrixInput[]>([])
  const [loadingInputs, setLoadingInputs] = useState(false)

  // Dialog states
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [showEditDevice, setShowEditDevice] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    cecDevicePath: '',
    inputChannel: 0,
    deviceModel: '',
  })

  // Load data on mount
  useEffect(() => {
    loadDevices()
    loadCECAdapters()
    loadMatrixInputs()
  }, [])

  // Clear status after 3 seconds
  useEffect(() => {
    if (commandStatus) {
      const timer = setTimeout(() => setCommandStatus(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [commandStatus])

  const loadDevices = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/everpass-devices')
      const data = await response.json()
      setDevices(data.devices || [])

      if (data.devices?.length > 0 && !selectedDevice) {
        setSelectedDevice(data.devices[0])
      }
    } catch (error) {
      console.error('Error loading EverPass devices:', error)
      setCommandStatus({ success: false, message: 'Failed to load devices' })
    } finally {
      setLoading(false)
    }
  }

  const loadCECAdapters = async () => {
    try {
      setLoadingAdapters(true)
      const response = await fetch('/api/cec/adapters')
      const data = await response.json()
      setCecAdapters(data.adapters || [])
    } catch (error) {
      console.error('Error loading CEC adapters:', error)
    } finally {
      setLoadingAdapters(false)
    }
  }

  const loadMatrixInputs = async () => {
    try {
      setLoadingInputs(true)
      const response = await fetch('/api/matrix/config')
      const data = await response.json()

      if (data.inputs && Array.isArray(data.inputs)) {
        const inputs = data.inputs.map((input: any) => ({
          id: input.id || input.channelNumber.toString(),
          channelNumber: input.channelNumber,
          label: input.label || `Input ${input.channelNumber}`,
          inputType: input.inputType || 'Other',
          deviceType: input.deviceType || 'Other',
          status: input.status || 'active',
          isActive: input.isActive !== false,
        }))
        setMatrixInputs(inputs.filter((i: MatrixInput) => i.isActive))
      }
    } catch (error) {
      console.error('Error loading matrix inputs:', error)
    } finally {
      setLoadingInputs(false)
    }
  }

  const addDevice = async () => {
    if (!formData.name || !formData.cecDevicePath || !formData.inputChannel) {
      setCommandStatus({ success: false, message: 'Please fill in all required fields' })
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/everpass-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          cecDevicePath: formData.cecDevicePath,
          inputChannel: formData.inputChannel,
          deviceModel: formData.deviceModel || undefined,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setCommandStatus({ success: true, message: `Added ${formData.name}` })
        setShowAddDevice(false)
        resetForm()
        await loadDevices()
      } else {
        setCommandStatus({ success: false, message: data.error || 'Failed to add device' })
      }
    } catch (error) {
      setCommandStatus({ success: false, message: 'Failed to add device' })
    } finally {
      setLoading(false)
    }
  }

  const updateDevice = async () => {
    if (!selectedDevice || !formData.name || !formData.cecDevicePath || !formData.inputChannel) {
      setCommandStatus({ success: false, message: 'Please fill in all required fields' })
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/everpass-devices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedDevice,
          name: formData.name,
          cecDevicePath: formData.cecDevicePath,
          inputChannel: formData.inputChannel,
          deviceModel: formData.deviceModel || undefined,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setCommandStatus({ success: true, message: `Updated ${formData.name}` })
        setShowEditDevice(false)
        await loadDevices()
      } else {
        setCommandStatus({ success: false, message: data.error || 'Failed to update device' })
      }
    } catch (error) {
      setCommandStatus({ success: false, message: 'Failed to update device' })
    } finally {
      setLoading(false)
    }
  }

  const deleteDevice = async (deviceId: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/everpass-devices?id=${deviceId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        setCommandStatus({ success: true, message: 'Device deleted' })
        setShowDeleteConfirm(null)
        if (selectedDevice?.id === deviceId) {
          setSelectedDevice(null)
        }
        await loadDevices()
      } else {
        setCommandStatus({ success: false, message: data.error || 'Failed to delete device' })
      }
    } catch (error) {
      setCommandStatus({ success: false, message: 'Failed to delete device' })
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async (device: EverPassDevice) => {
    try {
      setTestingConnection(device.id)
      const response = await fetch('/api/everpass-devices/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id,
          cecDevicePath: device.cecDevicePath,
        }),
      })

      const data = await response.json()
      setCommandStatus({
        success: data.connected,
        message: data.message || (data.connected ? 'Connected' : 'Not connected'),
      })
    } catch (error) {
      setCommandStatus({ success: false, message: 'Connection test failed' })
    } finally {
      setTestingConnection(null)
    }
  }

  const sendCommand = async (command: string) => {
    if (!selectedDevice) {
      setCommandStatus({ success: false, message: 'No device selected' })
      return
    }

    try {
      const response = await fetch('/api/everpass-devices/send-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDevice.id,
          command,
          cecDevicePath: selectedDevice.cecDevicePath,
        }),
      })

      const data = await response.json()
      setCommandStatus({
        success: data.success,
        message: data.message || getCommandDisplayName(command),
      })
    } catch (error) {
      setCommandStatus({ success: false, message: `Failed: ${command}` })
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      cecDevicePath: '',
      inputChannel: 0,
      deviceModel: '',
    })
  }

  const openEditDialog = (device: EverPassDevice) => {
    setSelectedDevice(device)
    setFormData({
      name: device.name,
      cecDevicePath: device.cecDevicePath,
      inputChannel: device.inputChannel,
      deviceModel: device.deviceModel || '',
    })
    setShowEditDevice(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tv className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold">EverPass Streaming Devices</h2>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowAddDevice(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Device
        </button>
      </div>

      {/* Status Message */}
      {commandStatus && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg ${
            commandStatus.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {commandStatus.success ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span>{commandStatus.message}</span>
        </div>
      )}

      {/* Device Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map((device) => (
          <div
            key={device.id}
            onClick={() => setSelectedDevice(device)}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedDevice?.id === device.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    device.isOnline ? 'bg-green-100' : 'bg-gray-100'
                  }`}
                >
                  <Tv
                    className={`h-5 w-5 ${device.isOnline ? 'text-green-600' : 'text-gray-400'}`}
                  />
                </div>
                <div>
                  <h3 className="font-medium">{device.name}</h3>
                  <p className="text-sm text-gray-500">
                    Input {device.inputChannel} • {device.cecDevicePath}
                  </p>
                  {device.deviceModel && (
                    <p className="text-xs text-gray-400">{device.deviceModel}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {device.isOnline ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  testConnection(device)
                }}
                disabled={testingConnection === device.id}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
              >
                {testingConnection === device.id ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Test
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  openEditDialog(device)
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                <Edit3 className="h-3 w-3" />
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowDeleteConfirm(device.id)
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-600 rounded transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            </div>
          </div>
        ))}

        {devices.length === 0 && !loading && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Tv className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No EverPass devices configured</p>
            <p className="text-sm">Click "Add Device" to get started</p>
          </div>
        )}
      </div>

      {/* Remote Control (when device selected) */}
      {selectedDevice && (
        <div className="bg-gray-900 rounded-xl p-6 text-white">
          <div className="text-center mb-4">
            <h3 className="text-lg font-medium">{selectedDevice.name}</h3>
            <p className="text-gray-400 text-sm">{selectedDevice.cecDevicePath}</p>
          </div>

          {/* Navigation D-Pad */}
          <div className="flex flex-col items-center gap-2 mb-6">
            <button
              onClick={() => sendCommand('up')}
              className="p-4 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
            >
              <ChevronUp className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => sendCommand('left')}
                className="p-4 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={() => sendCommand('select')}
                className="w-16 h-16 bg-blue-600 hover:bg-blue-700 rounded-full text-sm font-medium transition-colors"
              >
                OK
              </button>
              <button
                onClick={() => sendCommand('right')}
                className="p-4 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
            <button
              onClick={() => sendCommand('down')}
              className="p-4 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
            >
              <ChevronDown className="h-6 w-6" />
            </button>
          </div>

          {/* Control Buttons */}
          <div className="flex justify-center gap-4 mb-6">
            <button
              onClick={() => sendCommand('exit')}
              className="flex flex-col items-center gap-1 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-xs">Back</span>
            </button>
            <button
              onClick={() => sendCommand('root_menu')}
              className="flex flex-col items-center gap-1 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <Home className="h-5 w-5" />
              <span className="text-xs">Home</span>
            </button>
            <button
              onClick={() => sendCommand('menu')}
              className="flex flex-col items-center gap-1 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <Menu className="h-5 w-5" />
              <span className="text-xs">Menu</span>
            </button>
            <button
              onClick={() => sendCommand('guide')}
              className="flex flex-col items-center gap-1 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <List className="h-5 w-5" />
              <span className="text-xs">Guide</span>
            </button>
            <button
              onClick={() => sendCommand('info')}
              className="flex flex-col items-center gap-1 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <Info className="h-5 w-5" />
              <span className="text-xs">Info</span>
            </button>
          </div>

          {/* Playback Controls */}
          <div className="flex justify-center gap-3 mb-6">
            <button
              onClick={() => sendCommand('rewind')}
              className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <SkipBack className="h-5 w-5" />
            </button>
            <button
              onClick={() => sendCommand('play')}
              className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <Play className="h-5 w-5" />
            </button>
            <button
              onClick={() => sendCommand('pause')}
              className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <Pause className="h-5 w-5" />
            </button>
            <button
              onClick={() => sendCommand('stop')}
              className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <Square className="h-5 w-5" />
            </button>
            <button
              onClick={() => sendCommand('fast_forward')}
              className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>

          {/* Power Button */}
          <div className="flex justify-center">
            <button
              onClick={() => sendCommand('power')}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              <Power className="h-5 w-5" />
              Power
            </button>
          </div>

          {/* Color Buttons (for EverPass menus) */}
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() => sendCommand('f2_red')}
              className="w-10 h-6 bg-red-500 hover:bg-red-600 rounded transition-colors"
            />
            <button
              onClick={() => sendCommand('f3_green')}
              className="w-10 h-6 bg-green-500 hover:bg-green-600 rounded transition-colors"
            />
            <button
              onClick={() => sendCommand('f4_yellow')}
              className="w-10 h-6 bg-yellow-500 hover:bg-yellow-600 rounded transition-colors"
            />
            <button
              onClick={() => sendCommand('f1_blue')}
              className="w-10 h-6 bg-blue-500 hover:bg-blue-600 rounded transition-colors"
            />
          </div>
        </div>
      )}

      {/* Add Device Dialog */}
      {showAddDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add EverPass Device</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Device Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="EverPass 1"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CEC Adapter *
                </label>
                <select
                  value={formData.cecDevicePath}
                  onChange={(e) => setFormData({ ...formData, cecDevicePath: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select CEC adapter...</option>
                  {cecAdapters.map((adapter) => (
                    <option key={adapter.path} value={adapter.path}>
                      {adapter.path} ({adapter.vendor})
                    </option>
                  ))}
                </select>
                <button
                  onClick={loadCECAdapters}
                  disabled={loadingAdapters}
                  className="mt-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  {loadingAdapters ? 'Scanning...' : 'Refresh adapters'}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Matrix Input *
                </label>
                <select
                  value={formData.inputChannel}
                  onChange={(e) =>
                    setFormData({ ...formData, inputChannel: parseInt(e.target.value) })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={0}>Select input...</option>
                  {matrixInputs.map((input) => (
                    <option key={input.id} value={input.channelNumber}>
                      Input {input.channelNumber} - {input.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Device Model (optional)
                </label>
                <input
                  type="text"
                  value={formData.deviceModel}
                  onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
                  placeholder="Skykit, Chromebox, etc."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddDevice(false)
                  resetForm()
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={addDevice}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Device'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Device Dialog */}
      {showEditDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit EverPass Device</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Device Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CEC Adapter *
                </label>
                <select
                  value={formData.cecDevicePath}
                  onChange={(e) => setFormData({ ...formData, cecDevicePath: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select CEC adapter...</option>
                  {cecAdapters.map((adapter) => (
                    <option key={adapter.path} value={adapter.path}>
                      {adapter.path} ({adapter.vendor})
                    </option>
                  ))}
                  {/* Show current value even if not in list */}
                  {formData.cecDevicePath &&
                    !cecAdapters.find((a) => a.path === formData.cecDevicePath) && (
                      <option value={formData.cecDevicePath}>
                        {formData.cecDevicePath} (current)
                      </option>
                    )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Matrix Input *
                </label>
                <select
                  value={formData.inputChannel}
                  onChange={(e) =>
                    setFormData({ ...formData, inputChannel: parseInt(e.target.value) })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={0}>Select input...</option>
                  {matrixInputs.map((input) => (
                    <option key={input.id} value={input.channelNumber}>
                      Input {input.channelNumber} - {input.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Device Model (optional)
                </label>
                <input
                  type="text"
                  value={formData.deviceModel}
                  onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditDevice(false)
                  resetForm()
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={updateDevice}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Delete Device?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this device? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteDevice(showDeleteConfirm)}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
