
'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { Power, PowerOff } from 'lucide-react'

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
}

interface MatrixConfig {
  id?: string
  name: string
  ipAddress: string
  port: number
  tcpPort?: number
  udpPort?: number
  protocol: string
  isActive: boolean
  inputs: MatrixInput[]
  outputs: MatrixOutput[]
}

type TabType = 'inputs' | 'outputs'

export default function MatrixControl() {
  const [configs, setConfigs] = useState<MatrixConfig[]>([])
  const [currentConfig, setCurrentConfig] = useState<MatrixConfig>({
    name: 'Wolf Pack Matrix',
    ipAddress: '',
    port: 23,
    tcpPort: 23,
    udpPort: 4000,
    protocol: 'TCP',
    isActive: true,
    inputs: Array.from({ length: 36 }, (_, i) => ({
      channelNumber: i + 1,
      label: i < 17 ? `Input ${i + 1}` : 
             i < 32 ? `Additional Input ${i - 16}` :
             `Matrix ${i - 31}`,
      inputType: 'HDMI',
      deviceType: 'Other',
      status: 'active',
      isActive: true,
      powerOn: false,
      isCecPort: false
    })),
    outputs: Array.from({ length: 36 }, (_, i) => ({
      channelNumber: i + 1,
      label: i < 4 ? `TV ${String(i + 1).padStart(2, '0')}` :
             i < 29 ? `TV ${String(i - 3 + 4).padStart(2, '0')}` :
             i < 32 ? `Additional TV ${i - 23}` :
             i >= 32 ? `Matrix ${i - 31}` : `Additional Output ${i - 31}`,
      resolution: '1080p',
      status: 'active',
      audioOutput: i < 4 ? `Matrix ${i + 1}` : undefined,
      isActive: true,
      powerOn: false
    }))
  })
  const [loading, setLoading] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<string>('')
  const [activeTab, setActiveTab] = useState<TabType>('inputs')
  const [showVideoInputModal, setShowVideoInputModal] = useState(false)
  const [selectedMatrixOutput, setSelectedMatrixOutput] = useState<number | null>(null)

  useEffect(() => {
    loadConfigurations()
  }, [])

  const loadConfigurations = async () => {
    try {
      const response = await fetch('/api/matrix/config')
      if (response.ok) {
        const data = await response.json()
        setConfigs(data.configs || [])
        if (data.config) {
          // Merge loaded config with defaults to ensure all fields exist
          const loadedConfig = {
            ...data.config,
            inputs: data.inputs?.map((input: any) => ({
              ...input,
              powerOn: input.powerOn ?? false,
              isCecPort: input.isCecPort ?? false
            })) || currentConfig.inputs,
            outputs: data.outputs?.map((output: any) => ({
              ...output,
              powerOn: output.powerOn ?? false
            })) || currentConfig.outputs
          }
          setCurrentConfig(loadedConfig)
        }
      }
    } catch (error) {
      console.error('Error loading configurations:', error)
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
      console.error('Error saving configuration:', error)
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
      console.error('Error routing video input:', error)
      toast.error('Failed to route video input')
    }
  }

  const openVideoInputModal = (matrixOutputNumber: number) => {
    setSelectedMatrixOutput(matrixOutputNumber)
    setShowVideoInputModal(true)
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
              onClick={() => setActiveTab('inputs')}
              className={`px-6 py-3 font-medium transition-colors relative ${
                activeTab === 'inputs'
                  ? 'text-indigo-400 border-b-2 border-indigo-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Inputs (1-36)
            </button>
            <button
              onClick={() => setActiveTab('outputs')}
              className={`px-6 py-3 font-medium transition-colors relative ${
                activeTab === 'outputs'
                  ? 'text-indigo-400 border-b-2 border-indigo-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Outputs (1-36)
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[600px]">
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
                      <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={input.isCecPort}
                          onChange={(e) => updateInput(index, 'isCecPort', e.target.checked)}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <span>CEC Port (Hidden from Bartender)</span>
                      </label>
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
                        <span className="font-semibold text-slate-200">Output {output.channelNumber}</span>
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
                        
                        {/* Simple outputs (1-4) show only label and resolution */}
                        
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
                        
                        {/* Audio output field for non-simple, non-matrix outputs */}
                        {!isSimpleOutput && !isMatrixOutput && index < 4 && (
                          <input
                            type="text"
                            value={output.audioOutput || ''}
                            onChange={(e) => updateOutput(index, 'audioOutput', e.target.value)}
                            placeholder="Audio Output"
                            className="w-full px-3 py-2 text-sm border border-slate-600 rounded bg-slate-900 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
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
