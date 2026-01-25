'use client'

import { useState, useEffect } from 'react'
import {
  Volume2, Plus, Edit2, Trash2, Save, X, Wifi, Cable,
  CheckCircle, XCircle, RefreshCw, Speaker, Radio
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { logger } from '@sports-bar/logger'

// HTD model configurations
const HTD_MODELS = [
  { value: 'MC-66', label: 'MC-66 - 6-Zone Controller', zones: 6, sources: 6, supportsWebSocket: false },
  { value: 'MCA-66', label: 'MCA-66 - 6-Zone with Amplifier', zones: 6, sources: 6, supportsWebSocket: false },
  { value: 'Lync6', label: 'Lync 6 - 6-Zone Advanced', zones: 6, sources: 6, supportsWebSocket: true },
  { value: 'Lync12', label: 'Lync 12 - 12-Zone Advanced', zones: 12, sources: 6, supportsWebSocket: true },
]

interface HTDDevice {
  id: string
  name: string
  model: string
  connectionType: 'ethernet' | 'rs232'
  ipAddress: string
  tcpPort: number
  serialPort?: string
  baudRate?: number
  zones: number
  sources: number
  supportsWebSocket: boolean
  description?: string
  status: 'online' | 'offline' | 'error'
}

interface HTDFormData {
  id?: string
  name: string
  model: string
  connectionType: 'ethernet' | 'rs232'
  ipAddress: string
  tcpPort: number
  serialPort: string
  baudRate: number
  description: string
}

const defaultFormData: HTDFormData = {
  name: '',
  model: 'Lync12',
  connectionType: 'ethernet',
  ipAddress: '',
  tcpPort: 10006,
  serialPort: '/dev/ttyUSB0',
  baudRate: 57600,
  description: ''
}

interface HTDManagerProps {
  onDeviceCountChange?: (count: number) => void
  showBartenderToggle?: boolean
}

export default function HTDManager({ onDeviceCountChange, showBartenderToggle = true }: HTDManagerProps) {
  const [devices, setDevices] = useState<HTDDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState<HTDFormData>(defaultFormData)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [htdEnabled, setHtdEnabled] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(false)

  useEffect(() => {
    fetchDevices()
    fetchSettings()
  }, [])

  useEffect(() => {
    onDeviceCountChange?.(devices.length)
  }, [devices.length, onDeviceCountChange])

  const fetchDevices = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/htd')
      const data = await response.json()
      if (data.devices) {
        setDevices(data.devices)
      }
    } catch (error) {
      logger.error('Failed to fetch HTD devices:', { error })
      setMessage({ type: 'error', text: 'Failed to load HTD devices' })
    } finally {
      setLoading(false)
    }
  }

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/audio')
      const result = await response.json()
      if (result.success && result.data) {
        setHtdEnabled(result.data.htdEnabled ?? false)
      }
    } catch (error) {
      logger.error('Failed to fetch audio settings:', { error })
    }
  }

  const updateHtdSetting = async (enabled: boolean) => {
    setSettingsLoading(true)
    try {
      const response = await fetch('/api/settings/audio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htdEnabled: enabled })
      })
      const result = await response.json()
      if (result.success) {
        setHtdEnabled(enabled)
      }
    } catch (error) {
      logger.error('Failed to update HTD setting:', { error })
    } finally {
      setSettingsLoading(false)
    }
  }

  const handleModelChange = (model: string) => {
    const modelConfig = HTD_MODELS.find(m => m.value === model)
    setFormData(prev => ({
      ...prev,
      model,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const url = editing ? `/api/htd/${editing}` : '/api/htd'
      const method = editing ? 'PUT' : 'POST'

      const body: Record<string, unknown> = {
        name: formData.name,
        model: formData.model,
        connectionType: formData.connectionType,
        ipAddress: formData.ipAddress,
        tcpPort: formData.tcpPort,
        description: formData.description || undefined
      }

      // Include serial settings for RS-232
      if (formData.connectionType === 'rs232') {
        body.serialPort = formData.serialPort
        body.baudRate = formData.baudRate
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save device')
      }

      setMessage({ type: 'success', text: `Device ${editing ? 'updated' : 'created'} successfully` })
      setShowForm(false)
      setEditing(null)
      setFormData(defaultFormData)
      await fetchDevices()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (device: HTDDevice) => {
    setFormData({
      id: device.id,
      name: device.name,
      model: device.model,
      connectionType: device.connectionType,
      ipAddress: device.ipAddress,
      tcpPort: device.tcpPort,
      serialPort: device.serialPort || '/dev/ttyUSB0',
      baudRate: device.baudRate || 57600,
      description: device.description || ''
    })
    setEditing(device.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this HTD device?')) return

    try {
      const response = await fetch(`/api/htd/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete device')
      }

      setMessage({ type: 'success', text: 'Device deleted' })
      await fetchDevices()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setMessage({ type: 'error', text: errorMessage })
    }
  }

  const handleTestConnection = async (device: HTDDevice) => {
    setTesting(device.id)
    try {
      const response = await fetch(`/api/htd/${device.id}/test`, {
        method: 'POST'
      })

      const data = await response.json()
      if (data.success) {
        setMessage({
          type: 'success',
          text: `Connected to ${device.name} - ${data.zonesDetected} zones detected`
        })
      } else {
        setMessage({ type: 'error', text: data.error || 'Connection failed' })
      }
      await fetchDevices()
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection test failed' })
    } finally {
      setTesting(null)
    }
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditing(null)
    setFormData(defaultFormData)
    setMessage(null)
  }

  const selectedModel = HTD_MODELS.find(m => m.value === formData.model)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Speaker className="w-6 h-6 text-indigo-400" />
          <div>
            <h2 className="text-xl font-bold text-slate-100">HTD Whole-House Audio</h2>
            <p className="text-sm text-slate-400">Configure Home Theater Direct multi-zone audio systems</p>
          </div>
        </div>
        <Button
          onClick={() => {
            setFormData(defaultFormData)
            setEditing(null)
            setShowForm(true)
          }}
          className="bg-indigo-600 hover:bg-indigo-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add HTD Device
        </Button>
      </div>

      {/* Enable Toggle for Bartender Remote Visibility */}
      {showBartenderToggle && devices.length > 0 && (
        <div className="p-4 bg-green-900/30 rounded-lg border border-green-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Radio className="w-5 h-5 text-green-400" />
              <div>
                <Label htmlFor="htd-enabled" className="text-sm font-medium text-green-200">
                  Enable on Bartender Remote
                </Label>
                <p className="text-xs text-green-400">
                  When enabled, HTD zone controls will appear on the Bartender Remote page
                </p>
              </div>
            </div>
            <Switch
              id="htd-enabled"
              checked={htdEnabled}
              disabled={settingsLoading || devices.length === 0}
              onCheckedChange={updateHtdSetting}
              className="data-[state=checked]:bg-green-600"
            />
          </div>
        </div>
      )}

      {/* Message Toast */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center space-x-2 ${
          message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Device Form */}
      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">
            {editing ? 'Edit HTD Device' : 'Add New HTD Device'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Main Audio System"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                  required
                />
              </div>

              {/* Model */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Model</label>
                <select
                  value={formData.model}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                >
                  {HTD_MODELS.map(model => (
                    <option key={model.value} value={model.value}>{model.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Model Info */}
            {selectedModel && (
              <div className="flex items-center space-x-3 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                <Speaker className="w-5 h-5 text-indigo-400" />
                <div>
                  <p className="text-sm font-medium text-indigo-300">
                    {selectedModel.zones} Zones • {selectedModel.sources} Sources
                    {selectedModel.supportsWebSocket && (
                      <span className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                        WebSocket
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-indigo-300/70">
                    {selectedModel.supportsWebSocket
                      ? 'Supports WGW-SLX gateway for WiFi/Cloud connectivity'
                      : 'Requires WGW-SLX gateway for network control'}
                  </p>
                </div>
              </div>
            )}

            {/* Connection Type */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Connection Type
              </label>
              <div className="flex space-x-4">
                <label className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer ${
                  formData.connectionType === 'ethernet'
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-600'
                }`}>
                  <input
                    type="radio"
                    name="connectionType"
                    value="ethernet"
                    checked={formData.connectionType === 'ethernet'}
                    onChange={() => setFormData(prev => ({ ...prev, connectionType: 'ethernet' }))}
                    className="text-cyan-500"
                  />
                  <Wifi className="w-4 h-4" />
                  <span className="text-slate-200">TCP/IP (Gateway)</span>
                </label>
                <label className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer ${
                  formData.connectionType === 'rs232'
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-slate-600'
                }`}>
                  <input
                    type="radio"
                    name="connectionType"
                    value="rs232"
                    checked={formData.connectionType === 'rs232'}
                    onChange={() => setFormData(prev => ({ ...prev, connectionType: 'rs232' }))}
                    className="text-orange-500"
                  />
                  <Cable className="w-4 h-4" />
                  <span className="text-slate-200">RS-232 Serial</span>
                </label>
              </div>
            </div>

            {/* Ethernet Settings */}
            {formData.connectionType === 'ethernet' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Gateway IP Address
                  </label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData(prev => ({ ...prev, ipAddress: e.target.value }))}
                    placeholder="192.168.1.100"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">WGW-SLX gateway IP address</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">TCP Port</label>
                  <input
                    type="number"
                    value={formData.tcpPort}
                    onChange={(e) => setFormData(prev => ({ ...prev, tcpPort: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                  />
                  <p className="text-xs text-slate-500 mt-1">Default: 10006</p>
                </div>
              </div>
            )}

            {/* RS-232 Settings */}
            {formData.connectionType === 'rs232' && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Serial Port</label>
                  <input
                    type="text"
                    value={formData.serialPort}
                    onChange={(e) => setFormData(prev => ({ ...prev, serialPort: e.target.value }))}
                    placeholder="/dev/ttyUSB0"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Baud Rate</label>
                  <select
                    value={formData.baudRate}
                    onChange={(e) => setFormData(prev => ({ ...prev, baudRate: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                  >
                    <option value="57600">57600 (HTD default)</option>
                    <option value="38400">38400</option>
                    <option value="19200">19200</option>
                    <option value="9600">9600</option>
                  </select>
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Location or notes about this system..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                rows={2}
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
              <Button type="button" variant="outline" onClick={cancelForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-500">
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {editing ? 'Update' : 'Create'} Device
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Device List */}
      {loading ? (
        <div className="text-center py-8 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading HTD devices...
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-700 rounded-lg">
          <Speaker className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No HTD devices configured</p>
          <p className="text-sm text-slate-500">Add an HTD audio system to get started</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {devices.map(device => (
            <div
              key={device.id}
              className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-lg bg-indigo-500/20">
                    <Speaker className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-slate-100">{device.name}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        device.status === 'online'
                          ? 'bg-green-500/20 text-green-400'
                          : device.status === 'error'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {device.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 text-sm text-slate-400">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300">
                        HTD
                      </span>
                      <span>{device.model}</span>
                      <span>•</span>
                      <span>{device.zones} zones</span>
                      <span>•</span>
                      <span className="flex items-center">
                        {device.connectionType === 'rs232' ? (
                          <><Cable className="w-3 h-3 mr-1" /> {device.serialPort}</>
                        ) : (
                          <><Wifi className="w-3 h-3 mr-1" /> {device.ipAddress}:{device.tcpPort}</>
                        )}
                      </span>
                    </div>
                    {device.description && (
                      <p className="text-sm text-slate-500 mt-1">{device.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestConnection(device)}
                    disabled={testing === device.id}
                  >
                    {testing === device.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wifi className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(device)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(device.id)}
                    className="text-red-400 hover:text-red-300 hover:border-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
