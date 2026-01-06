'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { Power, PowerOff, Monitor } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

import { logger } from '@sports-bar/logger'

// Wolf Pack Matrix Models - HDTVSupply
const WOLFPACK_MODELS = [
  // Fixed Size Matrices (Non-Modular)
  { value: 'WP-4X4', label: '4x4 HDMI Matrix', inputs: 4, outputs: 4, series: 'Fixed', resolution: '4K@60Hz' },
  { value: 'WP-4X6', label: '4x6 HDMI Matrix w/Video Wall', inputs: 4, outputs: 6, series: 'Fixed', resolution: '4K@60Hz' },
  { value: 'WP-8X4', label: '8x4 HDMI Matrix w/Scaling', inputs: 8, outputs: 4, series: 'Fixed', resolution: '4K@60Hz' },
  { value: 'WP-8X8', label: '8x8 HDMI Matrix w/Video Wall', inputs: 8, outputs: 8, series: 'Fixed', resolution: '4K@30Hz' },
  { value: 'WP-8X18', label: '8x18 HDMI Matrix w/Dual Monitors', inputs: 8, outputs: 18, series: 'Fixed', resolution: '4K@30Hz' },
  // Modular Chassis - 18x18
  { value: 'WP-18X18', label: '18x18 Modular Chassis (4U)', inputs: 18, outputs: 18, series: 'Modular-18', resolution: '4K@30Hz' },
  { value: 'WP-16X16-18', label: '16x16 in 18x18 Chassis', inputs: 16, outputs: 16, series: 'Modular-18', resolution: '4K@30Hz' },
  { value: 'WP-8X8-18', label: '8x8 in 18x18 Chassis w/Touchscreen', inputs: 8, outputs: 8, series: 'Modular-18', resolution: '4K@30Hz' },
  // Modular Chassis - 36x36
  { value: 'WP-36X36', label: '36x36 Modular Chassis (8U)', inputs: 36, outputs: 36, series: 'Modular-36', resolution: '4K@30Hz' },
  { value: 'WP-32X32-36', label: '32x32 in 36x36 Chassis', inputs: 32, outputs: 32, series: 'Modular-36', resolution: '4K@30Hz' },
  { value: 'WP-24X24-36', label: '24x24 in 36x36 Chassis', inputs: 24, outputs: 24, series: 'Modular-36', resolution: '4K@30Hz' },
  // Large Enterprise
  { value: 'WP-64X64', label: '64x64 Modular Matrix', inputs: 64, outputs: 64, series: 'Enterprise', resolution: '4K@30Hz' },
  { value: 'WP-80X80', label: '80x80 Modular Matrix', inputs: 80, outputs: 80, series: 'Enterprise', resolution: '4K@30Hz' },
]
interface MatrixInput {
  channelNumber: number
  label: string
  inputType: string
  deviceType: string
  status: string
  isActive: boolean
  powerOn: boolean
  isCecPort: boolean
}

interface MatrixOutput {
  channelNumber: number
  label: string
  resolution: string
  status: string
  audioOutput?: string
  isActive: boolean
  powerOn: boolean
  selectedVideoInput?: number
  videoInputLabel?: string
  tvBrand?: string
  tvModel?: string
  cecAddress?: string
}

interface MatrixConfig {
  id?: string
  name: string
  model: string
  ipAddress: string
  port: number
  tcpPort?: number
  udpPort?: number
  protocol: string
  isActive: boolean
  inputs: MatrixInput[]
  outputs: MatrixOutput[]
}

// Helper to get model configuration
const getModelConfig = (model: string) => {
  return WOLFPACK_MODELS.find(m => m.value === model) || WOLFPACK_MODELS.find(m => m.value === 'WP-36X36')!
}

// Helper to generate default inputs for a model
const generateDefaultInputs = (count: number): MatrixInput[] => {
  return Array.from({ length: count }, (_, i) => ({
    channelNumber: i + 1,
    label: `Input ${i + 1}`,
    inputType: 'HDMI',
    deviceType: 'Other',
    status: 'active',
    isActive: true,
    powerOn: false,
    isCecPort: false
  }))
}

// Helper to generate default outputs for a model
const generateDefaultOutputs = (count: number): MatrixOutput[] => {
  return Array.from({ length: count }, (_, i) => ({
    channelNumber: i + 1,
    label: `TV ${String(i + 1).padStart(2, '0')}`,
    resolution: '1080p',
    status: 'active',
    audioOutput: undefined,
    isActive: true,
    powerOn: false
  }))
}

type TabType = 'routing' | 'inputs' | 'outputs'

export default function MatrixControl() {
  const defaultModel = getModelConfig('WP-36X36')
  const [configs, setConfigs] = useState<MatrixConfig[]>([])
  const [currentConfig, setCurrentConfig] = useState<MatrixConfig>({
    name: 'Wolf Pack Matrix',
    model: 'WP-36X36',
    ipAddress: '',
    port: 23,
    tcpPort: 23,
    udpPort: 4000,
    protocol: 'TCP',
    isActive: true,
    inputs: generateDefaultInputs(defaultModel.inputs),
    outputs: generateDefaultOutputs(defaultModel.outputs)
  })
  const [loading, setLoading] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<string>('')
  const [activeTab, setActiveTab] = useState<TabType>('routing')
  const [showVideoInputModal, setShowVideoInputModal] = useState(false)
  const [selectedMatrixOutput, setSelectedMatrixOutput] = useState<number | null>(null)
  const [currentRoutes, setCurrentRoutes] = useState<Map<number, number>>(new Map())
  const [routingStatus, setRoutingStatus] = useState<string>('')

  useEffect(() => {
    loadConfigurations()
    loadRoutes()
  }, [])

  const loadRoutes = async () => {
    try {
      const response = await fetch('/api/matrix/routes')
      if (response.ok) {
        const data = await response.json()
        const routeMap = new Map<number, number>()
        data.routes?.forEach((route: any) => {
          routeMap.set(route.outputNum, route.inputNum)
        })
        setCurrentRoutes(routeMap)
      }
    } catch (error) {
      logger.error('Error loading routes:', error)
    }
  }

  const loadConfigurations = async () => {
    try {
      const response = await fetch('/api/matrix/config')
      if (response.ok) {
        const data = await response.json()
        setConfigs(data.configs || [])
        if (data.config) {
          // Merge loaded config with defaults to ensure all fields exist
          // CRITICAL FIX: Check if arrays have content, not just if they exist
          const hasInputs = data.inputs && data.inputs.length > 0
          const hasOutputs = data.outputs && data.outputs.length > 0
          
          const loadedConfig = {
            ...data.config,
            inputs: hasInputs ? data.inputs.map((input: any) => ({
              ...input,
              powerOn: input.powerOn ?? false,
              isCecPort: input.isCecPort ?? false
            })) : currentConfig.inputs,
            outputs: hasOutputs ? data.outputs.map((output: any) => ({
              ...output,
              powerOn: output.powerOn ?? false
            })) : currentConfig.outputs
          }
          setCurrentConfig(loadedConfig)
        }
      }
    } catch (error) {
      logger.error('Error loading configurations:', error)
      toast.error('Failed to load configurations')
    }
  }

  const saveConfiguration = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/matrix/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: currentConfig,
          inputs: currentConfig.inputs,
          outputs: currentConfig.outputs
        })
      })

      if (response.ok) {
        toast.success('Configuration saved successfully')
        await loadConfigurations()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save configuration')
      }
    } catch (error) {
      logger.error('Error saving configuration:', error)
      toast.error('Failed to save configuration')
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async () => {
    setTestingConnection(true)
    setConnectionStatus('Testing connection...')
    
    try {
      const response = await fetch('/api/matrix/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress: currentConfig.ipAddress,
          port: currentConfig.protocol === 'TCP' ? currentConfig.tcpPort : currentConfig.udpPort,
          protocol: currentConfig.protocol
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setConnectionStatus('✓ Connected successfully')
        toast.success('Connection successful')
      } else {
        setConnectionStatus(`✗ Connection failed: ${data.error}`)
        toast.error('Connection failed')
      }
    } catch (error) {
      setConnectionStatus('✗ Connection error')
      toast.error('Connection test failed')
    } finally {
      setTestingConnection(false)
    }
  }

  const updateInput = (index: number, field: keyof MatrixInput, value: any) => {
    const newInputs = [...currentConfig.inputs]
    newInputs[index] = { ...newInputs[index], [field]: value }
    setCurrentConfig({ ...currentConfig, inputs: newInputs })
  }

  const updateOutput = (index: number, field: keyof MatrixOutput, value: any) => {
    const newOutputs = [...currentConfig.outputs]
    newOutputs[index] = { ...newOutputs[index], [field]: value }
    setCurrentConfig({ ...currentConfig, outputs: newOutputs })
  }

  // Handle model change - resize inputs/outputs to match model
  const handleModelChange = (modelValue: string) => {
    const modelConfig = getModelConfig(modelValue)
    const currentInputCount = currentConfig.inputs.length
    const currentOutputCount = currentConfig.outputs.length

    let newInputs = [...currentConfig.inputs]
    let newOutputs = [...currentConfig.outputs]

    // Adjust inputs
    if (modelConfig.inputs > currentInputCount) {
      // Add new inputs
      for (let i = currentInputCount; i < modelConfig.inputs; i++) {
        newInputs.push({
          channelNumber: i + 1,
          label: `Input ${i + 1}`,
          inputType: 'HDMI',
          deviceType: 'Other',
          status: 'active',
          isActive: true,
          powerOn: false,
          isCecPort: false
        })
      }
    } else if (modelConfig.inputs < currentInputCount) {
      // Trim inputs to model size
      newInputs = newInputs.slice(0, modelConfig.inputs)
    }

    // Adjust outputs
    if (modelConfig.outputs > currentOutputCount) {
      // Add new outputs
      for (let i = currentOutputCount; i < modelConfig.outputs; i++) {
        newOutputs.push({
          channelNumber: i + 1,
          label: `TV ${String(i + 1).padStart(2, '0')}`,
          resolution: '1080p',
          status: 'active',
          audioOutput: undefined,
          isActive: true,
          powerOn: false
        })
      }
    } else if (modelConfig.outputs < currentOutputCount) {
      // Trim outputs to model size
      newOutputs = newOutputs.slice(0, modelConfig.outputs)
    }

    setCurrentConfig({
      ...currentConfig,
      model: modelValue,
      inputs: newInputs,
      outputs: newOutputs
    })

    toast.success(`Model changed to ${modelConfig.label} (${modelConfig.inputs}x${modelConfig.outputs})`)
  }

  const handleVideoInputSelection = async (videoInputNumber: number) => {
    if (!selectedMatrixOutput) return

    try {
      const videoInput = currentConfig.inputs.find(i => i.channelNumber === videoInputNumber)
      if (!videoInput) {
        toast.error('Video input not found')
        return
      }

      const response = await fetch('/api/matrix/video-input-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matrixOutputNumber: selectedMatrixOutput,
          videoInputNumber,
          videoInputLabel: videoInput.label
        })
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message || 'Video input routed successfully')
        
        // Update the local state to reflect the change
        const outputIndex = currentConfig.outputs.findIndex(
          o => o.channelNumber === 32 + selectedMatrixOutput
        )
        if (outputIndex !== -1) {
          updateOutput(outputIndex, 'selectedVideoInput', videoInputNumber)
          updateOutput(outputIndex, 'videoInputLabel', videoInput.label)
          updateOutput(outputIndex, 'label', videoInput.label)
        }
        
        // Trigger refresh of AudioZoneControl to update Matrix labels
        if (typeof (window as any).refreshAudioZoneControl === 'function') {
          (window as any).refreshAudioZoneControl()
        }
        
        setShowVideoInputModal(false)
        setSelectedMatrixOutput(null)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to route video input')
      }
    } catch (error) {
      logger.error('Error routing video input:', error)
      toast.error('Failed to route video input')
    }
  }

  const openVideoInputModal = (matrixOutputNumber: number) => {
    setSelectedMatrixOutput(matrixOutputNumber)
    setShowVideoInputModal(true)
  }

  const handleRouteClick = async (inputNum: number, outputNum: number) => {
    setRoutingStatus(`Routing input ${inputNum} to output ${outputNum}...`)
    try {
      const response = await fetch('/api/matrix/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputNum, output: outputNum })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setRoutingStatus(`✓ Successfully routed input ${inputNum} to output ${outputNum}`)
        toast.success(result.message)
        await loadRoutes() // Reload to show updated routing
      } else {
        setRoutingStatus(`✗ Failed to route: ${result.error || 'Unknown error'}`)
        toast.error(result.error || 'Failed to route signal')
      }
    } catch (error) {
      logger.error('Error routing:', error)
      setRoutingStatus('✗ Error routing signal')
      toast.error('Failed to route signal')
    }

    // Clear status after 3 seconds
    setTimeout(() => setRoutingStatus(''), 3000)
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-lg shadow-xl p-6 border border-slate-700">
        <h2 className="text-2xl font-bold mb-6 text-slate-100">Matrix Configuration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-200">Configuration Name</label>
            <input
              type="text"
              value={currentConfig.name}
              onChange={(e) => setCurrentConfig({ ...currentConfig, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-slate-200">Model</label>
            <select
              value={currentConfig.model}
              onChange={(e) => handleModelChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-100"
            >
              <optgroup label="Fixed Size Matrices">
                {WOLFPACK_MODELS.filter(m => m.series === 'Fixed').map(model => (
                  <option key={model.value} value={model.value}>{model.label}</option>
                ))}
              </optgroup>
              <optgroup label="18x18 Modular Chassis">
                {WOLFPACK_MODELS.filter(m => m.series === 'Modular-18').map(model => (
                  <option key={model.value} value={model.value}>{model.label}</option>
                ))}
              </optgroup>
              <optgroup label="36x36 Modular Chassis">
                {WOLFPACK_MODELS.filter(m => m.series === 'Modular-36').map(model => (
                  <option key={model.value} value={model.value}>{model.label}</option>
                ))}
              </optgroup>
              <optgroup label="Enterprise">
                {WOLFPACK_MODELS.filter(m => m.series === 'Enterprise').map(model => (
                  <option key={model.value} value={model.value}>{model.label}</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Model Info Display */}
        {(() => {
          const selectedModel = getModelConfig(currentConfig.model)
          const seriesBadgeColor: Record<string, string> = {
            'Fixed': 'bg-blue-500/20 text-blue-300 border-blue-500/50',
            'Modular-18': 'bg-green-500/20 text-green-300 border-green-500/50',
            'Modular-36': 'bg-purple-500/20 text-purple-300 border-purple-500/50',
            'Enterprise': 'bg-orange-500/20 text-orange-300 border-orange-500/50'
          }
          return (
            <div className="flex items-center space-x-3 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg mb-6">
              <Monitor className="w-5 h-5 text-indigo-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-indigo-300">
                  {selectedModel.inputs} inputs × {selectedModel.outputs} outputs
                  <Badge className={`ml-2 ${seriesBadgeColor[selectedModel.series]}`}>
                    {selectedModel.series}
                  </Badge>
                  <span className="ml-2 text-xs text-indigo-400/70">
                    {selectedModel.resolution}
                  </span>
                </p>
                <p className="text-xs text-indigo-300/70">
                  {selectedModel.series === 'Fixed' && 'Non-modular fixed-size HDMI matrix with video wall support.'}
                  {selectedModel.series === 'Modular-18' && '18-slot modular chassis (4U) - Configure 8x8 to 18x18 matrices.'}
                  {selectedModel.series === 'Modular-36' && '36-slot modular chassis (8U) - Configure 24x24 to 36x36 matrices.'}
                  {selectedModel.series === 'Enterprise' && 'Large enterprise modular matrix for 64+ endpoints.'}
                </p>
              </div>
            </div>
          )
        })()}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-200">IP Address</label>
            <input
              type="text"
              value={currentConfig.ipAddress}
              onChange={(e) => setCurrentConfig({ ...currentConfig, ipAddress: e.target.value })}
              placeholder="192.168.1.100"
              className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-slate-200">Protocol</label>
            <select
              value={currentConfig.protocol}
              onChange={(e) => setCurrentConfig({ ...currentConfig, protocol: e.target.value })}
              className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-100"
            >
              <option value="TCP">TCP</option>
              <option value="UDP">UDP</option>
            </select>
          </div>

          {currentConfig.protocol === 'TCP' && (
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-200">TCP Port</label>
              <input
                type="number"
                value={currentConfig.tcpPort || 23}
                onChange={(e) => setCurrentConfig({ ...currentConfig, tcpPort: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-100"
              />
              <p className="text-xs text-slate-400 mt-1">Default: 23 (Telnet/Wolfpack standard)</p>
            </div>
          )}

          {currentConfig.protocol === 'UDP' && (
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-200">UDP Port</label>
              <input
                type="number"
                value={currentConfig.udpPort || 4000}
                onChange={(e) => setCurrentConfig({ ...currentConfig, udpPort: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-100"
              />
              <p className="text-xs text-slate-400 mt-1">Default: 4000</p>
            </div>
          )}
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={testConnection}
            disabled={testingConnection || !currentConfig.ipAddress}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
          >
            {testingConnection ? 'Testing...' : 'Test Connection'}
          </button>
          
          <button
            onClick={saveConfiguration}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

        {connectionStatus && (
          <div className={`p-3 rounded-md mb-6 ${
            connectionStatus.includes('✓') ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
          }`}>
            {connectionStatus}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-slate-700 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('routing')}
              className={`px-6 py-3 font-medium transition-colors relative ${
                activeTab === 'routing'
                  ? 'text-green-400 border-b-2 border-green-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Routing Matrix
            </button>
            <button
              onClick={() => setActiveTab('inputs')}
              className={`px-6 py-3 font-medium transition-colors relative ${
                activeTab === 'inputs'
                  ? 'text-indigo-400 border-b-2 border-indigo-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Inputs (1-{currentConfig.inputs.length})
            </button>
            <button
              onClick={() => setActiveTab('outputs')}
              className={`px-6 py-3 font-medium transition-colors relative ${
                activeTab === 'outputs'
                  ? 'text-indigo-400 border-b-2 border-indigo-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Outputs (1-{currentConfig.outputs.length})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[600px]">
          {activeTab === 'routing' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-slate-100">Matrix Routing</h3>
                  <p className="text-sm text-slate-400 mt-1">Click a cell to route an input to an output</p>
                </div>
                <button
                  onClick={loadRoutes}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                >
                  Refresh Routes
                </button>
              </div>

              {routingStatus && (
                <div className={`p-3 rounded-md mb-4 ${
                  routingStatus.includes('✓') ? 'bg-green-900/30 text-green-300' :
                  routingStatus.includes('✗') ? 'bg-red-900/30 text-red-300' :
                  'bg-blue-900/30 text-blue-300'
                }`}>
                  {routingStatus}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-slate-800 border border-slate-700 p-3 text-slate-200 font-semibold sticky left-0 z-10">
                        Out \ In
                      </th>
                      {currentConfig.inputs.slice(0, 32).filter(input => input.isActive && !input.isCecPort).map((input) => (
                        <th key={input.channelNumber} className="bg-slate-800 border border-slate-700 p-2 text-slate-200 text-xs min-w-[80px]">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-bold text-green-400">IN {input.channelNumber}</span>
                            <span className="text-slate-400 text-[10px] truncate max-w-[70px]" title={input.label}>
                              {input.label}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentConfig.outputs.slice(0, 32).filter(output => output.isActive).map((output) => {
                      const currentInput = currentRoutes.get(output.channelNumber)

                      return (
                        <tr key={output.channelNumber}>
                          <td className="bg-slate-800 border border-slate-700 p-2 font-semibold text-slate-200 sticky left-0 z-10 min-w-[120px]">
                            <div className="flex flex-col items-start gap-0.5">
                              <span className="text-indigo-400 font-bold text-sm">OUT {output.channelNumber}</span>
                              <span className="text-slate-300 text-xs truncate max-w-[110px]" title={output.label}>
                                {output.label}
                              </span>
                              {output.channelNumber <= 32 && output.tvModel && (
                                <span className="text-blue-400 text-[10px] truncate max-w-[110px]" title={`${output.tvBrand || ''} ${output.tvModel}`.trim()}>
                                  {output.tvBrand ? `${output.tvBrand} ` : ''}{output.tvModel}
                                </span>
                              )}
                            </div>
                          </td>
                          {currentConfig.inputs.slice(0, 32).filter(input => input.isActive && !input.isCecPort).map((input) => {
                            const isRouted = currentInput === input.channelNumber

                            return (
                              <td
                                key={`${output.channelNumber}-${input.channelNumber}`}
                                className={`border border-slate-700 p-1 text-center cursor-pointer transition-all ${
                                  isRouted
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-slate-900 hover:bg-slate-700'
                                }`}
                                onClick={() => handleRouteClick(input.channelNumber, output.channelNumber)}
                                title={`Route Input ${input.channelNumber} (${input.label}) to Output ${output.channelNumber} (${output.label})`}
                              >
                                {isRouted && (
                                  <div className="flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
                <h4 className="font-semibold text-slate-200 mb-3">Legend</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-slate-300">Active Route</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-slate-900 border border-slate-700 rounded"></div>
                    <span className="text-slate-300">Available Route</span>
                  </div>
                  <div className="text-slate-400">
                    Click any cell to change routing
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inputs' && (
            <div>
              <h3 className="text-xl font-semibold mb-4 text-slate-100">Input Configuration</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {currentConfig.inputs.map((input, index) => (
                  <div key={index} className="bg-slate-800 p-4 rounded-md border border-slate-700 hover:border-slate-600 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-slate-200">Input {input.channelNumber}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateInput(index, 'powerOn', !input.powerOn)}
                          className={`p-1.5 rounded transition-colors ${
                            input.powerOn 
                              ? 'bg-green-600 hover:bg-green-700 text-white' 
                              : 'bg-slate-700 hover:bg-slate-600 text-slate-400'
                          }`}
                          title={input.powerOn ? 'Power On' : 'Power Off'}
                        >
                          {input.powerOn ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                        </button>
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={input.isActive}
                            onChange={(e) => updateInput(index, 'isActive', e.target.checked)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </label>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={input.label}
                      onChange={(e) => updateInput(index, 'label', e.target.value)}
                      placeholder="Label"
                      className="w-full px-3 py-2 text-sm border border-slate-600 rounded bg-slate-900 text-slate-100 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="space-y-2">
                      <select
                        value={input.inputType}
                        onChange={(e) => updateInput(index, 'inputType', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-600 rounded bg-slate-900 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="HDMI">HDMI</option>
                        <option value="Component">Component</option>
                        <option value="Composite">Composite</option>
                      </select>
                      <select
                        value={input.deviceType}
                        onChange={(e) => updateInput(index, 'deviceType', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-600 rounded bg-slate-900 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Cable Box">Cable Box</option>
                        <option value="DirecTV">DirecTV</option>
                        <option value="Fire TV">Fire TV</option>
                        <option value="Other">Other</option>
                      </select>
                      {/* CEC Port checkbox removed - CEC deprecated */}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'outputs' && (
            <div>
              <h3 className="text-xl font-semibold mb-4 text-slate-100">Output Configuration</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {currentConfig.outputs.map((output, index) => {
                  const isMatrixOutput = output.channelNumber >= 33 && output.channelNumber <= 36
                  const matrixNumber = output.channelNumber - 32
                  const isSimpleOutput = false // FIXED: outputs 1-4 are now regular matrix outputs
                  
                  return (
                    <div key={index} className="bg-slate-800 p-4 rounded-md border border-slate-700 hover:border-slate-600 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-200">Output {output.channelNumber}</span>
                          {!isMatrixOutput && output.tvModel && (
                            <span className="text-xs text-blue-400 mt-0.5" title="TV Model">
                              {output.tvBrand ? `${output.tvBrand} ` : ''}{output.tvModel}
                            </span>
                          )}
                        </div>
                        {true && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateOutput(index, 'powerOn', !output.powerOn)}
                              className={`p-1.5 rounded transition-colors ${
                                output.powerOn
                                  ? 'bg-green-600 hover:bg-green-700 text-white'
                                  : 'bg-slate-700 hover:bg-slate-600 text-slate-400'
                              }`}
                              title={output.powerOn ? 'Power On' : 'Power Off'}
                            >
                              {output.powerOn ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                            </button>
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={output.isActive}
                                onChange={(e) => updateOutput(index, 'isActive', e.target.checked)}
                                className="w-4 h-4 cursor-pointer"
                              />
                            </label>
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        value={output.label}
                        onChange={(e) => updateOutput(index, 'label', e.target.value)}
                        placeholder="Label"
                        className="w-full px-3 py-2 text-sm border border-slate-600 rounded bg-slate-900 text-slate-100 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="space-y-2">
                        <select
                          value={output.resolution}
                          onChange={(e) => updateOutput(index, 'resolution', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-600 rounded bg-slate-900 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          disabled={false}
                        >
                          <option value="1080p">1080p</option>
                          <option value="4K">4K</option>
                          <option value="720p">720p</option>
                        </select>
                        
                        {/* Video Input Selection for Matrix Outputs (33-36) */}
                        {isMatrixOutput && (
                          <div className="mt-3 p-3 bg-slate-900 rounded border border-indigo-500/30">
                            <div className="text-xs font-semibold text-indigo-400 mb-2">
                              Matrix {matrixNumber} Audio Routing
                            </div>
                            <button
                              onClick={() => openVideoInputModal(matrixNumber)}
                              className="w-full px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
                            >
                              {output.videoInputLabel
                                ? `Video: ${output.videoInputLabel}`
                                : 'Select Video Input'}
                            </button>
                            {output.videoInputLabel && (
                              <div className="mt-2 text-xs text-slate-400">
                                Input #{output.selectedVideoInput} → Matrix {matrixNumber}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video Input Selection Modal */}
      {showVideoInputModal && selectedMatrixOutput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-y-auto border border-slate-700">
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-slate-100">
                    Select Video Input for Matrix {selectedMatrixOutput}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Choose which video input to route to Matrix {selectedMatrixOutput} output
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowVideoInputModal(false)
                    setSelectedMatrixOutput(null)
                  }}
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentConfig.inputs
                  .filter(input => input.isActive && !input.isCecPort)
                  .map((input) => (
                    <button
                      key={input.channelNumber}
                      onClick={() => handleVideoInputSelection(input.channelNumber)}
                      className="bg-slate-900 p-4 rounded-lg border-2 border-slate-700 hover:border-indigo-500 transition-all text-left group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-indigo-400 mb-1">
                            Input {input.channelNumber}
                          </div>
                          <div className="text-lg font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                            {input.label}
                          </div>
                        </div>
                        <div className="ml-2">
                          <svg className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="px-2 py-1 bg-slate-800 rounded">
                            {input.inputType}
                          </span>
                          <span className="px-2 py-1 bg-slate-800 rounded">
                            {input.deviceType}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>

              {currentConfig.inputs.filter(input => input.isActive && !input.isCecPort).length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-lg">No active video inputs available</p>
                  <p className="text-sm mt-2">Configure inputs in the Inputs tab first</p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-6">
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowVideoInputModal(false)
                    setSelectedMatrixOutput(null)
                  }}
                  className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
