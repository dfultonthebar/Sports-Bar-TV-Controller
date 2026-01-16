'use client'

/**
 * ZonePropertiesPanel Component
 *
 * A side panel for editing zone properties including label, output number,
 * position, and size. Also supports adding new zones and deleting existing ones.
 */

import { useState, useEffect } from 'react'
import {
  Settings,
  Trash2,
  Plus,
  X,
  Move,
  Maximize2,
  Hash,
  Tag
} from 'lucide-react'
import type { Zone } from './DraggableZone'

interface ZonePropertiesPanelProps {
  selectedZone: Zone | null
  zones: Zone[]
  onUpdateZone: (zone: Zone) => void
  onDeleteZone: (zoneId: string) => void
  onAddZone: () => void
  onClose: () => void
  matrixOutputs?: Array<{ channelNumber: number; label: string }>
}

export default function ZonePropertiesPanel({
  selectedZone,
  zones,
  onUpdateZone,
  onDeleteZone,
  onAddZone,
  onClose,
  matrixOutputs = []
}: ZonePropertiesPanelProps) {
  const [label, setLabel] = useState('')
  const [outputNumber, setOutputNumber] = useState(1)
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [width, setWidth] = useState(5)
  const [height, setHeight] = useState(5)

  // Update local state when selected zone changes
  useEffect(() => {
    if (selectedZone) {
      setLabel(selectedZone.label || '')
      setOutputNumber(selectedZone.outputNumber)
      setX(Math.round(selectedZone.x * 10) / 10)
      setY(Math.round(selectedZone.y * 10) / 10)
      setWidth(Math.round(selectedZone.width * 10) / 10)
      setHeight(Math.round(selectedZone.height * 10) / 10)
    }
  }, [selectedZone])

  const handleUpdate = (field: string, value: string | number) => {
    if (!selectedZone) return

    const updates: Partial<Zone> = {}

    switch (field) {
      case 'label':
        updates.label = value as string
        setLabel(value as string)
        break
      case 'outputNumber':
        updates.outputNumber = Number(value)
        setOutputNumber(Number(value))
        break
      case 'x':
        updates.x = Math.max(0, Math.min(100 - width, Number(value)))
        setX(updates.x)
        break
      case 'y':
        updates.y = Math.max(0, Math.min(100 - height, Number(value)))
        setY(updates.y)
        break
      case 'width':
        updates.width = Math.max(3, Math.min(100 - x, Number(value)))
        setWidth(updates.width)
        break
      case 'height':
        updates.height = Math.max(3, Math.min(100 - y, Number(value)))
        setHeight(updates.height)
        break
    }

    onUpdateZone({ ...selectedZone, ...updates })
  }

  const handleDelete = () => {
    if (!selectedZone) return
    if (confirm(`Delete zone "${selectedZone.label || `TV ${selectedZone.outputNumber}`}"?`)) {
      onDeleteZone(selectedZone.id)
    }
  }

  // Get available output numbers (not already used by other zones)
  const usedOutputNumbers = new Set(zones.map(z => z.outputNumber))
  const availableOutputs = matrixOutputs.length > 0
    ? matrixOutputs.filter(o => !usedOutputNumbers.has(o.channelNumber) || selectedZone?.outputNumber === o.channelNumber)
    : Array.from({ length: 36 }, (_, i) => ({
        channelNumber: i + 1,
        label: `Output ${i + 1}`
      })).filter(o => !usedOutputNumbers.has(o.channelNumber) || selectedZone?.outputNumber === o.channelNumber)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-xl w-72 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5 text-white" />
          <h3 className="font-semibold text-white">Zone Properties</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/20 rounded transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {selectedZone ? (
          <>
            {/* Label */}
            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-300">
                <Tag className="w-4 h-4 mr-2" />
                Label
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => handleUpdate('label', e.target.value)}
                placeholder="e.g., Bar TV 1"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Output Number */}
            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-300">
                <Hash className="w-4 h-4 mr-2" />
                Output Number
              </label>
              <select
                value={outputNumber}
                onChange={(e) => handleUpdate('outputNumber', e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableOutputs.map((output) => (
                  <option key={output.channelNumber} value={output.channelNumber}>
                    {output.channelNumber} - {output.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Position */}
            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-300">
                <Move className="w-4 h-4 mr-2" />
                Position (%)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">X</label>
                  <input
                    type="number"
                    value={x}
                    onChange={(e) => handleUpdate('x', e.target.value)}
                    min={0}
                    max={100 - width}
                    step={0.5}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Y</label>
                  <input
                    type="number"
                    value={y}
                    onChange={(e) => handleUpdate('y', e.target.value)}
                    min={0}
                    max={100 - height}
                    step={0.5}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Size */}
            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-300">
                <Maximize2 className="w-4 h-4 mr-2" />
                Size (%)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Width</label>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => handleUpdate('width', e.target.value)}
                    min={3}
                    max={100 - x}
                    step={0.5}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Height</label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => handleUpdate('height', e.target.value)}
                    min={3}
                    max={100 - y}
                    step={0.5}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Delete Button */}
            <button
              onClick={handleDelete}
              className="w-full mt-4 px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg hover:bg-red-600/30 transition-colors flex items-center justify-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Zone</span>
            </button>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="bg-slate-700/50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Settings className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-400 text-sm mb-2">No zone selected</p>
            <p className="text-slate-500 text-xs">Click on a zone to edit its properties</p>
          </div>
        )}

        {/* Add New Zone Button */}
        <div className="pt-4 border-t border-slate-700">
          <button
            onClick={onAddZone}
            className="w-full px-4 py-2 bg-green-600/20 text-green-400 border border-green-600/30 rounded-lg hover:bg-green-600/30 transition-colors flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Zone</span>
          </button>
        </div>

        {/* Zone Count */}
        <div className="text-center text-xs text-slate-500">
          {zones.length} zone{zones.length !== 1 ? 's' : ''} configured
        </div>
      </div>
    </div>
  )
}
