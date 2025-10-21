'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Save, X, HelpCircle, CheckCircle, AlertCircle } from 'lucide-react'

interface AtlasMapping {
  id: string
  processorId: string
  appKey: string
  atlasParam: string
  paramType: string
  paramCategory: string
  minValue: number | null
  maxValue: number | null
  minPercent: number | null
  maxPercent: number | null
  format: 'val' | 'pct' | 'str'
  description: string | null
  isReadOnly: boolean
  createdAt: string
  updatedAt: string
}

interface AtlasMappingManagerProps {
  processorId: string
}

export default function AtlasMappingManager({ processorId }: AtlasMappingManagerProps) {
  const [mappings, setMappings] = useState<AtlasMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    appKey: '',
    atlasParam: '',
    paramType: 'zone',
    paramCategory: 'gain',
    minValue: -80,
    maxValue: 0,
    minPercent: 0,
    maxPercent: 100,
    format: 'val' as 'val' | 'pct' | 'str',
    description: '',
    isReadOnly: false
  })

  useEffect(() => {
    fetchMappings()
  }, [processorId])

  const fetchMappings = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/atlas/mappings?processorId=${processorId}`)
      const data = await response.json()

      if (data.success) {
        setMappings(data.data)
      } else {
        setError(data.error || 'Failed to fetch mappings')
      }
    } catch (err) {
      setError('Failed to fetch mappings')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMapping = async () => {
    try {
      const response = await fetch('/api/atlas/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId,
          ...formData
        })
      })

      const data = await response.json()

      if (data.success) {
        await fetchMappings()
        setShowAddForm(false)
        resetForm()
      } else {
        setError(data.error || 'Failed to add mapping')
      }
    } catch (err) {
      setError('Failed to add mapping')
      console.error(err)
    }
  }

  const handleUpdateMapping = async (id: string) => {
    try {
      const mapping = mappings.find(m => m.id === id)
      if (!mapping) return

      const response = await fetch('/api/atlas/mappings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          ...formData
        })
      })

      const data = await response.json()

      if (data.success) {
        await fetchMappings()
        setEditingId(null)
        resetForm()
      } else {
        setError(data.error || 'Failed to update mapping')
      }
    } catch (err) {
      setError('Failed to update mapping')
      console.error(err)
    }
  }

  const handleDeleteMapping = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mapping?')) return

    try {
      const response = await fetch(`/api/atlas/mappings?id=${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        await fetchMappings()
      } else {
        setError(data.error || 'Failed to delete mapping')
      }
    } catch (err) {
      setError('Failed to delete mapping')
      console.error(err)
    }
  }

  const handleTestConnection = async () => {
    try {
      setTestResult(null)
      const response = await fetch(`/api/audio-processor?id=${processorId}`)
      const data = await response.json()

      if (data.success) {
        setTestResult({
          success: true,
          message: 'Successfully connected to Atlas processor!'
        })
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Failed to connect to Atlas processor'
        })
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: 'Failed to test connection'
      })
    }
  }

  const startEditing = (mapping: AtlasMapping) => {
    setEditingId(mapping.id)
    setFormData({
      appKey: mapping.appKey,
      atlasParam: mapping.atlasParam,
      paramType: mapping.paramType,
      paramCategory: mapping.paramCategory,
      minValue: mapping.minValue ?? -80,
      maxValue: mapping.maxValue ?? 0,
      minPercent: mapping.minPercent ?? 0,
      maxPercent: mapping.maxPercent ?? 100,
      format: mapping.format,
      description: mapping.description || '',
      isReadOnly: mapping.isReadOnly
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setShowAddForm(false)
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      appKey: '',
      atlasParam: '',
      paramType: 'zone',
      paramCategory: 'gain',
      minValue: -80,
      maxValue: 0,
      minPercent: 0,
      maxPercent: 100,
      format: 'val',
      description: '',
      isReadOnly: false
    })
  }

  if (loading) {
    return <div className="text-center py-8 text-slate-400">Loading mappings...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Parameter Mappings</h3>
          <p className="text-sm text-slate-400 mt-1">
            Map app-friendly names to Atlas parameter names
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleTestConnection}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Test Connection</span>
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Mapping</span>
          </button>
        </div>
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={`p-4 rounded-lg border ${
          testResult.success 
            ? 'bg-green-900/20 border-green-700 text-green-300' 
            : 'bg-red-900/20 border-red-700 text-red-300'
        }`}>
          <div className="flex items-center space-x-2">
            {testResult.success ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span>{testResult.message}</span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {/* Instructions */}
      <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
        <h4 className="font-semibold text-blue-300 mb-2 flex items-center space-x-2">
          <HelpCircle className="w-5 h-5" />
          <span>How to Find Parameter Names</span>
        </h4>
        <ol className="text-sm text-blue-200 space-y-1 ml-6 list-decimal">
          <li>Open the Atlas Atmosphere UI in your browser</li>
          <li>Go to Settings → Third Party Control → Message Table</li>
          <li>Find your zone/source/mix in the "Names" column</li>
          <li>Look across the row to find the parameter name (e.g., ZoneGain_0, SourceMute_2)</li>
          <li>Copy the parameter name and use it in the "Atlas Parameter" field below</li>
        </ol>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingId) && (
        <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
          <h4 className="text-lg font-semibold text-slate-100 mb-4">
            {editingId ? 'Edit Mapping' : 'Add New Mapping'}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                App Key (Friendly Name)
              </label>
              <input
                type="text"
                value={formData.appKey}
                onChange={(e) => setFormData({ ...formData, appKey: e.target.value })}
                placeholder="e.g., mainBarGain, zone1Volume"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Atlas Parameter
              </label>
              <input
                type="text"
                value={formData.atlasParam}
                onChange={(e) => setFormData({ ...formData, atlasParam: e.target.value })}
                placeholder="e.g., ZoneGain_0, SourceMute_2"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Parameter Type
              </label>
              <select
                value={formData.paramType}
                onChange={(e) => setFormData({ ...formData, paramType: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
              >
                <option value="zone">Zone</option>
                <option value="source">Source</option>
                <option value="mix">Mix</option>
                <option value="group">Group</option>
                <option value="message">Message</option>
                <option value="scene">Scene</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Category
              </label>
              <select
                value={formData.paramCategory}
                onChange={(e) => setFormData({ ...formData, paramCategory: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
              >
                <option value="gain">Gain</option>
                <option value="mute">Mute</option>
                <option value="source">Source</option>
                <option value="meter">Meter</option>
                <option value="name">Name</option>
                <option value="action">Action</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Format
              </label>
              <select
                value={formData.format}
                onChange={(e) => setFormData({ ...formData, format: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
              >
                <option value="val">Value (dB)</option>
                <option value="pct">Percentage</option>
                <option value="str">String</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Read Only
              </label>
              <input
                type="checkbox"
                checked={formData.isReadOnly}
                onChange={(e) => setFormData({ ...formData, isReadOnly: e.target.checked })}
                className="w-5 h-5 bg-slate-700 border border-slate-600 rounded"
              />
            </div>
            {formData.paramCategory === 'gain' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Min Value (dB)
                  </label>
                  <input
                    type="number"
                    value={formData.minValue}
                    onChange={(e) => setFormData({ ...formData, minValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Max Value (dB)
                  </label>
                  <input
                    type="number"
                    value={formData.maxValue}
                    onChange={(e) => setFormData({ ...formData, maxValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
                  />
                </div>
              </>
            )}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
              />
            </div>
          </div>
          <div className="flex space-x-3 mt-4">
            <button
              onClick={() => editingId ? handleUpdateMapping(editingId) : handleAddMapping()}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{editingId ? 'Update' : 'Create'}</span>
            </button>
            <button
              onClick={cancelEditing}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center space-x-2"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}

      {/* Mappings Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-3 px-4 text-slate-300 font-semibold">App Key</th>
              <th className="text-left py-3 px-4 text-slate-300 font-semibold">Atlas Parameter</th>
              <th className="text-left py-3 px-4 text-slate-300 font-semibold">Type</th>
              <th className="text-left py-3 px-4 text-slate-300 font-semibold">Category</th>
              <th className="text-left py-3 px-4 text-slate-300 font-semibold">Format</th>
              <th className="text-left py-3 px-4 text-slate-300 font-semibold">Range</th>
              <th className="text-right py-3 px-4 text-slate-300 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {mappings.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400">
                  No mappings configured yet. Click "Add Mapping" to get started.
                </td>
              </tr>
            ) : (
              mappings.map((mapping) => (
                <tr key={mapping.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="py-3 px-4">
                    <span className="text-teal-400 font-mono text-sm">{mapping.appKey}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-slate-300 font-mono text-sm">{mapping.atlasParam}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-slate-400 text-sm capitalize">{mapping.paramType}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-slate-400 text-sm capitalize">{mapping.paramCategory}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-slate-400 text-sm uppercase">{mapping.format}</span>
                  </td>
                  <td className="py-3 px-4">
                    {mapping.minValue !== null && mapping.maxValue !== null ? (
                      <span className="text-slate-400 text-sm">
                        {mapping.minValue} to {mapping.maxValue} dB
                      </span>
                    ) : (
                      <span className="text-slate-500 text-sm">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => startEditing(mapping)}
                        className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMapping(mapping.id)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
