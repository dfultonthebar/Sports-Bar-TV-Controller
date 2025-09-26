
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { 
  Settings, 
  Upload, 
  Download, 
  Save, 
  Play, 
  FileText, 
  Cpu, 
  Network, 
  Volume2, 
  Mic, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle,
  Zap,
  Activity,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Eye,
  EyeOff,
  Sliders,
  Router,
  AudioLines,
  MessageSquare,
  Clock,
  Music,
  Headphones
} from 'lucide-react'

interface AtlasProcessor {
  id: string
  name: string
  model: string
  ipAddress: string
  port: number
  status: 'online' | 'offline' | 'error'
  zones: number
  inputs: number
  outputs: number
}

interface InputConfig {
  id: number
  name: string
  type: 'microphone' | 'line' | 'dante' | 'zone'
  gainDb: number
  phantom: boolean
  lowcut: boolean
  compressor: boolean
  gate: boolean
  eq: {
    band1: number
    band2: number
    band3: number
  }
  routing: number[]
}

interface OutputConfig {
  id: number
  name: string
  type: 'speaker' | 'dante' | 'zone'
  levelDb: number
  muted: boolean
  delay: number
  eq: {
    band1: number
    band2: number
    band3: number
  }
  compressor: boolean
  limiter: boolean
}

interface SceneConfig {
  id: number
  name: string
  description: string
  inputs: Partial<InputConfig>[]
  outputs: Partial<OutputConfig>[]
  recall_time: number
  created_at: string
}

interface MessageConfig {
  id: number
  name: string
  file: string
  duration: number
  priority: number
  zones: number[]
  volume: number
}

export default function AtlasProgrammingInterface() {
  const [processors, setProcessors] = useState<AtlasProcessor[]>([])
  const [selectedProcessor, setSelectedProcessor] = useState<AtlasProcessor | null>(null)
  const [activeTab, setActiveTab] = useState('inputs')
  const [inputs, setInputs] = useState<InputConfig[]>([])
  const [outputs, setOutputs] = useState<OutputConfig[]>([])
  const [scenes, setScenes] = useState<SceneConfig[]>([])
  const [messages, setMessages] = useState<MessageConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null)

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 5000)
  }

  useEffect(() => {
    fetchProcessors()
  }, [])

  useEffect(() => {
    if (selectedProcessor) {
      fetchConfiguration(selectedProcessor.id)
    }
  }, [selectedProcessor])

  const fetchProcessors = async () => {
    try {
      const response = await fetch('/api/audio-processor')
      if (response.ok) {
        const data = await response.json()
        setProcessors(data.processors || [])
        setLoading(false)
      } else {
        showMessage('Failed to fetch processors', 'error')
      }
    } catch (error) {
      console.error('Error fetching processors:', error)
      showMessage('Failed to connect to server', 'error')
      setLoading(false)
    }
  }

  const fetchConfiguration = async (processorId: string) => {
    try {
      const response = await fetch(`/api/atlas/configuration?processorId=${processorId}`)
      if (response.ok) {
        const config = await response.json()
        setInputs(config.inputs || generateDefaultInputs())
        setOutputs(config.outputs || generateDefaultOutputs())
        setScenes(config.scenes || [])
        setMessages(config.messages || [])
      } else {
        // Generate default configuration if none exists
        setInputs(generateDefaultInputs())
        setOutputs(generateDefaultOutputs())
        setScenes([])
        setMessages([])
      }
    } catch (error) {
      console.error('Error fetching configuration:', error)
      setInputs(generateDefaultInputs())
      setOutputs(generateDefaultOutputs())
      setScenes([])
      setMessages([])
    }
  }

  const generateDefaultInputs = (): InputConfig[] => {
    return Array.from({ length: selectedProcessor?.inputs || 8 }, (_, i) => ({
      id: i + 1,
      name: `Input ${i + 1}`,
      type: i < 4 ? 'microphone' : 'line',
      gainDb: 0,
      phantom: false,
      lowcut: false,
      compressor: false,
      gate: false,
      eq: { band1: 0, band2: 0, band3: 0 },
      routing: []
    }))
  }

  const generateDefaultOutputs = (): OutputConfig[] => {
    return Array.from({ length: selectedProcessor?.outputs || 8 }, (_, i) => ({
      id: i + 1,
      name: `Zone ${i + 1}`,
      type: 'speaker',
      levelDb: -10,
      muted: false,
      delay: 0,
      eq: { band1: 0, band2: 0, band3: 0 },
      compressor: false,
      limiter: true
    }))
  }

  const updateInput = (inputId: number, updates: Partial<InputConfig>) => {
    setInputs(prev => prev.map(input => 
      input.id === inputId ? { ...input, ...updates } : input
    ))
  }

  const updateOutput = (outputId: number, updates: Partial<OutputConfig>) => {
    setOutputs(prev => prev.map(output => 
      output.id === outputId ? { ...output, ...updates } : output
    ))
  }

  const saveConfiguration = async () => {
    if (!selectedProcessor) return

    setSaving(true)
    try {
      const response = await fetch(`/api/atlas/configuration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: selectedProcessor.id,
          inputs,
          outputs,
          scenes,
          messages
        })
      })

      if (response.ok) {
        showMessage('Configuration saved successfully')
      } else {
        const error = await response.json()
        showMessage(error.error || 'Failed to save configuration', 'error')
      }
    } catch (error) {
      console.error('Error saving configuration:', error)
      showMessage('Failed to save configuration', 'error')
    } finally {
      setSaving(false)
    }
  }

  const uploadConfiguration = async () => {
    if (!selectedProcessor) return

    try {
      const response = await fetch(`/api/atlas/upload-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: selectedProcessor.id,
          ipAddress: selectedProcessor.ipAddress,
          inputs,
          outputs,
          scenes
        })
      })

      if (response.ok) {
        showMessage('Configuration uploaded to processor successfully')
      } else {
        const error = await response.json()
        showMessage(error.error || 'Failed to upload configuration', 'error')
      }
    } catch (error) {
      console.error('Error uploading configuration:', error)
      showMessage('Failed to upload configuration', 'error')
    }
  }

  const downloadConfiguration = async () => {
    if (!selectedProcessor) return

    try {
      const response = await fetch(`/api/atlas/download-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: selectedProcessor.id,
          ipAddress: selectedProcessor.ipAddress
        })
      })

      if (response.ok) {
        const config = await response.json()
        setInputs(config.inputs || inputs)
        setOutputs(config.outputs || outputs)
        setScenes(config.scenes || scenes)
        showMessage('Configuration downloaded from processor successfully')
      } else {
        const error = await response.json()
        showMessage(error.error || 'Failed to download configuration', 'error')
      }
    } catch (error) {
      console.error('Error downloading configuration:', error)
      showMessage('Failed to download configuration', 'error')
    }
  }

  const createScene = () => {
    const newScene: SceneConfig = {
      id: scenes.length + 1,
      name: `Scene ${scenes.length + 1}`,
      description: '',
      inputs: inputs.map(input => ({
        id: input.id,
        gainDb: input.gainDb,
        phantom: input.phantom,
        muted: false
      })),
      outputs: outputs.map(output => ({
        id: output.id,
        levelDb: output.levelDb,
        muted: output.muted
      })),
      recall_time: 2,
      created_at: new Date().toISOString()
    }
    setScenes([...scenes, newScene])
  }

  const recallScene = async (sceneId: number) => {
    if (!selectedProcessor) return

    try {
      const response = await fetch(`/api/atlas/recall-scene`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: selectedProcessor.id,
          sceneId
        })
      })

      if (response.ok) {
        showMessage(`Scene ${sceneId} recalled successfully`)
      } else {
        const error = await response.json()
        showMessage(error.error || 'Failed to recall scene', 'error')
      }
    } catch (error) {
      console.error('Error recalling scene:', error)
      showMessage('Failed to recall scene', 'error')
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-xl">
            <Settings className="h-6 w-6 text-blue-600 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-gray-900">Atlas Programming</h1>
            <p className="text-lg text-gray-600">Loading Atlas processor configurations...</p>
          </div>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="text-gray-600">Loading processors...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Message Display */}
      {message && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border-l-4 ${
          message.type === 'success' 
            ? 'bg-emerald-50 border-emerald-400 text-emerald-800' 
            : 'bg-red-50 border-red-400 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-emerald-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600" />
          )}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-xl">
              <Settings className="h-6 w-6 text-purple-600" />
            </div>
            Atlas Programming Interface
          </h1>
          <p className="text-lg text-gray-600">
            Comprehensive Atlas processor programming and configuration
          </p>
        </div>
      </div>

      {/* Processor Selection */}
      {processors.length === 0 ? (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Cpu className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Atlas Processors</h3>
            <p className="text-gray-600 mb-6 max-w-sm mx-auto">
              Add Atlas processors in the Audio Processors tab before accessing programming features.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Processor Selection Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {processors.map((processor) => (
              <Card 
                key={processor.id} 
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg border-2 ${
                  selectedProcessor?.id === processor.id 
                    ? 'border-purple-500 bg-purple-50/50 shadow-lg' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedProcessor(processor)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-gray-900">{processor.name}</h3>
                      <p className="text-sm text-gray-600">{processor.model}</p>
                    </div>
                    <Badge variant={processor.status === 'online' ? 'default' : 'secondary'} className={`
                      ${processor.status === 'online' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : ''}
                      ${processor.status === 'offline' ? 'bg-gray-100 text-gray-800 border-gray-300' : ''}
                      ${processor.status === 'error' ? 'bg-red-100 text-red-800 border-red-300' : ''}
                    `}>
                      {processor.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <Network className="h-3 w-3" />
                      <span>{processor.ipAddress}:{processor.port}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AudioLines className="h-3 w-3" />
                      <span>{processor.inputs} inputs • {processor.outputs} outputs</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Programming Interface */}
          {selectedProcessor && (
            <Card className="border-2 border-purple-100 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl text-purple-900 flex items-center gap-3">
                      <div className="p-2 bg-purple-200 rounded-lg">
                        <Settings className="h-6 w-6 text-purple-700" />
                      </div>
                      Programming: {selectedProcessor.name}
                    </CardTitle>
                    <CardDescription className="text-purple-700 text-base">
                      {selectedProcessor.model} • {selectedProcessor.inputs} inputs • {selectedProcessor.outputs} outputs
                    </CardDescription>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={downloadConfiguration}
                      variant="outline"
                      size="sm"
                      className="border-purple-200 text-purple-700 hover:bg-purple-50"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Config
                    </Button>
                    <Button
                      onClick={saveConfiguration}
                      disabled={saving}
                      variant="outline"
                      size="sm"
                      className="border-purple-200 text-purple-700 hover:bg-purple-50"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Save Config'}
                    </Button>
                    <Button
                      onClick={uploadConfiguration}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload to Processor
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-4 mb-6">
                    <TabsTrigger value="inputs" className="flex items-center gap-2">
                      <Mic className="h-4 w-4" />
                      <span className="hidden sm:inline">Input Config</span>
                      <span className="sm:hidden">Inputs</span>
                    </TabsTrigger>
                    <TabsTrigger value="outputs" className="flex items-center gap-2">
                      <Headphones className="h-4 w-4" />
                      <span className="hidden sm:inline">Output Config</span>
                      <span className="sm:hidden">Outputs</span>
                    </TabsTrigger>
                    <TabsTrigger value="scenes" className="flex items-center gap-2">
                      <Play className="h-4 w-4" />
                      <span className="hidden sm:inline">Scene Recall</span>
                      <span className="sm:hidden">Scenes</span>
                    </TabsTrigger>
                    <TabsTrigger value="messages" className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      <span className="hidden sm:inline">Messages</span>
                      <span className="sm:hidden">Messages</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Input Configuration Tab */}
                  <TabsContent value="inputs" className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-gray-900">Input Configuration</h3>
                      <p className="text-sm text-gray-600">
                        Configure microphone and line inputs, including gain, phantom power, EQ, and routing
                      </p>
                    </div>

                    <div className="space-y-4">
                      {inputs.map((input) => (
                        <Card key={input.id} className="border-l-4 border-l-blue-500">
                          <CardContent className="p-4">
                            <div className="space-y-4">
                              {/* Input Header */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${
                                    input.type === 'microphone' ? 'bg-red-100' : 'bg-blue-100'
                                  }`}>
                                    {input.type === 'microphone' ? (
                                      <Mic className="h-4 w-4 text-red-600" />
                                    ) : (
                                      <AudioLines className="h-4 w-4 text-blue-600" />
                                    )}
                                  </div>
                                  <div>
                                    <Input
                                      value={input.name}
                                      onChange={(e) => updateInput(input.id, { name: e.target.value })}
                                      className="text-lg font-semibold border-0 p-0 h-auto bg-transparent"
                                    />
                                    <select
                                      value={input.type}
                                      onChange={(e) => updateInput(input.id, { type: e.target.value as any })}
                                      className="text-sm text-gray-600 border-0 bg-transparent"
                                    >
                                      <option value="microphone">Microphone</option>
                                      <option value="line">Line Input</option>
                                      <option value="dante">Dante Network</option>
                                      <option value="zone">Zone Feed</option>
                                    </select>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  {input.phantom && (
                                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                      +48V
                                    </Badge>
                                  )}
                                  {input.compressor && (
                                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                                      COMP
                                    </Badge>
                                  )}
                                  {input.gate && (
                                    <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                                      GATE
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Input Controls */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Gain Control */}
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-gray-900">
                                    Gain: {input.gainDb}dB
                                  </label>
                                  <input
                                    type="range"
                                    min="-20"
                                    max="60"
                                    step="1"
                                    value={input.gainDb}
                                    onChange={(e) => updateInput(input.id, { gainDb: parseInt(e.target.value) })}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                  />
                                </div>

                                {/* Processing Controls */}
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-gray-900">Processing</label>
                                  <div className="space-y-1">
                                    {input.type === 'microphone' && (
                                      <label className="flex items-center gap-2 text-sm">
                                        <input
                                          type="checkbox"
                                          checked={input.phantom}
                                          onChange={(e) => updateInput(input.id, { phantom: e.target.checked })}
                                          className="rounded"
                                        />
                                        Phantom Power (+48V)
                                      </label>
                                    )}
                                    <label className="flex items-center gap-2 text-sm">
                                      <input
                                        type="checkbox"
                                        checked={input.lowcut}
                                        onChange={(e) => updateInput(input.id, { lowcut: e.target.checked })}
                                        className="rounded"
                                      />
                                      Low Cut Filter
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                      <input
                                        type="checkbox"
                                        checked={input.compressor}
                                        onChange={(e) => updateInput(input.id, { compressor: e.target.checked })}
                                        className="rounded"
                                      />
                                      Compressor
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                      <input
                                        type="checkbox"
                                        checked={input.gate}
                                        onChange={(e) => updateInput(input.id, { gate: e.target.checked })}
                                        className="rounded"
                                      />
                                      Noise Gate
                                    </label>
                                  </div>
                                </div>

                                {/* EQ Controls */}
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-gray-900">3-Band EQ</label>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="w-12">High:</span>
                                      <input
                                        type="range"
                                        min="-12"
                                        max="12"
                                        step="1"
                                        value={input.eq.band3}
                                        onChange={(e) => updateInput(input.id, { 
                                          eq: { ...input.eq, band3: parseInt(e.target.value) }
                                        })}
                                        className="flex-1 h-1"
                                      />
                                      <span className="w-8">{input.eq.band3}dB</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="w-12">Mid:</span>
                                      <input
                                        type="range"
                                        min="-12"
                                        max="12"
                                        step="1"
                                        value={input.eq.band2}
                                        onChange={(e) => updateInput(input.id, { 
                                          eq: { ...input.eq, band2: parseInt(e.target.value) }
                                        })}
                                        className="flex-1 h-1"
                                      />
                                      <span className="w-8">{input.eq.band2}dB</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="w-12">Low:</span>
                                      <input
                                        type="range"
                                        min="-12"
                                        max="12"
                                        step="1"
                                        value={input.eq.band1}
                                        onChange={(e) => updateInput(input.id, { 
                                          eq: { ...input.eq, band1: parseInt(e.target.value) }
                                        })}
                                        className="flex-1 h-1"
                                      />
                                      <span className="w-8">{input.eq.band1}dB</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Routing Matrix */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-900">Output Routing</label>
                                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                                  {outputs.map((output) => (
                                    <label key={output.id} className="flex items-center gap-1 text-xs">
                                      <input
                                        type="checkbox"
                                        checked={input.routing.includes(output.id)}
                                        onChange={(e) => {
                                          const newRouting = e.target.checked
                                            ? [...input.routing, output.id]
                                            : input.routing.filter(r => r !== output.id)
                                          updateInput(input.id, { routing: newRouting })
                                        }}
                                        className="rounded"
                                      />
                                      Zone {output.id}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Output Configuration Tab */}
                  <TabsContent value="outputs" className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-gray-900">Output Configuration</h3>
                      <p className="text-sm text-gray-600">
                        Configure speaker zones, Dante outputs, and processing parameters
                      </p>
                    </div>

                    <div className="space-y-4">
                      {outputs.map((output) => (
                        <Card key={output.id} className="border-l-4 border-l-green-500">
                          <CardContent className="p-4">
                            <div className="space-y-4">
                              {/* Output Header */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-green-100 rounded-lg">
                                    <Headphones className="h-4 w-4 text-green-600" />
                                  </div>
                                  <div>
                                    <Input
                                      value={output.name}
                                      onChange={(e) => updateOutput(output.id, { name: e.target.value })}
                                      className="text-lg font-semibold border-0 p-0 h-auto bg-transparent"
                                    />
                                    <select
                                      value={output.type}
                                      onChange={(e) => updateOutput(output.id, { type: e.target.value as any })}
                                      className="text-sm text-gray-600 border-0 bg-transparent"
                                    >
                                      <option value="speaker">Speaker Zone</option>
                                      <option value="dante">Dante Output</option>
                                      <option value="zone">Zone Feed</option>
                                    </select>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  {output.muted && (
                                    <Badge variant="secondary" className="bg-red-100 text-red-800">
                                      MUTED
                                    </Badge>
                                  )}
                                  {output.compressor && (
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                      COMP
                                    </Badge>
                                  )}
                                  {output.limiter && (
                                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                                      LIMIT
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Output Controls */}
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {/* Level Control */}
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-gray-900">
                                    Level: {output.levelDb}dB
                                  </label>
                                  <input
                                    type="range"
                                    min="-60"
                                    max="12"
                                    step="1"
                                    value={output.levelDb}
                                    onChange={(e) => updateOutput(output.id, { levelDb: parseInt(e.target.value) })}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                  />
                                </div>

                                {/* Delay Control */}
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-gray-900">
                                    Delay: {output.delay}ms
                                  </label>
                                  <input
                                    type="range"
                                    min="0"
                                    max="1000"
                                    step="1"
                                    value={output.delay}
                                    onChange={(e) => updateOutput(output.id, { delay: parseInt(e.target.value) })}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                  />
                                </div>

                                {/* Processing Controls */}
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-gray-900">Processing</label>
                                  <div className="space-y-1">
                                    <label className="flex items-center gap-2 text-sm">
                                      <input
                                        type="checkbox"
                                        checked={output.muted}
                                        onChange={(e) => updateOutput(output.id, { muted: e.target.checked })}
                                        className="rounded"
                                      />
                                      Mute
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                      <input
                                        type="checkbox"
                                        checked={output.compressor}
                                        onChange={(e) => updateOutput(output.id, { compressor: e.target.checked })}
                                        className="rounded"
                                      />
                                      Compressor
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                      <input
                                        type="checkbox"
                                        checked={output.limiter}
                                        onChange={(e) => updateOutput(output.id, { limiter: e.target.checked })}
                                        className="rounded"
                                      />
                                      Peak Limiter
                                    </label>
                                  </div>
                                </div>

                                {/* EQ Controls */}
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-gray-900">3-Band EQ</label>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="w-12">High:</span>
                                      <input
                                        type="range"
                                        min="-12"
                                        max="12"
                                        step="1"
                                        value={output.eq.band3}
                                        onChange={(e) => updateOutput(output.id, { 
                                          eq: { ...output.eq, band3: parseInt(e.target.value) }
                                        })}
                                        className="flex-1 h-1"
                                      />
                                      <span className="w-8">{output.eq.band3}dB</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="w-12">Mid:</span>
                                      <input
                                        type="range"
                                        min="-12"
                                        max="12"
                                        step="1"
                                        value={output.eq.band2}
                                        onChange={(e) => updateOutput(output.id, { 
                                          eq: { ...output.eq, band2: parseInt(e.target.value) }
                                        })}
                                        className="flex-1 h-1"
                                      />
                                      <span className="w-8">{output.eq.band2}dB</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="w-12">Low:</span>
                                      <input
                                        type="range"
                                        min="-12"
                                        max="12"
                                        step="1"
                                        value={output.eq.band1}
                                        onChange={(e) => updateOutput(output.id, { 
                                          eq: { ...output.eq, band1: parseInt(e.target.value) }
                                        })}
                                        className="flex-1 h-1"
                                      />
                                      <span className="w-8">{output.eq.band1}dB</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Scene Recall Tab */}
                  <TabsContent value="scenes" className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-gray-900">Scene Recall</h3>
                        <p className="text-sm text-gray-600">
                          Save and recall complete system configurations
                        </p>
                      </div>
                      <Button
                        onClick={createScene}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Scene
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {scenes.length === 0 ? (
                        <Card className="border-2 border-dashed border-gray-300">
                          <CardContent className="text-center py-8">
                            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                              <Play className="h-8 w-8 text-gray-400" />
                            </div>
                            <h4 className="text-lg font-semibold text-gray-900 mb-2">No Scenes Created</h4>
                            <p className="text-gray-600 mb-4">
                              Create scenes to save and recall complete system configurations
                            </p>
                            <Button
                              onClick={createScene}
                              variant="outline"
                              className="border-purple-200 text-purple-700 hover:bg-purple-50"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Create First Scene
                            </Button>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid gap-4">
                          {scenes.map((scene) => (
                            <Card key={scene.id} className="border-l-4 border-l-purple-500">
                              <CardContent className="p-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                  <div className="space-y-1">
                                    <h4 className="text-lg font-semibold text-gray-900">{scene.name}</h4>
                                    <p className="text-sm text-gray-600">{scene.description}</p>
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        Recall: {scene.recall_time}s
                                      </span>
                                      <span>Created: {new Date(scene.created_at).toLocaleDateString()}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <Button
                                      onClick={() => recallScene(scene.id)}
                                      size="sm"
                                      className="bg-purple-600 hover:bg-purple-700 text-white"
                                    >
                                      <Play className="h-4 w-4 mr-2" />
                                      Recall Scene
                                    </Button>
                                    <Button
                                      onClick={() => {
                                        const newScenes = scenes.filter(s => s.id !== scene.id)
                                        setScenes(newScenes)
                                      }}
                                      variant="outline"
                                      size="sm"
                                      className="text-red-600 border-red-200 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Message Playbook Tab */}
                  <TabsContent value="messages" className="space-y-6">
                    <div className="space-y-1">
                      <h3 className="text-xl font-semibold text-gray-900">Message Playbook</h3>
                      <p className="text-sm text-gray-600">
                        Manage recorded messages and announcements for automatic or manual playback
                      </p>
                    </div>

                    <Card className="border-2 border-dashed border-gray-300">
                      <CardContent className="text-center py-8">
                        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                          <MessageSquare className="h-8 w-8 text-gray-400" />
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">Message Playbook</h4>
                        <p className="text-gray-600 mb-4">
                          Upload and configure pre-recorded messages for automatic playback
                        </p>
                        <Button variant="outline" className="border-gray-300">
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Message Files
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
