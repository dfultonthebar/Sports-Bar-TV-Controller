
'use client'

import { useState, useEffect } from 'react'
import { Tv, Upload, RotateCcw, Zap, Radio } from 'lucide-react'
import Image from 'next/image'

interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  isActive: boolean
}

interface MatrixOutput {
  id: string
  channelNumber: number
  label: string
  resolution: string
  isActive: boolean
}

interface TVLayoutZone {
  id: string
  outputNumber: number
  x: number
  y: number
  width: number
  height: number
  label?: string
}

interface TVLayout {
  id?: string
  name: string
  imageUrl?: string
  zones: TVLayoutZone[]
}

export default function BartenderInterface() {
  const [inputs, setInputs] = useState<MatrixInput[]>([])
  const [outputs, setOutputs] = useState<MatrixOutput[]>([])
  const [selectedInput, setSelectedInput] = useState<string | null>(null)
  const [tvLayout, setTVLayout] = useState<TVLayout>({
    name: 'Bar Layout',
    zones: []
  })
  const [uploadingImage, setUploadingImage] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected')
  const [isRouting, setIsRouting] = useState(false)

  useEffect(() => {
    fetchMatrixData()
    loadTVLayout()
  }, [])

  const fetchMatrixData = async () => {
    try {
      const response = await fetch('/api/matrix/config')
      if (response.ok) {
        const data = await response.json()
        if (data.configs?.length > 0) {
          const activeConfig = data.configs[0]
          // Only show inputs with custom labels (not default "Input X" format)
          const customInputs = activeConfig.inputs?.filter((input: MatrixInput) => 
            input.label && !input.label.match(/^Input \d+$/) && input.isActive
          ) || []
          
          const activeOutputs = activeConfig.outputs?.filter((output: MatrixOutput) => 
            output.isActive
          ) || []
          
          setInputs(customInputs)
          setOutputs(activeOutputs)
          setConnectionStatus(activeConfig.connectionStatus === 'connected' ? 'connected' : 'disconnected')
        }
      }
    } catch (error) {
      console.error('Error fetching matrix data:', error)
    }
  }

  const loadTVLayout = async () => {
    try {
      const response = await fetch('/api/bartender/layout')
      if (response.ok) {
        const data = await response.json()
        if (data.layout) {
          setTVLayout(data.layout)
        }
      }
    } catch (error) {
      console.error('Error loading TV layout:', error)
    }
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setUploadingImage(true)
    try {
      const response = await fetch('/api/bartender/upload-layout', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setTVLayout(prev => ({
          ...prev,
          imageUrl: data.imageUrl
        }))
        await saveTVLayout({
          ...tvLayout,
          imageUrl: data.imageUrl
        })
      } else {
        alert('Failed to upload image')
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Error uploading image')
    } finally {
      setUploadingImage(false)
    }
  }

  const saveTVLayout = async (layout: TVLayout) => {
    try {
      await fetch('/api/bartender/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout })
      })
    } catch (error) {
      console.error('Error saving TV layout:', error)
    }
  }

  const routeInputToOutput = async (inputNumber: number, outputNumber: number) => {
    if (connectionStatus !== 'connected') {
      alert('Matrix not connected. Please check connection in Matrix Control.')
      return
    }

    setIsRouting(true)
    try {
      const response = await fetch('/api/matrix/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: inputNumber,
          output: outputNumber
        })
      })

      if (response.ok) {
        // Visual feedback for successful routing
        const element = document.querySelector(`[data-output="${outputNumber}"]`)
        if (element) {
          element.classList.add('animate-pulse', 'ring-2', 'ring-green-500')
          setTimeout(() => {
            element.classList.remove('animate-pulse', 'ring-2', 'ring-green-500')
          }, 1000)
        }
      } else {
        alert('Failed to route signal')
      }
    } catch (error) {
      console.error('Error routing signal:', error)
      alert('Error routing signal')
    } finally {
      setIsRouting(false)
    }
  }

  const handleZoneClick = (zone: TVLayoutZone) => {
    if (selectedInput && inputs.length > 0) {
      const input = inputs.find(i => i.id === selectedInput)
      if (input) {
        routeInputToOutput(input.channelNumber, zone.outputNumber)
      }
    } else {
      alert('Please select an input source first')
    }
  }

  const addTVZone = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!tvLayout.imageUrl) return

    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100

    const outputNumber = outputs.length > 0 ? outputs[0].channelNumber : 1
    
    const newZone: TVLayoutZone = {
      id: Date.now().toString(),
      outputNumber,
      x,
      y,
      width: 8,
      height: 6,
      label: `TV ${tvLayout.zones.length + 1}`
    }

    const updatedLayout = {
      ...tvLayout,
      zones: [...tvLayout.zones, newZone]
    }

    setTVLayout(updatedLayout)
    saveTVLayout(updatedLayout)
  }

  return (
    <div className="h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Bartender Control Panel</h2>
        <div className="flex items-center space-x-4 text-sm">
          <div className={`flex items-center space-x-2 ${connectionStatus === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
            <div className={`w-3 h-3 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{connectionStatus === 'connected' ? 'Matrix Connected' : 'Matrix Disconnected'}</span>
          </div>
          <div className="text-gray-600">
            {inputs.length} Input Sources | {outputs.length} TV Outputs
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Input Sources Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Radio className="w-5 h-5 mr-2" />
                Input Sources
              </h3>
              <p className="text-sm text-gray-600 mt-1">Click to select an input source</p>
            </div>
            
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {inputs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Radio className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No custom input sources configured.</p>
                  <p className="text-xs mt-1">Configure input labels in Matrix Control.</p>
                </div>
              ) : (
                inputs.map((input) => (
                  <button
                    key={input.id}
                    onClick={() => setSelectedInput(selectedInput === input.id ? null : input.id)}
                    className={`w-full p-3 text-left rounded-lg border-2 transition-all ${
                      selectedInput === input.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{input.label}</div>
                        <div className="text-sm text-gray-500">
                          Channel {input.channelNumber} • {input.inputType}
                        </div>
                      </div>
                      {selectedInput === input.id && (
                        <div className="text-blue-500">
                          <Zap className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* TV Layout Panel */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 h-full">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Tv className="w-5 h-5 mr-2" />
                  TV Layout
                </h3>
                <div className="flex items-center space-x-3">
                  <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer text-sm font-medium flex items-center">
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingImage ? 'Uploading...' : 'Upload Layout'}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                  </label>
                  <button
                    onClick={() => {
                      setTVLayout(prev => ({ ...prev, zones: [] }))
                      saveTVLayout({ ...tvLayout, zones: [] })
                    }}
                    className="text-gray-600 hover:text-gray-800"
                    title="Clear TV zones"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {selectedInput 
                  ? 'Click on TVs to route the selected input' 
                  : 'Select an input source first, then click on TVs to route signal'
                }
              </p>
            </div>
            
            <div className="p-4 h-full">
              {tvLayout.imageUrl ? (
                <div className="relative w-full h-96 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
                  <Image
                    src={tvLayout.imageUrl}
                    alt="Bar Layout"
                    fill
                    className="object-contain"
                    onDoubleClick={addTVZone}
                  />
                  
                  {/* TV Zone Overlays */}
                  {tvLayout.zones.map((zone) => (
                    <div
                      key={zone.id}
                      data-output={zone.outputNumber}
                      onClick={() => handleZoneClick(zone)}
                      className={`absolute border-2 rounded cursor-pointer transition-all ${
                        selectedInput 
                          ? 'border-blue-500 bg-blue-500/20 hover:bg-blue-500/30' 
                          : 'border-gray-400 bg-gray-400/20'
                      }`}
                      style={{
                        left: `${zone.x}%`,
                        top: `${zone.y}%`,
                        width: `${zone.width}%`,
                        height: `${zone.height}%`
                      }}
                      title={`Output ${zone.outputNumber}: ${zone.label}`}
                    >
                      <div className="flex items-center justify-center h-full">
                        <div className="bg-white/90 px-2 py-1 rounded text-xs font-medium">
                          {zone.outputNumber}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Instructions overlay */}
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    Double-click to add TV zones
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-center">
                    <Tv className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Upload Your Bar Layout</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Upload a photo or floor plan of your bar showing TV locations
                    </p>
                    <label className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg cursor-pointer font-medium">
                      <Upload className="w-4 h-4 mr-2 inline" />
                      Choose Image or PDF
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <span className="font-medium">Status:</span>
            {selectedInput ? (
              <span className="text-green-600">
                {inputs.find(i => i.id === selectedInput)?.label} selected
              </span>
            ) : (
              <span className="text-gray-600">No input selected</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {isRouting && (
              <div className="flex items-center text-blue-600">
                <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
                Routing signal...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
