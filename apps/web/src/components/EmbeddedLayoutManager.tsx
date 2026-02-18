'use client'

/**
 * Embedded Layout Manager
 *
 * Full layout management within System Admin - upload, edit zones, manage rooms
 */

import { useState, useEffect, useRef } from 'react'
import { Upload, Save, RefreshCw, Edit2, Eye, Trash2, Plus, Image } from 'lucide-react'
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

export default function EmbeddedLayoutManager() {
  const [layout, setLayout] = useState<Layout | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [matrixOutputs, setMatrixOutputs] = useState<Array<{ channelNumber: number; label: string }>>([])
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

  const handleCancelEdit = () => {
    setIsEditing(false)
    loadLayout() // Reload to discard changes
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
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-white">
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
