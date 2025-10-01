
'use client'

import { useState, useEffect } from 'react'
import { Tv, Upload, RotateCcw, Zap, Radio, Brain, MapPin } from 'lucide-react'
import Image from 'next/image'
import AILayoutAnalyzer from './AILayoutAnalyzer'

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
  originalFileUrl?: string
  fileType?: string
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
  const [matrixConfig, setMatrixConfig] = useState<any>(null)
  const [layoutAnalysis, setLayoutAnalysis] = useState<any>(null)
  const [showAIAnalyzer, setShowAIAnalyzer] = useState(false)
  const [uploadedLayoutDescription, setUploadedLayoutDescription] = useState<string>('')

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
          setMatrixConfig(activeConfig)
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

    console.log('Uploading file:', file.name, file.type, file.size)
    
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
        console.log('Upload response data:', data)
        console.log('Setting showAIAnalyzer to true')
        
        // Use converted image for layout display if available (from PDF conversion)
        const displayImageUrl = data.convertedImageUrl || data.imageUrl
        
        const newLayout = {
          ...tvLayout,
          imageUrl: displayImageUrl,
          originalFileUrl: data.imageUrl, // Keep reference to original file
          fileType: data.convertedImageUrl ? 'converted_pdf' : data.fileType
        }
        
        setTVLayout(newLayout)
        await saveTVLayout(newLayout)
        
        // Always show AI analyzer after upload and set description if available
        if (data.description) {
          setUploadedLayoutDescription(data.description)
          console.log('Description set:', data.description.length, 'characters')
        }
        
        // Show conversion success message for PDFs
        if (data.fileType === 'application/pdf' && data.convertedImageUrl) {
          console.log('PDF successfully converted to image for interactive layout')
        }
        
        // Show AI analyzer for all uploaded layouts
        setShowAIAnalyzer(true)
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

  const handleAIAnalysisComplete = async (analysis: any) => {
    console.log('🧠 AI Analysis Complete - Raw Data:', analysis)
    setLayoutAnalysis(analysis)
    
    // Auto-generate TV zones based on AI analysis
    if (analysis.suggestions && analysis.suggestions.length > 0) {
      console.log('🎯 Creating zones from', analysis.suggestions.length, 'suggestions')
      
      const autoGeneratedZones: TVLayoutZone[] = analysis.suggestions.map((suggestion: any, index: number) => {
        const location = analysis.locations.find((loc: any) => loc.number === suggestion.tvNumber)
        const zone = {
          id: `zone-${suggestion.tvNumber}`,
          outputNumber: suggestion.outputNumber,
          x: location?.position.x || (10 + (index % 5) * 18),
          y: location?.position.y || (10 + Math.floor(index / 5) * 20),
          width: 8,
          height: 6,
          label: suggestion.label
        }
        console.log(`📍 Zone ${suggestion.tvNumber}:`, zone)
        return zone
      })
      
      const updatedLayout = {
        ...tvLayout,
        zones: autoGeneratedZones
      }
      
      console.log('💾 Saving layout with', autoGeneratedZones.length, 'zones')
      setTVLayout(updatedLayout)
      await saveTVLayout(updatedLayout)
      
      alert(`AI analysis complete! Generated ${autoGeneratedZones.length} TV zones automatically.`)
    } else {
      console.log('❌ No suggestions found in analysis')
    }
    
    setShowAIAnalyzer(false)
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

  // Route selected input to all outputs (Wolf Pack: YAll.)
  const routeInputToAllOutputs = async () => {
    if (!selectedInput) {
      alert('Please select an input source first')
      return
    }
    
    if (connectionStatus !== 'connected' || !matrixConfig) {
      alert('Matrix not connected. Please check connection in Matrix Control.')
      return
    }

    const input = inputs.find(i => i.id === selectedInput)
    if (!input) return

    setIsRouting(true)
    try {
      const port = matrixConfig.protocol === 'UDP' ? (matrixConfig.udpPort || 4000) : (matrixConfig.tcpPort || 5000)
      
      const response = await fetch('/api/matrix/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: `${input.channelNumber}All.`,
          ipAddress: matrixConfig.ipAddress,
          port: port,
          protocol: matrixConfig.protocol || 'TCP'
        })
      })

      if (response.ok) {
        alert(`Successfully routed ${input.label} to all outputs`)
      } else {
        alert('Failed to route to all outputs')
      }
    } catch (error) {
      console.error('Error routing to all outputs:', error)
      alert('Error routing to all outputs')
    } finally {
      setIsRouting(false)
    }
  }

  // Reset all channels to one-to-one (Wolf Pack: All1.)
  const resetToOneToOne = async () => {
    if (connectionStatus !== 'connected' || !matrixConfig) {
      alert('Matrix not connected. Please check connection in Matrix Control.')
      return
    }

    setIsRouting(true)
    try {
      const port = matrixConfig.protocol === 'UDP' ? (matrixConfig.udpPort || 4000) : (matrixConfig.tcpPort || 5000)
      
      const response = await fetch('/api/matrix/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'All1.',
          ipAddress: matrixConfig.ipAddress,
          port: port,
          protocol: matrixConfig.protocol || 'TCP'
        })
      })

      if (response.ok) {
        alert('Successfully reset to one-to-one routing (1→1, 2→2, 3→3...)')
      } else {
        alert('Failed to reset routing')
      }
    } catch (error) {
      console.error('Error resetting routing:', error)
      alert('Error resetting routing')
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
        <h2 className="text-2xl font-bold text-slate-100 mb-2">Bartender Control Panel</h2>
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
              <h3 className="text-lg font-semibold text-slate-100 flex items-center">
                <Radio className="w-5 h-5 mr-2" />
                Input Sources
              </h3>
              <p className="text-sm text-slate-300 mt-1">Click to select an input source</p>
            </div>
            
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {inputs.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Radio className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No custom input sources configured.</p>
                  <p className="text-xs mt-1">Configure input labels in Matrix Control.</p>
                </div>
              ) : (
                <>
                  {inputs.map((input) => (
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
                          <div className="font-medium text-slate-100">{input.label}</div>
                          <div className="text-sm text-slate-400">
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
                  ))}
                  
                  {/* Quick Action Buttons */}
                  <div className="pt-3 border-t border-gray-200 space-y-2">
                    <h4 className="text-sm font-medium text-slate-200 mb-2">Quick Actions</h4>
                    
                    <button
                      onClick={routeInputToAllOutputs}
                      disabled={!selectedInput || isRouting || connectionStatus !== 'connected'}
                      className="w-full px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <Tv className="w-4 h-4 mr-2" />
                      Route to All TVs
                    </button>
                    
                    <button
                      onClick={resetToOneToOne}
                      disabled={isRouting || connectionStatus !== 'connected'}
                      className="w-full px-3 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset to 1:1
                    </button>
                    
                    {selectedInput && (
                      <button
                        onClick={() => setSelectedInput(null)}
                        className="w-full px-3 py-2 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600"
                      >
                        Clear Selection
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* TV Layout Panel */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 h-full">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100 flex items-center">
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
                    onClick={() => setShowAIAnalyzer(!showAIAnalyzer)}
                    className={`text-blue-600 hover:text-blue-800 p-2 rounded-lg ${showAIAnalyzer ? 'bg-blue-50' : ''}`}
                    title="AI Layout Analysis"
                    disabled={!tvLayout.imageUrl}
                  >
                    <Brain className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setTVLayout(prev => ({ ...prev, zones: [] }))
                      saveTVLayout({ ...tvLayout, zones: [] })
                    }}
                    className="text-gray-600 hover:text-slate-100"
                    title="Clear TV zones"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-300 mt-1">
                {selectedInput 
                  ? 'Click on TVs to route the selected input' 
                  : 'Select an input source first, then click on TVs to route signal'
                }
              </p>
            </div>
            
            <div className="p-4 h-full">
              {tvLayout.imageUrl ? (
                <div className="relative w-full h-96 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
                  {(tvLayout.imageUrl.toLowerCase().endsWith('.pdf') && tvLayout.fileType === 'application/pdf') ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-600 p-6">
                      <svg className="w-16 h-16 mb-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                      <h3 className="text-lg font-semibold mb-2 text-center">PDF Layout Uploaded</h3>
                      <p className="text-center mb-4 text-sm">
                        PDF files cannot be displayed as interactive layouts. To see your layout with clickable TV zones, please upload an image version (JPG, PNG) of your floor plan.
                      </p>
                      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded">
                        <p className="text-sm text-blue-700">
                          💡 <strong>Good news!</strong> The AI Layout Analyzer can still work with this PDF. Click the brain icon (🧠) above to analyze your layout!
                        </p>
                      </div>
                      <a 
                        href={tvLayout.imageUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        📄 View PDF Layout
                      </a>
                      
                      {/* Show generated zones list for PDFs */}
                      {tvLayout.zones.length > 0 && (
                        <div className="mt-4 w-full">
                          <h4 className="text-sm font-semibold text-slate-200 mb-2">Generated TV Zones:</h4>
                          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                            {tvLayout.zones.map((zone) => (
                              <div
                                key={zone.id}
                                onClick={() => handleZoneClick(zone)}
                                className={`p-2 rounded border text-xs cursor-pointer transition-colors ${
                                  selectedInput 
                                    ? 'border-blue-300 bg-blue-50 hover:bg-blue-100' 
                                    : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                                }`}
                              >
                                <div className="font-medium">Output {zone.outputNumber}</div>
                                <div className="text-gray-600">{zone.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Image
                      src={tvLayout.imageUrl}
                      alt="Bar Layout"
                      fill
                      className="object-contain"
                      onDoubleClick={addTVZone}
                    />
                  )}
                  
                  {/* TV Zone Overlays - only show for image files and converted PDFs */}
                  {!(tvLayout.imageUrl.toLowerCase().endsWith('.pdf') && tvLayout.fileType === 'application/pdf') && tvLayout.zones.map((zone) => (
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
                  
                  {/* Instructions overlay - only show for image files and converted PDFs */}
                  {!(tvLayout.imageUrl.toLowerCase().endsWith('.pdf') && tvLayout.fileType === 'application/pdf') && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      Double-click to add TV zones
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-center">
                    <Tv className="w-16 h-16 mx-auto text-slate-500 mb-4" />
                    <h4 className="text-lg font-medium text-slate-100 mb-2">Upload Your Bar Layout</h4>
                    <p className="text-sm text-slate-300 mb-4">
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

        {/* AI Layout Analyzer Panel */}
        {showAIAnalyzer && (
          <div className="lg:col-span-3 mt-6">
            <AILayoutAnalyzer
              onAnalysisComplete={handleAIAnalysisComplete}
              layoutDescription={uploadedLayoutDescription}
            />
          </div>
        )}
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
            {layoutAnalysis && (
              <span className="text-blue-600 flex items-center space-x-1">
                <Brain className="w-4 h-4" />
                <span>AI analyzed {layoutAnalysis.totalTVs} TV locations</span>
              </span>
            )}
            {tvLayout.zones.length > 0 && (
              <span className="text-purple-600 flex items-center space-x-1">
                <MapPin className="w-4 h-4" />
                <span>{tvLayout.zones.length} TV zones configured</span>
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {isRouting && (
              <div className="flex items-center text-blue-600">
                <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
                Routing signal...
              </div>
            )}
            {tvLayout.imageUrl && !showAIAnalyzer && !layoutAnalysis && (
              <button
                onClick={() => setShowAIAnalyzer(true)}
                className="text-blue-600 hover:text-blue-800 text-xs flex items-center space-x-1"
              >
                <Brain className="w-3 h-3" />
                <span>Analyze with AI</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
