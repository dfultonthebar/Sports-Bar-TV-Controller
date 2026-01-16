'use client'

/**
 * LayoutZoomControls Component
 *
 * Floating controls for zooming and panning the layout editor.
 * Supports zoom slider, buttons, and reset functionality.
 */

import { ZoomIn, ZoomOut, Maximize, Move } from 'lucide-react'

interface LayoutZoomControlsProps {
  zoom: number
  onZoomChange: (zoom: number) => void
  onReset: () => void
  isPanning: boolean
  onPanToggle: () => void
  minZoom?: number
  maxZoom?: number
}

export default function LayoutZoomControls({
  zoom,
  onZoomChange,
  onReset,
  isPanning,
  onPanToggle,
  minZoom = 0.5,
  maxZoom = 2
}: LayoutZoomControlsProps) {
  const zoomPercent = Math.round(zoom * 100)
  const step = 0.1

  const handleZoomIn = () => {
    const newZoom = Math.min(maxZoom, zoom + step)
    onZoomChange(Math.round(newZoom * 10) / 10)
  }

  const handleZoomOut = () => {
    const newZoom = Math.max(minZoom, zoom - step)
    onZoomChange(Math.round(newZoom * 10) / 10)
  }

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onZoomChange(parseFloat(e.target.value))
  }

  return (
    <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-slate-800/95 backdrop-blur-sm rounded-xl p-2 shadow-xl border border-slate-700 z-20">
      {/* Pan Mode Toggle */}
      <button
        onClick={onPanToggle}
        className={`p-2 rounded-lg transition-colors ${
          isPanning
            ? 'bg-blue-600 text-white'
            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
        }`}
        title={isPanning ? 'Pan mode active (drag to move)' : 'Enable pan mode'}
      >
        <Move className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-slate-600" />

      {/* Zoom Out Button */}
      <button
        onClick={handleZoomOut}
        disabled={zoom <= minZoom}
        className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Zoom out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      {/* Zoom Slider */}
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={minZoom}
          max={maxZoom}
          step={0.05}
          value={zoom}
          onChange={handleSliderChange}
          className="w-24 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-blue-500
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:hover:bg-blue-400
            [&::-webkit-slider-thumb]:transition-colors"
          title={`Zoom: ${zoomPercent}%`}
        />
        <span className="text-xs text-slate-400 w-10 text-center font-mono">
          {zoomPercent}%
        </span>
      </div>

      {/* Zoom In Button */}
      <button
        onClick={handleZoomIn}
        disabled={zoom >= maxZoom}
        className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Zoom in"
      >
        <ZoomIn className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-slate-600" />

      {/* Reset Button */}
      <button
        onClick={onReset}
        className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
        title="Reset zoom and position"
      >
        <Maximize className="w-4 h-4" />
      </button>
    </div>
  )
}
