
'use client'

import { useState, useEffect } from 'react'
import { 
  Upload,
  FileImage,
  Brain,
  Trash2,
  MapPin,
  Save,
  CheckCircle,
  AlertCircle,
  Zap,
  Tv
} from 'lucide-react'
import Image from 'next/image'

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

interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  isActive: boolean
}

export default function LayoutConfiguration() {
  const [tvLayout, setTVLayout] = useState<TVLayout>({
    name: 'Bar Layout',
    zones: [] as any[]
  })
  const [inputs, setInputs] = useState<MatrixInput[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState<string>('')
  const [aiAnalysis, setAIAnalysis] = useState<any>(null)
  const [aiInputMapping, setAIInputMapping] = useState<{[key: number]: string}>({})

  useEffect(() => {
    loadTVLayout()
    loadMatrixInputs()
  }, [])

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

  const loadMatrixInputs = async () => {
    try {
      const response = await fetch('/api/matrix/config')
      if (response.ok) {
        const data = await response.json()
        if (data.configs?.length > 0) {
          const activeConfig = data.configs[0]
          const matrixInputs = activeConfig.inputs?.filter((input: MatrixInput) => 
            input.isActive
          ) || []
          setInputs(matrixInputs)
        }
      }
    } catch (error) {
      console.error('Error loading matrix inputs:', error)
    }
  }

  const handleLayoutUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadStatus('Uploading floor plan...')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/bartender/upload-layout', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok) {
        setUploadStatus('✅ Upload successful!')
        
        const newLayout = {
          name: tvLayout.name,
          imageUrl: result.convertedImageUrl || result.imageUrl,
          originalFileUrl: result.imageUrl,
          fileType: result.fileType,
          zones: tvLayout.zones
        }
        
        setTVLayout(newLayout)

        // Save the layout
        await fetch('/api/bartender/layout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout: newLayout })
        })

        // Start AI analysis if description is available
        if (result.description) {
          await analyzeLayoutWithAI(result.description, result.convertedImageUrl || result.imageUrl)
        }
      } else {
        setUploadStatus(`❌ ${result.error}`)
      }
    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus('❌ Upload failed')
    } finally {
      setIsUploading(false)
      setTimeout(() => setUploadStatus(''), 5000)
    }
  }

  const analyzeLayoutWithAI = async (description: string, imageUrl: string) => {
    setIsAnalyzing(true)
    setAnalysisStatus('🤖 AI analyzing layout and mapping inputs...')

    try {
      // Fetch current matrix outputs
      const matrixResponse = await fetch('/api/matrix/config')
      let matrixOutputs = 36
      let availableOutputs: any[] = []

      if (matrixResponse.ok) {
        const matrixData = await matrixResponse.json()
        if (matrixData.configs?.length > 0) {
          const config = matrixData.configs[0]
          matrixOutputs = config.outputs?.length || 36
          availableOutputs = config.outputs || []
        }
      }

      const analysisResponse = await fetch('/api/ai/analyze-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layoutDescription: description,
          matrixOutputs,
          availableOutputs,
          imageUrl,
          availableInputs: inputs.map(input => ({
            id: input.id,
            label: input.label,
            channelNumber: input.channelNumber,
            inputType: input.inputType
          }))
        })
      })

      const result = await analysisResponse.json()

      if (analysisResponse.ok) {
        setAIAnalysis(result.analysis)
        
        // Extract AI input mapping suggestions
        if (result.analysis.inputMappingSuggestions) {
          const mappingObj: {[key: number]: string} = {}
          result.analysis.inputMappingSuggestions.forEach((suggestion: any) => {
            mappingObj[suggestion.outputNumber] = suggestion.suggestedInput
          })
          setAIInputMapping(mappingObj)
        }
        
        setAnalysisStatus('✅ AI analysis complete with input mapping!')
        
        // Auto-apply suggestions
        await applyAISuggestions(result.analysis)
      } else {
        setAnalysisStatus(`❌ Analysis failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Analysis error:', error)
      setAnalysisStatus('❌ Analysis failed')
    } finally {
      setIsAnalyzing(false)
      setTimeout(() => setAnalysisStatus(''), 5000)
    }
  }

  const applyAISuggestions = async (analysis: any) => {
    if (!analysis || !analysis.suggestions) return

    const newZones = analysis.suggestions.map((suggestion: any) => ({
      id: `zone-${suggestion.outputNumber}`,
      outputNumber: suggestion.outputNumber,
      x: analysis.locations.find((loc: any) => loc.number === suggestion.tvNumber)?.position.x || 50,
      y: analysis.locations.find((loc: any) => loc.number === suggestion.tvNumber)?.position.y || 50,
      width: 8,
      height: 6,
      label: suggestion.label
    }))

    const updatedLayout = {
      ...tvLayout,
      zones: newZones
    }

    setTVLayout(updatedLayout)
    
    // Save the updated layout
    await fetch('/api/bartender/layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout: updatedLayout })
    })

    setAnalysisStatus(`✅ Placed ${newZones.length} TV zones automatically with AI input mapping!`)
  }

  const clearLayout = async () => {
    const confirmed = confirm('Are you sure you want to clear the current layout?')
    if (!confirmed) return

    const emptyLayout = {
      name: 'Bar Layout',
      zones: [] as any[]
    }

    setTVLayout(emptyLayout)
    setAIAnalysis(null)
    setAIInputMapping({})

    // Save empty layout
    await fetch('/api/bartender/layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout: emptyLayout })
    })

    setUploadStatus('Layout cleared')
    setTimeout(() => setUploadStatus(''), 3000)
  }

  const getInputIcon = (inputType: string) => {
    switch (inputType.toLowerCase()) {
      case 'cable': return '📺'
      case 'satellite': return '🛰️'
      case 'streaming': return '📱'
      case 'gaming': return '🎮'
      default: return '📺'
    }
  }

  return (
    <div className="bg-slate-800 or bg-slate-900 rounded-2xl shadow-lg border border-slate-200">
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-2.5 shadow-lg">
            <FileImage className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Layout Configuration</h2>
            <p className="text-sm text-slate-500">Upload floor plan and configure TV zones with AI assistance</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload & Configuration Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Upload Section */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                <Upload className="mr-2 w-5 h-5" />
                Floor Plan Upload
              </h3>
              
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-orange-400 transition-colors">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleLayoutUpload}
                  disabled={isUploading}
                  className="hidden"
                  id="layout-upload"
                />
                <label
                  htmlFor="layout-upload"
                  className={`cursor-pointer flex flex-col items-center space-y-2 ${
                    isUploading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Upload className="w-8 h-8 text-orange-500" />
                  <div className="font-medium text-slate-700">
                    {isUploading ? 'Uploading...' : 'Upload Floor Plan'}
                  </div>
                  <div className="text-sm text-slate-500">
                    Images and PDFs up to 25MB
                  </div>
                </label>
              </div>

              {/* Status Messages */}
              {uploadStatus && (
                <div className={`mt-3 px-3 py-2 rounded-lg text-sm font-medium ${
                  uploadStatus.includes('❌') 
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {uploadStatus}
                </div>
              )}

              {analysisStatus && (
                <div className={`mt-3 px-3 py-2 rounded-lg text-sm font-medium ${
                  analysisStatus.includes('❌')
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : isAnalyzing
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {analysisStatus}
                </div>
              )}
            </div>

            {/* Current Layout Info */}
            {tvLayout.imageUrl && (
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center">
                  <Tv className="mr-2 w-5 h-5" />
                  Current Layout
                </h3>
                <div className="text-sm text-slate-600 space-y-2">
                  <div className="flex items-center space-x-2">
                    <span>📄</span>
                    <span>{tvLayout.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span>📺</span>
                    <span>{tvLayout.zones.length} TV zones configured</span>
                  </div>
                  {tvLayout.fileType === 'application/pdf' && (
                    <div className="flex items-center space-x-2">
                      <span>🤖</span>
                      <span>AI analyzed PDF layout</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={clearLayout}
                  className="mt-3 w-full px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-all flex items-center justify-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear Layout</span>
                </button>
              </div>
            )}

            {/* AI Analysis Results */}
            {aiAnalysis && (
              <div className="bg-blue-50 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center">
                  <Brain className="mr-2 w-5 h-5 text-blue-600" />
                  AI Analysis Results
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">TVs Detected:</span>
                    <span className="font-medium text-slate-900">{aiAnalysis.totalTVs}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Zones Created:</span>
                    <span className="font-medium text-slate-900">{aiAnalysis.suggestions?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Input Mapping:</span>
                    <span className="font-medium text-green-700">✅ Complete</span>
                  </div>
                </div>
              </div>
            )}

            {/* AI Input Mapping */}
            {Object.keys(aiInputMapping).length > 0 && (
              <div className="bg-purple-50 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center">
                  <Zap className="mr-2 w-5 h-5 text-purple-600" />
                  AI Input Recommendations
                </h3>
                <div className="space-y-2 text-sm">
                  {Object.entries(aiInputMapping).map(([outputNum, inputLabel]) => (
                    <div key={outputNum} className="flex items-center justify-between bg-slate-800 or bg-slate-900 rounded-lg p-2">
                      <span className="text-slate-600">Output {outputNum}:</span>
                      <span className="font-medium text-purple-700">{inputLabel}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Layout Preview */}
          <div className="lg:col-span-2">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                  <MapPin className="mr-2 w-5 h-5" />
                  Layout Preview
                </h3>
                {tvLayout.zones.length > 0 && (
                  <div className="text-sm text-slate-500">
                    {tvLayout.zones.length} TV zones configured
                  </div>
                )}
              </div>

              {tvLayout.imageUrl ? (
                <div className="relative w-full h-96 border border-slate-200 rounded-lg overflow-hidden bg-slate-800 or bg-slate-900">
                  {(tvLayout.imageUrl.toLowerCase().endsWith('.pdf') && tvLayout.fileType === 'application/pdf') ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-6">
                      <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <FileImage className="w-8 h-8 text-blue-600" />
                      </div>
                      <h4 className="text-lg font-semibold mb-2 text-center text-slate-700">PDF Layout Processed</h4>
                      <p className="text-center mb-4 text-sm">
                        AI has analyzed the PDF and configured TV zones with intelligent input mapping
                      </p>
                      <a 
                        href={tvLayout.originalFileUrl || tvLayout.imageUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-blue-100 text-blue-700 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                      >
                        📄 View Original PDF
                      </a>
                    </div>
                  ) : (
                    <Image
                      src={tvLayout.imageUrl}
                      alt="Bar Layout"
                      fill
                      className="object-contain"
                    />
                  )}
                  
                  {/* TV Zone Overlays - Preview Only */}
                  {!(tvLayout.imageUrl.toLowerCase().endsWith('.pdf') && tvLayout.fileType === 'application/pdf') && tvLayout.zones.map((zone) => (
                    <div
                      key={zone.id}
                      className="absolute border-2 border-blue-400 bg-blue-100/50 rounded cursor-default"
                      style={{
                        left: `${zone.x}%`,
                        top: `${zone.y}%`,
                        width: `${zone.width}%`,
                        height: `${zone.height}%`
                      }}
                    >
                      <div className="flex items-center justify-center h-full">
                        <div className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold">
                          {zone.outputNumber}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-96 border-2 border-dashed border-slate-300 rounded-lg">
                  <div className="text-center text-slate-400">
                    <Upload className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <h4 className="text-lg font-medium mb-2 text-slate-500">No Layout Uploaded</h4>
                    <p className="text-sm mb-4">
                      Upload a floor plan to get started with automatic TV zone placement and input mapping
                    </p>
                    <div className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg inline-block">
                      💡 AI will automatically detect TVs and suggest optimal input assignments
                    </div>
                  </div>
                </div>
              )}

              {/* TV Zone Grid for PDF layouts */}
              {(tvLayout.imageUrl?.toLowerCase().endsWith('.pdf') && tvLayout.fileType === 'application/pdf' && tvLayout.zones.length > 0) && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Configured TV Zones:</h4>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2 max-h-32 overflow-y-auto">
                    {tvLayout.zones.map((zone) => (
                      <div
                        key={zone.id}
                        className="p-2 rounded border border-slate-200 bg-slate-800 or bg-slate-900 text-xs"
                      >
                        <div className="font-medium text-slate-700">TV {zone.outputNumber}</div>
                        <div className="text-slate-500 truncate" title={zone.label}>{zone.label}</div>
                        {aiInputMapping[zone.outputNumber] && (
                          <div className="text-purple-600 text-xs mt-1">
                            🤖 {aiInputMapping[zone.outputNumber]}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
