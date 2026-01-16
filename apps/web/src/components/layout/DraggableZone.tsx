'use client'

/**
 * DraggableZone Component
 *
 * A draggable and resizable zone for the layout editor.
 * Supports mouse and touch interactions for repositioning and resizing TV zones.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { Tv, GripVertical } from 'lucide-react'

export interface Zone {
  id: string
  outputNumber: number
  x: number // percentage
  y: number // percentage
  width: number // percentage
  height: number // percentage
  label?: string
  confidence?: number
}

interface DraggableZoneProps {
  zone: Zone
  isSelected: boolean
  onSelect: (zone: Zone) => void
  onUpdate: (zone: Zone) => void
  containerRef: React.RefObject<HTMLDivElement>
  showResizeHandles?: boolean
}

type DragMode = 'none' | 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se'

export default function DraggableZone({
  zone,
  isSelected,
  onSelect,
  onUpdate,
  containerRef,
  showResizeHandles = true
}: DraggableZoneProps) {
  const [dragMode, setDragMode] = useState<DragMode>('none')
  const [isDragging, setIsDragging] = useState(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const startZoneRef = useRef({ x: zone.x, y: zone.y, width: zone.width, height: zone.height })

  // Minimum zone size (percentage)
  const MIN_SIZE = 3

  const getContainerRect = useCallback(() => {
    if (!containerRef.current) return null
    return containerRef.current.getBoundingClientRect()
  }, [containerRef])

  const pixelToPercent = useCallback((px: number, dimension: 'width' | 'height') => {
    const rect = getContainerRect()
    if (!rect) return 0
    return (px / (dimension === 'width' ? rect.width : rect.height)) * 100
  }, [getContainerRect])

  const handleDragStart = useCallback((
    e: React.MouseEvent | React.TouchEvent,
    mode: DragMode
  ) => {
    e.preventDefault()
    e.stopPropagation()

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    setDragMode(mode)
    setIsDragging(true)
    startPosRef.current = { x: clientX, y: clientY }
    startZoneRef.current = { x: zone.x, y: zone.y, width: zone.width, height: zone.height }
    onSelect(zone)
  }, [zone, onSelect])

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || dragMode === 'none') return

    const dx = pixelToPercent(clientX - startPosRef.current.x, 'width')
    const dy = pixelToPercent(clientY - startPosRef.current.y, 'height')

    let newX = startZoneRef.current.x
    let newY = startZoneRef.current.y
    let newWidth = startZoneRef.current.width
    let newHeight = startZoneRef.current.height

    if (dragMode === 'move') {
      newX = Math.max(0, Math.min(100 - zone.width, startZoneRef.current.x + dx))
      newY = Math.max(0, Math.min(100 - zone.height, startZoneRef.current.y + dy))
    } else if (dragMode === 'resize-se') {
      // Southeast corner - resize width and height
      newWidth = Math.max(MIN_SIZE, startZoneRef.current.width + dx)
      newHeight = Math.max(MIN_SIZE, startZoneRef.current.height + dy)
      // Clamp to container bounds
      newWidth = Math.min(newWidth, 100 - zone.x)
      newHeight = Math.min(newHeight, 100 - zone.y)
    } else if (dragMode === 'resize-sw') {
      // Southwest corner - move x, resize width and height
      const proposedX = startZoneRef.current.x + dx
      const proposedWidth = startZoneRef.current.width - dx
      if (proposedWidth >= MIN_SIZE && proposedX >= 0) {
        newX = proposedX
        newWidth = proposedWidth
      }
      newHeight = Math.max(MIN_SIZE, startZoneRef.current.height + dy)
      newHeight = Math.min(newHeight, 100 - zone.y)
    } else if (dragMode === 'resize-ne') {
      // Northeast corner - resize width, move y and resize height
      newWidth = Math.max(MIN_SIZE, startZoneRef.current.width + dx)
      newWidth = Math.min(newWidth, 100 - zone.x)
      const proposedY = startZoneRef.current.y + dy
      const proposedHeight = startZoneRef.current.height - dy
      if (proposedHeight >= MIN_SIZE && proposedY >= 0) {
        newY = proposedY
        newHeight = proposedHeight
      }
    } else if (dragMode === 'resize-nw') {
      // Northwest corner - move x/y, resize width/height
      const proposedX = startZoneRef.current.x + dx
      const proposedWidth = startZoneRef.current.width - dx
      const proposedY = startZoneRef.current.y + dy
      const proposedHeight = startZoneRef.current.height - dy
      if (proposedWidth >= MIN_SIZE && proposedX >= 0) {
        newX = proposedX
        newWidth = proposedWidth
      }
      if (proposedHeight >= MIN_SIZE && proposedY >= 0) {
        newY = proposedY
        newHeight = proposedHeight
      }
    }

    onUpdate({
      ...zone,
      x: Math.round(newX * 100) / 100,
      y: Math.round(newY * 100) / 100,
      width: Math.round(newWidth * 100) / 100,
      height: Math.round(newHeight * 100) / 100
    })
  }, [isDragging, dragMode, zone, pixelToPercent, onUpdate])

  const handleDragEnd = useCallback(() => {
    setDragMode('none')
    setIsDragging(false)
  }, [])

  // Global mouse/touch move and up handlers
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY)
      }
    }

    const handleMouseUp = () => handleDragEnd()
    const handleTouchEnd = () => handleDragEnd()

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  const resizeHandleClass = "absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-sm shadow-md z-10 hover:bg-blue-600 transition-colors"

  return (
    <div
      className={`absolute transition-shadow duration-200 ${
        isSelected
          ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900 shadow-lg shadow-blue-500/30'
          : 'hover:ring-2 hover:ring-blue-400/50'
      } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        left: `${zone.x}%`,
        top: `${zone.y}%`,
        width: `${zone.width}%`,
        height: `${zone.height}%`,
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(zone)
      }}
    >
      {/* Zone Content */}
      <div
        className={`w-full h-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all ${
          isSelected
            ? 'bg-blue-500/30 border-blue-400'
            : 'bg-slate-700/50 border-slate-500 hover:bg-slate-600/50 hover:border-slate-400'
        }`}
        onMouseDown={(e) => handleDragStart(e, 'move')}
        onTouchStart={(e) => handleDragStart(e, 'move')}
      >
        {/* TV Icon */}
        <Tv className={`w-6 h-6 sm:w-8 sm:h-8 ${isSelected ? 'text-blue-300' : 'text-slate-300'}`} />

        {/* Label */}
        <div className={`mt-1 px-2 py-0.5 rounded text-xs font-semibold truncate max-w-full ${
          isSelected ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200'
        }`}>
          {zone.label || `TV ${zone.outputNumber}`}
        </div>

        {/* Drag indicator */}
        {isSelected && (
          <div className="absolute top-1 left-1/2 -translate-x-1/2">
            <GripVertical className="w-4 h-4 text-blue-400/60" />
          </div>
        )}
      </div>

      {/* Resize Handles - Only show when selected and showResizeHandles is true */}
      {isSelected && showResizeHandles && (
        <>
          {/* NW Handle */}
          <div
            className={`${resizeHandleClass} -top-2 -left-2 cursor-nw-resize`}
            onMouseDown={(e) => handleDragStart(e, 'resize-nw')}
            onTouchStart={(e) => handleDragStart(e, 'resize-nw')}
          />
          {/* NE Handle */}
          <div
            className={`${resizeHandleClass} -top-2 -right-2 cursor-ne-resize`}
            onMouseDown={(e) => handleDragStart(e, 'resize-ne')}
            onTouchStart={(e) => handleDragStart(e, 'resize-ne')}
          />
          {/* SW Handle */}
          <div
            className={`${resizeHandleClass} -bottom-2 -left-2 cursor-sw-resize`}
            onMouseDown={(e) => handleDragStart(e, 'resize-sw')}
            onTouchStart={(e) => handleDragStart(e, 'resize-sw')}
          />
          {/* SE Handle */}
          <div
            className={`${resizeHandleClass} -bottom-2 -right-2 cursor-se-resize`}
            onMouseDown={(e) => handleDragStart(e, 'resize-se')}
            onTouchStart={(e) => handleDragStart(e, 'resize-se')}
          />
        </>
      )}
    </div>
  )
}
