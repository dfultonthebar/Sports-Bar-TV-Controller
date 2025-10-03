
'use client'

import { useState, useEffect } from 'react'
import { 
  Plus, 
  Edit3, 
  Trash2, 
  GripVertical, 
  Save, 
  X,
  Tv,
  Radio,
  AlertCircle
} from 'lucide-react'

interface ChannelPreset {
  id: string
  name: string
  channelNumber: string
  deviceType: string
  order: number
  isActive: boolean
}

export default function ChannelPresetsPanel() {
  const [activeTab, setActiveTab] = useState<'cable' | 'directv'>('cable')
  const [presets, setPresets] = useState<ChannelPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    channelNumber: ''
  })

  useEffect(() => {
    fetchPresets()
  }, [activeTab])

  const fetchPresets = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/channel-presets?deviceType=${activeTab}`)
      const data = await response.json()
      
      if (data.success) {
        setPresets(data.presets)
      } else {
        setError(data.error || 'Failed to load presets')
      }
    } catch (err) {
      console.error('Error fetching presets:', err)
      setError('Failed to load channel presets')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setIsAdding(true)
    setFormData({ name: '', channelNumber: '' })
  }

  const handleEdit = (preset: ChannelPreset) => {
    setEditingId(preset.id)
    setFormData({
      name: preset.name,
      channelNumber: preset.channelNumber
    })
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    setFormData({ name: '', channelNumber: '' })
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.channelNumber.trim()) {
      alert('Please fill in all fields')
      return
    }

    try {
      if (isAdding) {
        // Create new preset
        const response = await fetch('/api/channel-presets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: formData.name.trim(),
            channelNumber: formData.channelNumber.trim(),
            deviceType: activeTab
          })
        })

        const data = await response.json()
        
        if (data.success) {
          await fetchPresets()
          handleCancel()
        } else {
          alert(data.error || 'Failed to create preset')
        }
      } else if (editingId) {
        // Update existing preset
        const response = await fetch(`/api/channel-presets/${editingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: formData.name.trim(),
            channelNumber: formData.channelNumber.trim()
          })
        })

        const data = await response.json()
        
        if (data.success) {
          await fetchPresets()
          handleCancel()
        } else {
          alert(data.error || 'Failed to update preset')
        }
      }
    } catch (err) {
      console.error('Error saving preset:', err)
      alert('Failed to save preset')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this preset?')) {
      return
    }

    try {
      const response = await fetch(`/api/channel-presets/${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      
      if (data.success) {
        await fetchPresets()
      } else {
        alert(data.error || 'Failed to delete preset')
      }
    } catch (err) {
      console.error('Error deleting preset:', err)
      alert('Failed to delete preset')
    }
  }

  const handleReorder = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = presets.findIndex(p => p.id === id)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= presets.length) return

    // Swap orders
    const currentPreset = presets[currentIndex]
    const swapPreset = presets[newIndex]

    try {
      // Update both presets
      await Promise.all([
        fetch(`/api/channel-presets/${currentPreset.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: swapPreset.order })
        }),
        fetch(`/api/channel-presets/${swapPreset.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: currentPreset.order })
        })
      ])

      await fetchPresets()
    } catch (err) {
      console.error('Error reordering presets:', err)
      alert('Failed to reorder presets')
    }
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Channel Presets</h2>
        <p className="text-gray-400">
          Manage quick-access channel presets for Cable Box and DirecTV inputs
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('cable')}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'cable'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Tv className="w-4 h-4" />
          Cable Box
        </button>
        <button
          onClick={() => setActiveTab('directv')}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'directv'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Radio className="w-4 h-4" />
          DirecTV
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Error loading presets</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Add Button */}
          {!isAdding && (
            <button
              onClick={handleAdd}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-3 flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Channel Preset
            </button>
          )}

          {/* Add Form */}
          {isAdding && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-white font-medium mb-3">New Preset</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Channel Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., ESPN, Fox Sports"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Channel Number
                  </label>
                  <input
                    type="text"
                    value={formData.channelNumber}
                    onChange={(e) => setFormData({ ...formData, channelNumber: e.target.value })}
                    placeholder="e.g., 206, 212"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Presets List */}
          {presets.length > 0 ? (
            <div className="space-y-2">
              {presets.map((preset, index) => (
                <div
                  key={preset.id}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                >
                  {editingId === preset.id ? (
                    // Edit Form
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">
                          Channel Name
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">
                          Channel Number
                        </label>
                        <input
                          type="text"
                          value={formData.channelNumber}
                          onChange={(e) => setFormData({ ...formData, channelNumber: e.target.value })}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors"
                        >
                          <Save className="w-4 h-4" />
                          Save
                        </button>
                        <button
                          onClick={handleCancel}
                          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Display Mode
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleReorder(preset.id, 'up')}
                          disabled={index === 0}
                          className="p-1 hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <GripVertical className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => handleReorder(preset.id, 'down')}
                          disabled={index === presets.length - 1}
                          className="p-1 hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <GripVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-medium">{preset.name}</div>
                        <div className="text-sm text-gray-400">Channel {preset.channelNumber}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(preset)}
                          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-4 h-4 text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleDelete(preset.id)}
                          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            !isAdding && (
              <div className="text-center py-12 text-gray-400">
                <p>No channel presets configured for {activeTab === 'cable' ? 'Cable Box' : 'DirecTV'}</p>
                <p className="text-sm mt-2">Click "Add Channel Preset" to get started</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
