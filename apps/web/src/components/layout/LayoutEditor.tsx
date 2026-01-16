'use client'

/**
 * LayoutEditor Component
 *
 * Main container for editing TV zone layouts. Provides:
 * - Draggable/resizable zones on top of the floor plan image
 * - Properties panel for fine-tuning zone settings
 * - Save/cancel workflow with API integration
 * - Zoom and pan controls for large floor plans
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Save,
  X,
  RotateCcw,
  ChevronLeft,
  Grid3X3,
  Eye,
  EyeOff
} from 'lucide-react'
import DraggableZone, { type Zone } from './DraggableZone'
import ZonePropertiesPanel from './ZonePropertiesPanel'
import LayoutZoomControls from './LayoutZoomControls'
import { logger } from '@sports-bar/logger'

interface TVLayout {
  id?: string
  name: string
  imageUrl?: string
  originalFileUrl?: string
  zones: Zone[]
}

interface LayoutEditorProps {
  layout: TVLayout
  onSave: (layout: TVLayout) => Promise<void>
  onCancel: () => void
  matrixOutputs?: Array<{ channelNumber: number; label: string }>
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.0

export default function LayoutEditor({
  layout,
  onSave,
  onCancel,
  matrixOutputs = []
}: LayoutEditorProps) {
  // Working copy of zones for editing
  const [zones, setZones] = useState<Zone[]>([...layout.zones])
  const [originalZones] = useState<Zone[]>([...layout.zones])
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(true)
  const [hasChanges, setHasChanges] = useState(false)

  // Zoom and pan state
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [isPanDragging, setIsPanDragging] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const panOffsetStartRef = useRef({ x: 0, y: 0 })

  // Pinch-to-zoom state
  const lastPinchDistanceRef = useRef<number | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasWrapperRef = useRef<HTMLDivElement>(null)

  // Track changes
  useEffect(() => {
    const zonesChanged = JSON.stringify(zones) !== JSON.stringify(originalZones)
    setHasChanges(zonesChanged)
  }, [zones, originalZones])

  // Reset zoom and pan
  const handleZoomReset = useCallback(() => {
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
  }, [])

  // Pan mode toggle
  const handlePanToggle = useCallback(() => {
    setIsPanning(prev => !prev)
    setSelectedZone(null) // Deselect when entering pan mode
  }, [])

  // Pan drag handlers
  const handlePanStart = useCallback((clientX: number, clientY: number) => {
    if (!isPanning) return
    setIsPanDragging(true)
    panStartRef.current = { x: clientX, y: clientY }
    panOffsetStartRef.current = { ...panOffset }
  }, [isPanning, panOffset])

  const handlePanMove = useCallback((clientX: number, clientY: number) => {
    if (!isPanDragging) return
    const dx = clientX - panStartRef.current.x
    const dy = clientY - panStartRef.current.y
    setPanOffset({
      x: panOffsetStartRef.current.x + dx,
      y: panOffsetStartRef.current.y + dy
    })
  }, [isPanDragging])

  const handlePanEnd = useCallback(() => {
    setIsPanDragging(false)
  }, [])

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)))
    }
  }, [])

  // Pinch-to-zoom handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      lastPinchDistanceRef.current = distance
    } else if (e.touches.length === 1 && isPanning) {
      handlePanStart(e.touches[0].clientX, e.touches[0].clientY)
    }
  }, [isPanning, handlePanStart])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDistanceRef.current !== null) {
      e.preventDefault()
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const delta = (distance - lastPinchDistanceRef.current) * 0.005
      setZoom(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)))
      lastPinchDistanceRef.current = distance
    } else if (e.touches.length === 1 && isPanDragging) {
      handlePanMove(e.touches[0].clientX, e.touches[0].clientY)
    }
  }, [isPanDragging, handlePanMove])

  const handleTouchEnd = useCallback(() => {
    lastPinchDistanceRef.current = null
    handlePanEnd()
  }, [handlePanEnd])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle when not in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      const panStep = 50
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          setPanOffset(prev => ({ ...prev, y: prev.y + panStep }))
          break
        case 'ArrowDown':
          e.preventDefault()
          setPanOffset(prev => ({ ...prev, y: prev.y - panStep }))
          break
        case 'ArrowLeft':
          e.preventDefault()
          setPanOffset(prev => ({ ...prev, x: prev.x + panStep }))
          break
        case 'ArrowRight':
          e.preventDefault()
          setPanOffset(prev => ({ ...prev, x: prev.x - panStep }))
          break
        case '+':
        case '=':
          e.preventDefault()
          setZoom(prev => Math.min(MAX_ZOOM, prev + 0.1))
          break
        case '-':
        case '_':
          e.preventDefault()
          setZoom(prev => Math.max(MIN_ZOOM, prev - 0.1))
          break
        case '0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            handleZoomReset()
          }
          break
        case 'Escape':
          if (isPanning) {
            setIsPanning(false)
          } else if (selectedZone) {
            setSelectedZone(null)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPanning, selectedZone, handleZoomReset])

  // Global mouse move/up for panning
  useEffect(() => {
    if (!isPanDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      handlePanMove(e.clientX, e.clientY)
    }

    const handleMouseUp = () => {
      handlePanEnd()
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isPanDragging, handlePanMove, handlePanEnd])

  const handleZoneUpdate = useCallback((updatedZone: Zone) => {
    setZones(prev => prev.map(z => z.id === updatedZone.id ? updatedZone : z))
    setSelectedZone(updatedZone)
  }, [])

  const handleZoneSelect = useCallback((zone: Zone) => {
    setSelectedZone(zone)
    setShowPropertiesPanel(true)
  }, [])

  const handleDeleteZone = useCallback((zoneId: string) => {
    setZones(prev => prev.filter(z => z.id !== zoneId))
    if (selectedZone?.id === zoneId) {
      setSelectedZone(null)
    }
  }, [selectedZone])

  const handleAddZone = useCallback(() => {
    // Find the next available output number
    const usedNumbers = new Set(zones.map(z => z.outputNumber))
    let nextNumber = 1
    while (usedNumbers.has(nextNumber) && nextNumber <= 36) {
      nextNumber++
    }

    const newZone: Zone = {
      id: `zone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      outputNumber: nextNumber,
      x: 40 + (Math.random() * 20), // Random position in center-ish area
      y: 40 + (Math.random() * 20),
      width: 8,
      height: 8,
      label: `TV ${String(nextNumber).padStart(2, '0')}`
    }

    setZones(prev => [...prev, newZone])
    setSelectedZone(newZone)
    setShowPropertiesPanel(true)
  }, [zones])

  const handleReset = useCallback(() => {
    if (confirm('Reset all changes? This will revert to the original layout.')) {
      setZones([...originalZones])
      setSelectedZone(null)
    }
  }, [originalZones])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave({
        ...layout,
        zones
      })
    } catch (error) {
      logger.error('[LayoutEditor] Save failed:', error)
      alert('Failed to save layout. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (hasChanges) {
      if (!confirm('Discard unsaved changes?')) {
        return
      }
    }
    onCancel()
  }

  const handleContainerClick = (e: React.MouseEvent) => {
    // Don't deselect when in pan mode
    if (isPanning) return

    // Deselect zone when clicking on empty space
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('layout-background')) {
      setSelectedZone(null)
    }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (isPanning) {
      e.preventDefault()
      handlePanStart(e.clientX, e.clientY)
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
      {/* Toolbar */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleCancel}
            className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <div className="h-6 w-px bg-slate-700" />
          <h2 className="text-lg font-semibold text-white">Edit Layout: {layout.name}</h2>
          {hasChanges && (
            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
              Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Toggle Grid */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-2 rounded-lg transition-colors ${
              showGrid ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            title="Toggle grid"
          >
            <Grid3X3 className="w-5 h-5" />
          </button>

          {/* Toggle Properties Panel */}
          <button
            onClick={() => setShowPropertiesPanel(!showPropertiesPanel)}
            className={`p-2 rounded-lg transition-colors ${
              showPropertiesPanel ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            title="Toggle properties panel"
          >
            {showPropertiesPanel ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </button>

          <div className="h-6 w-px bg-slate-700" />

          {/* Reset */}
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>

          {/* Cancel */}
          <button
            onClick={handleCancel}
            className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Cancel</span>
          </button>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Layout'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Layout Canvas */}
        <div className="flex-1 p-4 overflow-hidden relative">
          {/* Canvas Wrapper with zoom/pan */}
          <div
            ref={canvasWrapperRef}
            className={`relative w-full h-full overflow-hidden rounded-xl border border-slate-600 bg-slate-800 ${
              isPanning ? 'cursor-grab' : ''
            } ${isPanDragging ? 'cursor-grabbing' : ''}`}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleCanvasMouseDown}
            style={{ touchAction: 'none' }}
          >
            {/* Zoomable/Pannable Content */}
            <div
              ref={containerRef}
              className="absolute inset-0 origin-center transition-transform duration-75"
              style={{
                transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
              }}
              onClick={handleContainerClick}
            >
              {/* Background Image */}
              {layout.imageUrl && (
                <img
                  src={layout.imageUrl}
                  alt="Floor plan"
                  className="absolute inset-0 w-full h-full object-contain layout-background opacity-50"
                  draggable={false}
                />
              )}

              {/* Grid Overlay */}
              {showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, rgba(59, 130, 246, 0.1) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '10% 10%'
                  }}
                />
              )}

              {/* Draggable Zones */}
              {zones.map(zone => (
                <DraggableZone
                  key={zone.id}
                  zone={zone}
                  isSelected={selectedZone?.id === zone.id}
                  onSelect={isPanning ? () => {} : handleZoneSelect}
                  onUpdate={handleZoneUpdate}
                  containerRef={containerRef}
                  showResizeHandles={!isPanning}
                />
              ))}

              {/* Empty State */}
              {zones.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-slate-400">
                    <Grid3X3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No zones configured</p>
                    <p className="text-sm mt-1">Click "Add New Zone" to get started</p>
                  </div>
                </div>
              )}
            </div>

            {/* Zoom Controls */}
            <LayoutZoomControls
              zoom={zoom}
              onZoomChange={setZoom}
              onReset={handleZoomReset}
              isPanning={isPanning}
              onPanToggle={handlePanToggle}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
            />
          </div>

          {/* Instructions */}
          <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <h4 className="text-sm font-medium text-slate-300 mb-2">Editing Tips:</h4>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>- Click and drag a zone to move it</li>
              <li>- Use corner handles to resize a selected zone</li>
              <li>- Click on empty space to deselect</li>
              <li>- Use the properties panel to fine-tune values</li>
              <li>- Use Ctrl+scroll or pinch to zoom, arrow keys to pan</li>
              <li>- Press Escape to exit pan mode or deselect</li>
            </ul>
          </div>
        </div>

        {/* Properties Panel */}
        {showPropertiesPanel && (
          <div className="w-80 border-l border-slate-700 overflow-auto p-4">
            <ZonePropertiesPanel
              selectedZone={selectedZone}
              zones={zones}
              onUpdateZone={handleZoneUpdate}
              onDeleteZone={handleDeleteZone}
              onAddZone={handleAddZone}
              onClose={() => setShowPropertiesPanel(false)}
              matrixOutputs={matrixOutputs}
            />
          </div>
        )}
      </div>
    </div>
  )
}
