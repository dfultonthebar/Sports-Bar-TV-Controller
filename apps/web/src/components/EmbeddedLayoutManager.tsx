'use client'

/**
 * Embedded Layout Manager
 *
 * Full layout management within System Admin - upload, edit zones, manage rooms
 */

import { useState, useEffect, useRef } from 'react'
import { Upload, Save, RefreshCw, Edit2, Eye, Trash2, Plus, Image, Home, X, Palette, Wand2, Bot, Cloud, Sparkles } from 'lucide-react'
import LayoutEditor from './layout/LayoutEditor'
import { type Zone, type Room } from './layout/DraggableZone'
import { logger } from '@sports-bar/logger'

interface Layout {
  name: string
  imageUrl?: string
  originalFileUrl?: string
  zones: Zone[]
  rooms?: Room[]
  imageWidth?: number
  imageHeight?: number
}

const ROOM_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
]

export default function EmbeddedLayoutManager() {
  const [layout, setLayout] = useState<Layout | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [matrixOutputs, setMatrixOutputs] = useState<Array<{ channelNumber: number; label: string }>>([])
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomColor, setNewRoomColor] = useState(ROOM_COLORS[0])
  const [showAddRoom, setShowAddRoom] = useState(false)
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null)
  const [enhancing, setEnhancing] = useState(false)
  const [enhanceProvider, setEnhanceProvider] = useState<'ollama' | 'claude' | 'none'>('ollama')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadLayout()
    loadMatrixOutputs()
  }, [])

  const loadLayout = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/bartender/layout')
      if (response.ok) {
        const data = await response.json()
        if (data.layout) {
          setLayout(data.layout)
        }
      }
    } catch (error) {
      logger.error('[EmbeddedLayoutManager] Error loading layout:', error)
      setMessage({ type: 'error', text: 'Failed to load layout' })
    } finally {
      setIsLoading(false)
    }
  }

  const loadMatrixOutputs = async () => {
    try {
      const response = await fetch('/api/matrix/config')
      if (response.ok) {
        const data = await response.json()
        if (data.outputs) {
          setMatrixOutputs(data.outputs)
        }
      }
    } catch (error) {
      logger.error('[EmbeddedLayoutManager] Error loading matrix outputs:', error)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('layout', file)
      formData.append('name', layout?.name || 'Bar Layout')
      formData.append('autoDetect', 'false')

      const response = await fetch('/api/bartender/layout/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      if (data.success) {
        // Update layout with new image, preserve existing zones and rooms
        setLayout(prev => ({
          ...prev,
          name: prev?.name || 'Bar Layout',
          zones: prev?.zones || [],
          rooms: prev?.rooms || [],
          imageUrl: data.layout.imageUrl,
          originalFileUrl: data.layout.imageUrl
        }))
        setMessage({ type: 'success', text: 'Image uploaded successfully!' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Upload failed' })
      }
    } catch (error) {
      logger.error('[EmbeddedLayoutManager] Upload error:', error)
      setMessage({ type: 'error', text: 'Failed to upload image' })
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  const handleSaveLayout = async (updatedLayout: Layout) => {
    setIsSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/bartender/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: updatedLayout })
      })

      if (response.ok) {
        setLayout(updatedLayout)
        setIsEditing(false)
        setMessage({ type: 'success', text: 'Layout saved successfully!' })
      } else {
        const data = await response.json()
        setMessage({ type: 'error', text: data.error || 'Failed to save layout' })
      }
    } catch (error) {
      logger.error('[EmbeddedLayoutManager] Save error:', error)
      setMessage({ type: 'error', text: 'Failed to save layout' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddRoom = async () => {
    if (!newRoomName.trim()) return

    const newRoom: Room = {
      id: `room-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: newRoomName.trim(),
      color: newRoomColor
    }

    const updatedLayout: Layout = {
      ...(layout || { name: 'Bar Layout', zones: [] }),
      rooms: [...(layout?.rooms || []), newRoom]
    }

    // Save immediately
    try {
      const response = await fetch('/api/bartender/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: updatedLayout })
      })

      if (response.ok) {
        setLayout(updatedLayout)
        setNewRoomName('')
        setNewRoomColor(ROOM_COLORS[(updatedLayout.rooms?.length || 0) % ROOM_COLORS.length])
        setShowAddRoom(false)
        setMessage({ type: 'success', text: `Room "${newRoom.name}" added!` })
      } else {
        setMessage({ type: 'error', text: 'Failed to save room' })
      }
    } catch (error) {
      logger.error('[EmbeddedLayoutManager] Error adding room:', error)
      setMessage({ type: 'error', text: 'Failed to add room' })
    }
  }

  const handleDeleteRoom = async (roomId: string) => {
    if (!layout) return

    const roomName = layout.rooms?.find(r => r.id === roomId)?.name || 'Unknown'

    // Remove room and unassign zones from this room
    const updatedLayout: Layout = {
      ...layout,
      rooms: (layout.rooms || []).filter(r => r.id !== roomId),
      zones: layout.zones.map(z => z.room === roomId ? { ...z, room: undefined } : z)
    }

    try {
      const response = await fetch('/api/bartender/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: updatedLayout })
      })

      if (response.ok) {
        setLayout(updatedLayout)
        setRoomToDelete(null)
        setMessage({ type: 'success', text: `Room "${roomName}" deleted. Its TV zones are now unassigned.` })
      } else {
        setMessage({ type: 'error', text: 'Failed to delete room' })
      }
    } catch (error) {
      logger.error('[EmbeddedLayoutManager] Error deleting room:', error)
      setMessage({ type: 'error', text: 'Failed to delete room' })
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    loadLayout() // Reload to discard changes
  }

  const handleEnhanceLayout = async () => {
    if (!layout?.imageUrl || !layout?.zones?.length) return

    setEnhancing(true)
    setMessage(null)

    try {
      const response = await fetch('/api/bartender/layout/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: enhanceProvider })
      })

      const data = await response.json()

      if (data.success) {
        // Update layout with professional image and save
        const updatedLayout = { ...layout, professionalImageUrl: data.professionalImageUrl }
        await handleSaveLayout(updatedLayout as Layout)
        // Enter edit mode so user can adjust zone positions on the new clean floor plan
        setIsEditing(true)
        setMessage({
          type: 'success',
          text: `Professional floor plan generated! Opening editor — drag TV zones to their correct positions.`
        })
      } else {
        setMessage({ type: 'error', text: data.error || 'Enhancement failed' })
      }
    } catch (error) {
      logger.error('[EmbeddedLayoutManager] Enhance error:', error)
      setMessage({ type: 'error', text: 'Failed to enhance layout' })
    } finally {
      setEnhancing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
        <span className="ml-3 text-slate-300">Loading layout...</span>
      </div>
    )
  }

  // Editing mode - show full editor
  if (isEditing && layout) {
    return (
      <div className="h-[800px]">
        <LayoutEditor
          layout={layout}
          onSave={handleSaveLayout}
          onCancel={handleCancelEdit}
          matrixOutputs={matrixOutputs}
        />
      </div>
    )
  }

  // View mode - show layout summary and controls
  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
          {message.text}
        </div>
      )}

      {/* Upload Section */}
      <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Upload Floor Plan
        </h3>
        <p className="text-slate-300 text-sm mb-4">
          Upload a new floor plan image (PNG, SVG, JPG). Your existing TV zones will be preserved.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.svg"
          onChange={handleFileUpload}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          {isUploading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Choose Image
            </>
          )}
        </button>
      </div>

      {/* AI Enhance Section */}
      {layout?.imageUrl && layout?.zones?.length > 0 && (
        <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-400" />
            AI Layout Enhancement
          </h3>
          <p className="text-slate-400 text-sm mb-4">
            Generate a professional floor plan using AI to analyze your layout image and identify rooms
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setEnhanceProvider('ollama')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                enhanceProvider === 'ollama'
                  ? 'bg-purple-600/30 border border-purple-500 text-purple-200'
                  : 'bg-slate-700/50 border border-slate-600 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Bot className="w-4 h-4" />
              Ollama (Local)
            </button>
            <button
              onClick={() => setEnhanceProvider('claude')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                enhanceProvider === 'claude'
                  ? 'bg-blue-600/30 border border-blue-500 text-blue-200'
                  : 'bg-slate-700/50 border border-slate-600 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Cloud className="w-4 h-4" />
              Claude (Cloud)
            </button>
            <button
              onClick={() => setEnhanceProvider('none')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                enhanceProvider === 'none'
                  ? 'bg-slate-600/30 border border-slate-500 text-slate-200'
                  : 'bg-slate-700/50 border border-slate-600 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Basic (No AI)
            </button>
          </div>

          <button
            onClick={handleEnhanceLayout}
            disabled={enhancing}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {enhancing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate Professional Layout
              </>
            )}
          </button>

          {(layout as any).professionalImageUrl && (
            <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Professional layout active — bartender remote will use the enhanced version
            </div>
          )}
        </div>
      )}

      {/* Room Management */}
      <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Home className="w-5 h-5 text-blue-400" />
            Room Management
          </h3>
          {!showAddRoom && (
            <button
              onClick={() => {
                setShowAddRoom(true)
                setNewRoomColor(ROOM_COLORS[(layout?.rooms?.length || 0) % ROOM_COLORS.length])
              }}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Room
            </button>
          )}
        </div>

        <p className="text-slate-400 text-sm mb-4">
          Create rooms to organize your TV zones (e.g., Main Bar, Patio, VIP Room). Zones can be assigned to rooms in the layout editor.
        </p>

        {/* Add Room Form */}
        {showAddRoom && (
          <div className="mb-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
            <h4 className="text-sm font-medium text-white mb-3">New Room</h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Room Name</label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g., Main Bar, Patio, VIP Room"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRoom()}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1">
                  <Palette className="w-3 h-3" /> Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {ROOM_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewRoomColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        newRoomColor === color ? 'border-white scale-110' : 'border-transparent hover:border-slate-400'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleAddRoom}
                  disabled={!newRoomName.trim()}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/30 disabled:text-green-400/50 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Room
                </button>
                <button
                  onClick={() => { setShowAddRoom(false); setNewRoomName('') }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Room List */}
        {layout?.rooms && layout.rooms.length > 0 ? (
          <div className="space-y-2">
            {layout.rooms.map(room => {
              const zoneCount = layout.zones?.filter(z => z.room === room.id).length || 0
              return (
                <div
                  key={room.id}
                  className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/50 hover:border-slate-500/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: room.color }}
                    />
                    <div>
                      <span className="text-white font-medium">{room.name}</span>
                      <span className="text-slate-400 text-sm ml-2">({zoneCount} TV{zoneCount !== 1 ? 's' : ''})</span>
                    </div>
                  </div>
                  {roomToDelete === room.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-400">Delete?</span>
                      <button
                        onClick={() => handleDeleteRoom(room.id)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-sm text-xs"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setRoomToDelete(null)}
                        className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded-sm text-xs"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRoomToDelete(room.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-sm transition-colors"
                      title={`Delete ${room.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-500">
            <Home className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No rooms created yet</p>
            <p className="text-xs mt-1">Add a room to organize your TV zones</p>
          </div>
        )}
      </div>

      {/* Current Layout Preview */}
      {layout && (
        <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Image className="w-5 h-5" />
              Current Layout: {layout.name}
            </h3>
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Edit Layout
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-slate-700/50 rounded-lg text-center">
              <div className="text-2xl font-bold text-white">{layout.zones?.length || 0}</div>
              <div className="text-sm text-slate-400">TV Zones</div>
            </div>
            <div className="p-4 bg-slate-700/50 rounded-lg text-center">
              <div className="text-2xl font-bold text-white">{layout.rooms?.length || 0}</div>
              <div className="text-sm text-slate-400">Rooms</div>
            </div>
            <div className="p-4 bg-slate-700/50 rounded-lg text-center">
              <div className="text-2xl font-bold text-white">{layout.imageUrl ? 'Yes' : 'No'}</div>
              <div className="text-sm text-slate-400">Floor Plan</div>
            </div>
            <div className="p-4 bg-slate-700/50 rounded-lg text-center">
              <div className="text-2xl font-bold text-white">{matrixOutputs.length}</div>
              <div className="text-sm text-slate-400">Matrix Outputs</div>
            </div>
          </div>

          {/* Rooms List */}
          {layout.rooms && layout.rooms.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-slate-300 mb-2">Rooms:</h4>
              <div className="flex flex-wrap gap-2">
                {layout.rooms.map(room => {
                  const zoneCount = layout.zones?.filter(z => z.room === room.id).length || 0
                  return (
                    <div
                      key={room.id}
                      className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-2"
                      style={{ backgroundColor: `${room.color}30`, borderColor: room.color, borderWidth: 1 }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: room.color }} />
                      {room.name} ({zoneCount} TVs)
                      {room.imageUrl && <Image className="w-3 h-3 opacity-60" />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Image Preview */}
          {layout.imageUrl && (
            <div className="relative rounded-lg overflow-hidden border border-slate-600 bg-slate-900">
              <img
                src={layout.imageUrl}
                alt="Floor plan preview"
                className="w-full h-auto max-h-[400px] object-contain"
              />
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded-sm text-xs text-white">
                {layout.zones?.length || 0} zones configured
              </div>
            </div>
          )}

          {!layout.imageUrl && (
            <div className="p-12 bg-slate-700/30 rounded-lg border border-dashed border-slate-600 text-center">
              <Image className="w-16 h-16 mx-auto mb-4 text-slate-500" />
              <p className="text-slate-400">No floor plan uploaded yet</p>
              <p className="text-sm text-slate-500 mt-1">Upload an image above to get started</p>
            </div>
          )}
        </div>
      )}

      {/* Quick Tips */}
      <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <h4 className="text-sm font-medium text-slate-300 mb-2">Quick Tips:</h4>
        <ul className="text-xs text-slate-400 space-y-1">
          <li>• Click "Edit Layout" to drag and resize TV zones</li>
          <li>• Each room can have its own floor plan image</li>
          <li>• Changes appear immediately on the /remote page</li>
          <li>• SVG files are supported for crisp display at any zoom level</li>
        </ul>
      </div>
    </div>
  )
}
