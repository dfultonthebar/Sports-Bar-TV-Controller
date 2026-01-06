'use client'

import { useState, useEffect } from 'react'
import {
  Volume2, Plus, Edit2, Trash2, Save, X, Wifi, Cable,
  CheckCircle, XCircle, RefreshCw, Settings
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logger } from '@sports-bar/logger'

// Atlas models
const ATLAS_MODELS = [
  { value: 'AZM4', label: 'AZM4 - 4-Zone Processor', zones: 4 },
  { value: 'AZM8', label: 'AZM8 - 8-Zone Processor', zones: 8 },
  { value: 'AZMP4', label: 'AZMP4 - 4-Zone with 600W Amp', zones: 4 },
  { value: 'AZMP8', label: 'AZMP8 - 8-Zone with 1200W Amp', zones: 8 },
  { value: 'AZM4-D', label: 'AZM4-D - 4-Zone with Dante', zones: 4 },
  { value: 'AZM8-D', label: 'AZM8-D - 8-Zone with Dante', zones: 8 },
]

// dbx ZonePRO models
const DBX_MODELS = [
  { value: 'ZonePRO 640', label: 'ZonePRO 640 - 6x4 (RS-232)', zones: 4, hasEthernet: false },
  { value: 'ZonePRO 640m', label: 'ZonePRO 640m - 6x4 (Ethernet)', zones: 4, hasEthernet: true },
  { value: 'ZonePRO 641', label: 'ZonePRO 641 - 6x4 Mic (RS-232)', zones: 4, hasEthernet: false },
  { value: 'ZonePRO 641m', label: 'ZonePRO 641m - 6x4 Mic (Ethernet)', zones: 4, hasEthernet: true },
  { value: 'ZonePRO 1260', label: 'ZonePRO 1260 - 12x6 (RS-232)', zones: 6, hasEthernet: false },
  { value: 'ZonePRO 1260m', label: 'ZonePRO 1260m - 12x6 (Ethernet)', zones: 6, hasEthernet: true },
  { value: 'ZonePRO 1261', label: 'ZonePRO 1261 - 12x6 Mic (RS-232)', zones: 6, hasEthernet: false },
  { value: 'ZonePRO 1261m', label: 'ZonePRO 1261m - 12x6 Mic (Ethernet)', zones: 6, hasEthernet: true },
]

// BSS Soundweb London BLU series models
// All BSS BLU devices are network-only (HiQnet protocol over TCP port 1023)
const BSS_MODELS = [
  { value: 'BLU-50', label: 'BLU-50 - 4x4 Signal Processor', inputs: 4, outputs: 4, zones: 4, hasDante: false, hasCobraNet: false },
  { value: 'BLU-100', label: 'BLU-100 - 12x8 Signal Processor', inputs: 12, outputs: 8, zones: 8, hasDante: false, hasCobraNet: false },
  { value: 'BLU-120', label: 'BLU-120 - Configurable I/O', inputs: 16, outputs: 16, zones: 8, hasDante: false, hasCobraNet: false },
  { value: 'BLU-160', label: 'BLU-160 - Configurable I/O (EN 54-16)', inputs: 16, outputs: 16, zones: 8, hasDante: false, hasCobraNet: false },
  { value: 'BLU-320', label: 'BLU-320 - I/O Expander + CobraNet', inputs: 16, outputs: 16, zones: 8, hasDante: false, hasCobraNet: true },
  { value: 'BLU-800', label: 'BLU-800 - Signal Processor + CobraNet', inputs: 16, outputs: 16, zones: 8, hasDante: false, hasCobraNet: true },
  { value: 'BLU-806', label: 'BLU-806 - Signal Processor + Dante', inputs: 16, outputs: 16, zones: 8, hasDante: true, hasCobraNet: false },
  { value: 'BLU-806DA', label: 'BLU-806DA - Signal Processor + Dante/AES67', inputs: 16, outputs: 16, zones: 8, hasDante: true, hasCobraNet: false },
]

interface AudioProcessor {
  id: string
  name: string
  model: string
  processorType: 'atlas' | 'dbx-zonepro' | 'bss-blu'
  ipAddress: string
  port: number
  tcpPort: number
  connectionType: 'ethernet' | 'rs232'
  serialPort?: string
  baudRate?: number
  zones: number
  inputs?: number
  outputs?: number
  description?: string
  status: 'online' | 'offline' | 'error'
  username?: string
  hasCredentials?: boolean
  // BSS-specific fields
  hasDante?: boolean
  hasCobraNet?: boolean
}

interface ProcessorFormData {
  id?: string
  name: string
  processorType: 'atlas' | 'dbx-zonepro' | 'bss-blu'
  model: string
  ipAddress: string
  port: number
  tcpPort: number
  connectionType: 'ethernet' | 'rs232'
  serialPort: string
  baudRate: number
  zones: number
  inputs: number
  outputs: number
  description: string
  username: string
  password: string
}

const defaultFormData: ProcessorFormData = {
  name: '',
  processorType: 'atlas',
  model: 'AZM8',
  ipAddress: '',
  port: 80,
  tcpPort: 5321,
  connectionType: 'ethernet',
  serialPort: '/dev/ttyUSB0',
  baudRate: 57600,
  zones: 8,
  inputs: 10,
  outputs: 8,
  description: '',
  username: '',
  password: ''
}

export default function AudioProcessorManager() {
  const [processors, setProcessors] = useState<AudioProcessor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState<ProcessorFormData>(defaultFormData)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchProcessors()
  }, [])

  const fetchProcessors = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/audio-processor')
      const data = await response.json()
      if (data.processors) {
        setProcessors(data.processors)
      }
    } catch (error) {
      logger.error('Failed to fetch processors:', error)
      setMessage({ type: 'error', text: 'Failed to load processors' })
    } finally {
      setLoading(false)
    }
  }

  const handleProcessorTypeChange = (type: 'atlas' | 'dbx-zonepro' | 'bss-blu') => {
    let defaultModel: string
    let defaultTcpPort: number
    let models: typeof ATLAS_MODELS | typeof DBX_MODELS | typeof BSS_MODELS

    if (type === 'atlas') {
      defaultModel = 'AZM8'
      defaultTcpPort = 5321
      models = ATLAS_MODELS
    } else if (type === 'dbx-zonepro') {
      defaultModel = 'ZonePRO 640m'
      defaultTcpPort = 3804
      models = DBX_MODELS
    } else {
      // BSS BLU - HiQnet uses port 1023
      defaultModel = 'BLU-100'
      defaultTcpPort = 1023
      models = BSS_MODELS
    }

    const modelConfig = models.find(m => m.value === defaultModel)
    const bssModel = type === 'bss-blu' ? BSS_MODELS.find(m => m.value === defaultModel) : null

    setFormData(prev => ({
      ...prev,
      processorType: type,
      model: defaultModel,
      tcpPort: defaultTcpPort,
      zones: modelConfig?.zones || 4,
      inputs: bssModel?.inputs || prev.inputs,
      outputs: bssModel?.outputs || prev.outputs,
      // BSS is always ethernet, dbx depends on model
      connectionType: type === 'dbx-zonepro' && !defaultModel.includes('m') ? 'rs232' : 'ethernet'
    }))
  }

  const handleModelChange = (model: string) => {
    let models: typeof ATLAS_MODELS | typeof DBX_MODELS | typeof BSS_MODELS
    if (formData.processorType === 'atlas') {
      models = ATLAS_MODELS
    } else if (formData.processorType === 'dbx-zonepro') {
      models = DBX_MODELS
    } else {
      models = BSS_MODELS
    }
    const modelConfig = models.find(m => m.value === model)

    // For dbx, check if model has ethernet (m suffix)
    const hasEthernet = formData.processorType === 'dbx-zonepro'
      ? DBX_MODELS.find(m => m.value === model)?.hasEthernet ?? true
      : true // Atlas and BSS are always ethernet

    // Get BSS-specific I/O counts
    const bssModel = formData.processorType === 'bss-blu'
      ? BSS_MODELS.find(m => m.value === model)
      : null

    setFormData(prev => ({
      ...prev,
      model,
      zones: modelConfig?.zones || prev.zones,
      inputs: bssModel?.inputs || prev.inputs,
      outputs: bssModel?.outputs || prev.outputs,
      connectionType: hasEthernet ? 'ethernet' : 'rs232'
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const url = '/api/audio-processor'
      const method = editing ? 'PUT' : 'POST'

      const body: any = {
        ...formData,
        id: editing || undefined
      }

      // Only include serial settings for RS-232 connections
      if (body.connectionType !== 'rs232') {
        delete body.serialPort
        delete body.baudRate
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save processor')
      }

      setMessage({ type: 'success', text: `Processor ${editing ? 'updated' : 'created'} successfully` })
      setShowForm(false)
      setEditing(null)
      setFormData(defaultFormData)
      await fetchProcessors()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (processor: AudioProcessor) => {
    setFormData({
      id: processor.id,
      name: processor.name,
      processorType: processor.processorType || 'atlas',
      model: processor.model,
      ipAddress: processor.ipAddress,
      port: processor.port,
      tcpPort: processor.tcpPort,
      connectionType: processor.connectionType || 'ethernet',
      serialPort: processor.serialPort || '/dev/ttyUSB0',
      baudRate: processor.baudRate || 57600,
      zones: processor.zones,
      description: processor.description || '',
      username: processor.username || '',
      password: ''
    })
    setEditing(processor.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this processor?')) return

    try {
      const response = await fetch(`/api/audio-processor?id=${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete processor')
      }

      setMessage({ type: 'success', text: 'Processor deleted' })
      await fetchProcessors()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  const handleTestConnection = async (processor: AudioProcessor) => {
    setTesting(processor.id)
    try {
      const response = await fetch('/api/audio-processor/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processorId: processor.id })
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: `Connected to ${processor.name}` })
      } else {
        setMessage({ type: 'error', text: data.error || 'Connection failed' })
      }
      await fetchProcessors()
    } catch (error: any) {
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

  // Get models array based on processor type
  const models = formData.processorType === 'atlas'
    ? ATLAS_MODELS
    : formData.processorType === 'dbx-zonepro'
      ? DBX_MODELS
      : BSS_MODELS
  const selectedModel = models.find(m => m.value === formData.model)
  const selectedDbxModel = formData.processorType === 'dbx-zonepro'
    ? DBX_MODELS.find(m => m.value === formData.model)
    : null
  const selectedBssModel = formData.processorType === 'bss-blu'
    ? BSS_MODELS.find(m => m.value === formData.model)
    : null
  const modelHasEthernet = selectedDbxModel?.hasEthernet ?? true
  const showConnectionTypeChoice = formData.processorType === 'dbx-zonepro' && modelHasEthernet
  const showSerialOptions = formData.processorType === 'dbx-zonepro' && formData.connectionType === 'rs232'
  const showCredentials = formData.processorType === 'atlas' || formData.processorType === 'bss-blu'
  const isBss = formData.processorType === 'bss-blu'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Volume2 className="w-6 h-6 text-teal-400" />
          <div>
            <h2 className="text-xl font-bold text-slate-100">Audio Processors</h2>
            <p className="text-sm text-slate-400">Configure AtlasIED, dbx ZonePRO, and BSS Soundweb London processors</p>
          </div>
        </div>
        <Button
          onClick={() => {
            setFormData(defaultFormData)
            setEditing(null)
            setShowForm(true)
          }}
          className="bg-teal-600 hover:bg-teal-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Processor
        </Button>
      </div>

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

      {/* Processor Form */}
      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">
            {editing ? 'Edit Processor' : 'Add New Audio Processor'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Processor Type Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Processor Type
              </label>
              <div className="flex flex-wrap gap-3">
                <label className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  formData.processorType === 'atlas'
                    ? 'border-teal-500 bg-teal-500/10'
                    : 'border-slate-600 hover:border-slate-500'
                }`}>
                  <input
                    type="radio"
                    name="processorType"
                    value="atlas"
                    checked={formData.processorType === 'atlas'}
                    onChange={() => handleProcessorTypeChange('atlas')}
                    className="text-teal-500"
                  />
                  <span className="text-slate-200">AtlasIED Atmosphere</span>
                </label>
                <label className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  formData.processorType === 'dbx-zonepro'
                    ? 'border-teal-500 bg-teal-500/10'
                    : 'border-slate-600 hover:border-slate-500'
                }`}>
                  <input
                    type="radio"
                    name="processorType"
                    value="dbx-zonepro"
                    checked={formData.processorType === 'dbx-zonepro'}
                    onChange={() => handleProcessorTypeChange('dbx-zonepro')}
                    className="text-teal-500"
                  />
                  <span className="text-slate-200">dbx ZonePRO</span>
                </label>
                <label className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  formData.processorType === 'bss-blu'
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-slate-600 hover:border-slate-500'
                }`}>
                  <input
                    type="radio"
                    name="processorType"
                    value="bss-blu"
                    checked={formData.processorType === 'bss-blu'}
                    onChange={() => handleProcessorTypeChange('bss-blu')}
                    className="text-purple-500"
                  />
                  <span className="text-slate-200">BSS Soundweb London</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Main Audio Processor"
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
                  {models.map(model => (
                    <option key={model.value} value={model.value}>{model.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Connection Type for dbx - only show choice for m-models */}
            {showConnectionTypeChoice && (
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
                    <span className="text-slate-200">Ethernet</span>
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
            )}

            {/* Info message for RS-232 only models */}
            {formData.processorType === 'dbx-zonepro' && !modelHasEthernet && (
              <div className="flex items-center space-x-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <Cable className="w-5 h-5 text-orange-400" />
                <div>
                  <p className="text-sm font-medium text-orange-300">RS-232 Only Model</p>
                  <p className="text-xs text-orange-300/70">
                    {formData.model} does not have Ethernet. Connection requires RS-232 serial cable.
                  </p>
                </div>
              </div>
            )}

            {/* BSS Network Info */}
            {isBss && (
              <div className="flex items-center space-x-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <Wifi className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-sm font-medium text-purple-300">
                    Network Only (HiQnet Protocol)
                    {selectedBssModel?.hasDante && <span className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">Dante</span>}
                    {selectedBssModel?.hasCobraNet && <span className="ml-2 text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded">CobraNet</span>}
                  </p>
                  <p className="text-xs text-purple-300/70">
                    BSS Soundweb London uses HiQnet over TCP port 1023. Configure via Audio Architect software.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* IP Address */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  IP Address {formData.connectionType === 'rs232' && '(optional)'}
                </label>
                <input
                  type="text"
                  value={formData.ipAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, ipAddress: e.target.value }))}
                  placeholder={formData.processorType === 'dbx-zonepro' ? '169.254.2.2' : formData.processorType === 'bss-blu' ? '192.168.1.50' : '192.168.1.100'}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                  required={formData.connectionType === 'ethernet'}
                />
                {formData.processorType === 'dbx-zonepro' && (
                  <p className="text-xs text-slate-500 mt-1">Default dbx IP: 169.254.2.2 (static)</p>
                )}
                {isBss && (
                  <p className="text-xs text-slate-500 mt-1">BSS uses DHCP by default. Check device front panel for IP.</p>
                )}
              </div>

              {/* TCP Port */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">TCP Port</label>
                <input
                  type="number"
                  value={formData.tcpPort}
                  onChange={(e) => setFormData(prev => ({ ...prev, tcpPort: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {formData.processorType === 'atlas' ? 'Atlas default: 5321' : formData.processorType === 'bss-blu' ? 'HiQnet default: 1023' : 'dbx default: 3804'}
                </p>
              </div>
            </div>

            {/* RS-232 Settings */}
            {showSerialOptions && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Serial Port</label>
                  <input
                    type="text"
                    value={formData.serialPort}
                    onChange={(e) => setFormData(prev => ({ ...prev, serialPort: e.target.value }))}
                    placeholder="/dev/ttyUSB0"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Baud Rate</label>
                  <select
                    value={formData.baudRate}
                    onChange={(e) => setFormData(prev => ({ ...prev, baudRate: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                  >
                    <option value="57600">57600 (dbx default)</option>
                    <option value="38400">38400</option>
                    <option value="19200">19200</option>
                    <option value="9600">9600</option>
                  </select>
                </div>
              </div>
            )}

            {/* Atlas Credentials */}
            {showCredentials && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Username (optional)</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="admin"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Password (optional)</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder={editing ? '(unchanged)' : ''}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                  />
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Location or notes about this processor..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                rows={2}
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
              <Button type="button" variant="outline" onClick={cancelForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-teal-600 hover:bg-teal-500">
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {editing ? 'Update' : 'Create'} Processor
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Processor List */}
      {loading ? (
        <div className="text-center py-8 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading processors...
        </div>
      ) : processors.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-700 rounded-lg">
          <Volume2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No audio processors configured</p>
          <p className="text-sm text-slate-500">Add an AtlasIED or dbx ZonePRO processor to get started</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {processors.map(processor => (
            <div
              key={processor.id}
              className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-lg ${
                    processor.processorType === 'dbx-zonepro'
                      ? 'bg-orange-500/20'
                      : 'bg-teal-500/20'
                  }`}>
                    <Volume2 className={`w-6 h-6 ${
                      processor.processorType === 'dbx-zonepro'
                        ? 'text-orange-400'
                        : 'text-teal-400'
                    }`} />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-slate-100">{processor.name}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        processor.status === 'online'
                          ? 'bg-green-500/20 text-green-400'
                          : processor.status === 'error'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {processor.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 text-sm text-slate-400">
                      <span className={`px-2 py-0.5 rounded ${
                        processor.processorType === 'dbx-zonepro'
                          ? 'bg-orange-500/10 text-orange-300'
                          : 'bg-teal-500/10 text-teal-300'
                      }`}>
                        {processor.processorType === 'dbx-zonepro' ? 'dbx' : 'Atlas'}
                      </span>
                      <span>{processor.model}</span>
                      <span>•</span>
                      <span>{processor.zones} zones</span>
                      <span>•</span>
                      <span className="flex items-center">
                        {processor.connectionType === 'rs232' ? (
                          <><Cable className="w-3 h-3 mr-1" /> {processor.serialPort}</>
                        ) : (
                          <><Wifi className="w-3 h-3 mr-1" /> {processor.ipAddress}:{processor.tcpPort}</>
                        )}
                      </span>
                    </div>
                    {processor.description && (
                      <p className="text-sm text-slate-500 mt-1">{processor.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestConnection(processor)}
                    disabled={testing === processor.id}
                  >
                    {testing === processor.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wifi className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(processor)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(processor.id)}
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
