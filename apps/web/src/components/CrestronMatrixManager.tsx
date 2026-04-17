'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Cable,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Wifi,
  WifiOff,
  RefreshCw,
  TestTube,
  Monitor,
  Zap
} from 'lucide-react'

// Crestron DM Matrix Models
const CRESTRON_MODELS = [
  // DM-MD Modular Matrix Switchers
  { value: 'DM-MD8X8', label: 'DM-MD8X8 - 8x8 Modular Matrix', inputs: 8, outputs: 8, series: 'DM-MD' },
  { value: 'DM-MD8X8-CPU3', label: 'DM-MD8X8-CPU3 - 8x8 with CPU3', inputs: 8, outputs: 8, series: 'DM-MD' },
  { value: 'DM-MD16X16', label: 'DM-MD16X16 - 16x16 Modular Matrix', inputs: 16, outputs: 16, series: 'DM-MD' },
  { value: 'DM-MD16X16-CPU3', label: 'DM-MD16X16-CPU3 - 16x16 with CPU3', inputs: 16, outputs: 16, series: 'DM-MD' },
  { value: 'DM-MD32X32', label: 'DM-MD32X32 - 32x32 Modular Matrix', inputs: 32, outputs: 32, series: 'DM-MD' },
  { value: 'DM-MD32X32-CPU3', label: 'DM-MD32X32-CPU3 - 32x32 with CPU3', inputs: 32, outputs: 32, series: 'DM-MD' },
  { value: 'DM-MD64X64', label: 'DM-MD64X64 - 64x64 Modular Matrix', inputs: 64, outputs: 64, series: 'DM-MD' },
  { value: 'DM-MD128X128', label: 'DM-MD128X128 - 128x128 Modular Matrix', inputs: 128, outputs: 128, series: 'DM-MD' },
  // HD-MD HDMI Switchers
  { value: 'HD-MD4X2-4KZ-E', label: 'HD-MD4X2-4KZ-E - 4x2 HDMI Switcher', inputs: 4, outputs: 2, series: 'HD-MD' },
  { value: 'HD-MD6X2-4KZ-E', label: 'HD-MD6X2-4KZ-E - 6x2 HDMI Switcher', inputs: 6, outputs: 2, series: 'HD-MD' },
  { value: 'HD-MD8X2-4KZ-E', label: 'HD-MD8X2-4KZ-E - 8x2 HDMI Switcher', inputs: 8, outputs: 2, series: 'HD-MD' },
  { value: 'HD-MD4X1-4KZ-E', label: 'HD-MD4X1-4KZ-E - 4x1 HDMI Switcher', inputs: 4, outputs: 1, series: 'HD-MD' },
  // DMPS Presentation Systems
  { value: 'DMPS3-4K-350-C', label: 'DMPS3-4K-350-C - Presentation System', inputs: 8, outputs: 3, series: 'DMPS' },
  { value: 'DMPS3-4K-150-C', label: 'DMPS3-4K-150-C - Presentation System', inputs: 6, outputs: 2, series: 'DMPS' },
  { value: 'DMPS3-4K-100-C', label: 'DMPS3-4K-100-C - Presentation System', inputs: 4, outputs: 2, series: 'DMPS' },
  // NVX Network AV
  { value: 'DM-NVX-DIR-80', label: 'DM-NVX-DIR-80 - Network AV Director (80 endpoints)', inputs: 80, outputs: 80, series: 'NVX' },
  { value: 'DM-NVX-DIR-160', label: 'DM-NVX-DIR-160 - Network AV Director (160 endpoints)', inputs: 160, outputs: 160, series: 'NVX' },
  { value: 'DM-NVX-DIR-ENT', label: 'DM-NVX-DIR-ENT - Network AV Director Enterprise', inputs: 500, outputs: 500, series: 'NVX' },
]

interface CrestronMatrix {
  id: string
  name: string
  model: string
  ipAddress: string
  port: number
  username?: string
  password?: string
  description?: string
  status: 'online' | 'offline' | 'unknown'
  lastSeen?: string
  inputs: number
  outputs: number
}

const defaultFormData = {
  name: '',
  model: 'DM-MD8X8',
  ipAddress: '',
  port: 23,
  username: '',
  password: '',
  description: ''
}

export default function CrestronMatrixManager() {
  const [matrices, setMatrices] = useState<CrestronMatrix[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState(defaultFormData)
  const [testing, setTesting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchMatrices()
  }, [])

  const fetchMatrices = async () => {
    try {
      const res = await fetch('/api/crestron/matrices')
      if (res.ok) {
        const data = await res.json()
        setMatrices(data.matrices || [])
      }
    } catch (error) {
      console.error('Failed to fetch Crestron matrices:', error)
    } finally {
      setLoading(false)
    }
  }

  const getModelConfig = (model: string) => {
    return CRESTRON_MODELS.find(m => m.value === model)
  }

  const handleModelChange = (model: string) => {
    const modelConfig = getModelConfig(model)
    const defaultPort = modelConfig?.series === 'DMPS' ? 41795 :
                        modelConfig?.series === 'NVX' ? 443 : 23
    setFormData(prev => ({
      ...prev,
      model,
      port: defaultPort
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const modelConfig = getModelConfig(formData.model)

    try {
      const endpoint = editing
        ? `/api/crestron/matrices/${editing}`
        : '/api/crestron/matrices'

      const res = await fetch(endpoint, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          inputs: modelConfig?.inputs || 8,
          outputs: modelConfig?.outputs || 8
        })
      })

      if (res.ok) {
        setMessage({ type: 'success', text: editing ? 'Matrix updated!' : 'Matrix added!' })
        setShowForm(false)
        setEditing(null)
        setFormData(defaultFormData)
        fetchMatrices()
        toast.success(editing ? 'Matrix updated!' : 'Matrix added!')
      } else {
        const error = await res.json()
        setMessage({ type: 'error', text: error.error || 'Failed to save matrix' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save matrix' })
    }

    setTimeout(() => setMessage(null), 3000)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this matrix?')) return

    try {
      const res = await fetch(`/api/crestron/matrices/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Matrix deleted!')
        fetchMatrices()
      }
    } catch (error) {
      toast.error('Failed to delete matrix')
    }
  }

  const handleEdit = (matrix: CrestronMatrix) => {
    setFormData({
      name: matrix.name,
      model: matrix.model,
      ipAddress: matrix.ipAddress,
      port: matrix.port,
      username: matrix.username || '',
      password: '',
      description: matrix.description || ''
    })
    setEditing(matrix.id)
    setShowForm(true)
  }

  const handleTest = async (matrix: CrestronMatrix) => {
    setTesting(matrix.id)
    try {
      const res = await fetch(`/api/crestron/matrices/${matrix.id}/test`, { method: 'POST' })
      const data = await res.json()

      if (data.success) {
        toast.success('Connection successful!')
        fetchMatrices()
      } else {
        toast.error(data.message || 'Connection failed')
      }
    } catch (error) {
      toast.error('Connection test failed')
    } finally {
      setTesting(null)
    }
  }

  const selectedModel = getModelConfig(formData.model)
  const seriesBadgeColor = {
    'DM-MD': 'bg-blue-500/20 text-blue-300 border-blue-500/50',
    'HD-MD': 'bg-green-500/20 text-green-300 border-green-500/50',
    'DMPS': 'bg-purple-500/20 text-purple-300 border-purple-500/50',
    'NVX': 'bg-orange-500/20 text-orange-300 border-orange-500/50'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Cable className="w-6 h-6 text-indigo-400" />
          <div>
            <h2 className="text-xl font-bold text-slate-100">Crestron Video Matrices</h2>
            <p className="text-sm text-slate-400">Configure Crestron DM, HD-MD, DMPS, and NVX matrices</p>
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
          Add Matrix
        </Button>
      </div>

      {/* Message Toast */}
      {message && (
        <div className={`p-3 rounded-lg ${
          message.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card p-6 border border-indigo-500/30">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">
            {editing ? 'Edit Crestron Matrix' : 'Add New Crestron Matrix'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name and Model */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Main Bar Matrix"
                  required
                />
              </div>
              <div>
                <Label>Model</Label>
                <select
                  value={formData.model}
                  onChange={e => handleModelChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-slate-100"
                >
                  <optgroup label="DM-MD Modular Matrix Switchers">
                    {CRESTRON_MODELS.filter(m => m.series === 'DM-MD').map(model => (
                      <option key={model.value} value={model.value}>{model.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="HD-MD HDMI Switchers">
                    {CRESTRON_MODELS.filter(m => m.series === 'HD-MD').map(model => (
                      <option key={model.value} value={model.value}>{model.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="DMPS Presentation Systems">
                    {CRESTRON_MODELS.filter(m => m.series === 'DMPS').map(model => (
                      <option key={model.value} value={model.value}>{model.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="NVX Network AV">
                    {CRESTRON_MODELS.filter(m => m.series === 'NVX').map(model => (
                      <option key={model.value} value={model.value}>{model.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Model Info */}
            {selectedModel && (
              <div className="flex items-center space-x-3 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                <Monitor className="w-5 h-5 text-indigo-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-indigo-300">
                    {selectedModel.inputs} inputs × {selectedModel.outputs} outputs
                    <Badge className={`ml-2 ${seriesBadgeColor[selectedModel.series as keyof typeof seriesBadgeColor]}`}>
                      {selectedModel.series}
                    </Badge>
                  </p>
                  <p className="text-xs text-indigo-300/70">
                    {selectedModel.series === 'DM-MD' && 'Telnet control on port 23. Supports audio/video breakaway.'}
                    {selectedModel.series === 'HD-MD' && 'Telnet control on port 23. Compact HDMI switching.'}
                    {selectedModel.series === 'DMPS' && 'CTP control on port 41795. All-in-one presentation system.'}
                    {selectedModel.series === 'NVX' && 'REST API on port 443. Network AV over IP.'}
                  </p>
                </div>
              </div>
            )}

            {/* IP and Port */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>IP Address</Label>
                <Input
                  value={formData.ipAddress}
                  onChange={e => setFormData(prev => ({ ...prev, ipAddress: e.target.value }))}
                  placeholder="192.168.1.100"
                  required
                />
              </div>
              <div>
                <Label>Port</Label>
                <Input
                  type="number"
                  value={formData.port}
                  onChange={e => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                />
                <p className="text-xs text-slate-500 mt-1">
                  {selectedModel?.series === 'DMPS' ? 'CTP default: 41795' :
                   selectedModel?.series === 'NVX' ? 'HTTPS default: 443' :
                   'Telnet default: 23'}
                </p>
              </div>
            </div>

            {/* Credentials (optional) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Username (optional)</Label>
                <Input
                  value={formData.username}
                  onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="admin"
                />
              </div>
              <div>
                <Label>Password (optional)</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Location or notes..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false)
                  setEditing(null)
                  setFormData(defaultFormData)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500">
                <Save className="w-4 h-4 mr-2" />
                {editing ? 'Update Matrix' : 'Create Matrix'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Matrix List */}
      <div className="space-y-3">
        {matrices.length === 0 ? (
          <div className="card p-8 text-center">
            <Cable className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No Crestron matrices configured</p>
            <p className="text-sm text-slate-500">Click "Add Matrix" to get started</p>
          </div>
        ) : (
          matrices.map(matrix => {
            const modelConfig = getModelConfig(matrix.model)
            return (
              <div
                key={matrix.id}
                className="card p-4 flex items-center justify-between hover:border-indigo-500/50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  {matrix.status === 'online' ? (
                    <Wifi className="w-5 h-5 text-green-400" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-slate-500" />
                  )}
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-slate-100">{matrix.name}</h3>
                      <Badge className={matrix.status === 'online' ? 'bg-green-500/20 text-green-300' : 'bg-slate-500/20 text-slate-400'}>
                        {matrix.status}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-slate-400">
                      <span>{matrix.model}</span>
                      <span>•</span>
                      <span>{matrix.inputs}×{matrix.outputs}</span>
                      <span>•</span>
                      <span className="flex items-center">
                        <Wifi className="w-3 h-3 mr-1" />
                        {matrix.ipAddress}:{matrix.port}
                      </span>
                      {modelConfig && (
                        <Badge className={`ml-2 text-xs ${seriesBadgeColor[modelConfig.series as keyof typeof seriesBadgeColor]}`}>
                          {modelConfig.series}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTest(matrix)}
                    disabled={testing === matrix.id}
                  >
                    {testing === matrix.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <TestTube className="w-4 h-4" />
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(matrix)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(matrix.id)}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
