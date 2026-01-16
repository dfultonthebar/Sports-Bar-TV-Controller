'use client'

/**
 * LayoutManager Component
 *
 * A panel for managing bar layouts - create new, rename, delete,
 * set default, and reorder layouts.
 */

import { useState } from 'react'
import {
  Plus,
  Trash2,
  Star,
  Edit3,
  GripVertical,
  Check,
  X,
  MapPin,
  Settings
} from 'lucide-react'
import { logger } from '@sports-bar/logger'

export interface LayoutInfo {
  id: string
  name: string
  description?: string | null
  imageUrl?: string | null
  isDefault: boolean
  isActive: boolean
  displayOrder: number
  zones: Array<{
    id: string
    outputNumber: number
    x: number
    y: number
    width: number
    height: number
    label?: string
  }>
  createdAt: string
  updatedAt: string
}

interface LayoutManagerProps {
  layouts: LayoutInfo[]
  onLayoutsChange: () => void
  onLayoutSelect?: (layout: LayoutInfo) => void
  selectedLayoutId?: string | null
}

export default function LayoutManager({
  layouts,
  onLayoutsChange,
  onLayoutSelect,
  selectedLayoutId
}: LayoutManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const handleSetDefault = async (layoutId: string) => {
    try {
      const response = await fetch(`/api/layouts/${layoutId}/set-default`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to set default layout')
      }

      onLayoutsChange()
    } catch (error) {
      logger.error('[LayoutManager] Failed to set default:', error)
      alert('Failed to set default layout')
    }
  }

  const handleRename = async (layoutId: string) => {
    if (!editName.trim()) {
      setEditingId(null)
      return
    }

    try {
      const response = await fetch(`/api/layouts/${layoutId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      })

      if (!response.ok) {
        throw new Error('Failed to rename layout')
      }

      setEditingId(null)
      onLayoutsChange()
    } catch (error) {
      logger.error('[LayoutManager] Failed to rename:', error)
      alert('Failed to rename layout')
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) {
      setIsCreating(false)
      return
    }

    try {
      const response = await fetch('/api/layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          zones: [],
          isDefault: layouts.length === 0,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create layout')
      }

      setIsCreating(false)
      setNewName('')
      onLayoutsChange()
    } catch (error) {
      logger.error('[LayoutManager] Failed to create:', error)
      alert('Failed to create layout')
    }
  }

  const handleDelete = async (layoutId: string) => {
    try {
      const response = await fetch(`/api/layouts/${layoutId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete layout')
      }

      setIsDeleting(null)
      onLayoutsChange()
    } catch (error) {
      logger.error('[LayoutManager] Failed to delete:', error)
      alert('Failed to delete layout')
    }
  }

  const startEditing = (layout: LayoutInfo) => {
    setEditingId(layout.id)
    setEditName(layout.name)
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-white" />
          <h3 className="font-semibold text-white">Layout Manager</h3>
        </div>
        <span className="text-sm text-indigo-200">{layouts.length} layout{layouts.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Layout List */}
      <div className="divide-y divide-slate-700">
        {layouts.map(layout => (
          <div
            key={layout.id}
            className={`flex items-center gap-3 px-4 py-3 transition-colors ${
              selectedLayoutId === layout.id ? 'bg-slate-700/50' : 'hover:bg-slate-700/30'
            }`}
          >
            {/* Drag Handle */}
            <GripVertical className="w-4 h-4 text-slate-500 cursor-grab" />

            {/* Layout Icon */}
            <MapPin className={`w-4 h-4 ${selectedLayoutId === layout.id ? 'text-blue-400' : 'text-slate-400'}`} />

            {/* Name / Edit */}
            <div className="flex-1 min-w-0">
              {editingId === layout.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(layout.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="flex-1 px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={() => handleRename(layout.id)}
                    className="p-1 text-green-400 hover:bg-green-400/20 rounded"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1 text-slate-400 hover:bg-slate-600 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  className="cursor-pointer"
                  onClick={() => onLayoutSelect?.(layout)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white truncate">{layout.name}</span>
                    {layout.isDefault && (
                      <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{layout.zones.length} TV zones</p>
                </div>
              )}
            </div>

            {/* Actions */}
            {editingId !== layout.id && isDeleting !== layout.id && (
              <div className="flex items-center gap-1">
                {!layout.isDefault && (
                  <button
                    onClick={() => handleSetDefault(layout.id)}
                    className="p-1.5 text-slate-400 hover:text-yellow-400 hover:bg-slate-600 rounded transition-colors"
                    title="Set as default"
                  >
                    <Star className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => startEditing(layout)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
                  title="Rename"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsDeleting(layout.id)}
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Delete Confirmation */}
            {isDeleting === layout.id && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-400">Delete?</span>
                <button
                  onClick={() => handleDelete(layout.id)}
                  className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-500"
                >
                  Yes
                </button>
                <button
                  onClick={() => setIsDeleting(null)}
                  className="px-2 py-1 bg-slate-600 text-white text-xs rounded hover:bg-slate-500"
                >
                  No
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Create New Layout */}
        {isCreating ? (
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-700/30">
            <Plus className="w-4 h-4 text-green-400" />
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') {
                  setIsCreating(false)
                  setNewName('')
                }
              }}
              placeholder="Layout name..."
              className="flex-1 px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              autoFocus
            />
            <button
              onClick={handleCreate}
              className="p-1 text-green-400 hover:bg-green-400/20 rounded"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setIsCreating(false)
                setNewName('')
              }}
              className="p-1 text-slate-400 hover:bg-slate-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-green-400 hover:bg-slate-700/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="font-medium">Create New Layout</span>
          </button>
        )}
      </div>

      {/* Help Text */}
      {layouts.length === 0 && (
        <div className="px-4 py-6 text-center">
          <MapPin className="w-12 h-12 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400 text-sm">No layouts configured yet.</p>
          <p className="text-slate-500 text-xs mt-1">
            Create your first layout to get started.
          </p>
        </div>
      )}
    </div>
  )
}
