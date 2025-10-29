'use client'

/**
 * TV Layout Editor
 *
 * Upload layout images and edit TV zone positions
 */

import { useState, useRef, useEffect } from 'react'
import { Upload, Scan, Save, RefreshCw, Download, Trash2, Move, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Zone {
  id: string
  outputNumber: number
  x: number
  y: number
  width: number
  height: number
  label: string
  confidence?: number
}

interface Layout {
  name: string
  imageUrl?: string
  originalFileUrl?: string
  zones: Zone[]
  imageWidth?: number
  imageHeight?: number
}

export default function LayoutEditorPage() {
  const [layout, setLayout] = useState<Layout>({
    name: 'Bar Layout',
    zones: []
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Zone editing state
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [editMode, setEditMode] = useState<'select' | 'draw' | 'move'>('select')
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    loadCurrentLayout()
  }, [])

  const loadCurrentLayout = async () => {
    try {
      const response = await fetch('/api/bartender/layout')
      if (response.ok) {
        const data = await response.json()
        if (data.layout) {
          setLayout(data.layout)
          if (data.layout.imageUrl) {
            setPreviewUrl(data.layout.imageUrl)
          }
        }
      }
    } catch (error) {
      console.error('Error loading layout:', error)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  const handleUploadAndDetect = async () => {
    if (!selectedFile) return

    setUploading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('layout', selectedFile)
      formData.append('name', layout.name)
      formData.append('autoDetect', 'true')

      const response = await fetch('/api/bartender/layout/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        setLayout(data.layout)
        setPreviewUrl(data.layout.imageUrl)
        setMessage({
          type: 'success',
          text: `Uploaded successfully! Detected ${data.detection?.zonesExtracted || 0} TV zones`
        })
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Upload failed'
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error uploading layout'
      })
    } finally {
      setUploading(false)
    }
  }

  const handleRedetect = async () => {
    if (!layout.imageUrl) return

    setDetecting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/bartender/layout/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: layout.imageUrl })
      })

      const data = await response.json()

      if (data.success) {
        setLayout({ ...layout, zones: data.zones })
        setMessage({
          type: 'success',
          text: `Re-detected ${data.zones.length} TV zones`
        })
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Detection failed'
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error detecting zones'
      })
    } finally {
      setDetecting(false)
    }
  }

  const handleSaveLayout = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/bartender/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout })
      })

      if (response.ok) {
        setMessage({
          type: 'success',
          text: 'Layout saved successfully!'
        })
      } else {
        setMessage({
          type: 'error',
          text: 'Failed to save layout'
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error saving layout'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current || editMode !== 'draw') return

    const rect = imageRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    if (!drawStart) {
      setDrawStart({ x, y })
    } else {
      // Create new zone
      const newZone: Zone = {
        id: `tv${layout.zones.length + 1}`,
        outputNumber: layout.zones.length + 1,
        x: Math.min(drawStart.x, x),
        y: Math.min(drawStart.y, y),
        width: Math.abs(x - drawStart.x),
        height: Math.abs(y - drawStart.y),
        label: `TV ${String(layout.zones.length + 1).padStart(2, '0')}`,
        confidence: 1.0
      }

      setLayout({ ...layout, zones: [...layout.zones, newZone] })
      setDrawStart(null)
      setEditMode('select')
    }
  }

  const handleDeleteZone = (zoneId: string) => {
    setLayout({
      ...layout,
      zones: layout.zones.filter(z => z.id !== zoneId)
    })
    setSelectedZone(null)
  }

  const handleZoneUpdate = (zoneId: string, updates: Partial<Zone>) => {
    setLayout({
      ...layout,
      zones: layout.zones.map(z =>
        z.id === zoneId ? { ...z, ...updates } : z
      )
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            📐 TV Layout Editor
          </h1>
          <p className="text-slate-400">
            Upload your bar layout image and automatically detect TV positions, or draw them manually
          </p>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-900/50 border border-green-700 text-green-200' : 'bg-red-900/50 border border-red-700 text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-1 space-y-4">
            {/* Upload Section */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-3">Upload Layout</h3>

              <input
                type="text"
                value={layout.name}
                onChange={(e) => setLayout({ ...layout, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white mb-3"
                placeholder="Layout name"
              />

              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />

              <label htmlFor="file-upload">
                <div className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer text-center transition-all">
                  <Upload className="w-4 h-4 inline mr-2" />
                  Choose Image
                </div>
              </label>

              {selectedFile && (
                <p className="text-sm text-slate-400 mt-2 truncate">{selectedFile.name}</p>
              )}

              <Button
                onClick={handleUploadAndDetect}
                disabled={!selectedFile || uploading}
                className="w-full mt-3 bg-green-600 hover:bg-green-700"
              >
                {uploading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Scan className="w-4 h-4 mr-2" />}
                Upload & Auto-Detect
              </Button>
            </div>

            {/* Detection Section */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-3">Detection</h3>

              <Button
                onClick={handleRedetect}
                disabled={!layout.imageUrl || detecting}
                variant="outline"
                className="w-full"
              >
                {detecting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Scan className="w-4 h-4 mr-2" />}
                Re-detect Zones
              </Button>

              <div className="mt-3 text-sm text-slate-400">
                <p>Detected: {layout.zones.length} zones</p>
              </div>
            </div>

            {/* Edit Mode Section */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-3">Edit Mode</h3>

              <div className="space-y-2">
                <button
                  onClick={() => setEditMode('select')}
                  className={`w-full px-3 py-2 rounded transition-all ${
                    editMode === 'select' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Select & Edit
                </button>

                <button
                  onClick={() => setEditMode('draw')}
                  className={`w-full px-3 py-2 rounded transition-all ${
                    editMode === 'draw' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Draw New Zone
                </button>
              </div>

              {editMode === 'draw' && (
                <p className="text-xs text-slate-400 mt-2">
                  Click two points on the canvas to draw a rectangle
                </p>
              )}
            </div>

            {/* Save Section */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50">
              <Button
                onClick={handleSaveLayout}
                disabled={saving || layout.zones.length === 0}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Layout
              </Button>
            </div>
          </div>

          {/* Center Panel - Canvas */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-3">
                Layout Preview
                {editMode === 'draw' && drawStart && (
                  <span className="text-sm text-blue-400 ml-2">(Click to complete rectangle)</span>
                )}
              </h3>

              <div
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="relative w-full bg-slate-900 rounded border border-slate-700 overflow-hidden cursor-crosshair"
                style={{ minHeight: '600px' }}
              >
                {previewUrl ? (
                  <>
                    <img
                      ref={imageRef}
                      src={previewUrl}
                      alt="Layout"
                      className="w-full h-auto"
                    />

                    {/* Render zones */}
                    {layout.zones.map((zone) => (
                      <div
                        key={zone.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (editMode === 'select') {
                            setSelectedZone(zone.id)
                          }
                        }}
                        className={`absolute border-2 transition-all ${
                          selectedZone === zone.id
                            ? 'border-blue-500 bg-blue-500/20'
                            : 'border-green-500 bg-green-500/10 hover:bg-green-500/20'
                        }`}
                        style={{
                          left: `${zone.x}%`,
                          top: `${zone.y}%`,
                          width: `${zone.width}%`,
                          height: `${zone.height}%`,
                          cursor: editMode === 'select' ? 'pointer' : 'crosshair'
                        }}
                      >
                        <div className="absolute top-0 left-0 bg-green-600 text-white text-xs px-1 rounded-br">
                          {zone.label}
                        </div>
                      </div>
                    ))}

                    {/* Draw preview */}
                    {drawStart && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div
                          className="absolute border-2 border-dashed border-yellow-500 bg-yellow-500/20"
                          style={{
                            left: `${drawStart.x}%`,
                            top: `${drawStart.y}%`,
                            width: '1px',
                            height: '1px'
                          }}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                    <div className="text-center">
                      <Upload className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>Upload a layout image to begin</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Zone List */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-3">
                Zones ({layout.zones.length})
              </h3>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {layout.zones.map((zone) => (
                  <div
                    key={zone.id}
                    className={`p-3 rounded border transition-all cursor-pointer ${
                      selectedZone === zone.id
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                    }`}
                    onClick={() => setSelectedZone(zone.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{zone.label}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteZone(zone.id)
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {selectedZone === zone.id && (
                      <div className="space-y-2 text-sm">
                        <input
                          type="text"
                          value={zone.label}
                          onChange={(e) => handleZoneUpdate(zone.id, { label: e.target.value })}
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                          placeholder="Label"
                        />

                        <input
                          type="number"
                          value={zone.outputNumber}
                          onChange={(e) => handleZoneUpdate(zone.id, { outputNumber: parseInt(e.target.value) })}
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                          placeholder="Output #"
                        />

                        <div className="grid grid-cols-2 gap-1 text-xs text-slate-400">
                          <div>X: {zone.x.toFixed(1)}%</div>
                          <div>Y: {zone.y.toFixed(1)}%</div>
                          <div>W: {zone.width.toFixed(1)}%</div>
                          <div>H: {zone.height.toFixed(1)}%</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
